/**
 * 指标收集器 - Linus式隐私安全的本地数据收集
 * "收集有用的数据，而不是所有数据"
 */

class MetricsCollector {
  constructor() {
    this.data = {
      features: new Map(), // 功能使用统计
      errors: [], // 错误记录
      performance: [], // 性能数据点
      userJourney: [], // 用户使用路径（匿名化）
      settings: new Map(), // 设置使用情况
      lastCleanup: Date.now()
    };
    
    this.maxStorageSize = 1024 * 1024; // 1MB限制
    this.maxDataAge = 7 * 24 * 60 * 60 * 1000; // 7天
    
    this.init();
  }

  async init() {
    await this.loadStoredData();
    this.startPeriodicCleanup();
    this.bindEvents();
  }

  async loadStoredData() {
    try {
      const result = await chrome.storage.local.get(['metricsData']);
      if (result.metricsData) {
        this.deserializeData(result.metricsData);
      }
    } catch (error) {
      console.error('Failed to load metrics data:', error);
    }
  }

  async saveData() {
    try {
      const serializedData = this.serializeData();
      
      // 检查数据大小
      if (this.getDataSize(serializedData) > this.maxStorageSize) {
        await this.cleanup(true); // 强制清理
        serializedData = this.serializeData();
      }
      
      await chrome.storage.local.set({
        metricsData: serializedData
      });
    } catch (error) {
      console.error('Failed to save metrics data:', error);
    }
  }

  serializeData() {
    return {
      features: Array.from(this.data.features.entries()),
      errors: this.data.errors,
      performance: this.data.performance,
      userJourney: this.data.userJourney,
      settings: Array.from(this.data.settings.entries()),
      lastCleanup: this.data.lastCleanup
    };
  }

  deserializeData(data) {
    this.data.features = new Map(data.features || []);
    this.data.errors = data.errors || [];
    this.data.performance = data.performance || [];
    this.data.userJourney = data.userJourney || [];
    this.data.settings = new Map(data.settings || []);
    this.data.lastCleanup = data.lastCleanup || Date.now();
  }

  bindEvents() {
    // 监听扩展内部事件
    if (typeof document !== 'undefined') {
      document.addEventListener('metrics:feature-used', (event) => {
        this.recordFeatureUsage(event.detail.feature, event.detail.data);
      });

      document.addEventListener('metrics:error', (event) => {
        this.recordError(event.detail.error, event.detail.context);
      });

      document.addEventListener('metrics:performance', (event) => {
        this.recordPerformance(event.detail.metric, event.detail.value);
      });
    }
  }

  /**
   * 记录功能使用情况
   */
  recordFeatureUsage(feature, additionalData = {}) {
    const key = this.sanitizeFeatureName(feature);
    
    if (!this.data.features.has(key)) {
      this.data.features.set(key, {
        count: 0,
        firstUsed: Date.now(),
        lastUsed: Date.now(),
        contexts: new Set()
      });
    }
    
    const featureData = this.data.features.get(key);
    featureData.count++;
    featureData.lastUsed = Date.now();
    
    // 记录使用上下文（隐私安全）
    if (additionalData.context) {
      featureData.contexts.add(this.hashContext(additionalData.context));
    }
    
    this.recordUserJourney('feature_used', { feature: key });
    this.saveDataAsync();
  }

  /**
   * 记录错误信息
   */
  recordError(error, context = {}) {
    const errorRecord = {
      message: this.sanitizeErrorMessage(error.message || String(error)),
      type: error.name || 'UnknownError',
      stack: this.sanitizeStackTrace(error.stack),
      context: this.sanitizeContext(context),
      timestamp: Date.now(),
      userAgent: this.getUserAgentInfo(),
      url: this.sanitizeUrl(context.url || window.location?.href)
    };
    
    this.data.errors.push(errorRecord);
    
    // 限制错误记录数量
    if (this.data.errors.length > 100) {
      this.data.errors.shift();
    }
    
    this.recordUserJourney('error_occurred', { 
      type: errorRecord.type,
      context: errorRecord.context?.component 
    });
    
    this.saveDataAsync();
  }

