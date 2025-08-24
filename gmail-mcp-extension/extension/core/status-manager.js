/**
 * 统一状态管理器 - Linus式简洁设计
 * 消除分散的状态查询和复杂的if/else分支
 */

class StatusManager {
  constructor() {
    this.state = {
      connection: 'checking',
      bridgeHealth: false,
      bridgePolling: false,
      lastError: null,
      lastUpdate: Date.now(),
      metrics: {
        responseTime: 0,
        uptime: 0,
        errorCount: 0,
        successCount: 0
      }
    };
    
    this.listeners = [];
    this.updateInterval = null;
  }

  /**
   * 获取当前状态 - 单一数据源
   */
  getState() {
    return { ...this.state };
  }

  /**
   * 更新状态 - 统一入口点
   */
  updateState(newState) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...newState, lastUpdate: Date.now() };
    
    // 通知所有监听者
    this.listeners.forEach(listener => {
      try {
        listener(this.state, oldState);
      } catch (error) {
        console.error('Status listener error:', error);
      }
    });
  }

  /**
   * 添加状态监听器
   */
  addListener(callback) {
    this.listeners.push(callback);
    // 立即触发一次当前状态
    callback(this.state, {});
  }

  /**
   * 移除状态监听器
   */
  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 检查连接状态 - 简化逻辑
   */
  async checkConnection() {
    try {
      const startTime = Date.now();
      
      // 发送检查请求
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'checkConnection' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });

      const responseTime = Date.now() - startTime;

      // 更新指标
      this.updateMetrics(responseTime, true);

      // 根据响应更新状态
      if (response?.connected) {
        this.updateState({
          connection: 'connected',
          bridgeHealth: true,
          bridgePolling: true,
          lastError: null
        });
      } else {
        this.updateState({
          connection: 'disconnected',
          bridgeHealth: response?.healthy || false,
          bridgePolling: response?.polling || false,
          lastError: this.getErrorMessage(response)
        });
      }

    } catch (error) {
      this.updateMetrics(0, false);
      this.updateState({
        connection: 'error',
        bridgeHealth: false,
        bridgePolling: false,
        lastError: error.message || 'Extension communication error'
      });
    }
  }

  /**
   * 更新性能指标
   */
  updateMetrics(responseTime, success) {
    const metrics = { ...this.state.metrics };
    
    if (success) {
      metrics.successCount++;
      metrics.responseTime = responseTime;
    } else {
      metrics.errorCount++;
    }

    // 计算运行时间
    const now = Date.now();
    if (!this.startTime) {
      this.startTime = now;
    }
    metrics.uptime = now - this.startTime;

    this.updateState({ metrics });
  }

  /**
   * 获取用户友好的错误消息
   */
  getErrorMessage(response) {
    if (!response) return 'No response from extension';
    
    if (!response.polling) {
      return 'Bridge server not started - run npm run bridge';
    }
    
    if (!response.healthy) {
      return response.lastError || 'Bridge server offline on port 3456';
    }
    
    return 'Waiting for Gmail connection';
  }

  /**
   * 开始自动状态检查
   */
  startAutoCheck(interval = 3000) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => {
      this.checkConnection();
    }, interval);
    
    // 立即检查一次
    this.checkConnection();
  }

  /**
   * 停止自动状态检查
   */
  stopAutoCheck() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * 获取状态显示信息 - UI渲染用
   */
  getDisplayInfo() {
    const { connection, lastError, metrics } = this.state;
    
    const statusMap = {
      'connected': {
        dot: 'connected',
        text: 'Connected',
        details: 'Bridge server is running and Gmail is connected',
        showHelp: false
      },
      'disconnected': {
        dot: 'disconnected', 
        text: this.getDisconnectedTitle(),
        details: lastError || 'Unknown connection issue',
        showHelp: true
      },
      'checking': {
        dot: 'checking',
        text: 'Checking connection...',
        details: 'Please wait while we verify the connection',
        showHelp: false
      },
      'error': {
        dot: 'disconnected',
        text: 'Extension Error', 
        details: lastError || 'Cannot communicate with extension',
        showHelp: true
      }
    };

    return {
      ...statusMap[connection],
      metrics: {
        responseTime: metrics.responseTime,
        uptime: this.formatUptime(metrics.uptime),
        errorRate: this.calculateErrorRate(metrics),
        successRate: this.calculateSuccessRate(metrics)
      }
    };
  }

  getDisconnectedTitle() {
    const { bridgePolling, bridgeHealth } = this.state;
    
    if (!bridgePolling) return 'Bridge Not Started';
    if (!bridgeHealth) return 'Bridge Server Offline';
    return 'Waiting for Connection';
  }

  formatUptime(uptime) {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  calculateErrorRate(metrics) {
    const total = metrics.errorCount + metrics.successCount;
    return total === 0 ? 0 : Math.round((metrics.errorCount / total) * 100);
  }

  calculateSuccessRate(metrics) {
    const total = metrics.errorCount + metrics.successCount;
    return total === 0 ? 0 : Math.round((metrics.successCount / total) * 100);
  }
}

// 全局单例
window.statusManager = window.statusManager || new StatusManager();