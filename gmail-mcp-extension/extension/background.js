// Bridge server configuration
const BRIDGE_URL = 'http://localhost:3456';
let bridgePolling = false;

let bridgeConnectionAttempts = 0;
let bridgeLastError = null;
let bridgeHealthy = false;

// Keep service worker alive
let keepAliveInterval;

function keepServiceWorkerAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }

  keepAliveInterval = setInterval(() => {
    // Send a ping to keep the service worker active
    chrome.runtime.getPlatformInfo(() => {
      // This is just to keep the service worker alive
    });
  }, 20000); // Every 20 seconds
}

// Start keeping service worker alive
keepServiceWorkerAlive();

async function pollBridgeServer() {
  if (bridgePolling) return;
  bridgePolling = true;

  console.log('Starting bridge server polling...');

  while (true) {
    try {
      // Keep service worker alive during polling
      keepServiceWorkerAlive();

      // Health check first with shorter timeout
      const healthController = new AbortController();
      const healthTimeout = setTimeout(() => healthController.abort(), 3000);

      const healthResponse = await fetch(`${BRIDGE_URL}/health`, {
        method: 'GET',
        signal: healthController.signal
      });

      clearTimeout(healthTimeout);

      if (!healthResponse.ok) {
        throw new Error(`Bridge server health check failed: ${healthResponse.status}`);
      }

      // Reset error tracking on successful health check
      if (!bridgeHealthy) {
        console.log('Bridge server connection restored');
        bridgeConnectionAttempts = 0;
        bridgeLastError = null;
        bridgeHealthy = true;
      }

      // Poll for requests with timeout control
      const pollController = new AbortController();
      const pollTimeout = setTimeout(() => pollController.abort(), 8000);

      const response = await fetch(`${BRIDGE_URL}/chrome/poll`, {
        method: 'GET',
        signal: pollController.signal
      });

      clearTimeout(pollTimeout);

      if (!response.ok) {
        throw new Error(`Poll request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.id && data.action) {
        console.log('Received request from bridge:', data);

        // Forward to Gmail tab with enhanced error handling
        chrome.tabs.query({ url: 'https://mail.google.com/*' }, async (tabs) => {
          if (tabs.length > 0) {
            try {
              // Create a promise to wait for response
              const responsePromise = new Promise((resolve, reject) => {
                const requestId = data.id;

                // Store callback for bridge response
                if (!globalThis.bridgeRequests) {
                  globalThis.bridgeRequests = new Map();
                }
                globalThis.bridgeRequests.set(requestId, resolve);

                // Send to content script with error handling
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: data.action,
                  params: data.params,
                  id: requestId
                }, (response) => {
                  if (chrome.runtime.lastError) {
                    const errorMessage = chrome.runtime.lastError.message || 'Unknown content script error';
                    console.error('Error sending to content script:', errorMessage);
                    globalThis.bridgeRequests.delete(requestId);
                    resolve({ error: `Content script error: ${errorMessage}` });
                  } else {
                    // Handle response directly
                    console.log('Received response from content script for bridge:', response);
                    globalThis.bridgeRequests.delete(requestId);
                    resolve(response);
                  }
                });

                // Timeout after 30 seconds for search operations (they take longer)
                const timeoutDuration = data.action === 'searchEmails' ? 30000 : 15000;
                setTimeout(() => {
                  if (globalThis.bridgeRequests.has(requestId)) {
                    globalThis.bridgeRequests.delete(requestId);
                    resolve({ error: `Request timeout after ${timeoutDuration/1000} seconds` });
                  }
                }, timeoutDuration);
              });

              // Wait for response
              const result = await responsePromise;

              // Send response back to bridge with retry logic
              await sendResponseToBridge(data.id, result);

            } catch (error) {
              console.error('Error processing bridge request:', error);
              await sendResponseToBridge(data.id, { error: error.message });
            }
          } else {
            // No Gmail tab open
            await sendResponseToBridge(data.id, { error: 'No Gmail tab open. Please open Gmail in a browser tab.' });
          }
        });
      }
    } catch (error) {
      bridgeHealthy = false;
      bridgeConnectionAttempts++;
      bridgeLastError = error.message;

      console.error(`Bridge polling error (attempt ${bridgeConnectionAttempts}):`, error);

      // Shorter backoff for better responsiveness
      let waitTime = Math.min(1000 * Math.pow(1.5, Math.min(bridgeConnectionAttempts - 1, 8)), 10000);

      if (bridgeConnectionAttempts % 5 === 0) {
        console.warn(`Bridge server connection failed ${bridgeConnectionAttempts} times. Last error: ${bridgeLastError}`);
        // Try to restart polling after multiple failures
        if (bridgeConnectionAttempts >= 10) {
          console.log('Attempting to restart bridge polling...');
          bridgePolling = false;
          setTimeout(() => pollBridgeServer(), 5000);
          return;
        }
      }

      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }

    // Shorter polling interval for better responsiveness
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Helper function to send response to bridge with retry logic
async function sendResponseToBridge(requestId, result, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${BRIDGE_URL}/chrome/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: requestId,
          response: result.error ? null : result,
          error: result.error
        }),
        timeout: 5000
      });

      if (response.ok) {
        return; // Success
      } else {
        throw new Error(`Response failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to send response to bridge (attempt ${attempt}/${retries}):`, error);

      if (attempt === retries) {
        console.error(`Failed to send response after ${retries} attempts. Request ID: ${requestId}`);
      } else {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}

// Start polling when extension loads with delay to ensure everything is ready
setTimeout(() => {
  console.log('Initializing bridge server connection...');
  pollBridgeServer();
}, 1000);

// Also restart polling when extension wakes up
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup detected, restarting bridge polling...');
  bridgePolling = false;
  setTimeout(() => pollBridgeServer(), 2000);
});

// Handle extension suspension/resume
chrome.runtime.onSuspend.addListener(() => {
  console.log('Extension suspending...');
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
});

chrome.runtime.onSuspendCanceled.addListener(() => {
  console.log('Extension suspend canceled, restarting services...');
  keepServiceWorkerAlive();
  if (!bridgePolling) {
    setTimeout(() => pollBridgeServer(), 1000);
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle popup requests
  if (request.action === 'checkConnection') {
    // Enhanced connection status check
    sendResponse({
      connected: bridgePolling && bridgeHealthy,
      polling: bridgePolling,
      healthy: bridgeHealthy,
      attempts: bridgeConnectionAttempts,
      lastError: bridgeLastError,
      bridgeUrl: BRIDGE_URL
    });
    return true;
  }
  
  // Handle content script ready signal
  if (request.action === 'contentScriptReady') {
    console.log('Content script ready on tab:', sender.tab.id);
    sendResponse({ status: 'acknowledged' });
    return true;
  }
  
  // Handle Gmail action requests (from popup or native host)
  if (request.action && ['getEmails', 'sendEmail', 'readEmail', 'replyEmail', 'composeReply', 'debugPage', 'searchEmails'].includes(request.action)) {
    // Check if this is from popup or native host
    const isFromPopup = !sender.tab;
    const requestId = request.id || Date.now();
    
    // Store the original requester info
    if (!globalThis.pendingRequests) {
      globalThis.pendingRequests = new Map();
    }
    
    if (isFromPopup) {
      // Request from popup - store callback and forward to content script
      globalThis.pendingRequests.set(requestId, { 
        sendResponse, 
        timestamp: Date.now(),
        source: 'popup'
      });
      
      // Forward to Gmail content script
      chrome.tabs.query({ url: 'https://mail.google.com/*' }, (tabs) => {
        if (tabs.length > 0) {
          console.log(`Forwarding ${request.action} request to content script, id: ${requestId}`);
          chrome.tabs.sendMessage(tabs[0].id, {
            ...request,
            id: requestId
          }, (response) => {
            if (chrome.runtime.lastError) {
              const errorMessage = chrome.runtime.lastError.message || 'Unknown error';
              console.error('Error sending to content script:', errorMessage);
              sendResponse({ error: errorMessage });
            } else {
              console.log('Received response from content script:', response);
              sendResponse(response);
            }
            globalThis.pendingRequests.delete(requestId);
          });
        } else {
          sendResponse({ error: 'No Gmail tabs open' });
          globalThis.pendingRequests.delete(requestId);
        }
      });
      
      return true; // Will respond asynchronously
    }
  }
  
  // Handle responses from content script for bridge requests only
  if (sender.tab && sender.tab.url.includes('mail.google.com')) {
    // Check if this is a response to a bridge request
    if (request.response && request.id) {
      const bridgeRequest = globalThis.bridgeRequests?.get(request.id);
      if (bridgeRequest) {
        globalThis.bridgeRequests.delete(request.id);
        bridgeRequest(request.response);
        return;
      }
    }
  }
  
  return true;
});

// Log extension ID on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`Gmail MCP Bridge Extension ID: ${chrome.runtime.id}`);
  if (details.reason === 'install') {
    console.log('Extension installed. Please run the setup script with this ID:', chrome.runtime.id);
  }
  
  // Inject content script into existing Gmail tabs
  console.log('Checking for existing Gmail tabs...');
  chrome.tabs.query({ url: 'https://mail.google.com/*' }, (tabs) => {
    console.log(`Found ${tabs.length} Gmail tabs`);
    tabs.forEach(tab => {
      console.log(`Injecting content script into tab ${tab.id}: ${tab.url}`);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error(`Failed to inject content script into tab ${tab.id}:`, chrome.runtime.lastError.message);
        } else {
          console.log(`Content script successfully injected into tab ${tab.id}`);
        }
      });
    });
  });
});

// Debug helpers
globalThis.testGmail = {
  getEmails: () => {
    const id = Date.now();
    console.log(`Testing getEmails through content script with id: ${id}`);
    
    chrome.tabs.query({ url: 'https://mail.google.com/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getEmails', id: id }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error:', chrome.runtime.lastError.message || chrome.runtime.lastError);
          } else {
            console.log('Response:', response);
          }
        });
      } else {
        console.error('No Gmail tabs open');
      }
    });
  },
  
  sendEmail: (to, subject, body) => {
    const id = Date.now();
    console.log(`Testing sendEmail with id: ${id}`);
    
    chrome.tabs.query({ url: 'https://mail.google.com/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'sendEmail', 
          id: id,
          params: { to, subject, body }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error:', chrome.runtime.lastError.message || chrome.runtime.lastError);
          } else {
            console.log('Response:', response);
          }
        });
      } else {
        console.error('No Gmail tabs open');
      }
    });
  },
  
  replyEmail: (emailId, content) => {
    const id = Date.now();
    console.log(`Testing replyEmail with id: ${id}`);
    
    chrome.tabs.query({ url: 'https://mail.google.com/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'replyEmail', 
          id: id,
          params: { emailId, content }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error:', chrome.runtime.lastError.message || chrome.runtime.lastError);
          } else {
            console.log('Response:', response);
          }
        });
      } else {
        console.error('No Gmail tabs open');
      }
    });
  }
};