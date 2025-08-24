/**
 * Gmail MCP Bridge - Predictive System Monitor
 * 
 * Linus Philosophy: "Prevention is better than recovery"
 * - 监控趋势而不是状态
 * - 预测故障而不是等待故障
 * - 简单的指标但强大的预测
 * - 95%+ 的问题应该被提前发现
 * 
 * @version 1.0.0 - New Module
 */

/**
 * PredictiveMonitor - 预测性系统监控
 * 
 * 通过分析历史数据和趋势来预测系统问题，
 * 而不是等到问题发生才反应。
 */
class PredictiveMonitor {
  constructor(systemState, healthChecker) {
    this.systemState = systemState;
    this.healthChecker = healthChecker;
    
    // 预测模型配置 - 简单有效，不过度工程化
    this.predictiveConfig = {
      historyWindow: 300000,    // 5分钟历史数据窗口
      sampleInterval: 10000,    // 10秒采样间隔
      trendSensitivity: 0.7,    // 趋势敏感度（0-1）
      alertThreshold: 0.8,      // 预警阈值（0-1）
      maxHistorySize: 100       // 最大历史记录数
    };
    
    // 预测指标 - 用数据驱动，不是复杂算法
    this.metrics = new Map([
      ['response_time_trend', { history: [], weight: 0.3, critical: true }],
      ['error_rate_trend', { history: [], weight: 0.4, critical: true }],
      ['connection_stability', { history: [], weight: 0.2, critical: true }],
      ['resource_usage_trend', { history: [], weight: 0.1, critical: false }]
    ]);
    
    // 预警状态
    this.alerts = new Map();
    this.lastPrediction = null;
    this.isMonitoring = false;
    
    // 故障模式识别 - 简单的模式匹配
    this.failurePatterns = new Map([
      ['slowdown_cascade', {
        description: '响应时间逐渐增加',
        detector: (history) => this._detectSlowdownCascade(history),
        severity: 'high',
        prediction: '系统可能在5-10分钟内出现性能问题'
      }],
      ['connection_instability', {
        description: '连接频繁断开重连',
        detector: (history) => this._detectConnectionInstability(history),
        severity: 'medium',
        prediction: '连接可能在2-5分钟内完全失败'
      }],
      ['error_spike', {
        description: '错误率急剧上升',
        detector: (history) => this._detectErrorSpike(history),
        severity: 'critical',
        prediction: '系统可能在1-3分钟内崩溃'
      }],
      ['resource_exhaustion', {
        description: '资源使用率持续增长',
        detector: (history) => this._detectResourceExhaustion(history),
        severity: 'medium', 
        prediction: '系统可能在10-15分钟内资源耗尽'
      }]
    ]);
  }
  
