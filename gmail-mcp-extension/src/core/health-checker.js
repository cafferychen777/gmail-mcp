/**
 * Gmail MCP Bridge - Health Checker System
 * 
 * Based on Linus's philosophy: "Keep it simple, keep it working"
 * - Simple health checks, not complex monitoring systems
 * - Boolean health results - either works or doesn't
 * - Fast checks with reasonable timeouts
 * - Clear health scoring algorithm
 * 
 * @author Gmail MCP Bridge Team
 * @version 2.0.0
 */

/**
 * HealthChecker - Centralized health checking for all system components
 * 
 * This provides a unified interface for checking component health.
 * Used by StatusManager for automated monitoring.
 */
class HealthChecker {
  constructor(systemState) {
    this.systemState = systemState;
    
    // Health check registry - Map for O(1) lookups
    this.healthChecks = new Map();
    
    // Health check configuration
    this.config = {
      defaultTimeout: 5000, // 5 seconds
      retryAttempts: 2,
      retryDelay: 1000, // 1 second between retries
      healthScoreWeights: {
        status: 0.4,      // 40% - current status
        responseTime: 0.3, // 30% - performance
        errorRate: 0.2,    // 20% - reliability
        uptime: 0.1       // 10% - stability
      }
    };
    
    // Health score thresholds
    this.healthThresholds = {
      excellent: 90,  // 90-100%
      good: 75,       // 75-89%
      fair: 50,       // 50-74%
      poor: 25,       // 25-49%
      critical: 0     // 0-24%
    };
    
    // Initialize health checks
    this._initializeHealthChecks();
  }
  
