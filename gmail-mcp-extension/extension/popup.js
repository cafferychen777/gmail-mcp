// Check connection status with enhanced details and auto-refresh
function checkConnectionStatus() {
  chrome.runtime.sendMessage({ action: 'checkConnection' }, (response) => {
    const statusDiv = document.getElementById('status');
    const detailsDiv = document.getElementById('connection-details');

    if (chrome.runtime.lastError || !response) {
      statusDiv.textContent = 'Extension communication error';
      statusDiv.className = 'status disconnected';
      if (detailsDiv) {
        detailsDiv.textContent = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'No response from background script';
      }
    } else if (!response.connected) {
      statusDiv.className = 'status disconnected';

      if (!response.polling) {
        statusDiv.textContent = 'Bridge server polling not started';
      } else if (!response.healthy) {
        statusDiv.textContent = `Bridge server connection issues (${response.attempts} attempts)`;
        if (detailsDiv && response.lastError) {
          detailsDiv.textContent = `Last error: ${response.lastError}`;
          detailsDiv.style.color = '#721c24';
          detailsDiv.style.fontSize = '12px';
          detailsDiv.style.marginTop = '5px';
        }
      } else {
        statusDiv.textContent = 'Bridge server not connected';
      }
    } else {
      statusDiv.textContent = 'Bridge server connected';
      statusDiv.className = 'status connected';
      if (detailsDiv) {
        detailsDiv.textContent = `Connected to ${response.bridgeUrl}`;
        detailsDiv.style.color = '#155724';
        detailsDiv.style.fontSize = '12px';
        detailsDiv.style.marginTop = '5px';
      }
    }
  });
}

// Initial check
checkConnectionStatus();

// Auto-refresh connection status every 5 seconds
setInterval(checkConnectionStatus, 5000);

// Setup button functionality
document.getElementById('setup').addEventListener('click', () => {
  const setupInfo = document.getElementById('setup-info');
  const extensionId = chrome.runtime.id;
  
  document.getElementById('extension-id').textContent = extensionId;
  setupInfo.style.display = 'block';
});

// Copy bridge server command
document.getElementById('copy-setup').addEventListener('click', () => {
  const bridgeCommand = `cd ~/CascadeProjects/gmail-mcp/gmail-mcp-extension/mcp-server && npm run bridge`;
  
  navigator.clipboard.writeText(bridgeCommand).then(() => {
    document.getElementById('copy-status').style.display = 'block';
    setTimeout(() => {
      document.getElementById('copy-status').style.display = 'none';
    }, 2000);
  });
});

// Enhanced test functions with loading states
function showResults(data, isLoading = false) {
  const resultsDiv = document.getElementById('test-results');
  const resultsContent = document.getElementById('results-content');

  if (isLoading) {
    resultsContent.textContent = 'Loading...';
    resultsDiv.className = 'test-results loading';
  } else {
    resultsContent.textContent = JSON.stringify(data, null, 2);
    resultsDiv.className = data.error ? 'test-results error' : 'test-results success';
  }

  resultsDiv.style.display = 'block';

  // Auto-hide after 10 seconds for success, keep errors visible
  if (!isLoading && !data.error) {
    setTimeout(() => {
      resultsDiv.style.display = 'none';
    }, 10000);
  }
}

function setButtonLoading(buttonId, isLoading) {
  const button = document.getElementById(buttonId);
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = 'Loading...';
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}

// Test get emails with enhanced UX
document.getElementById('test-emails').addEventListener('click', () => {
  setButtonLoading('test-emails', true);
  showResults({}, true);

  chrome.runtime.sendMessage({ action: 'getEmails', id: Date.now() }, (response) => {
    setButtonLoading('test-emails', false);

    if (chrome.runtime.lastError) {
      showResults({
        error: chrome.runtime.lastError.message,
        suggestion: 'Make sure Gmail is open in a browser tab'
      });
    } else {
      showResults(response || { error: 'No response from extension' });
    }
  });
});

