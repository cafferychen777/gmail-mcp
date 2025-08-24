/**
 * Gmail MCP Bridge - Enhanced Status Manager
 * 
 * Based on Linus's philosophy: "Real-time status, simple design"
 * - Single state manager for entire system
 * - Automatic health monitoring with predictive capabilities
 * - Simple event-driven updates
 * - Integrated recovery and prediction systems
 * 
 * @author Gmail MCP Bridge Team
 * @version 3.0.0 - Enhanced with predictive monitoring
 */

// Import enhanced recovery and prediction systems
import { SimpleRecoveryEngine } from './auto-recovery.js';
import { PredictiveMonitor } from './predictive-monitor.js';
import { HealthChecker } from './health-checker.js';

/**
 * EnhancedStatusManager - Centralized status monitoring with predictive capabilities
 * 
 * This replaces all scattered status checks with unified monitoring,
 * predictive issue detection, and automatic recovery.
 */
class EnhancedStatusManager {
  constructor(systemState, errorHandler) {
    this.systemState = systemState;
    this.errorHandler = errorHandler;
    
    // Initialize enhanced health checker
    this.healthChecker = new HealthChecker(systemState);
    
    // Initialize simplified recovery engine
    this.recoveryEngine = new SimpleRecoveryEngine(systemState, errorHandler);
    
    // Initialize predictive monitor
    this.predictiveMonitor = new PredictiveMonitor(systemState, this.healthChecker);
    
    // Legacy health checker map for backward compatibility
    this.healthCheckers = new Map();
    this.checkIntervals = new Map();
    this.runningChecks = new Map();
    
    // Event system for status changes
    this.statusListeners = new Set();
    
    // Monitor configuration
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.checkCycle = 0;
    
    // Last health check timestamp
    this.lastHealthCheck = 0;
    
    // Initialize legacy health checkers for backward compatibility
    this._initializeHealthCheckers();
    
    // Set up system state watchers with enhanced recovery
    this._setupEnhancedStateWatchers();
    
    console.log('[EnhancedStatusManager] Initialized with predictive monitoring and simplified recovery');
  }
  
  /**
   * Start enhanced monitoring with predictive capabilities
   * This is the main entry point - call once to start everything
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('Enhanced status monitoring already running');
      return;
    }
    
    console.log('Starting enhanced status monitoring with predictive capabilities...');
    this.isMonitoring = true;
    
    // Initial health check for all components
    await this._performEnhancedInitialChecks();
    
    // Start periodic monitoring
    this._startEnhancedPeriodicChecks();
    
    // Start predictive monitoring
    this.predictiveMonitor.startMonitoring();
    
    console.log('Enhanced status monitoring started with predictive monitoring active');
  }
  
  /**
   * Stop enhanced monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    console.log('Stopping enhanced status monitoring...');
    this.isMonitoring = false;
    
    // Clear periodic checks
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    // Clear component-specific intervals
    for (const intervalId of this.runningChecks.values()) {
      clearInterval(intervalId);
    }
    this.runningChecks.clear();
    
    // Stop predictive monitoring
    this.predictiveMonitor.stopMonitoring();
    
    console.log('Enhanced status monitoring stopped');
  }
  
  /**
   * Manually trigger health check for a specific component
   */
  async checkComponent(componentName) {
    const checker = this.healthCheckers.get(componentName);
    if (!checker) {
      throw new Error(`No health checker for component: ${componentName}`);
    }
    
    try {
      const result = await checker.check();
      await this._processHealthResult(componentName, result);
      return result;
    } catch (error) {
      await this.errorHandler.handleError(error, { 
        component: componentName, 
        operation: 'health_check' 
      });
      return { healthy: false, error: error.message };
    }
  }
  
