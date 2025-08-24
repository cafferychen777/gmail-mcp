/**
 * 性能监控器 - Linus式轻量级实现
 * "不要为了监控而监控，要为了解决实际问题而监控"
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      responseTime: [],
      memoryUsage: [],
      errorCount: 0,
      successCount: 0,
      startTime: Date.now(),
      lastUpdate: Date.now()
    };
    
    this.maxDataPoints = 100; // 保持轻量级
    this.updateInterval = null;
    this.listeners = [];
    
    this.init();
  }

  init() {
    // 从存储恢复历史数据
    this.loadStoredMetrics();
    
    // 开始定期更新
    this.startMonitoring();
    
    // 监听扩展事件
    this.bindExtensionEvents();
  }

  async loadStoredMetrics() {
    try {
      const result = await chrome.storage.local.get(['performanceMetrics']);
      if (result.performanceMetrics) {
        this.metrics = { ...this.metrics, ...result.performanceMetrics };
      }
    } catch (error) {
      console.error('Failed to load stored metrics:', error);
    }
  }

  async saveMetrics() {
    try {
      await chrome.storage.local.set({
        performanceMetrics: this.metrics
      });
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }

  startMonitoring() {
    // 每30秒更新一次性能指标
    this.updateInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.saveMetrics();
      this.notifyListeners();
    }, 30000);

    // 立即收集一次
    this.collectSystemMetrics();
  }

  stopMonitoring() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  bindExtensionEvents() {
    // 监听消息传递，记录响应时间
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // 只监控特定的性能相关消息
        if (message.action === 'checkConnection' || message.action === 'ping') {
          const startTime = performance.now();
          
          // 包装原始响应以测量时间
          const originalSendResponse = sendResponse;
          sendResponse = (response) => {
            const responseTime = performance.now() - startTime;
            this.recordResponseTime(responseTime);
            originalSendResponse(response);
          };
        }
      });
    }
  }

  /**
   * 记录API响应时间
   */
  recordResponseTime(responseTime) {
    this.metrics.responseTime.push({
      value: Math.round(responseTime),
      timestamp: Date.now()
    });

    // 保持数据点数量限制
    if (this.metrics.responseTime.length > this.maxDataPoints) {
      this.metrics.responseTime.shift();
    }

    this.metrics.lastUpdate = Date.now();
  }

  /**
   * 记录成功/失败统计
   */
  recordSuccess() {
    this.metrics.successCount++;
    this.metrics.lastUpdate = Date.now();
  }

  recordError() {
    this.metrics.errorCount++;
    this.metrics.lastUpdate = Date.now();
  }

  /**
   * 收集系统指标
   */
  collectSystemMetrics() {
    // 内存使用情况
    this.collectMemoryUsage();
    
    // 清理旧数据
    this.cleanupOldData();
  }

  collectMemoryUsage() {
    try {
      if ('memory' in performance) {
        const memInfo = performance.memory;
        const usedMB = Math.round(memInfo.usedJSHeapSize / 1024 / 1024);
        
        this.metrics.memoryUsage.push({
          value: usedMB,
          timestamp: Date.now()
        });

        // 保持数据点数量限制
        if (this.metrics.memoryUsage.length > this.maxDataPoints) {
          this.metrics.memoryUsage.shift();
        }
      }
    } catch (error) {
      console.error('Memory collection failed:', error);
    }
  }

  /**
   * 清理超过24小时的旧数据
   */
  cleanupOldData() {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    this.metrics.responseTime = this.metrics.responseTime.filter(
      item => item.timestamp > oneDayAgo
    );
    
    this.metrics.memoryUsage = this.metrics.memoryUsage.filter(
      item => item.timestamp > oneDayAgo
    );
  }

  /**
   * 获取当前性能快照
   */
  getSnapshot() {
    const now = Date.now();
    const uptime = now - this.metrics.startTime;
    
    return {
      responseTime: this.getAverageResponseTime(),
      peakResponseTime: this.getPeakResponseTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
      peakMemoryUsage: this.getPeakMemoryUsage(),
      errorRate: this.getErrorRate(),
      successRate: this.getSuccessRate(),
      totalRequests: this.metrics.errorCount + this.metrics.successCount,
      uptime: uptime,
      uptimeFormatted: this.formatUptime(uptime),
      dataPoints: {
        responseTime: this.metrics.responseTime.length,
        memoryUsage: this.metrics.memoryUsage.length
      },
      lastUpdate: this.metrics.lastUpdate
    };
  }

  getAverageResponseTime() {
    if (this.metrics.responseTime.length === 0) return 0;
    
    const sum = this.metrics.responseTime.reduce((acc, item) => acc + item.value, 0);
    return Math.round(sum / this.metrics.responseTime.length);
  }

  getPeakResponseTime() {
    if (this.metrics.responseTime.length === 0) return 0;
    
    return Math.max(...this.metrics.responseTime.map(item => item.value));
  }

  getCurrentMemoryUsage() {
    if (this.metrics.memoryUsage.length === 0) return 0;
    
    return this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1].value;
  }

  getPeakMemoryUsage() {
    if (this.metrics.memoryUsage.length === 0) return 0;
    
    return Math.max(...this.metrics.memoryUsage.map(item => item.value));
  }

  getErrorRate() {
    const total = this.metrics.errorCount + this.metrics.successCount;
    return total === 0 ? 0 : Math.round((this.metrics.errorCount / total) * 100);
  }

  getSuccessRate() {
    const total = this.metrics.errorCount + this.metrics.successCount;
    return total === 0 ? 0 : Math.round((this.metrics.successCount / total) * 100);
  }

  formatUptime(uptime) {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * 获取趋势数据用于图表显示
   */
  getTrendData(metric, timeRange = '1h') {
    const ranges = {
      '5m': 5 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    };

    const cutoff = Date.now() - (ranges[timeRange] || ranges['1h']);
    
    const data = this.metrics[metric] || [];
    return data
      .filter(item => item.timestamp > cutoff)
      .map(item => ({
        value: item.value,
        timestamp: item.timestamp
      }));
  }

  /**
   * 性能健康评分 (0-100)
   */
  getHealthScore() {
    let score = 100;
    
    // 响应时间评分 (权重: 30%)
    const avgResponseTime = this.getAverageResponseTime();
    if (avgResponseTime > 1000) score -= 30;
    else if (avgResponseTime > 500) score -= 15;
    else if (avgResponseTime > 200) score -= 5;
    
    // 错误率评分 (权重: 40%)
    const errorRate = this.getErrorRate();
    if (errorRate > 20) score -= 40;
    else if (errorRate > 10) score -= 25;
    else if (errorRate > 5) score -= 10;
    
    // 内存使用评分 (权重: 20%)
    const memUsage = this.getCurrentMemoryUsage();
    if (memUsage > 100) score -= 20;
    else if (memUsage > 50) score -= 10;
    
    // 数据新鲜度评分 (权重: 10%)
    const timeSinceUpdate = Date.now() - this.metrics.lastUpdate;
    if (timeSinceUpdate > 5 * 60 * 1000) score -= 10; // 5分钟没更新
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 获取性能警告
   */
  getWarnings() {
    const warnings = [];
    
    const avgResponseTime = this.getAverageResponseTime();
    if (avgResponseTime > 1000) {
      warnings.push({
        level: 'error',
        message: `Response time is too high: ${avgResponseTime}ms`,
        suggestion: 'Check network connection and server performance'
      });
    } else if (avgResponseTime > 500) {
      warnings.push({
        level: 'warning',
        message: `Response time is slow: ${avgResponseTime}ms`,
        suggestion: 'Monitor for continued degradation'
      });
    }
    
    const errorRate = this.getErrorRate();
    if (errorRate > 10) {
      warnings.push({
        level: 'error',
        message: `High error rate: ${errorRate}%`,
        suggestion: 'Check system logs and connectivity'
      });
    } else if (errorRate > 5) {
      warnings.push({
        level: 'warning',
        message: `Elevated error rate: ${errorRate}%`,
        suggestion: 'Monitor error patterns'
      });
    }
    
    const memUsage = this.getCurrentMemoryUsage();
    if (memUsage > 100) {
      warnings.push({
        level: 'warning',
        message: `High memory usage: ${memUsage}MB`,
        suggestion: 'Consider restarting the extension'
      });
    }
    
    return warnings;
  }

  /**
   * 添加性能监听器
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * 移除性能监听器
   */
  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   */
  notifyListeners() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(callback => {
      try {
        callback(snapshot);
      } catch (error) {
        console.error('Performance listener error:', error);
      }
    });
  }

  /**
   * 重置所有指标
   */
  reset() {
    this.metrics = {
      responseTime: [],
      memoryUsage: [],
      errorCount: 0,
      successCount: 0,
      startTime: Date.now(),
      lastUpdate: Date.now()
    };
    
    this.saveMetrics();
    this.notifyListeners();
  }

  /**
   * 导出性能数据
   */
  exportData(format = 'json') {
    const data = {
      snapshot: this.getSnapshot(),
      metrics: this.metrics,
      warnings: this.getWarnings(),
      healthScore: this.getHealthScore(),
      exportedAt: new Date().toISOString()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return data;
  }

  convertToCSV(data) {
    // 简化的CSV导出实现
    const lines = ['Metric,Value,Unit'];
    
    lines.push(`Average Response Time,${data.snapshot.responseTime},ms`);
    lines.push(`Peak Response Time,${data.snapshot.peakResponseTime},ms`);
    lines.push(`Current Memory,${data.snapshot.memoryUsage},MB`);
    lines.push(`Peak Memory,${data.snapshot.peakMemoryUsage},MB`);
    lines.push(`Error Rate,${data.snapshot.errorRate},%`);
    lines.push(`Success Rate,${data.snapshot.successRate},%`);
    lines.push(`Health Score,${data.healthScore},/100`);
    lines.push(`Uptime,${data.snapshot.uptimeFormatted},time`);
    
    return lines.join('\n');
  }
}

// 全局实例
if (typeof window !== 'undefined') {
  window.performanceMonitor = window.performanceMonitor || new PerformanceMonitor();
}

// 导出给其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceMonitor;
}