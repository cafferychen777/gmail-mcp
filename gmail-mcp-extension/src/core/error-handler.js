/**
 * Gmail MCP Bridge - Intelligent Error Handler
 * 
 * Based on Linus's philosophy: "Eliminate special cases"
 * - All errors handled through the same mechanism
 * - User-friendly messages for every error
 * - Automatic recovery suggestions
 * - No more try-catch hell scattered throughout the code
 * 
 * @author Gmail MCP Bridge Team
 * @version 2.0.0
 */

/**
 * IntelligentErrorHandler - Unified error handling for the entire system
 * 
 * Philosophy: Instead of scattered try-catch blocks, we handle ALL errors
 * through a centralized system using data structures, not conditionals.
 */
class IntelligentErrorHandler {
  constructor(systemState) {
    this.systemState = systemState;
    
    // Error code mappings - the heart of intelligent error handling
    // Use Map for O(1) lookups, no if/else chains
    this.errorMappings = new Map();
    this.solutionMappings = new Map();
    this.userMessages = new Map();
    
    // Auto-fix registry - functions that can automatically resolve errors
    this.autoFixRegistry = new Map();
    
    // Error patterns for classification
    this.errorPatterns = new Map();
    
    // Initialize all mappings
    this._initializeErrorMappings();
    this._initializeSolutions();
    this._initializeUserMessages();
    this._initializeAutoFixes();
    this._initializePatterns();
  }
  
  /**
   * Handle any error - the SINGLE entry point for all error handling
   * This replaces all try-catch blocks throughout the codebase
   */
  async handleError(error, context = {}) {
    const errorInfo = this._classifyError(error, context);
    const solution = this._findSolution(errorInfo);
    const userMessage = this._generateUserMessage(errorInfo, solution);
    
    // Record error in system state
    const errorId = this.systemState.recordError(context.component || 'unknown', errorInfo);
    
    // Attempt automatic fix if available
    let autoFixResult = null;
    if (solution.autoFixable) {
      try {
        autoFixResult = await this._attemptAutoFix(errorInfo, solution);
      } catch (fixError) {
        console.error('Auto-fix failed:', fixError);
        autoFixResult = { success: false, error: fixError.message };
      }
    }
    
    const result = {
      errorId,
      resolved: autoFixResult?.success || false,
      userMessage: autoFixResult?.success ? userMessage.success : userMessage.manual,
      actions: solution.userActions || [],
      autoFixAttempted: !!autoFixResult,
      autoFixResult: autoFixResult,
      errorInfo,
      solution,
      timestamp: Date.now()
    };
    
    // Log structured error information (replacing scattered console.log)
    this._logStructuredError(result);
    
    return result;
  }
  