  /**
   * Get enhanced system status with predictive information
   */
  async getSystemStatus() {
    // Get comprehensive health status
    const healthStatus = await this.healthChecker.checkAllComponentsHealth();
    
    // Get recovery statistics
    const recoveryStats = this.recoveryEngine.getStats();
    
    // Get predictive status
    const predictiveStatus = this.predictiveMonitor.getCurrentPrediction();
    
    // Legacy system state for compatibility
    const components = this.systemState.getAllComponents();
    const health = this.systemState.getHealthSummary();
    const metrics = this.systemState.getMetrics();
    
    return {
      overall: {
        healthy: healthStatus.systemHealth.healthy,
        healthPercentage: healthStatus.systemHealth.score,
        grade: healthStatus.systemHealth.grade,
        predictiveRisk: predictiveStatus.prediction?.overallRisk || 0,
        uptime: Date.now() - (metrics?.uptime || Date.now())
      },
      components: {
        ...this._formatComponentStatus(components),
        ...healthStatus.components
      },
      recovery: {
        engine: 'SimpleRecoveryEngine',
        stats: recoveryStats,
        enabled: true
      },
      predictive: {
        monitoring: predictiveStatus.monitoring,
        prediction: predictiveStatus.prediction,
        alerts: predictiveStatus.alerts,
        metricsStatus: predictiveStatus.metricsStatus
      },
      metrics: {
        avgResponseTime: Math.round(metrics?.responseTime || 0),
        errorRate: Math.round((metrics?.errorRate || 0) * 100) / 100,
        successRate: Math.round((metrics?.successRate || 1) * 100) / 100
      },
      lastUpdate: Date.now(),
      monitoringActive: this.isMonitoring
    };
  }
  