// Test send email with enhanced UX
document.getElementById('test-send').addEventListener('click', () => {
  setButtonLoading('test-send', true);
  showResults({}, true);

  chrome.runtime.sendMessage({
    action: 'sendEmail',
    id: Date.now(),
    params: {
      to: 'test@example.com',
      subject: 'Test from Gmail MCP Bridge',
      body: 'This is a test email sent at ' + new Date().toLocaleString()
    }
  }, (response) => {
    setButtonLoading('test-send', false);

    if (chrome.runtime.lastError) {
      showResults({
        error: chrome.runtime.lastError.message,
        suggestion: 'Make sure Gmail is open and you are logged in'
      });
    } else {
      showResults(response || { error: 'No response from extension' });
    }
  });
});

// Test search emails
document.getElementById('test-search').addEventListener('click', () => {
  setButtonLoading('test-search', true);
  showResults({}, true);

  chrome.runtime.sendMessage({
    action: 'searchEmails',
    id: Date.now(),
    params: {
      query: 'Augment',
      options: {
        limit: 5
      }
    }
  }, (response) => {
    setButtonLoading('test-search', false);

    if (chrome.runtime.lastError) {
      showResults({
        error: chrome.runtime.lastError.message,
        suggestion: 'Make sure Gmail is open and you are logged in'
      });
    } else {
      showResults(response || { error: 'No search response from extension' });
    }
  });
});

// Debug Gmail page
document.getElementById('debug-page').addEventListener('click', () => {
  setButtonLoading('debug-page', true);
  showResults({}, true);

  chrome.runtime.sendMessage({
    action: 'debugPage',
    id: Date.now()
  }, (response) => {
    setButtonLoading('debug-page', false);

    if (chrome.runtime.lastError) {
      showResults({
        error: chrome.runtime.lastError.message,
        suggestion: 'Make sure Gmail is open and the extension is working'
      });
    } else {
      showResults(response || { error: 'No debug response from extension' });
    }
  });
});

// Add refresh connection button functionality
document.getElementById('refresh-connection').addEventListener('click', () => {
  const button = document.getElementById('refresh-connection');
  const statusDiv = document.getElementById('status');
  const detailsDiv = document.getElementById('connection-details');

  button.disabled = true;
  button.textContent = 'Refreshing...';
  statusDiv.textContent = 'Checking connection...';
  statusDiv.className = 'status checking';

  // Clear details
  if (detailsDiv) {
    detailsDiv.textContent = '';
  }

  // Re-check connection after a short delay
  setTimeout(() => {
    chrome.runtime.sendMessage({ action: 'checkConnection' }, (response) => {
      button.disabled = false;
      button.textContent = 'Refresh Status';

      // Reuse the connection check logic
      if (chrome.runtime.lastError || !response) {
        statusDiv.textContent = 'Extension communication error';
        statusDiv.className = 'status disconnected';
        if (detailsDiv) {
          detailsDiv.textContent = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'No response from background script';
        }
      } else if (!response.connected) {
        statusDiv.className = 'status disconnected';

        if (!response.polling) {
          statusDiv.textContent = 'Bridge server polling not started';
        } else if (!response.healthy) {
          statusDiv.textContent = `Bridge server connection issues (${response.attempts} attempts)`;
          if (detailsDiv && response.lastError) {
            detailsDiv.textContent = `Last error: ${response.lastError}`;
            detailsDiv.style.color = '#721c24';
            detailsDiv.style.fontSize = '12px';
            detailsDiv.style.marginTop = '5px';
          }
        } else {
          statusDiv.textContent = 'Bridge server not connected';
        }
      } else {
        statusDiv.textContent = 'Bridge server connected';
        statusDiv.className = 'status connected';
        if (detailsDiv) {
          detailsDiv.textContent = `Connected to ${response.bridgeUrl}`;
          detailsDiv.style.color = '#155724';
          detailsDiv.style.fontSize = '12px';
          detailsDiv.style.marginTop = '5px';
        }
      }
    });
  }, 500);
});