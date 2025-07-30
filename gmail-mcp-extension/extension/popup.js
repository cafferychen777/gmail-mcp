// Check and display connection status
function updateConnectionStatus() {
  chrome.runtime.sendMessage({ action: 'checkConnection' }, (response) => {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const statusDetails = document.getElementById('status-details');
    const helpSection = document.getElementById('help-section');
    
    if (chrome.runtime.lastError || !response) {
      // Extension error
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = 'Extension Error';
      statusDetails.textContent = chrome.runtime.lastError?.message || 'Cannot communicate with extension';
      helpSection.style.display = 'block';
      return;
    }
    
    if (response.connected) {
      // Connected
      statusDot.className = 'status-dot connected';
      statusText.textContent = 'Connected';
      statusDetails.textContent = 'Bridge server is running and Gmail is connected';
      helpSection.style.display = 'none';
    } else {
      // Not connected
      statusDot.className = 'status-dot disconnected';
      
      if (!response.polling) {
        statusText.textContent = 'Bridge Not Started';
        statusDetails.textContent = 'Bridge server polling has not started';
      } else if (!response.healthy) {
        statusText.textContent = 'Bridge Server Offline';
        statusDetails.textContent = response.lastError || 'Cannot connect to bridge server on port 3456';
      } else {
        statusText.textContent = 'Waiting for Connection';
        statusDetails.textContent = 'Bridge server is running but waiting for connection';
      }
      helpSection.style.display = 'block';
    }
  });
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

// Check status on load
updateConnectionStatus();

// Auto-refresh every 3 seconds
setInterval(updateConnectionStatus, 3000);