  /**
   * Subscribe to status change events
   */
  onStatusChange(callback) {
    this.statusListeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.statusListeners.delete(callback);
    };
  }
  
  /**
   * Force refresh all component statuses
   */
  async refreshAllComponents() {
    console.log('Refreshing all component statuses...');
    
    const results = {};
    for (const componentName of this.healthCheckers.keys()) {
      try {
        results[componentName] = await this.checkComponent(componentName);
      } catch (error) {
        results[componentName] = { healthy: false, error: error.message };
      }
    }
    
    return results;
  }
  
  /**
   * Update component status manually (for external integrations)
   */
  updateComponentStatus(componentName, status, metadata = {}) {
    const success = this.systemState.updateComponent(componentName, {
      status: status,
      ...metadata
    });
    
    if (success) {
      this._notifyStatusListeners({
        component: componentName,
        status: status,
        metadata: metadata,
        timestamp: Date.now(),
        source: 'manual'
      });
    }
    
    return success;
  }
  
  // Private methods
  
  _initializeHealthCheckers() {
    // MCP Server health checker
    this.healthCheckers.set('mcpServer', {
      interval: 30000, // 30 seconds
      check: async () => {
        // Check if MCP server process is running and responsive
        // This is a placeholder - real implementation would check actual MCP server
        const isRunning = await this._checkMCPServerProcess();
        return {
          healthy: isRunning,
          details: isRunning ? 'MCP server is running' : 'MCP server not detected',
          metrics: { responseTime: isRunning ? 50 : null }
        };
      }
    });
    
    // Bridge Server health checker
    this.healthCheckers.set('bridgeServer', {
      interval: 15000, // 15 seconds
      check: async () => {
        try {
          const startTime = Date.now();
          const response = await fetch('http://localhost:3456/health', {
            method: 'GET',
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });
          
          const responseTime = Date.now() - startTime;
          const data = await response.json();
          
          return {
            healthy: response.ok,
            details: `Bridge server responsive (${responseTime}ms)`,
            metrics: { 
              responseTime,
              chromeConnected: data.chromeConnected,
              pendingRequests: data.pendingRequests
            }
          };
        } catch (error) {
          return {
            healthy: false,
            details: `Bridge server unreachable: ${error.message}`,
            error: error.message
          };
        }
      }
    });
    
    // Chrome Extension health checker
    this.healthCheckers.set('chromeExtension', {
      interval: 20000, // 20 seconds
      check: async () => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
          return {
            healthy: false,
            details: 'Chrome runtime not available',
            error: 'Not in extension context'
          };
        }
        
        try {
          const startTime = Date.now();
          const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'ping' }, response => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          });
          
          const responseTime = Date.now() - startTime;
          
          return {
            healthy: true,
            details: `Extension responsive (${responseTime}ms)`,
            metrics: { responseTime }
          };
        } catch (error) {
          return {
            healthy: false,
            details: `Extension not responsive: ${error.message}`,
            error: error.message
          };
        }
      }
    });
    
    // Gmail Tabs health checker
    this.healthCheckers.set('gmailTabs', {
      interval: 25000, // 25 seconds
      check: async () => {
        try {
          // This would be implemented differently in content script vs background
          if (typeof chrome !== 'undefined' && chrome.tabs) {
            // Background script context
            const tabs = await chrome.tabs.query({ url: '*://mail.google.com/*' });
            return {
              healthy: tabs.length > 0,
              details: `Found ${tabs.length} Gmail tab(s)`,
              metrics: { tabCount: tabs.length }
            };
          } else if (typeof window !== 'undefined' && window.location) {
            // Content script context
            const isGmail = window.location.hostname.includes('mail.google.com');
            return {
              healthy: isGmail,
              details: isGmail ? 'On Gmail page' : 'Not on Gmail page',
              metrics: { url: window.location.href }
            };
          } else {
            return {
              healthy: false,
              details: 'Cannot check Gmail tabs in this context',
              error: 'Invalid context'
            };
          }
        } catch (error) {
          return {
            healthy: false,
            details: `Error checking Gmail tabs: ${error.message}`,
            error: error.message
          };
        }
      }
    });
    
    // Claude Desktop health checker
    this.healthCheckers.set('claudeDesktop', {
      interval: 60000, // 60 seconds (less frequent)
      check: async () => {
        // This is a simplified check - real implementation would verify Claude Desktop config
        try {
          // Check if we can detect Claude Desktop is configured
          const hasConfig = await this._checkClaudeDesktopConfig();
          return {
            healthy: hasConfig,
            details: hasConfig ? 'Claude Desktop configured' : 'Claude Desktop not configured',
            metrics: { configured: hasConfig }
          };
        } catch (error) {
          return {
            healthy: false,
            details: `Error checking Claude Desktop: ${error.message}`,
            error: error.message
          };
        }
      }
    });
  }
  
  async _performInitialChecks() {
    console.log('Performing initial health checks...');
    
    for (const [componentName, checker] of this.healthCheckers) {
      try {
        const result = await checker.check();
        await this._processHealthResult(componentName, result);
      } catch (error) {
        await this.errorHandler.handleError(error, { 
          component: componentName, 
          operation: 'initial_check' 
        });
      }
    }
    
    console.log('Initial health checks completed');
  }
  
  _startPeriodicChecks() {
    // Main monitor loop - simple polling approach
    this.monitorInterval = setInterval(() => {
      this.checkCycle++;
      this._runPeriodicChecks();
    }, 5000); // Check every 5 seconds which component needs checking
    
    console.log('Periodic health checks started');
  }
  
  async _runPeriodicChecks() {
    const now = Date.now();
    
    for (const [componentName, checker] of this.healthCheckers) {
      const component = this.systemState.getComponent(componentName);
      const lastCheck = component?.lastCheck || 0;
      const interval = checker.interval;
      
      // Time to check this component?
      if (now - lastCheck >= interval) {
        try {
          const result = await checker.check();
          await this._processHealthResult(componentName, result);
        } catch (error) {
          await this.errorHandler.handleError(error, { 
            component: componentName, 
            operation: 'periodic_check' 
          });
        }
      }
    }
  }
  
  async _processHealthResult(componentName, result) {
    const now = Date.now();
    
    // Determine status from health result
    let status = 'unknown';
    if (result.healthy === true) {
      status = 'running';
    } else if (result.healthy === false) {
      status = 'error';
    }
    
    // Update component state
    const updates = {
      status: status,
      lastCheck: now,
      healthy: result.healthy,
      details: result.details
    };
    
    // Add metrics if available
    if (result.metrics) {
      updates.metrics = result.metrics;
      
      // Record response time metric
      if (result.metrics.responseTime) {
        this.systemState.recordMetric('responseTime', result.metrics.responseTime);
      }
    }
    
    // Add error info if unhealthy
    if (!result.healthy && result.error) {
      updates.lastError = result.error;
    }
    
    // Update system state
    const success = this.systemState.updateComponent(componentName, updates);
    
    if (success) {
      // Notify listeners
      this._notifyStatusListeners({
        component: componentName,
        status: status,
        healthy: result.healthy,
        details: result.details,
        metrics: result.metrics,
        timestamp: now,
        source: 'health_check'
      });
      
      // Record success/error metric
      this.systemState.recordMetric(result.healthy ? 'successRate' : 'errorRate', 1);
    }
  }
  
  _setupEnhancedStateWatchers() {
    // Watch for status changes and trigger enhanced recovery
    for (const componentName of this.healthCheckers.keys()) {
      this.systemState.watchComponent(componentName, async (newState, oldState) => {
        if (newState.status !== oldState.status) {
          console.log(`[EnhancedStatusManager] ${componentName} status: ${oldState.status} -> ${newState.status}`);
          
          // Trigger enhanced recovery if needed
          if (newState.status === 'error' && oldState.status !== 'error') {
            await this._triggerEnhancedRecovery(componentName, newState, oldState);
          }
        }
      });
    }
  }
  
  async _triggerEnhancedRecovery(componentName, newState, oldState) {
    console.log(`[EnhancedStatusManager] Triggering enhanced recovery for ${componentName}`);
    
    try {
      // Check predictive alerts first
      const prediction = this.predictiveMonitor.getCurrentPrediction();
      if (prediction.prediction && prediction.prediction.overallRisk > 70) {
        console.warn(`[EnhancedStatusManager] High predictive risk (${prediction.prediction.overallRisk}%), taking proactive measures`);
        await this._handlePredictiveAlert(prediction.prediction);
      }
      
      // Map component to error type for simplified recovery
      const errorType = this._mapComponentToErrorType(componentName);
      
      // Attempt recovery with simplified engine
      const recoveryResult = await this.recoveryEngine.recover(errorType, {
        component: componentName,
        previousState: oldState,
        currentState: newState,
        timestamp: Date.now()
      });
      
      console.log(`[EnhancedStatusManager] Recovery result for ${componentName}:`, recoveryResult);
      
      // Update component state based on recovery result
      if (recoveryResult.success) {
        this.systemState.updateComponent(componentName, {
          ...newState,
          status: 'running',
          healthy: true,
          lastRecovery: Date.now(),
          recoverySuccess: true
        });
        
        // Notify listeners of successful recovery
        this._notifyStatusListeners({
          component: componentName,
          status: 'running',
          healthy: true,
          details: 'Recovered successfully',
          timestamp: Date.now(),
          source: 'enhanced_recovery'
        });
      } else {
        // Recovery failed - update state with failure info
        this.systemState.updateComponent(componentName, {
          ...newState,
          recoveryAttempted: true,
          recoverySuccess: false,
          recoveryError: recoveryResult.error
        });
      }
      
    } catch (error) {
      console.error(`[EnhancedStatusManager] Enhanced recovery failed for ${componentName}:`, error);
      await this.errorHandler.handleError(error, {
        component: componentName,
        operation: 'enhanced_recovery',
        context: { oldState, newState }
      });
    }
  }
  
  /**
   * Map component name to error type for simplified recovery
   */
  _mapComponentToErrorType(componentName) {
    const errorTypeMap = {
      'gmailTabs': 'gmail_tab_lost',
      'bridgeServer': 'bridge_disconnected',
      'mcpServer': 'mcp_server_down',
      'chromeExtension': 'chrome_extension_error',
      'claudeDesktop': 'claude_missing'
    };
    
    return errorTypeMap[componentName] || 'unknown_error';
  }
  
  /**
   * Handle predictive alerts proactively
   */
  async _handlePredictiveAlert(prediction) {
    console.log('[EnhancedStatusManager] Handling predictive alert:', prediction);
    
    // Execute high-priority recommended actions
    for (const action of prediction.recommendedActions || []) {
      if (action.priority === 'critical' || action.priority === 'high') {
        console.log(`[EnhancedStatusManager] Executing ${action.priority} action: ${action.action}`);
        await this._executeRecommendedAction(action);
      }
    }
    
    // If risk is very high, trigger preventive recovery
    if (prediction.overallRisk > 90) {
      console.warn('[EnhancedStatusManager] Very high risk detected, triggering preventive recovery');
      await this._triggerPreventiveRecovery();
    }
  }
  
  /**
   * Execute recommended action from predictive analysis
   */
  async _executeRecommendedAction(action) {
    try {
      switch (action.action) {
        case '重启Bridge服务器和Chrome扩展':
          await this.recoveryEngine.recover('bridge_disconnected');
          await this.recoveryEngine.recover('chrome_extension_error');
          break;
          
        case '立即检查错误日志':
          console.warn('[EnhancedStatusManager] Error spike detected, logging system state');
          const status = await this.getSystemStatus();
          console.warn('Current enhanced system status:', status);
          break;
          
        default:
          console.log(`[EnhancedStatusManager] Manual action required: ${action.action}`);
          break;
      }
    } catch (error) {
      console.error('[EnhancedStatusManager] Failed to execute recommended action:', error);
    }
  }
  
  /**
   * Trigger preventive recovery for critical components
   */
  async _triggerPreventiveRecovery() {
    console.warn('[EnhancedStatusManager] Executing preventive recovery sequence');
    
    const criticalErrorTypes = ['bridge_disconnected', 'chrome_extension_error'];
    
    for (const errorType of criticalErrorTypes) {
      try {
        await this.recoveryEngine.recover(errorType, { preventive: true });
        await this._wait(2000); // Wait 2 seconds between attempts
      } catch (error) {
        console.error(`[EnhancedStatusManager] Preventive recovery failed for ${errorType}:`, error);
      }
    }
  }
  
  /**
   * Enhanced initial checks using new health checker
   */
  async _performEnhancedInitialChecks() {
    console.log('Performing enhanced initial health checks...');
    
    try {
      const healthStatus = await this.healthChecker.checkAllComponentsHealth();
      this.lastHealthCheck = Date.now();
      
      // Update system state with comprehensive health data
      for (const [componentName, result] of Object.entries(healthStatus.components)) {
        this.systemState.updateComponent(componentName, {
          status: result.healthy ? 'running' : 'error',
          healthy: result.healthy,
          details: result.details,
          score: result.score,
          grade: result.grade,
          lastCheck: result.timestamp
        });
      }
      
      console.log('Enhanced initial health checks completed');
    } catch (error) {
      console.error('Enhanced initial health checks failed:', error);
      await this.errorHandler.handleError(error, { operation: 'enhanced_initial_checks' });
    }
  }
  
  /**
   * Enhanced periodic checks
   */
  _startEnhancedPeriodicChecks() {
    // Main monitor loop with enhanced checks
    this.monitorInterval = setInterval(async () => {
      this.checkCycle++;
      
      // Run enhanced health check every 30 seconds
      const now = Date.now();
      if (now - this.lastHealthCheck >= 30000) {
        try {
          const healthStatus = await this.healthChecker.checkAllComponentsHealth();
          this.lastHealthCheck = now;
          
          // Process health results for each component
          for (const [componentName, result] of Object.entries(healthStatus.components)) {
            await this._processEnhancedHealthResult(componentName, result);
          }
        } catch (error) {
          console.error('Enhanced periodic health check failed:', error);
        }
      }
      
      // Run legacy checks for backward compatibility
      await this._runPeriodicChecks();
    }, 10000); // Check every 10 seconds
    
    console.log('Enhanced periodic health checks started');
  }
  
  /**
   * Process enhanced health results
   */
  async _processEnhancedHealthResult(componentName, result) {
    const now = Date.now();
    
    // Determine status from enhanced health result
    const status = result.healthy ? 'running' : 'error';
    
    // Update component state with enhanced data
    const updates = {
      status: status,
      lastCheck: now,
      healthy: result.healthy,
      details: result.details,
      score: result.score,
      grade: result.grade
    };
    
    // Add metrics if available
    if (result.metrics) {
      updates.metrics = result.metrics;
      
      // Record response time metric
      if (result.metrics.responseTime) {
        this.systemState.recordMetric('responseTime', result.metrics.responseTime);
      }
    }
    
    // Add error info if unhealthy
    if (!result.healthy && result.error) {
      updates.lastError = result.error;
    }
    
    // Update system state
    const success = this.systemState.updateComponent(componentName, updates);
    
    if (success) {
      // Notify listeners with enhanced data
      this._notifyStatusListeners({
        component: componentName,
        status: status,
        healthy: result.healthy,
        details: result.details,
        score: result.score,
        grade: result.grade,
        metrics: result.metrics,
        timestamp: now,
        source: 'enhanced_health_check'
      });
      
      // Record success/error metric
      this.systemState.recordMetric(result.healthy ? 'successRate' : 'errorRate', 1);
    }
  }
  
  /**
   * Simple wait utility
   */
  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  _notifyStatusListeners(event) {
    for (const listener of this.statusListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in status listener:', error);
        // Don't let listener errors break the system
      }
    }
  }
  
  _formatComponentStatus(components) {
    const formatted = {};
    
    for (const [name, state] of Object.entries(components)) {
      formatted[name] = {
        status: state.status,
        healthy: state.healthy,
        lastCheck: state.lastCheck,
        details: state.details,
        errorCount: state.errorCount,
        uptime: state.startTime ? Date.now() - state.startTime : null
      };
    }
    
    return formatted;
  }
  
  // Placeholder methods for actual health checks
  // These would be replaced with real implementations
  
  async _checkMCPServerProcess() {
    // Placeholder: check if MCP server process is running
    // Real implementation would check actual process/port
    return true; // Assume running for now
  }
  
  async _checkClaudeDesktopConfig() {
    // Placeholder: check if Claude Desktop is configured
    // Real implementation would check config file
    return false; // Assume not configured for now
  }
}

// Export for Node.js and browsers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EnhancedStatusManager };
} else if (typeof window !== 'undefined') {
  window.EnhancedStatusManager = EnhancedStatusManager;
}