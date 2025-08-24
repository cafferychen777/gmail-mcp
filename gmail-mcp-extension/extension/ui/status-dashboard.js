/**
 * 状态仪表板控制器 - 基于Linus的"好品味"原则
 * 无特殊情况，统一的状态处理逻辑
 */

class StatusDashboard {
  constructor() {
    this.statusManager = window.statusManager;
    this.performanceData = [];
    this.maxDataPoints = 20;
    this.isRefreshing = false;
    
    this.init();
  }

  init() {
    // 绑定事件监听器
    this.bindEvents();
    
    // 监听状态变化
    this.statusManager.addListener((state) => {
      this.updateDisplay(state);
      this.updatePerformanceChart(state);
    });
    
    // 开始自动更新
    this.statusManager.startAutoCheck();
  }

  bindEvents() {
    // 刷新按钮
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.handleRefresh();
    });

    // 设置按钮 
    document.getElementById('settings-btn').addEventListener('click', () => {
      this.openSettings();
    });

    // 快速操作按钮
    document.getElementById('open-setup').addEventListener('click', () => {
      this.openSetupWizard();
    });

    document.getElementById('open-troubleshoot').addEventListener('click', () => {
      this.openTroubleshoot();
    });

    document.getElementById('open-logs').addEventListener('click', () => {
      this.openLogs();
    });

    document.getElementById('open-github').addEventListener('click', () => {
      this.openGitHub();
    });
  }

  /**
   * 更新显示 - 单一状态处理函数，消除if/else分支
   */
  updateDisplay(state) {
    const displayInfo = this.statusManager.getDisplayInfo();
    
    // 更新状态指示器
    this.updateStatusIndicator(displayInfo);
    
    // 更新性能指标
    this.updateMetrics(displayInfo.metrics);
  }

  updateStatusIndicator({ dot, text, details }) {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const statusDetails = document.getElementById('status-details');

    // 统一的状态更新，无条件分支
    statusDot.className = `status-dot ${dot}`;
    statusText.textContent = text;
    statusDetails.textContent = details;
  }

  updateMetrics(metrics) {
    // 响应时间
    const responseTimeElement = document.getElementById('response-time');
    const responseTimeMetric = document.getElementById('response-time-metric');
    
    if (metrics.responseTime > 0) {
      responseTimeElement.textContent = `${metrics.responseTime}ms`;
      responseTimeMetric.className = this.getMetricClass('response-time', metrics.responseTime);
    } else {
      responseTimeElement.textContent = '--';
      responseTimeMetric.className = 'metric';
    }

    // 运行时间
    document.getElementById('uptime').textContent = metrics.uptime || '--';

    // 成功率
    const successRateElement = document.getElementById('success-rate');
    const successRateMetric = document.getElementById('success-rate-metric');
    
    if (metrics.successRate >= 0) {
      successRateElement.textContent = `${metrics.successRate}%`;
      successRateMetric.className = this.getMetricClass('success-rate', metrics.successRate);
    } else {
      successRateElement.textContent = '--';
      successRateMetric.className = 'metric';
    }

    // 错误率
    const errorRateElement = document.getElementById('error-rate');
    const errorRateMetric = document.getElementById('error-rate-metric');
    
    if (metrics.errorRate >= 0) {
      errorRateElement.textContent = `${metrics.errorRate}%`;
      errorRateMetric.className = this.getMetricClass('error-rate', metrics.errorRate);
    } else {
      errorRateElement.textContent = '--';
      errorRateMetric.className = 'metric';
    }
  }

  /**
   * 获取指标样式类 - 统一的阈值逻辑
   */
  getMetricClass(type, value) {
    const thresholds = {
      'response-time': { good: 100, warning: 500 },
      'success-rate': { good: 95, warning: 80 },
      'error-rate': { good: 5, warning: 20 }
    };

    const threshold = thresholds[type];
    if (!threshold) return 'metric';

    if (type === 'response-time' || type === 'error-rate') {
      // 越小越好的指标
      if (value <= threshold.good) return 'metric success';
      if (value <= threshold.warning) return 'metric warning';
      return 'metric error';
    } else {
      // 越大越好的指标
      if (value >= threshold.good) return 'metric success';
      if (value >= threshold.warning) return 'metric warning';
      return 'metric error';
    }
  }

  /**
   * 更新性能图表
   */
  updatePerformanceChart(state) {
    const { metrics } = state;
    
    // 添加新的数据点
    if (metrics.responseTime > 0) {
      this.performanceData.push(metrics.responseTime);
    }
    
    // 保持数据点数量限制
    if (this.performanceData.length > this.maxDataPoints) {
      this.performanceData.shift();
    }
    
    this.renderChart();
  }

  renderChart() {
    const chartContainer = document.getElementById('performance-chart');
    const chartLatest = document.getElementById('chart-latest');
    
    // 清空现有内容
    chartContainer.innerHTML = '';
    
    if (this.performanceData.length === 0) {
      chartLatest.textContent = '--ms';
      return;
    }

    // 计算最大值用于缩放
    const maxValue = Math.max(...this.performanceData);
    const latest = this.performanceData[this.performanceData.length - 1];
    chartLatest.textContent = `${latest}ms`;

    // 生成图表条
    const barWidth = 100 / this.maxDataPoints;
    
    this.performanceData.forEach((value, index) => {
      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      bar.style.left = `${index * barWidth}%`;
      bar.style.height = maxValue > 0 ? `${(value / maxValue) * 100}%` : '0%';
      bar.style.width = `${barWidth * 0.8}%`;
      
      // 添加悬停提示
      bar.title = `${value}ms`;
      
      chartContainer.appendChild(bar);
    });
  }

  /**
   * 处理刷新操作
   */
  async handleRefresh() {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = refreshBtn.querySelector('svg');
    const refreshText = refreshBtn.querySelector('span');
    
    // 添加动画效果
    refreshIcon.classList.add('rotating');
    refreshText.textContent = 'Refreshing...';
    refreshBtn.disabled = true;
    
    try {
      await this.statusManager.checkConnection();
    } finally {
      // 移除动画效果
      setTimeout(() => {
        refreshIcon.classList.remove('rotating');
        refreshText.textContent = 'Refresh';
        refreshBtn.disabled = false;
        this.isRefreshing = false;
      }, 1000);
    }
  }

  /**
   * 打开设置页面
   */
  openSettings() {
    // 未来实现设置页面
    console.log('Opening settings...');
  }

  /**
   * 打开安装向导
   */
  openSetupWizard() {
    const setupUrl = chrome.runtime.getURL('ui/setup-wizard.html');
    chrome.tabs.create({ url: setupUrl });
  }

  /**
   * 打开故障排除
   */
  openTroubleshoot() {
    const troubleshootUrl = chrome.runtime.getURL('ui/troubleshoot.html');
    chrome.tabs.create({ url: troubleshootUrl });
  }

  /**
   * 打开日志查看器
   */
  openLogs() {
    // 未来实现日志查看器
    console.log('Opening logs...');
  }

  /**
   * 打开GitHub文档
   */
  openGitHub() {
    chrome.tabs.create({ 
      url: 'https://github.com/cafferychen777/gmail-mcp'
    });
  }

  /**
   * 清理资源
   */
  destroy() {
    this.statusManager.stopAutoCheck();
    this.statusManager.removeListener(this.updateDisplay);
  }
}

// 初始化仪表板
document.addEventListener('DOMContentLoaded', () => {
  new StatusDashboard();
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
  if (window.dashboard) {
    window.dashboard.destroy();
  }
});