  /**
   * 记录性能数据
   */
  recordPerformance(metric, value, context = {}) {
    const performanceRecord = {
      metric: metric,
      value: Number(value),
      context: this.sanitizeContext(context),
      timestamp: Date.now()
    };
    
    this.data.performance.push(performanceRecord);
    
    // 限制性能记录数量
    if (this.data.performance.length > 200) {
      this.data.performance.shift();
    }
    
    this.saveDataAsync();
  }

  /**
   * 记录用户使用路径（完全匿名化）
   */
  recordUserJourney(action, data = {}) {
    const journeyRecord = {
      action: action,
      data: this.anonymizeData(data),
      timestamp: Date.now(),
      sessionId: this.getSessionId()
    };
    
    this.data.userJourney.push(journeyRecord);
    
    // 限制用户路径记录数量
    if (this.data.userJourney.length > 50) {
      this.data.userJourney.shift();
    }
  }

  /**
   * 记录设置使用情况
   */
  recordSettingChange(setting, value, oldValue = null) {
    const key = this.sanitizeSettingName(setting);
    
    if (!this.data.settings.has(key)) {
      this.data.settings.set(key, {
        changeCount: 0,
        firstChanged: Date.now(),
        lastChanged: Date.now(),
        values: new Set()
      });
    }
    
    const settingData = this.data.settings.get(key);
    settingData.changeCount++;
    settingData.lastChanged = Date.now();
    settingData.values.add(this.hashValue(value));
    
    this.recordUserJourney('setting_changed', { setting: key });
    this.saveDataAsync();
  }

  /**
   * 数据清理和维护
   */
  async cleanup(force = false) {
    const now = Date.now();
    const shouldCleanup = force || (now - this.data.lastCleanup > 24 * 60 * 60 * 1000);
    
    if (!shouldCleanup) return;
    
    // 清理过期数据
    const cutoff = now - this.maxDataAge;
    
    this.data.errors = this.data.errors.filter(error => error.timestamp > cutoff);
    this.data.performance = this.data.performance.filter(perf => perf.timestamp > cutoff);
    this.data.userJourney = this.data.userJourney.filter(journey => journey.timestamp > cutoff);
    
    // 清理很少使用的功能数据
    for (const [feature, data] of this.data.features.entries()) {
      if (data.lastUsed < cutoff && data.count < 5) {
        this.data.features.delete(feature);
      }
    }
    
    this.data.lastCleanup = now;
    await this.saveData();
  }

