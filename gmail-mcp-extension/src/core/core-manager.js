/**
 * Gmail MCP Bridge - Core Manager
 * 
 * Based on Linus's philosophy: "Simple integration, powerful result"
 * - Single entry point for all core systems
 * - Clean initialization sequence
 * - Unified API for the entire application
 * - No complex dependency injection, just good composition
 * 
 * @author Gmail MCP Bridge Team  
 * @version 2.0.0
 */

// Import all core components
if (typeof require !== 'undefined') {
  // Node.js environment
  const { SystemState } = require('./system-state.js');
  const { IntelligentErrorHandler } = require('./error-handler.js');
  const { AdaptiveStatusManager } = require('./status-manager.js');
  const { AutoRecoveryEngine } = require('./auto-recovery.js');
  const { HealthChecker } = require('./health-checker.js');
}

/**
 * CoreManager - The unified entry point for all core systems
 * 
 * This replaces the scattered initialization and management code
 * throughout the application. Everything goes through here.
 */
class CoreManager {
  constructor(config = {}) {
    this.config = {
      autoStart: true,
      enableRecovery: true,
      enableMonitoring: true,
      logLevel: 'info',
      ...config
    };
    
    // Core system instances
    this.systemState = null;
    this.errorHandler = null;
    this.statusManager = null;
    this.recoveryEngine = null;
    this.healthChecker = null;
    
    // Initialization state
    this.initialized = false;
    this.starting = false;
    this.startTime = null;
    
    // Global error tracking
    this.globalErrorCount = 0;
    this.lastGlobalError = null;
    
    // Initialize if auto-start is enabled
    if (this.config.autoStart) {
      this._delayedInit();
    }
  }
  