  /**
   * Perform health check for a specific component
   * Returns a comprehensive health result
   */
  async checkComponentHealth(componentName) {
    const healthCheck = this.healthChecks.get(componentName);
    if (!healthCheck) {
      return {
        component: componentName,
        healthy: false,
        error: `No health check defined for ${componentName}`,
        score: 0,
        grade: 'unknown'
      };
    }
    
    let result;
    let attempts = 0;
    const maxAttempts = this.config.retryAttempts + 1;
    
    // Retry logic for failed checks
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const checkPromise = healthCheck.check();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 
            healthCheck.timeout || this.config.defaultTimeout)
        );
        
        result = await Promise.race([checkPromise, timeoutPromise]);
        break; // Success, exit retry loop
        
      } catch (error) {
        if (attempts === maxAttempts) {
          // Final attempt failed
          result = {
            healthy: false,
            error: error.message,
            details: `Health check failed after ${maxAttempts} attempts`
          };
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }
    
    // Calculate comprehensive health score
    const healthScore = this._calculateHealthScore(componentName, result);
    const healthGrade = this._getHealthGrade(healthScore);
    
    // Add metadata to result
    const enhancedResult = {
      component: componentName,
      timestamp: Date.now(),
      attempts: attempts,
      ...result,
      score: healthScore,
      grade: healthGrade
    };
    
    // Record metrics
    this._recordHealthMetrics(componentName, enhancedResult);
    
    return enhancedResult;
  }
  
  /**
   * Perform health check for all registered components
   */
  async checkAllComponentsHealth() {
    const results = {};
    const promises = [];
    
    // Run all health checks in parallel
    for (const componentName of this.healthChecks.keys()) {
      promises.push(
        this.checkComponentHealth(componentName).then(result => {
          results[componentName] = result;
        })
      );
    }
    
    await Promise.all(promises);
    
    // Calculate system-wide health summary
    const systemHealth = this._calculateSystemHealth(results);
    
    return {
      timestamp: Date.now(),
      systemHealth: systemHealth,
      components: results
    };
  }
  
  /**
   * Get health check registry information
   */
  getHealthCheckInfo() {
    const info = {};
    
    for (const [componentName, healthCheck] of this.healthChecks) {
      info[componentName] = {
        name: healthCheck.name,
        description: healthCheck.description,
        timeout: healthCheck.timeout || this.config.defaultTimeout,
        critical: healthCheck.critical || false,
        dependencies: healthCheck.dependencies || []
      };
    }
    
    return info;
  }
  
  /**
   * Register a custom health check for a component
   */
  registerHealthCheck(componentName, healthCheckConfig) {
    if (!componentName || !healthCheckConfig || !healthCheckConfig.check) {
      throw new Error('Invalid health check configuration');
    }
    
    this.healthChecks.set(componentName, {
      name: healthCheckConfig.name || componentName,
      description: healthCheckConfig.description || `Health check for ${componentName}`,
      check: healthCheckConfig.check,
      timeout: healthCheckConfig.timeout,
      critical: healthCheckConfig.critical || false,
      dependencies: healthCheckConfig.dependencies || []
    });
    
    console.log(`[HealthChecker] Registered health check for ${componentName}`);
  }
  
  /**
   * Unregister health check for a component
   */
  unregisterHealthCheck(componentName) {
    const removed = this.healthChecks.delete(componentName);
    if (removed) {
      console.log(`[HealthChecker] Unregistered health check for ${componentName}`);
    }
    return removed;
  }
  
  // Private methods
  
  _initializeHealthChecks() {
    // MCP Server Health Check
    this.registerHealthCheck('mcpServer', {
      name: 'MCP Server Process Check',
      description: 'Verifies MCP server process is running and responsive',
      timeout: 8000, // Longer timeout for server checks
      critical: true,
      check: async () => {
        // Check if MCP server process is running
        const isProcessRunning = await this._checkMCPProcess();
        
        if (!isProcessRunning) {
          return {
            healthy: false,
            details: 'MCP server process not found',
            metrics: { processRunning: false }
          };
        }
        
        // Check if MCP server is responsive (if we have a way to ping it)
        const startTime = Date.now();
        const isResponsive = await this._pingMCPServer();
        const responseTime = Date.now() - startTime;
        
        if (!isResponsive) {
          return {
            healthy: false,
            details: 'MCP server not responsive',
            metrics: { processRunning: true, responsive: false, responseTime }
          };
        }
        
        return {
          healthy: true,
          details: `MCP server running and responsive (${responseTime}ms)`,
          metrics: { processRunning: true, responsive: true, responseTime }
        };
      }
    });
    
    // Bridge Server Health Check
    this.registerHealthCheck('bridgeServer', {
      name: 'Bridge Server HTTP Check',
      description: 'Verifies bridge server is accepting HTTP connections',
      timeout: 5000,
      critical: true,
      check: async () => {
        try {
          const startTime = Date.now();
          const response = await fetch('http://localhost:3456/health', {
            method: 'GET',
            signal: AbortSignal.timeout(4000)
          });
          
          const responseTime = Date.now() - startTime;
          
          if (!response.ok) {
            return {
              healthy: false,
              details: `Bridge server returned status ${response.status}`,
              metrics: { httpStatus: response.status, responseTime }
            };
          }
          
          const data = await response.json();
          
          return {
            healthy: true,
            details: `Bridge server healthy (${responseTime}ms)`,
            metrics: {
              httpStatus: 200,
              responseTime,
              chromeConnected: data.chromeConnected,
              pendingRequests: data.pendingRequests,
              lastPing: data.lastPing
            }
          };
          
        } catch (error) {
          return {
            healthy: false,
            details: `Bridge server unreachable: ${error.message}`,
            error: error.message,
            metrics: { reachable: false }
          };
        }
      }
    });
    
    // Chrome Extension Health Check
    this.registerHealthCheck('chromeExtension', {
      name: 'Chrome Extension Runtime Check',
      description: 'Verifies Chrome extension is loaded and responsive',
      timeout: 3000,
      critical: true,
      check: async () => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
          return {
            healthy: false,
            details: 'Chrome runtime not available',
            error: 'Not in extension context',
            metrics: { runtimeAvailable: false }
          };
        }
        
        try {
          const startTime = Date.now();
          const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'ping', healthCheck: true }, response => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          });
          
          const responseTime = Date.now() - startTime;
          
          if (response && response.status === 'pong') {
            return {
              healthy: true,
              details: `Extension responsive (${responseTime}ms)`,
              metrics: { runtimeAvailable: true, responsive: true, responseTime }
            };
          } else {
            return {
              healthy: false,
              details: 'Extension not responding correctly',
              metrics: { runtimeAvailable: true, responsive: false, responseTime }
            };
          }
          
        } catch (error) {
          return {
            healthy: false,
            details: `Extension communication failed: ${error.message}`,
            error: error.message,
            metrics: { runtimeAvailable: true, responsive: false }
          };
        }
      }
    });
    
    // Gmail Tabs Health Check
    this.registerHealthCheck('gmailTabs', {
      name: 'Gmail Tab Presence Check',
      description: 'Verifies Gmail tabs are open and accessible',
      timeout: 3000,
      critical: false, // Not critical - user can open Gmail manually
      check: async () => {
        try {
          // Different behavior based on context
          if (typeof chrome !== 'undefined' && chrome.tabs) {
            // Background script context - can query tabs
            const tabs = await chrome.tabs.query({ url: '*://mail.google.com/*' });
            
            if (tabs.length === 0) {
              return {
                healthy: false,
                details: 'No Gmail tabs found',
                metrics: { tabCount: 0, context: 'background' }
              };
            }
            
            // Check if any tab is active
            const activeTabs = tabs.filter(tab => tab.active);
            
            return {
              healthy: true,
              details: `Found ${tabs.length} Gmail tab(s), ${activeTabs.length} active`,
              metrics: { 
                tabCount: tabs.length, 
                activeTabs: activeTabs.length,
                context: 'background'
              }
            };
            
          } else if (typeof window !== 'undefined' && window.location) {
            // Content script context - check current page
            const isGmailPage = window.location.hostname.includes('mail.google.com');
            
            if (!isGmailPage) {
              return {
                healthy: false,
                details: 'Not on Gmail page',
                metrics: { 
                  onGmailPage: false, 
                  currentUrl: window.location.href,
                  context: 'content'
                }
              };
            }
            
            // Check if Gmail interface is loaded
            const hasGmailInterface = window.gmailInterface !== undefined;
            
            return {
              healthy: hasGmailInterface,
              details: hasGmailInterface ? 
                'On Gmail page with interface loaded' : 
                'On Gmail page but interface not loaded',
              metrics: { 
                onGmailPage: true, 
                interfaceLoaded: hasGmailInterface,
                context: 'content'
              }
            };
            
          } else {
            return {
              healthy: false,
              details: 'Cannot check Gmail tabs in this context',
              error: 'Invalid context',
              metrics: { context: 'unknown' }
            };
          }
          
        } catch (error) {
          return {
            healthy: false,
            details: `Error checking Gmail tabs: ${error.message}`,
            error: error.message,
            metrics: { errorType: error.name }
          };
        }
      }
    });
    
    // Claude Desktop Health Check
    this.registerHealthCheck('claudeDesktop', {
      name: 'Claude Desktop Configuration Check',
      description: 'Verifies Claude Desktop MCP configuration',
      timeout: 5000,
      critical: false, // Not critical for basic functionality
      check: async () => {
        try {
          // This would check if Claude Desktop is configured properly
          // For now, we'll do a basic check
          const isConfigured = await this._checkClaudeDesktopConfig();
          
          if (!isConfigured) {
            return {
              healthy: false,
              details: 'Claude Desktop MCP configuration not found',
              metrics: { configured: false },
              suggestion: 'Run configuration wizard or manually configure Claude Desktop'
            };
          }
          
          return {
            healthy: true,
            details: 'Claude Desktop appears to be configured',
            metrics: { configured: true }
          };
          
        } catch (error) {
          return {
            healthy: false,
            details: `Error checking Claude Desktop: ${error.message}`,
            error: error.message,
            metrics: { errorType: error.name }
          };
        }
      }
    });
  }
  
  _calculateHealthScore(componentName, healthResult) {
    if (!healthResult.healthy) {
      return 0; // Unhealthy component gets 0 score
    }
    
    const weights = this.config.healthScoreWeights;
    let score = 0;
    
    // Status score (40% weight)
    score += weights.status * 100; // Healthy status = full points
    
    // Response time score (30% weight)
    if (healthResult.metrics && healthResult.metrics.responseTime !== undefined) {
      const responseTime = healthResult.metrics.responseTime;
      let responseScore = 100;
      
      if (responseTime > 5000) responseScore = 20;      // >5s = poor
      else if (responseTime > 2000) responseScore = 50; // >2s = fair
      else if (responseTime > 1000) responseScore = 75; // >1s = good
      // <=1s = excellent (100)
      
      score += weights.responseTime * responseScore;
    } else {
      score += weights.responseTime * 75; // Default good score if no response time
    }
    
    // Error rate score (20% weight)
    const component = this.systemState.getComponent(componentName);
    if (component && component.errorCount !== undefined) {
      let errorScore = 100;
      
      if (component.errorCount > 10) errorScore = 20;      // >10 errors = poor
      else if (component.errorCount > 5) errorScore = 50;  // >5 errors = fair
      else if (component.errorCount > 2) errorScore = 75;  // >2 errors = good
      // <=2 errors = excellent (100)
      
      score += weights.errorRate * errorScore;
    } else {
      score += weights.errorRate * 100; // No errors recorded = full points
    }
    
    // Uptime score (10% weight)
    if (component && component.lastCheck) {
      const timeSinceCheck = Date.now() - component.lastCheck;
      let uptimeScore = 100;
      
      if (timeSinceCheck > 300000) uptimeScore = 20;      // >5min = poor
      else if (timeSinceCheck > 120000) uptimeScore = 50;  // >2min = fair
      else if (timeSinceCheck > 60000) uptimeScore = 75;   // >1min = good
      // <=1min = excellent (100)
      
      score += weights.uptime * uptimeScore;
    } else {
      score += weights.uptime * 50; // No check history = fair score
    }
    
    return Math.round(score);
  }
  
  _getHealthGrade(score) {
    if (score >= this.healthThresholds.excellent) return 'excellent';
    if (score >= this.healthThresholds.good) return 'good';
    if (score >= this.healthThresholds.fair) return 'fair';
    if (score >= this.healthThresholds.poor) return 'poor';
    return 'critical';
  }
  
  _calculateSystemHealth(componentResults) {
    const components = Object.entries(componentResults);
    if (components.length === 0) {
      return { score: 0, grade: 'unknown', healthy: false };
    }
    
    let totalScore = 0;
    let criticalFailures = 0;
    let healthyCount = 0;
    
    for (const [componentName, result] of components) {
      const healthCheck = this.healthChecks.get(componentName);
      const isCritical = healthCheck?.critical || false;
      
      totalScore += result.score || 0;
      
      if (result.healthy) {
        healthyCount++;
      } else if (isCritical) {
        criticalFailures++;
      }
    }
    
    const averageScore = totalScore / components.length;
    
    // System is unhealthy if any critical component fails
    const systemHealthy = criticalFailures === 0;
    
    // Adjust score based on critical failures
    let adjustedScore = averageScore;
    if (criticalFailures > 0) {
      adjustedScore = Math.min(adjustedScore, 25); // Cap at 25 for critical failures
    }
    
    return {
      score: Math.round(adjustedScore),
      grade: this._getHealthGrade(adjustedScore),
      healthy: systemHealthy,
      componentCount: components.length,
      healthyComponents: healthyCount,
      criticalFailures: criticalFailures
    };
  }
  
  _recordHealthMetrics(componentName, healthResult) {
    if (healthResult.metrics && healthResult.metrics.responseTime) {
      this.systemState.recordMetric('responseTime', healthResult.metrics.responseTime);
    }
    
    // Record success/failure
    this.systemState.recordMetric(
      healthResult.healthy ? 'successRate' : 'errorRate', 
      1
    );
  }
  
  // Placeholder methods for actual system checks
  
  async _checkMCPProcess() {
    // Placeholder: check if MCP server process is running
    // Real implementation would check process list or PID file
    return true; // Assume running for now
  }
  
  async _pingMCPServer() {
    // Placeholder: ping MCP server
    // Real implementation would send a test message to MCP server
    return true; // Assume responsive for now
  }
  
  async _checkClaudeDesktopConfig() {
    // Placeholder: check Claude Desktop configuration
    // Real implementation would read and validate config file
    return false; // Assume not configured for now
  }
}

// Export for Node.js and browsers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HealthChecker };
} else if (typeof window !== 'undefined') {
  window.HealthChecker = HealthChecker;
}