  /**
   * 启动预测性监控
   */
  startMonitoring() {
    if (this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = true;
    console.log('[PredictiveMonitor] Starting predictive monitoring...');
    
    // 定期采样和分析
    this.monitoringInterval = setInterval(() => {
      this._collectMetrics().catch(error => {
        console.error('[PredictiveMonitor] Metrics collection failed:', error);
      });
    }, this.predictiveConfig.sampleInterval);
    
    // 定期预测分析
    this.analysisInterval = setInterval(() => {
      this._performPredictiveAnalysis().catch(error => {
        console.error('[PredictiveMonitor] Predictive analysis failed:', error);
      });
    }, this.predictiveConfig.sampleInterval * 3); // 每30秒分析一次
  }
  
  /**
   * 停止预测性监控
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = false;
    console.log('[PredictiveMonitor] Stopping predictive monitoring...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
  }
  
  /**
   * 获取当前预测状态
   */
  getCurrentPrediction() {
    return {
      timestamp: Date.now(),
      prediction: this.lastPrediction,
      alerts: Array.from(this.alerts.values()),
      monitoring: this.isMonitoring,
      metricsStatus: this._getMetricsStatus()
    };
  }
  
  /**
   * 手动触发预测分析
   */
  async triggerAnalysis() {
    await this._collectMetrics();
    return await this._performPredictiveAnalysis();
  }
  
  /**
   * 收集系统指标
   */
  async _collectMetrics() {
    const timestamp = Date.now();
    
    try {
      // 获取所有组件的健康状态
      const healthStatus = await this.healthChecker.checkAllComponentsHealth();
      
      // 提取关键指标
      const responseTime = this._extractResponseTime(healthStatus);
      const errorRate = this._extractErrorRate(healthStatus);
      const connectionStability = this._extractConnectionStability(healthStatus);
      const resourceUsage = this._extractResourceUsage(healthStatus);
      
      // 更新历史数据
      this._updateMetricHistory('response_time_trend', responseTime, timestamp);
      this._updateMetricHistory('error_rate_trend', errorRate, timestamp);
      this._updateMetricHistory('connection_stability', connectionStability, timestamp);
      this._updateMetricHistory('resource_usage_trend', resourceUsage, timestamp);
      
    } catch (error) {
      console.error('[PredictiveMonitor] Failed to collect metrics:', error);
    }
  }
  
  /**
   * 执行预测性分析
   */
  async _performPredictiveAnalysis() {
    const predictions = [];
    const currentTime = Date.now();
    
    // 检查每种故障模式
    for (const [patternName, pattern] of this.failurePatterns) {
      const risk = pattern.detector(this.metrics);
      
      if (risk > this.predictiveConfig.alertThreshold) {
        const alert = {
          type: 'prediction',
          pattern: patternName,
          description: pattern.description,
          prediction: pattern.prediction,
          severity: pattern.severity,
          risk: Math.round(risk * 100),
          timestamp: currentTime,
          ttl: currentTime + (15 * 60 * 1000) // 15分钟有效期
        };
        
        predictions.push(alert);
        this.alerts.set(patternName, alert);
        
        console.warn(`[PredictiveMonitor] Predicted issue: ${patternName} (${Math.round(risk * 100)}% risk)`);\n      }\n    }\n    \n    // 清理过期警告\n    this._cleanupExpiredAlerts(currentTime);\n    \n    // 更新最新预测结果\n    this.lastPrediction = {\n      timestamp: currentTime,\n      overallRisk: this._calculateOverallRisk(predictions),\n      predictions: predictions,\n      recommendedActions: this._generateRecommendedActions(predictions)\n    };\n    \n    return this.lastPrediction;\n  }\n  \n  /**\n   * 更新指标历史数据\n   */\n  _updateMetricHistory(metricName, value, timestamp) {\n    const metric = this.metrics.get(metricName);\n    if (!metric) return;\n    \n    // 添加新数据点\n    metric.history.push({ value, timestamp });\n    \n    // 保持历史大小限制\n    if (metric.history.length > this.predictiveConfig.maxHistorySize) {\n      metric.history.shift();\n    }\n    \n    // 清理过期数据\n    const cutoffTime = timestamp - this.predictiveConfig.historyWindow;\n    metric.history = metric.history.filter(point => point.timestamp > cutoffTime);\n  }\n  \n  /**\n   * 检测响应时间下降趋势\n   */\n  _detectSlowdownCascade(metrics) {\n    const responseMetric = metrics.get('response_time_trend');\n    if (!responseMetric || responseMetric.history.length < 5) {\n      return 0;\n    }\n    \n    const history = responseMetric.history.slice(-10); // 最近10个样本\n    const trend = this._calculateTrend(history.map(h => h.value));\n    \n    // 如果响应时间持续增长且最近的响应时间超过正常范围\n    const recentAvg = history.slice(-3).reduce((sum, h) => sum + h.value, 0) / 3;\n    const baselineAvg = history.slice(0, 3).reduce((sum, h) => sum + h.value, 0) / 3;\n    \n    if (trend > 0.5 && recentAvg > baselineAvg * 1.5) {\n      return Math.min(trend, 1.0);\n    }\n    \n    return 0;\n  }\n  \n  /**\n   * 检测连接不稳定模式\n   */\n  _detectConnectionInstability(metrics) {\n    const connectionMetric = metrics.get('connection_stability');\n    if (!connectionMetric || connectionMetric.history.length < 5) {\n      return 0;\n    }\n    \n    const history = connectionMetric.history.slice(-10);\n    const recentConnections = history.map(h => h.value);\n    \n    // 检测连接波动 - 如果连接状态频繁变化\n    let fluctuations = 0;\n    for (let i = 1; i < recentConnections.length; i++) {\n      if (Math.abs(recentConnections[i] - recentConnections[i-1]) > 0.3) {\n        fluctuations++;\n      }\n    }\n    \n    const instabilityRatio = fluctuations / (recentConnections.length - 1);\n    return Math.min(instabilityRatio * 1.5, 1.0);\n  }\n  \n  /**\n   * 检测错误率激增\n   */\n  _detectErrorSpike(metrics) {\n    const errorMetric = metrics.get('error_rate_trend');\n    if (!errorMetric || errorMetric.history.length < 3) {\n      return 0;\n    }\n    \n    const history = errorMetric.history.slice(-5);\n    const recentErrors = history.slice(-2).map(h => h.value);\n    const baselineErrors = history.slice(0, 2).map(h => h.value);\n    \n    const recentAvg = recentErrors.reduce((sum, e) => sum + e, 0) / recentErrors.length;\n    const baselineAvg = baselineErrors.reduce((sum, e) => sum + e, 0) / baselineErrors.length;\n    \n    // 如果最近错误率是基线的3倍以上\n    if (recentAvg > baselineAvg * 3 && recentAvg > 0.1) {\n      return Math.min((recentAvg / baselineAvg) / 5, 1.0);\n    }\n    \n    return 0;\n  }\n  \n  /**\n   * 检测资源耗尽趋势\n   */\n  _detectResourceExhaustion(metrics) {\n    const resourceMetric = metrics.get('resource_usage_trend');\n    if (!resourceMetric || resourceMetric.history.length < 5) {\n      return 0;\n    }\n    \n    const history = resourceMetric.history.slice(-10);\n    const trend = this._calculateTrend(history.map(h => h.value));\n    const latestUsage = history[history.length - 1].value;\n    \n    // 如果使用率持续增长且已经很高\n    if (trend > 0.3 && latestUsage > 0.7) {\n      return Math.min(trend + (latestUsage - 0.7) * 2, 1.0);\n    }\n    \n    return 0;\n  }\n  \n  /**\n   * 计算趋势 - 简单的线性回归\n   */\n  _calculateTrend(values) {\n    if (values.length < 2) return 0;\n    \n    const n = values.length;\n    const x = Array.from({length: n}, (_, i) => i);\n    \n    const sumX = x.reduce((a, b) => a + b, 0);\n    const sumY = values.reduce((a, b) => a + b, 0);\n    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);\n    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);\n    \n    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);\n    return slope;\n  }\n  \n  /**\n   * 提取响应时间指标\n   */\n  _extractResponseTime(healthStatus) {\n    const components = Object.values(healthStatus.components);\n    const responseTimes = components\n      .filter(c => c.metrics && c.metrics.responseTime)\n      .map(c => c.metrics.responseTime);\n    \n    if (responseTimes.length === 0) return 0;\n    \n    return responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;\n  }\n  \n  /**\n   * 提取错误率指标\n   */\n  _extractErrorRate(healthStatus) {\n    const components = Object.values(healthStatus.components);\n    const unhealthyCount = components.filter(c => !c.healthy).length;\n    \n    return components.length > 0 ? unhealthyCount / components.length : 0;\n  }\n  \n  /**\n   * 提取连接稳定性指标\n   */\n  _extractConnectionStability(healthStatus) {\n    const bridgeHealth = healthStatus.components.bridgeServer;\n    const chromeHealth = healthStatus.components.chromeExtension;\n    \n    let stability = 1.0;\n    \n    if (bridgeHealth && !bridgeHealth.healthy) {\n      stability -= 0.5;\n    }\n    \n    if (chromeHealth && !chromeHealth.healthy) {\n      stability -= 0.3;\n    }\n    \n    return Math.max(stability, 0);\n  }\n  \n  /**\n   * 提取资源使用率指标\n   */\n  _extractResourceUsage(healthStatus) {\n    // 简单的资源使用率估算\n    // 基于响应时间和错误率\n    const avgResponseTime = this._extractResponseTime(healthStatus);\n    const errorRate = this._extractErrorRate(healthStatus);\n    \n    // 响应时间越长，错误率越高，资源使用率越高\n    const responseUsage = Math.min(avgResponseTime / 5000, 1); // 5秒为100%\n    const errorUsage = errorRate; // 错误率直接映射\n    \n    return (responseUsage + errorUsage) / 2;\n  }\n  \n  /**\n   * 计算整体风险\n   */\n  _calculateOverallRisk(predictions) {\n    if (predictions.length === 0) return 0;\n    \n    // 最高风险决定整体风险\n    const maxRisk = Math.max(...predictions.map(p => p.risk));\n    return maxRisk;\n  }\n  \n  /**\n   * 生成建议行动\n   */\n  _generateRecommendedActions(predictions) {\n    const actions = [];\n    \n    for (const prediction of predictions) {\n      switch (prediction.pattern) {\n        case 'slowdown_cascade':\n          actions.push({\n            action: '检查系统资源使用情况',\n            priority: 'high',\n            description: '系统响应变慢可能是资源瓶颈导致的'\n          });\n          break;\n          \n        case 'connection_instability':\n          actions.push({\n            action: '重启Bridge服务器和Chrome扩展',\n            priority: 'medium',\n            description: '连接不稳定通常可以通过重启组件解决'\n          });\n          break;\n          \n        case 'error_spike':\n          actions.push({\n            action: '立即检查错误日志',\n            priority: 'critical',\n            description: '错误率激增需要立即调查根本原因'\n          });\n          break;\n          \n        case 'resource_exhaustion':\n          actions.push({\n            action: '释放系统资源或增加系统容量',\n            priority: 'medium',\n            description: '预防系统因资源不足而崩溃'\n          });\n          break;\n      }\n    }\n    \n    return actions;\n  }\n  \n  /**\n   * 获取指标状态\n   */\n  _getMetricsStatus() {\n    const status = {};\n    \n    for (const [metricName, metric] of this.metrics) {\n      status[metricName] = {\n        samples: metric.history.length,\n        latest: metric.history.length > 0 ? metric.history[metric.history.length - 1] : null,\n        trend: metric.history.length > 2 ? \n          this._calculateTrend(metric.history.slice(-5).map(h => h.value)) : 0\n      };\n    }\n    \n    return status;\n  }\n  \n  /**\n   * 清理过期警告\n   */\n  _cleanupExpiredAlerts(currentTime) {\n    for (const [alertName, alert] of this.alerts) {\n      if (alert.ttl < currentTime) {\n        this.alerts.delete(alertName);\n      }\n    }\n  }\n}\n\n// Export for Node.js and browsers\nif (typeof module !== 'undefined' && module.exports) {\n  module.exports = { PredictiveMonitor };\n} else if (typeof window !== 'undefined') {\n  window.PredictiveMonitor = PredictiveMonitor;\n}