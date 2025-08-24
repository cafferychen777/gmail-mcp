// 现代化的状态管理 - 使用新的StatusManager
function initializeStatusManager() {
  // 加载状态管理器
  const script = document.createElement('script');
  script.src = 'core/status-manager.js';
  script.onload = function() {
    const statusManager = window.statusManager;
    
    // 监听状态变化
    statusManager.addListener((state) => {
      updateConnectionDisplay(statusManager.getDisplayInfo());
    });
    
    // 开始自动检查
    statusManager.startAutoCheck();
  };
  document.head.appendChild(script);
}

// 更简洁的状态显示更新
function updateConnectionDisplay(displayInfo) {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const statusDetails = document.getElementById('status-details');
  const helpSection = document.getElementById('help-section');
  
  statusDot.className = `status-dot ${displayInfo.dot}`;
  statusText.textContent = displayInfo.text;
  statusDetails.textContent = displayInfo.details;
  helpSection.style.display = displayInfo.showHelp ? 'block' : 'none';
}

// 向后兼容的更新函数
function updateConnectionStatus() {
  // 如果状态管理器已加载，使用它
  if (window.statusManager) {
    window.statusManager.checkConnection();
  } else {
    // 否则使用原始逻辑作为后备
    chrome.runtime.sendMessage({ action: 'checkConnection' }, (response) => {
      const displayInfo = parseResponse(response);
      updateConnectionDisplay(displayInfo);
    });
  }
}

function parseResponse(response) {
  if (chrome.runtime.lastError || !response) {
    return {
      dot: 'disconnected',
      text: 'Extension Error',
      details: chrome.runtime.lastError?.message || 'Cannot communicate with extension',
      showHelp: true
    };
  }
  
  if (response.connected) {
    return {
      dot: 'connected',
      text: 'Connected',
      details: 'Bridge server is running and Gmail is connected',
      showHelp: false
    };
  } else {
    let text, details;
    
    if (!response.polling) {
      text = 'Bridge Not Started';
      details = 'Bridge server polling has not started';
    } else if (!response.healthy) {
      text = 'Bridge Server Offline';
      details = response.lastError || 'Cannot connect to bridge server on port 3456';
    } else {
      text = 'Waiting for Connection';
      details = 'Bridge server is running but waiting for connection';
    }
    
    return { dot: 'disconnected', text, details, showHelp: true };
  }
}

// Refresh button functionality
document.getElementById('refresh-btn').addEventListener('click', function() {
  const refreshBtn = this;
  const refreshIcon = refreshBtn.querySelector('svg');
  const refreshText = refreshBtn.querySelector('span');
  
  // Add rotating animation
  refreshIcon.classList.add('rotating');
  refreshText.textContent = 'Refreshing...';
  refreshBtn.disabled = true;
  
  // Update status
  updateConnectionStatus();
  
  // Remove animation after a short delay
  setTimeout(() => {
    refreshIcon.classList.remove('rotating');
    refreshText.textContent = 'Refresh';
    refreshBtn.disabled = false;
  }, 1000);
});

// 初始化时优先使用新的状态管理器
document.addEventListener('DOMContentLoaded', () => {
  initializeStatusManager();
});

// 后备方案：如果状态管理器加载失败，使用传统方式
setTimeout(() => {
  if (!window.statusManager) {
    console.log('StatusManager not loaded, falling back to legacy mode');
    updateConnectionStatus();
    setInterval(updateConnectionStatus, 3000);
  }
}, 1000);