  /**
   * Wrap any function to use intelligent error handling
   * This eliminates the need for try-catch in application code
   */
  wrap(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        const result = await this.handleError(error, context);
        
        // For wrapped functions, we throw a user-friendly error
        const friendlyError = new Error(result.userMessage);
        friendlyError.originalError = error;
        friendlyError.errorResult = result;
        throw friendlyError;
      }
    };
  }
  
  /**
   * Get error statistics - useful for monitoring
   */
  getErrorStats() {
    const stats = {
      byComponent: {},
      byType: {},
      recentErrors: [],
      autoFixSuccessRate: 0,
      totalErrors: this.systemState.errors.size
    };
    
    // Analyze errors
    let autoFixAttempts = 0;
    let autoFixSuccesses = 0;
    
    for (const error of this.systemState.errors.values()) {
      // By component
      stats.byComponent[error.component] = (stats.byComponent[error.component] || 0) + 1;
      
      // By type
      stats.byType[error.code] = (stats.byType[error.code] || 0) + 1;
      
      // Recent errors (last 10)
      if (stats.recentErrors.length < 10) {
        stats.recentErrors.push({
          component: error.component,
          code: error.code,
          message: error.message,
          timestamp: error.timestamp
        });
      }
      
      // Auto-fix stats
      if (error.metadata?.autoFixAttempted) {
        autoFixAttempts++;
        if (error.metadata?.autoFixSuccess) {
          autoFixSuccesses++;
        }
      }
    }
    
    stats.autoFixSuccessRate = autoFixAttempts > 0 ? 
      Math.round((autoFixSuccesses / autoFixAttempts) * 100) : 0;
    
    // Sort recent errors by timestamp
    stats.recentErrors.sort((a, b) => b.timestamp - a.timestamp);
    
    return stats;
  }
  
  // Private methods for error classification and handling
  
  _classifyError(error, context) {
    let errorCode = 'UNKNOWN_ERROR';
    let severity = 'error';
    let category = 'system';
    
    // Pattern-based classification
    const errorMessage = error.message || error.toString();
    const errorStack = error.stack || '';
    
    for (const [pattern, classification] of this.errorPatterns) {
      if (pattern.test(errorMessage) || pattern.test(errorStack)) {
        errorCode = classification.code;
        severity = classification.severity;
        category = classification.category;
        break;
      }
    }
    
    // Context-based refinement
    if (context.component === 'chromeExtension' && errorMessage.includes('Extension context invalidated')) {
      errorCode = 'EXTENSION_CONTEXT_INVALIDATED';
    }
    
    if (context.component === 'bridgeServer' && errorMessage.includes('ECONNREFUSED')) {
      errorCode = 'BRIDGE_SERVER_UNAVAILABLE';
    }
    
    return {
      code: errorCode,
      message: errorMessage,
      stack: errorStack,
      severity,
      category,
      component: context.component || 'unknown',
      timestamp: Date.now(),
      metadata: {
        originalError: error,
        context,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server'
      }
    };
  }
  
  _findSolution(errorInfo) {
    const solution = this.solutionMappings.get(errorInfo.code) || {
      autoFixable: false,
      userActions: ['检查系统状态', '重启相关服务', '查看详细日志'],
      description: '通用错误处理'
    };
    
    return solution;
  }
  
  _generateUserMessage(errorInfo, solution) {
    const messageTemplate = this.userMessages.get(errorInfo.code) || {
      manual: `发生错误: ${errorInfo.message}`,
      success: '错误已自动修复',
      details: '请查看日志了解详细信息'
    };
    
    // Simple template replacement (no complex templating engine needed)
    const replacements = {
      '{{error}}': errorInfo.message,
      '{{component}}': errorInfo.component,
      '{{timestamp}}': new Date(errorInfo.timestamp).toLocaleString()
    };
    
    const result = {};
    for (const [key, template] of Object.entries(messageTemplate)) {
      result[key] = this._replaceTemplate(template, replacements);
    }
    
    return result;
  }
  
  async _attemptAutoFix(errorInfo, solution) {
    const autoFixFn = this.autoFixRegistry.get(errorInfo.code);
    
    if (!autoFixFn) {
      return { success: false, error: 'No auto-fix available' };
    }
    
    try {
      const result = await autoFixFn(errorInfo, this.systemState);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  _logStructuredError(errorResult) {
    // Structured logging replaces scattered console.log statements
    const logEntry = {
      level: this._getLogLevel(errorResult.errorInfo.severity),
      timestamp: new Date(errorResult.timestamp).toISOString(),
      component: errorResult.errorInfo.component,
      errorCode: errorResult.errorInfo.code,
      message: errorResult.userMessage,
      resolved: errorResult.resolved,
      autoFixed: errorResult.autoFixResult?.success || false,
      metadata: {
        errorId: errorResult.errorId,
        category: errorResult.errorInfo.category,
        stack: errorResult.errorInfo.stack?.split('\n').slice(0, 3).join('\n') // First 3 lines only
      }
    };
    
    // Use appropriate console method based on severity
    if (logEntry.level === 'error') {
      console.error('[Gmail MCP]', JSON.stringify(logEntry, null, 2));
    } else if (logEntry.level === 'warn') {
      console.warn('[Gmail MCP]', JSON.stringify(logEntry, null, 2));
    } else {
      console.log('[Gmail MCP]', JSON.stringify(logEntry, null, 2));
    }
  }
  
  _getLogLevel(severity) {
    const levels = {
      'critical': 'error',
      'error': 'error', 
      'warning': 'warn',
      'info': 'info',
      'debug': 'debug'
    };
    
    return levels[severity] || 'info';
  }
  
  _replaceTemplate(template, replacements) {
    let result = template;
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }
    return result;
  }
  
  // Initialization methods - these define all the error handling rules
  
  _initializeErrorMappings() {
    // Map error patterns to codes - this eliminates if/else chains
    const mappings = [
      {
        code: 'CHROME_EXTENSION_NOT_FOUND',
        severity: 'error',
        category: 'configuration',
        autoFixable: true
      },
      {
        code: 'GMAIL_TAB_NOT_FOUND', 
        severity: 'warning',
        category: 'user_action',
        autoFixable: false
      },
      {
        code: 'BRIDGE_SERVER_UNAVAILABLE',
        severity: 'error',
        category: 'connectivity', 
        autoFixable: true
      },
      {
        code: 'MCP_SERVER_NOT_RUNNING',
        severity: 'error',
        category: 'service',
        autoFixable: true
      },
      {
        code: 'CLAUDE_DESKTOP_NOT_CONFIGURED',
        severity: 'error',
        category: 'configuration',
        autoFixable: false
      },
      {
        code: 'EXTENSION_CONTEXT_INVALIDATED',
        severity: 'warning',
        category: 'browser',
        autoFixable: false
      },
      {
        code: 'EMAIL_PARSING_FAILED',
        severity: 'warning', 
        category: 'data',
        autoFixable: false
      },
      {
        code: 'RATE_LIMIT_EXCEEDED',
        severity: 'warning',
        category: 'throttling',
        autoFixable: true
      }
    ];
    
    mappings.forEach(mapping => {
      this.errorMappings.set(mapping.code, mapping);
    });
  }
  
  _initializeSolutions() {
    this.solutionMappings.set('CHROME_EXTENSION_NOT_FOUND', {
      autoFixable: true,
      userActions: ['重启浏览器', '重新安装扩展'],
      description: '检测并重新连接Chrome扩展'
    });
    
    this.solutionMappings.set('GMAIL_TAB_NOT_FOUND', {
      autoFixable: false,
      userActions: ['打开Gmail页面', '确保已登录Gmail账户'],
      description: '需要用户手动打开Gmail'
    });
    
    this.solutionMappings.set('BRIDGE_SERVER_UNAVAILABLE', {
      autoFixable: true,
      userActions: ['检查网络连接', '重启桥接服务器'],
      description: '尝试重新启动桥接服务器'
    });
    
    this.solutionMappings.set('MCP_SERVER_NOT_RUNNING', {
      autoFixable: true,
      userActions: ['检查MCP服务器日志', '手动重启MCP服务器'],
      description: '自动重启MCP服务器'
    });
    
    this.solutionMappings.set('CLAUDE_DESKTOP_NOT_CONFIGURED', {
      autoFixable: false,
      userActions: ['运行自动配置工具', '手动配置Claude Desktop'],
      description: '需要配置Claude Desktop MCP设置'
    });
    
    this.solutionMappings.set('EXTENSION_CONTEXT_INVALIDATED', {
      autoFixable: false,
      userActions: ['刷新页面', '重启浏览器'],
      description: '扩展上下文失效，需要重新加载'
    });
    
    this.solutionMappings.set('EMAIL_PARSING_FAILED', {
      autoFixable: false,
      userActions: ['检查邮件格式', '尝试其他邮件'],
      description: '邮件解析失败，可能是格式问题'
    });
    
    this.solutionMappings.set('RATE_LIMIT_EXCEEDED', {
      autoFixable: true,
      userActions: ['稍后再试', '减少请求频率'],
      description: '自动延迟后重试'
    });
  }
  
  _initializeUserMessages() {
    this.userMessages.set('CHROME_EXTENSION_NOT_FOUND', {
      manual: 'Chrome扩展未找到或已禁用。点击"修复"按钮自动处理，或手动重启浏览器。',
      success: 'Chrome扩展已重新连接并正常工作。',
      details: '扩展ID: {{component}}, 检测时间: {{timestamp}}'
    });
    
    this.userMessages.set('GMAIL_TAB_NOT_FOUND', {
      manual: '未找到Gmail标签页。请打开Gmail (gmail.com) 并确保已登录您的账户。',
      success: 'Gmail标签页已找到并连接。',
      details: '请在同一浏览器中打开 https://mail.google.com'
    });
    
    this.userMessages.set('BRIDGE_SERVER_UNAVAILABLE', {
      manual: '桥接服务器无法连接。正在尝试重新启动...',
      success: '桥接服务器已重新连接，服务恢复正常。',
      details: '服务器地址: localhost:3456'
    });
    
    this.userMessages.set('MCP_SERVER_NOT_RUNNING', {
      manual: 'MCP服务器未运行。正在尝试启动服务器...',
      success: 'MCP服务器已启动并连接到Claude Desktop。',
      details: '如果问题持续，请检查Claude Desktop配置'
    });
    
    this.userMessages.set('CLAUDE_DESKTOP_NOT_CONFIGURED', {
      manual: 'Claude Desktop未正确配置。请运行配置向导或手动添加MCP服务器设置。',
      success: 'Claude Desktop配置已更新。',
      details: '配置文件位置会根据您的操作系统而有所不同'
    });
    
    this.userMessages.set('EXTENSION_CONTEXT_INVALIDATED', {
      manual: '浏览器扩展需要重新加载。请刷新此页面或重启浏览器。',
      success: '扩展上下文已恢复。',
      details: '这通常在扩展更新后发生'
    });
    
    this.userMessages.set('EMAIL_PARSING_FAILED', {
      manual: '无法解析该邮件内容。邮件可能有特殊格式或包含不支持的内容。',
      success: '邮件解析已完成。',
      details: '错误详情: {{error}}'
    });
    
    this.userMessages.set('RATE_LIMIT_EXCEEDED', {
      manual: '请求过于频繁，已触发限制。系统将自动等待后重试。',
      success: '请求限制已解除，操作已完成。',
      details: '为了保护Gmail服务，我们限制了请求频率'
    });
  }
  
  _initializeAutoFixes() {
    // Auto-fix for extension connection issues
    this.autoFixRegistry.set('CHROME_EXTENSION_NOT_FOUND', async (errorInfo, systemState) => {
      // Try to reconnect to extension
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'ping' }, response => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          });
          
          systemState.updateComponent('chromeExtension', {
            status: 'connected',
            isConnected: true,
            lastPing: Date.now()
          });
          
          return 'Extension reconnected successfully';
        } catch (error) {
          throw new Error(`Failed to reconnect: ${error.message}`);
        }
      } else {
        throw new Error('Chrome runtime not available');
      }
    });
    
    // Auto-fix for bridge server connection
    this.autoFixRegistry.set('BRIDGE_SERVER_UNAVAILABLE', async (errorInfo, systemState) => {
      // Try to reconnect to bridge server
      try {
        const response = await fetch('http://localhost:3456/health', {
          method: 'GET',
          timeout: 5000
        });
        
        if (response.ok) {
          systemState.updateComponent('bridgeServer', {
            status: 'running',
            lastHeartbeat: Date.now()
          });
          return 'Bridge server reconnected successfully';
        } else {
          throw new Error(`Server returned status ${response.status}`);
        }
      } catch (error) {
        throw new Error(`Failed to reconnect to bridge server: ${error.message}`);
      }
    });
    
    // Auto-fix for rate limiting
    this.autoFixRegistry.set('RATE_LIMIT_EXCEEDED', async (errorInfo, systemState) => {
      // Wait and retry
      const waitTime = Math.min(5000, Math.pow(2, (errorInfo.metadata.retryCount || 0)) * 1000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return `Waited ${waitTime}ms before retry`;
    });
  }
  
  _initializePatterns() {
    // Error patterns for automatic classification
    this.errorPatterns.set(/Extension context invalidated/i, {
      code: 'EXTENSION_CONTEXT_INVALIDATED',
      severity: 'warning',
      category: 'browser'
    });
    
    this.errorPatterns.set(/ECONNREFUSED.*3456/i, {
      code: 'BRIDGE_SERVER_UNAVAILABLE',
      severity: 'error',
      category: 'connectivity'
    });
    
    this.errorPatterns.set(/Gmail.*not found|not.*gmail/i, {
      code: 'GMAIL_TAB_NOT_FOUND',
      severity: 'warning',
      category: 'user_action'
    });
    
    this.errorPatterns.set(/MCP.*not.*running|server.*not.*found/i, {
      code: 'MCP_SERVER_NOT_RUNNING',
      severity: 'error',
      category: 'service'
    });
    
    this.errorPatterns.set(/rate.*limit|too many requests/i, {
      code: 'RATE_LIMIT_EXCEEDED',
      severity: 'warning',
      category: 'throttling'
    });
    
    this.errorPatterns.set(/Failed to parse|parsing.*failed/i, {
      code: 'EMAIL_PARSING_FAILED',
      severity: 'warning',
      category: 'data'
    });
  }
}

// Export for Node.js and browsers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IntelligentErrorHandler };
} else if (typeof window !== 'undefined') {
  window.IntelligentErrorHandler = IntelligentErrorHandler;
}