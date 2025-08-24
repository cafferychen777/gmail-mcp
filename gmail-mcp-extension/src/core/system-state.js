/**
 * Gmail MCP Bridge - System State Management
 * 
 * Based on Linus's "good taste" philosophy:
 * - Single source of truth for all system state
 * - No special cases - all components use the same state structure
 * - Data structures first, code follows naturally
 * 
 * @author Gmail MCP Bridge Team
 * @version 2.0.0
 */

/**
 * SystemState - The single source of truth for all system state
 * 
 * Philosophy: "Bad programmers worry about the code. Good programmers worry about data structures."
 * This class eliminates all the scattered state variables across the codebase.
 */
class SystemState {
  constructor() {
    // Component states - all follow the same structure (no special cases!)
    this.components = {
      mcpServer: {
        status: 'unknown',
        lastCheck: null,
        pid: null,
        port: null,
        startTime: null,
        errorCount: 0,
        metadata: {}
      },
      bridgeServer: {
        status: 'unknown', 
        port: 3456,
        lastHeartbeat: null,
        connectedClients: 0,
        pendingRequests: 0,
        errorCount: 0,
        metadata: {}
      },
      chromeExtension: {
        status: 'unknown',
        id: null,
        version: null,
        isConnected: false,
        lastPing: null,
        errorCount: 0,
        metadata: {}
      },
      gmailTabs: {
        status: 'unknown',
        activeTab: null,
        registeredTabs: [],
        accounts: [],
        lastUpdate: null,
        errorCount: 0,
        metadata: {}
      },
      claudeDesktop: {
        status: 'unknown',
        configPath: null,
        version: null,
        isRunning: false,
        lastCheck: null,
        errorCount: 0,
        metadata: {}
      }
    };
    
    // Performance metrics - simple rolling averages, no fancy algorithms
    this.metrics = {
      responseTime: new RollingAverage(100),
      memoryUsage: new RollingAverage(50), 
      errorRate: new RollingAverage(20),
      successRate: new RollingAverage(20),
      uptime: Date.now()
    };
    
    // Error tracking - use Map for O(1) operations
    this.errors = new Map(); // errorId -> ErrorInfo
    this.errorStats = new Map(); // errorType -> count
    
    // Recovery tracking - simple state machine
    this.recovery = new Map(); // componentId -> RecoveryState
    
    // Event watchers - no complex observer pattern, just simple callbacks
    this.watchers = new Map(); // componentId -> Set<callback>
    
    // State validation - prevent data corruption
    this.isValid = true;
    this.lastUpdate = Date.now();
    
    // Initialize component watchers
    this._initializeWatchers();
  }
  
  /**
   * Update component state - the ONLY way to change component state
   * This eliminates all the scattered state updates across the codebase
   */
  updateComponent(componentName, update) {
    if (!this.components[componentName]) {
      throw new Error(`Unknown component: ${componentName}`);
    }
    
    const prev = this.components[componentName];
    const updated = { 
      ...prev, 
      ...update, 
      lastUpdate: Date.now() 
    };
    
    // Validate the update (prevent bad data)
    if (!this._validateComponentState(componentName, updated)) {
      console.error(`Invalid state update for ${componentName}:`, update);
      return false;
    }
    
    this.components[componentName] = updated;
    this.lastUpdate = Date.now();
    
    // Notify watchers - simple, no fancy event system
    this._notifyWatchers(componentName, updated, prev);
    
    return true;
  }
  
  /**
   * Get component state - read-only access
   */
  getComponent(componentName) {
    if (!this.components[componentName]) {
      return null;
    }
    
    // Return a copy to prevent external mutation
    return { ...this.components[componentName] };
  }
  
  /**
   * Get all components - useful for dashboard display
   */
  getAllComponents() {
    const result = {};
    for (const [name, state] of Object.entries(this.components)) {
      result[name] = { ...state };
    }
    return result;
  }
  
  /**
   * Record performance metric - simple rolling average
   */
  recordMetric(name, value) {
    if (this.metrics[name] && typeof this.metrics[name].add === 'function') {
      this.metrics[name].add(value);
    }
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    const result = {};
    for (const [name, metric] of Object.entries(this.metrics)) {
      if (typeof metric === 'object' && metric.getAverage) {
        result[name] = metric.getAverage();
      } else {
        result[name] = metric;
      }
    }
    return result;
  }
  