  /**
   * Initialize all core systems
   * Call this once at application startup
   */
  async initialize() {
    if (this.initialized) {
      console.warn('[CoreManager] Already initialized');
      return;
    }
    
    if (this.starting) {
      console.warn('[CoreManager] Initialization already in progress');
      return;
    }
    
    this.starting = true;
    this.startTime = Date.now();
    
    try {
      console.log('[CoreManager] Initializing Gmail MCP Bridge core systems...');
      
      // Step 1: Initialize system state (the foundation)
      console.log('[CoreManager] 1/5 Initializing system state...');
      this.systemState = new SystemState();
      
      // Step 2: Initialize error handler
      console.log('[CoreManager] 2/5 Initializing error handler...');
      this.errorHandler = new IntelligentErrorHandler(this.systemState);
      
      // Step 3: Initialize health checker
      console.log('[CoreManager] 3/5 Initializing health checker...');
      this.healthChecker = new HealthChecker(this.systemState);
      
      // Step 4: Initialize status manager
      console.log('[CoreManager] 4/5 Initializing status manager...');
      this.statusManager = new AdaptiveStatusManager(this.systemState, this.errorHandler);
      
      // Step 5: Initialize recovery engine
      console.log('[CoreManager] 5/5 Initializing recovery engine...');
      this.recoveryEngine = new AutoRecoveryEngine(this.systemState, this.errorHandler);
      
      // Set up global error handling
      this._setupGlobalErrorHandling();
      
      // Start monitoring if enabled
      if (this.config.enableMonitoring) {
        await this.statusManager.startMonitoring();
      }
      
      this.initialized = true;
      this.starting = false;
      
      const initTime = Date.now() - this.startTime;
      console.log(`[CoreManager] Core systems initialized successfully in ${initTime}ms`);
      
      // Record initialization in system state
      this.systemState.updateComponent('coreManager', {
        status: 'running',
        initialized: true,
        initTime: initTime,
        startTime: this.startTime
      });
      
    } catch (error) {
      this.starting = false;
      console.error('[CoreManager] Initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Shutdown all core systems gracefully
   */
  async shutdown() {
    if (!this.initialized) {
      console.warn('[CoreManager] Not initialized, nothing to shutdown');
      return;
    }
    
    console.log('[CoreManager] Shutting down core systems...');
    
    try {
      // Stop monitoring
      if (this.statusManager) {
        this.statusManager.stopMonitoring();
      }
      
      // Update system state
      if (this.systemState) {
        this.systemState.updateComponent('coreManager', {
          status: 'stopped',
          shutdownTime: Date.now()
        });
      }
      
      // Clear references
      this.systemState = null;
      this.errorHandler = null;
      this.statusManager = null;
      this.recoveryEngine = null;
      this.healthChecker = null;
      
      this.initialized = false;
      
      console.log('[CoreManager] Core systems shut down successfully');
      
    } catch (error) {
      console.error('[CoreManager] Shutdown error:', error);
      throw error;
    }
  }
  
  /**
   * Get the unified API interface
   * This is what the rest of the application should use
   */
  getAPI() {
    if (!this.initialized) {
      throw new Error('Core systems not initialized. Call initialize() first.');
    }
    
    return {
      // System state access
      getSystemStatus: () => this.statusManager.getSystemStatus(),
      getComponent: (name) => this.systemState.getComponent(name),
      getAllComponents: () => this.systemState.getAllComponents(),
      
      // Error handling
      handleError: (error, context) => this.errorHandler.handleError(error, context),
      wrapFunction: (fn, context) => this.errorHandler.wrap(fn, context),
      getErrorStats: () => this.errorHandler.getErrorStats(),
      
      // Health checking
      checkHealth: (component) => this.healthChecker.checkComponentHealth(component),
      checkAllHealth: () => this.healthChecker.checkAllComponentsHealth(),
      
      // Recovery
      recoverComponent: (component, error) => this.recoveryEngine.recoverComponent(component, error),
      getRecoveryStats: () => this.recoveryEngine.getRecoveryStats(),
      
      // Status management
      onStatusChange: (callback) => this.statusManager.onStatusChange(callback),
      updateStatus: (component, status, metadata) => 
        this.statusManager.updateComponentStatus(component, status, metadata),
      
      // System control
      refreshAll: () => this.statusManager.refreshAllComponents(),
      exportDiagnostics: () => this._exportDiagnostics()
    };
  }
  
  /**
   * Check if core systems are ready
   */
  isReady() {
    return this.initialized && !this.starting;
  }
  
  /**
   * Get core manager status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      starting: this.starting,
      startTime: this.startTime,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      globalErrorCount: this.globalErrorCount,
      lastGlobalError: this.lastGlobalError,
      memoryUsage: this._getMemoryUsage()
    };
  }
  
  // Private methods
  
  _delayedInit() {
    // Initialize after a short delay to allow the environment to stabilize
    setTimeout(() => {
      this.initialize().catch(error => {
        console.error('[CoreManager] Auto-initialization failed:', error);
      });
    }, 100);
  }
  
  _setupGlobalErrorHandling() {
    // Set up global error handlers to catch unhandled errors
    
    // Unhandled promise rejections
    if (typeof window !== 'undefined') {
      // Browser environment
      window.addEventListener('unhandledrejection', (event) => {
        this._handleGlobalError(event.reason, 'unhandled_promise_rejection');
      });
      
      // Global errors
      window.addEventListener('error', (event) => {
        this._handleGlobalError(event.error, 'global_error');
      });
      
    } else if (typeof process !== 'undefined') {
      // Node.js environment
      process.on('unhandledRejection', (reason, promise) => {
        this._handleGlobalError(reason, 'unhandled_promise_rejection');
      });
      
      process.on('uncaughtException', (error) => {
        this._handleGlobalError(error, 'uncaught_exception');
      });
    }
  }
  
  _handleGlobalError(error, type) {
    this.globalErrorCount++;
    this.lastGlobalError = {
      error: error?.message || String(error),
      type: type,
      timestamp: Date.now()
    };
    
    console.error(`[CoreManager] Global ${type}:`, error);
    
    // Try to handle through error handler if available
    if (this.errorHandler) {
      try {
        this.errorHandler.handleError(error, { 
          component: 'global', 
          type: type 
        });
      } catch (handlerError) {
        console.error('[CoreManager] Error handler failed for global error:', handlerError);
      }
    }
  }
  
  _exportDiagnostics() {
    if (!this.initialized) {
      return { error: 'Core systems not initialized' };
    }
    
    return {
      coreManager: this.getStatus(),
      systemState: this.systemState.exportState(),
      errorHandler: this.errorHandler.getErrorStats(),
      recoveryEngine: this.recoveryEngine.getRecoveryStats(),
      timestamp: Date.now()
    };
  }
  
  _getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      // Node.js environment
      const usage = process.memoryUsage();
      return {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024), // MB
        rss: Math.round(usage.rss / 1024 / 1024) // MB
      };
    } else if (typeof performance !== 'undefined' && performance.memory) {
      // Browser environment (Chrome)
      return {
        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
        jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) // MB
      };
    } else {
      return { unavailable: true };
    }
  }
}

/**
 * Global instance management
 * Provides a singleton pattern for easy access throughout the application
 */
class CoreManagerSingleton {
  constructor() {
    this._instance = null;
  }
  
  getInstance(config) {
    if (!this._instance) {
      this._instance = new CoreManager(config);
    }
    return this._instance;
  }
  
  hasInstance() {
    return this._instance !== null;
  }
  
  destroyInstance() {
    if (this._instance && this._instance.initialized) {
      this._instance.shutdown();
    }
    this._instance = null;
  }
}

const coreManagerSingleton = new CoreManagerSingleton();

// Export for Node.js and browsers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    CoreManager, 
    getCoreManager: (config) => coreManagerSingleton.getInstance(config),
    hasCoreManager: () => coreManagerSingleton.hasInstance(),
    destroyCoreManager: () => coreManagerSingleton.destroyInstance()
  };
} else if (typeof window !== 'undefined') {
  window.CoreManager = CoreManager;
  window.getCoreManager = (config) => coreManagerSingleton.getInstance(config);
  window.hasCoreManager = () => coreManagerSingleton.hasInstance();
  window.destroyCoreManager = () => coreManagerSingleton.destroyInstance();
}

// Auto-initialize in browser if not disabled
if (typeof window !== 'undefined' && !window.DISABLE_AUTO_CORE_INIT) {
  // Initialize core manager when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const coreManager = window.getCoreManager({ autoStart: true });
      console.log('[CoreManager] Auto-initialized from DOM ready');
    });
  } else {
    // DOM already ready
    const coreManager = window.getCoreManager({ autoStart: true });
    console.log('[CoreManager] Auto-initialized immediately');
  }
}