  startPeriodicCleanup() {
    // 每天清理一次
    setInterval(() => {
      this.cleanup();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * 数据分析和报告生成
   */
  generateReport() {
    return {
      summary: this.getSummary(),
      topFeatures: this.getTopFeatures(),
      errorAnalysis: this.getErrorAnalysis(),
      performanceInsights: this.getPerformanceInsights(),
      userBehavior: this.getUserBehaviorInsights(),
      recommendations: this.getRecommendations()
    };
  }

  getSummary() {
    const totalFeatureUsage = Array.from(this.data.features.values())
      .reduce((sum, data) => sum + data.count, 0);
    
    const avgSessionLength = this.calculateAverageSessionLength();
    const activeFeatures = this.data.features.size;
    const errorRate = this.calculateErrorRate();
    
    return {
      totalFeatureUsage,
      activeFeatures,
      errorRate,
      avgSessionLength,
      dataPoints: {
        errors: this.data.errors.length,
        performance: this.data.performance.length,
        userJourney: this.data.userJourney.length
      }
    };
  }

  getTopFeatures(limit = 5) {
    return Array.from(this.data.features.entries())
      .map(([feature, data]) => ({
        feature,
        usage: data.count,
        lastUsed: data.lastUsed,
        contexts: data.contexts.size
      }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, limit);
  }

  getErrorAnalysis() {
    const errorsByType = new Map();
    const errorsByContext = new Map();
    
    this.data.errors.forEach(error => {
      // 按类型统计
      const type = error.type;
      errorsByType.set(type, (errorsByType.get(type) || 0) + 1);
      
      // 按上下文统计
      const context = error.context?.component || 'unknown';
      errorsByContext.set(context, (errorsByContext.get(context) || 0) + 1);
    });
    
    return {
      totalErrors: this.data.errors.length,
      byType: Array.from(errorsByType.entries()).sort((a, b) => b[1] - a[1]),
      byContext: Array.from(errorsByContext.entries()).sort((a, b) => b[1] - a[1]),
      recentErrors: this.data.errors.slice(-5)
    };
  }

  getPerformanceInsights() {
    const metrics = new Map();
    
    this.data.performance.forEach(record => {
      if (!metrics.has(record.metric)) {
        metrics.set(record.metric, []);
      }
      metrics.get(record.metric).push(record.value);
    });
    
    const insights = {};
    for (const [metric, values] of metrics.entries()) {
      insights[metric] = {
        count: values.length,
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        recent: values.slice(-10)
      };
    }
    
    return insights;
  }

  getUserBehaviorInsights() {
    const actionCounts = new Map();
    const sessionLengths = [];
    
    this.data.userJourney.forEach(journey => {
      actionCounts.set(journey.action, (actionCounts.get(journey.action) || 0) + 1);
    });
    
    // 计算会话长度
    const sessions = this.groupJourneyBySessions();
    sessions.forEach(session => {
      if (session.length > 1) {
        const duration = session[session.length - 1].timestamp - session[0].timestamp;
        sessionLengths.push(duration);
      }
    });
    
    return {
      topActions: Array.from(actionCounts.entries()).sort((a, b) => b[1] - a[1]),
      averageSessionLength: sessionLengths.length > 0 ? 
        sessionLengths.reduce((sum, len) => sum + len, 0) / sessionLengths.length : 0,
      totalSessions: sessions.length
    };
  }

  getRecommendations() {
    const recommendations = [];
    const summary = this.getSummary();
    const errorAnalysis = this.getErrorAnalysis();
    
    // 基于错误率的建议
    if (summary.errorRate > 10) {
      recommendations.push({
        priority: 'high',
        type: 'reliability',
        message: 'High error rate detected. Consider investigating common error patterns.',
        data: errorAnalysis.byType.slice(0, 3)
      });
    }
    
    // 基于功能使用的建议
    const topFeatures = this.getTopFeatures(3);
    if (topFeatures.length > 0) {
      recommendations.push({
        priority: 'medium',
        type: 'optimization',
        message: 'Focus optimization efforts on most-used features.',
        data: topFeatures
      });
    }
    
    // 基于性能的建议
    const performanceInsights = this.getPerformanceInsights();
    if (performanceInsights.responseTime && performanceInsights.responseTime.average > 500) {
      recommendations.push({
        priority: 'medium',
        type: 'performance',
        message: 'Response time is slow. Consider optimization.',
        data: performanceInsights.responseTime
      });
    }
    
    return recommendations;
  }

  /**
   * 隐私保护和数据清理方法
   */
  sanitizeFeatureName(feature) {
    return String(feature).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
  }

  sanitizeErrorMessage(message) {
    return String(message)
      .replace(/https?:\/\/[^\s]+/g, '[URL]') // 移除URL
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]') // 移除IP
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]') // 移除邮箱
      .substring(0, 200);
  }

  sanitizeStackTrace(stack) {
    if (!stack) return null;
    
    return stack
      .split('\n')
      .slice(0, 5) // 只保留前5行
      .map(line => line.replace(/https?:\/\/[^\s]+/g, '[URL]'))
      .join('\n')
      .substring(0, 500);
  }

  sanitizeContext(context) {
    if (!context || typeof context !== 'object') return {};
    
    const sanitized = {};
    const allowedKeys = ['component', 'action', 'feature', 'state'];
    
    allowedKeys.forEach(key => {
      if (context[key]) {
        sanitized[key] = String(context[key]).substring(0, 50);
      }
    });
    
    return sanitized;
  }

  sanitizeUrl(url) {
    if (!url) return null;
    
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
    } catch {
      return '[INVALID_URL]';
    }
  }

  sanitizeSettingName(setting) {
    return String(setting).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  }

  hashContext(context) {
    return this.simpleHash(JSON.stringify(context)).toString(36);
  }

  hashValue(value) {
    return this.simpleHash(String(value)).toString(36);
  }

  anonymizeData(data) {
    const anonymized = {};
    
    for (const [key, value] of Object.entries(data || {})) {
      if (typeof value === 'string' && value.length > 20) {
        anonymized[key] = `[${value.length}chars]`;
      } else if (typeof value === 'number') {
        anonymized[key] = value;
      } else {
        anonymized[key] = this.hashValue(value);
      }
    }
    
    return anonymized;
  }

  /**
   * 实用工具方法
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }

  getSessionId() {
    if (!this._sessionId) {
      this._sessionId = this.simpleHash(Date.now() + Math.random()).toString(36);
    }
    return this._sessionId;
  }

  getUserAgentInfo() {
    const ua = navigator.userAgent;
    const match = ua.match(/(Chrome|Firefox|Safari)\/(\d+)/);
    return match ? `${match[1]}/${match[2]}` : 'Unknown';
  }

  getDataSize(data) {
    return new Blob([JSON.stringify(data)]).size;
  }

  calculateAverageSessionLength() {
    const sessions = this.groupJourneyBySessions();
    if (sessions.length === 0) return 0;
    
    const totalLength = sessions.reduce((sum, session) => {
      if (session.length < 2) return sum;
      return sum + (session[session.length - 1].timestamp - session[0].timestamp);
    }, 0);
    
    return totalLength / sessions.length;
  }

  calculateErrorRate() {
    const totalEvents = this.data.userJourney.length;
    const errorEvents = this.data.userJourney.filter(j => j.action === 'error_occurred').length;
    
    return totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;
  }

  groupJourneyBySessions() {
    const sessions = [];
    let currentSession = [];
    
    const sessionTimeout = 30 * 60 * 1000; // 30分钟
    
    this.data.userJourney.forEach(journey => {
      if (currentSession.length === 0) {
        currentSession.push(journey);
      } else {
        const lastEvent = currentSession[currentSession.length - 1];
        if (journey.timestamp - lastEvent.timestamp > sessionTimeout) {
          sessions.push(currentSession);
          currentSession = [journey];
        } else {
          currentSession.push(journey);
        }
      }
    });
    
    if (currentSession.length > 0) {
      sessions.push(currentSession);
    }
    
    return sessions;
  }

  saveDataAsync() {
    // 防抖保存
    clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => {
      this.saveData();
    }, 1000);
  }

  /**
   * 导出数据（隐私安全）
   */
  exportData(includeRawData = false) {
    const report = this.generateReport();
    
    if (includeRawData) {
      return {
        report,
        rawData: this.serializeData()
      };
    }
    
    return report;
  }

  /**
   * 清除所有数据
   */
  async clearAllData() {
    this.data = {
      features: new Map(),
      errors: [],
      performance: [],
      userJourney: [],
      settings: new Map(),
      lastCleanup: Date.now()
    };
    
    await chrome.storage.local.remove(['metricsData']);
  }
}

// 全局实例
if (typeof window !== 'undefined') {
  window.metricsCollector = window.metricsCollector || new MetricsCollector();
}

// 导出给其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MetricsCollector;
}