  /**
   * Record error - centralized error tracking
   */
  recordError(componentName, errorInfo) {
    const errorId = `${componentName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const errorRecord = {
      id: errorId,
      component: componentName,
      message: errorInfo.message || 'Unknown error',
      code: errorInfo.code || 'UNKNOWN_ERROR',
      timestamp: Date.now(),
      stack: errorInfo.stack,
      severity: errorInfo.severity || 'error',
      metadata: errorInfo.metadata || {}
    };
    
    // Store error record
    this.errors.set(errorId, errorRecord);
    
    // Update error stats
    const errorType = errorInfo.code || 'UNKNOWN_ERROR';
    this.errorStats.set(errorType, (this.errorStats.get(errorType) || 0) + 1);
    
    // Update component error count
    if (this.components[componentName]) {
      this.components[componentName].errorCount++;
      this.components[componentName].lastError = errorRecord;
    }
    
    // Clean up old errors (keep last 100)
    if (this.errors.size > 100) {
      const oldestId = this.errors.keys().next().value;
      this.errors.delete(oldestId);
    }
    
    return errorId;
  }
  
  /**
   * Get recent errors for a component
   */
  getComponentErrors(componentName, limit = 10) {
    const componentErrors = [];
    for (const error of this.errors.values()) {
      if (error.component === componentName) {
        componentErrors.push(error);
      }
    }
    
    return componentErrors
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * Get system health summary - simple boolean logic
   */
  getHealthSummary() {
    const now = Date.now();
    const components = this.getAllComponents();
    let healthyCount = 0;
    let totalCount = 0;
    const unhealthyComponents = [];
    
    for (const [name, state] of Object.entries(components)) {
      totalCount++;
      
      // Simple health check - component is healthy if:
      // 1. Status is 'running' or 'connected' or 'active'
      // 2. Last update was within reasonable time
      // 3. Error count is not too high
      const isHealthy = (
        ['running', 'connected', 'active', 'ready'].includes(state.status) &&
        (now - (state.lastUpdate || 0)) < 60000 && // Updated within 1 minute
        state.errorCount < 5 // Less than 5 errors
      );
      
      if (isHealthy) {
        healthyCount++;
      } else {
        unhealthyComponents.push({
          name,
          status: state.status,
          lastUpdate: state.lastUpdate,
          errorCount: state.errorCount,
          issue: this._identifyHealthIssue(state, now)
        });
      }
    }
    
    return {
      isHealthy: healthyCount === totalCount,
      healthyCount,
      totalCount,
      healthPercentage: totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0,
      unhealthyComponents,
      lastCheck: now
    };
  }
  
  /**
   * Watch component changes - simple callback registration
   */
  watchComponent(componentName, callback) {
    if (!this.watchers.has(componentName)) {
      this.watchers.set(componentName, new Set());
    }
    
    this.watchers.get(componentName).add(callback);
    
    // Return unwatch function
    return () => {
      const watchers = this.watchers.get(componentName);
      if (watchers) {
        watchers.delete(callback);
        if (watchers.size === 0) {
          this.watchers.delete(componentName);
        }
      }
    };
  }
  
  /**
   * Export state for debugging/logging
   */
  exportState() {
    return {
      components: this.getAllComponents(),
      metrics: this.getMetrics(),
      errorStats: Object.fromEntries(this.errorStats),
      health: this.getHealthSummary(),
      timestamp: Date.now()
    };
  }
  
  // Private methods
  
  _initializeWatchers() {
    // Set up internal state watchers - keep it simple
    this.watchComponent('mcpServer', (newState, oldState) => {
      if (newState.status !== oldState.status) {
        console.log(`MCP Server status changed: ${oldState.status} -> ${newState.status}`);
      }
    });
    
    this.watchComponent('bridgeServer', (newState, oldState) => {
      if (newState.status !== oldState.status) {
        console.log(`Bridge Server status changed: ${oldState.status} -> ${newState.status}`);
      }
    });
  }
  
  _validateComponentState(componentName, state) {
    // Basic validation - prevent obviously bad data
    if (!state || typeof state !== 'object') return false;
    if (!state.status || typeof state.status !== 'string') return false;
    if (state.errorCount !== undefined && typeof state.errorCount !== 'number') return false;
    
    return true;
  }
  
  _notifyWatchers(componentName, newState, oldState) {
    const watchers = this.watchers.get(componentName);
    if (!watchers) return;
    
    // Call watchers with error handling
    for (const callback of watchers) {
      try {
        callback(newState, oldState);
      } catch (error) {
        console.error(`Watcher error for ${componentName}:`, error);
        // Don't let watcher errors break the state update
      }
    }
  }
  
  _identifyHealthIssue(state, now) {
    if (!['running', 'connected', 'active', 'ready'].includes(state.status)) {
      return `Bad status: ${state.status}`;
    }
    
    if ((now - (state.lastUpdate || 0)) > 60000) {
      return 'Not updated recently';
    }
    
    if (state.errorCount >= 5) {
      return `Too many errors: ${state.errorCount}`;
    }
    
    return 'Unknown issue';
  }
}

/**
 * RollingAverage - Simple rolling average implementation
 * No fancy algorithms, just a circular buffer
 */
class RollingAverage {
  constructor(size) {
    this.size = size;
    this.buffer = [];
    this.index = 0;
    this.full = false;
  }
  
  add(value) {
    if (typeof value !== 'number' || !isFinite(value)) return;
    
    this.buffer[this.index] = value;
    this.index = (this.index + 1) % this.size;
    
    if (this.index === 0) {
      this.full = true;
    }
  }
  
  getAverage() {
    if (this.buffer.length === 0) return 0;
    
    const count = this.full ? this.size : this.index;
    if (count === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < count; i++) {
      sum += this.buffer[i] || 0;
    }
    
    return sum / count;
  }
  
  getCount() {
    return this.full ? this.size : this.index;
  }
  
  clear() {
    this.buffer = [];
    this.index = 0;
    this.full = false;
  }
}

// Export for Node.js and browsers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SystemState, RollingAverage };
} else if (typeof window !== 'undefined') {
  window.SystemState = SystemState;
  window.RollingAverage = RollingAverage;
}