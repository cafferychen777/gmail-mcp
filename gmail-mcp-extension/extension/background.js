// Bridge server configuration
const BRIDGE_URL = 'http://localhost:3456';
let bridgePolling = false;

let bridgeConnectionAttempts = 0;
let bridgeLastError = null;
let bridgeHealthy = false;

// Account Manager for multi-account support
class AccountManager {
  constructor() {
    this.accounts = new Map(); // tabId -> accountInfo
    this.activeAccountTabId = null;
    this.lastActiveTime = new Map(); // tabId -> timestamp
  }

  registerAccount(tabId, accountInfo) {
    const account = {
      ...accountInfo,
      tabId,
      registeredAt: Date.now(),
      lastActive: Date.now(),
      viewState: accountInfo.viewState || 'unknown',
      lastActivity: accountInfo.lastActivity || Date.now()
    };
    
    this.accounts.set(tabId, account);
    this.lastActiveTime.set(tabId, Date.now());
    
    // If no active account, set as default
    if (!this.activeAccountTabId || !this.accounts.has(this.activeAccountTabId)) {
      this.activeAccountTabId = tabId;
    }
    
    console.log(`Registered account: ${accountInfo.email} on tab ${tabId} (view: ${account.viewState})`);
    console.log(`Total accounts: ${this.accounts.size}`);
    
    return { success: true, isActive: this.activeAccountTabId === tabId };
  }

  getAccountList() {
    return Array.from(this.accounts.values()).map(account => ({
      ...account,
      isActive: account.tabId === this.activeAccountTabId
    }));
  }

  getAccountByEmail(email, preferredView = 'inbox') {
    const matchingAccounts = [];
    
    // 收集所有匹配的账号
    for (const [tabId, account] of this.accounts) {
      if (account.email === email) {
        matchingAccounts.push({ tabId, account });
      }
    }
    
    if (matchingAccounts.length === 0) return null;
    if (matchingAccounts.length === 1) return matchingAccounts[0];
    
    // 多个匹配时，智能选择最佳的
    // 优先级：1. 在目标视图的 2. 最近活动的 3. 第一个
    
    // 查找在目标视图的账号
    const inPreferredView = matchingAccounts.find(
      ({ account }) => account.viewState === preferredView
    );
    if (inPreferredView) return inPreferredView;
    
    // 查找在收件箱的账号（如果不是已经在找收件箱）
    if (preferredView !== 'inbox') {
      const inInbox = matchingAccounts.find(
        ({ account }) => account.viewState === 'inbox'
      );
      if (inInbox) return inInbox;
    }
    
    // 按最后活动时间排序，返回最近的
    matchingAccounts.sort((a, b) => 
      (b.account.lastActivity || 0) - (a.account.lastActivity || 0)
    );
    
    return matchingAccounts[0];
  }
  
  // 新增：获取特定邮箱的所有标签页
  getAllTabsForEmail(email) {
    const tabs = [];
    for (const [tabId, account] of this.accounts) {
      if (account.email === email) {
        tabs.push({ tabId, account });
      }
    }
    return tabs;
  }

  getAccountByTabId(tabId) {
    return this.accounts.get(tabId);
  }

  setActiveAccount(tabId) {
    if (this.accounts.has(tabId)) {
      this.activeAccountTabId = tabId;
      this.lastActiveTime.set(tabId, Date.now());
      console.log(`Set active account to tab ${tabId}:`, this.accounts.get(tabId).email);
      return true;
    }
    return false;
  }

  getActiveAccount() {
    if (this.activeAccountTabId && this.accounts.has(this.activeAccountTabId)) {
      return {
        tabId: this.activeAccountTabId,
        account: this.accounts.get(this.activeAccountTabId)
      };
    }
    return null;
  }

  removeAccount(tabId) {
    const account = this.accounts.get(tabId);
    if (account) {
      console.log(`Removing account: ${account.email} from tab ${tabId}`);
    }
    
    this.accounts.delete(tabId);
    this.lastActiveTime.delete(tabId);
    
    // If removed account was active, select another
    if (this.activeAccountTabId === tabId) {
      const remaining = Array.from(this.accounts.keys());
      if (remaining.length > 0) {
        // Select most recently active account
        const mostRecent = remaining.reduce((a, b) => 
          (this.lastActiveTime.get(a) || 0) > (this.lastActiveTime.get(b) || 0) ? a : b
        );
        this.activeAccountTabId = mostRecent;
        console.log(`Switched active account to tab ${mostRecent}`);
      } else {
        this.activeAccountTabId = null;
        console.log('No accounts remaining');
      }
    }
  }

  updateLastActive(tabId) {
    if (this.accounts.has(tabId)) {
      this.lastActiveTime.set(tabId, Date.now());
      const account = this.accounts.get(tabId);
      if (account) {
        account.lastActive = Date.now();
      }
    }
  }
  
  // 新增：更新账号状态（视图、活动时间等）
  updateAccountState(tabId, accountInfo) {
    if (this.accounts.has(tabId)) {
      const account = this.accounts.get(tabId);
      account.viewState = accountInfo.viewState || account.viewState;
      account.lastActivity = accountInfo.lastActivity || Date.now();
      account.lastActive = Date.now();
      account.url = accountInfo.url || account.url;
      this.lastActiveTime.set(tabId, Date.now());
      
      console.log(`Updated account state for tab ${tabId}: view=${account.viewState}`);
      return true;
    }
    return false;
  }

  // Intelligently select target tab
  selectTargetTab(accountEmail = null, preferredView = 'inbox') {
    if (accountEmail) {
      // Specific account requested, find best matching tab
      const result = this.getAccountByEmail(accountEmail, preferredView);
      if (result) {
        console.log(`Selected tab ${result.tabId} for ${accountEmail} (view: ${result.account.viewState})`);
        return result.tabId;
      }
      return null;
    } else {
      // Use active account, but verify it's still valid
      const active = this.getActiveAccount();
      if (active) {
        // Check if active account is in a good state for the operation
        if (preferredView && active.account.viewState !== preferredView) {
          console.log(`Active account not in ${preferredView} view, searching for better option`);
          // Try to find any account in the preferred view
          for (const [tabId, account] of this.accounts) {
            if (account.viewState === preferredView) {
              console.log(`Found tab ${tabId} in ${preferredView} view`);
              return tabId;
            }
          }
        }
        return active.tabId;
      }
      return null;
    }
  }
}

// Create global account manager instance
const accountManager = new AccountManager();

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

// Health check for content scripts
function checkContentScriptHealth() {
  chrome.tabs.query({ url: 'https://mail.google.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'ping' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          console.log(`Content script not responding in tab ${tab.id}, re-injecting...`);
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }, () => {
            if (chrome.runtime.lastError) {
              console.error(`Re-injection failed for tab ${tab.id}:`, chrome.runtime.lastError.message);
            } else {
              console.log(`Content script re-injected into tab ${tab.id}`);
              // 触发账号重新注册
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: 'refreshAccount' }, (response) => {
                  if (!chrome.runtime.lastError) {
                    console.log(`Account refreshed for tab ${tab.id}`);
                  }
                });
              }, 2000);
            }
          });
        } else {
          // Content script 响应了，检查是否有账号注册
          if (!accountManager.getAccountByTabId(tab.id)) {
            console.log(`Tab ${tab.id} has no registered account, requesting registration...`);
            chrome.tabs.sendMessage(tab.id, { action: 'refreshAccount' }, (response) => {
              if (!chrome.runtime.lastError) {
                console.log(`Account registration requested for tab ${tab.id}`);
              }
            });
          }
        }
      });
    });
  });
}

// Check content script health every 30 seconds
setInterval(checkContentScriptHealth, 30000);

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

        // Handle account management actions directly in background script
        if (data.action === 'getAccounts') {
          const accountsData = {
            accounts: accountManager.getAccountList(),
            activeAccount: accountManager.getActiveAccount()
          };
          console.log('Handling getAccounts directly:', accountsData);
          
          // 确保即使没有账号也返回响应
          try {
            await sendResponseToBridge(data.id, accountsData);
            console.log('Response sent successfully for getAccounts');
          } catch (error) {
            console.error('Failed to send getAccounts response:', error);
            // 尝试发送错误响应
            await sendResponseToBridge(data.id, { 
              error: 'Failed to get accounts: ' + error.message 
            });
          }
          continue; // Continue polling loop instead of returning
        }

        if (data.action === 'setActiveAccount') {
          const { accountEmail, tabId } = data.params || {};
          let success = false;
          let errorMessage = '';

          if (tabId) {
            success = accountManager.setActiveAccount(tabId);
            if (!success) {
              errorMessage = `Tab ID ${tabId} not found`;
            }
          } else if (accountEmail) {
            // 清理邮箱地址格式（处理可能的格式问题）
            const cleanEmail = accountEmail.includes('@') ?
              (accountEmail.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/) || [null, accountEmail])[1] :
              accountEmail;

            const result = accountManager.getAccountByEmail(cleanEmail);
            if (result) {
              success = accountManager.setActiveAccount(result.tabId);
            } else {
              // 尝试模糊匹配（处理格式差异）
              const accounts = accountManager.getAccountList();
              const fuzzyMatch = accounts.find(acc =>
                acc.email.includes(cleanEmail) || cleanEmail.includes(acc.email.split('@')[0])
              );
              if (fuzzyMatch) {
                success = accountManager.setActiveAccount(fuzzyMatch.tabId);
              } else {
                errorMessage = `Account ${cleanEmail} not found. Available accounts: ${accounts.map(a => a.email).join(', ')}`;
              }
            }
          } else {
            errorMessage = 'No accountEmail or tabId provided';
          }

          const responseData = {
            success,
            error: errorMessage || undefined,
            activeAccount: success ? accountManager.getActiveAccount() : null,
            availableAccounts: accountManager.getAccountList().map(a => a.email)
          };
          console.log('Handling setActiveAccount directly:', responseData);
          await sendResponseToBridge(data.id, responseData);
          continue; // Continue polling loop instead of returning
        }

        if (data.action === 'getActiveAccount') {
          const activeAccount = accountManager.getActiveAccount();
          const responseData = {
            success: !!activeAccount,
            activeAccount: activeAccount,
            totalAccounts: accountManager.getAccountList().length
          };
          console.log('Handling getActiveAccount directly:', responseData);
          await sendResponseToBridge(data.id, responseData);
          continue; // Continue polling loop instead of returning
        }

        // Forward other actions to Gmail tab with enhanced error handling
        chrome.tabs.query({ url: 'https://mail.google.com/*' }, async (tabs) => {
          if (tabs.length > 0) {
            // 根据操作类型确定需要的视图
            let preferredView = 'inbox'; // 默认视图
            if (data.action === 'getEmails' || data.action === 'searchEmails') {
              preferredView = 'inbox'; // 邮件列表操作需要收件箱视图
            } else if (data.action === 'sendEmail' || data.action === 'composeReply') {
              preferredView = null; // 撰写操作在任何视图都可以
            }
            
            // Intelligently select target tab with view preference
            let targetTabId = accountManager.selectTargetTab(data.params?.accountEmail, preferredView);
            
            if (!targetTabId && tabs.length > 0) {
              // If no specific account found, use first available
              targetTabId = tabs[0].id;
              console.warn('No specific account found, using first available tab');
            }
            
            // 验证标签页是否仍然存在并且是Gmail页面
            const targetTab = tabs.find(tab => tab.id === targetTabId);
            if (!targetTab) {
              console.warn(`Tab ${targetTabId} no longer exists, selecting new tab`);
              // 选择第一个可用的Gmail标签页
              targetTabId = tabs[0].id;
              // 更新账号管理器中的活动账号
              accountManager.setActiveAccount(targetTabId);
            }
            
            console.log(`Forwarding ${data.action} to tab ${targetTabId}`);
            
            if (!targetTabId) {
              await sendResponseToBridge(data.id, { error: 'No suitable Gmail tab found' });
              return;
            }

            try {
              // Update last active time
              accountManager.updateLastActive(targetTabId);
              
              // Create a promise to wait for response
              const responsePromise = new Promise((resolve, reject) => {
                const requestId = data.id;
                let responseReceived = false;

                // Store callback for bridge response
                if (!globalThis.bridgeRequests) {
                  globalThis.bridgeRequests = new Map();
                }
                
                // Setup response handler with timeout
                const responseHandler = (response) => {
                  if (!responseReceived) {
                    responseReceived = true;
                    globalThis.bridgeRequests.delete(requestId);
                    resolve(response);
                  }
                };
                
                globalThis.bridgeRequests.set(requestId, responseHandler);

                // Send to specific tab - don't use callback in sendMessage for async
                chrome.tabs.sendMessage(targetTabId, {
                  action: data.action,
                  params: data.params,
                  id: requestId
                }, (response) => {
                  if (chrome.runtime.lastError) {
                    const errorMessage = chrome.runtime.lastError.message || 'Unknown content script error';
                    console.error('Error sending to content script:', errorMessage);

                    // Auto-retry with content script re-injection
                    if (errorMessage.includes('Could not establish connection') ||
                        errorMessage.includes('Receiving end does not exist')) {
                      console.log(`Auto-retrying with content script re-injection for tab ${targetTabId}`);

                      // Re-inject content script
                      chrome.scripting.executeScript({
                        target: { tabId: targetTabId },
                        files: ['content.js']
                      }, () => {
                        if (chrome.runtime.lastError) {
                          console.error(`Re-injection failed for tab ${targetTabId}:`, chrome.runtime.lastError.message);
                          if (!responseReceived) {
                            responseReceived = true;
                            globalThis.bridgeRequests.delete(requestId);
                            resolve({ error: `Content script error: ${errorMessage}` });
                          }
                        } else {
                          console.log(`Content script re-injected, retrying message to tab ${targetTabId}`);

                          // Retry the message after a short delay
                          setTimeout(() => {
                            chrome.tabs.sendMessage(targetTabId, {
                              action: data.action,
                              params: data.params,
                              id: requestId
                            }, (retryResponse) => {
                              if (!responseReceived) {
                                responseReceived = true;
                                globalThis.bridgeRequests.delete(requestId);
                                if (chrome.runtime.lastError) {
                                  resolve({ error: `Retry failed: ${chrome.runtime.lastError.message}` });
                                } else {
                                  console.log('Retry successful:', retryResponse);
                                  resolve(retryResponse);
                                }
                              }
                            });
                          }, 1000);
                        }
                      });
                    } else {
                      if (!responseReceived) {
                        responseReceived = true;
                        globalThis.bridgeRequests.delete(requestId);
                        resolve({ error: `Content script error: ${errorMessage}` });
                      }
                    }
                  } else if (response !== undefined) {
                    // Handle response directly if provided synchronously
                    console.log('Received immediate response from content script for bridge:', response);
                    if (!responseReceived) {
                      responseReceived = true;
                      globalThis.bridgeRequests.delete(requestId);
                      resolve(response);
                    }
                  }
                });

                // Timeout after 30 seconds for search operations (they take longer)
                const timeoutDuration = data.action === 'searchEmails' ? 30000 : 15000;
                setTimeout(() => {
                  if (!responseReceived && globalThis.bridgeRequests.has(requestId)) {
                    responseReceived = true;
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
      const responseController = new AbortController();
      const responseTimeout = setTimeout(() => responseController.abort(), 5000);
      
      const response = await fetch(`${BRIDGE_URL}/chrome/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: requestId,
          response: result.error ? null : result,
          error: result.error
        }),
        signal: responseController.signal
      });
      
      clearTimeout(responseTimeout);

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
  // 初始健康检查
  checkContentScriptHealth();
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
// IMPORTANT: For Manifest V3, this must be synchronous at top level
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle account registration from content script
  if (request.action === 'registerAccount') {
    const result = accountManager.registerAccount(sender.tab.id, request.accountInfo);
    sendResponse(result);
    return false; // Synchronous response
  }
  
  // Handle account state update from content script
  if (request.action === 'updateAccountState') {
    const result = accountManager.updateAccountState(sender.tab.id, request.accountInfo);
    sendResponse({ success: result });
    return false; // Synchronous response
  }

  // Handle get accounts request
  if (request.action === 'getAccounts') {
    sendResponse({
      accounts: accountManager.getAccountList(),
      activeAccount: accountManager.getActiveAccount()
    });
    return false; // Synchronous response
  }

  // Handle set active account request
  if (request.action === 'setActiveAccount') {
    const { accountEmail, tabId } = request;
    let success = false;
    
    if (tabId) {
      success = accountManager.setActiveAccount(tabId);
    } else if (accountEmail) {
      const result = accountManager.getAccountByEmail(accountEmail);
      if (result) {
        success = accountManager.setActiveAccount(result.tabId);
      }
    }
    
    sendResponse({ 
      success, 
      activeAccount: accountManager.getActiveAccount() 
    });
    return false; // Synchronous response
  }

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
    return false; // Synchronous response
  }
  
  // Handle content script ready signal
  if (request.action === 'contentScriptReady') {
    console.log('Content script ready on tab:', sender.tab.id);
    sendResponse({ status: 'acknowledged' });
    return false; // Synchronous response
  }

  // Handle manual content script injection request
  if (request.action === 'injectContentScript') {
    chrome.tabs.query({ url: 'https://mail.google.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }, (result) => {
          if (chrome.runtime.lastError) {
            console.error(`Manual injection failed for tab ${tab.id}:`, chrome.runtime.lastError.message);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            console.log(`Manual injection successful for tab ${tab.id}`);
            sendResponse({ success: true });
          }
        });
      });
    });
    return true;
  }
  
  // Handle Gmail action requests (from popup or native host)
  if (request.action && ['getEmails', 'sendEmail', 'readEmail', 'replyEmail', 'composeReply', 'debugPage', 'searchEmails', 'markEmailsRead', 'deleteEmails', 'archiveEmails', 'getEmailAttachments', 'downloadAttachment'].includes(request.action)) {
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
          // Use account manager to select target tab
          let targetTabId = accountManager.selectTargetTab(request.params?.accountEmail);
          
          if (!targetTabId && tabs.length > 0) {
            targetTabId = tabs[0].id;
            console.warn('No specific account found for popup request, using first available tab');
          }
          
          if (!targetTabId) {
            sendResponse({ error: 'No suitable Gmail tab found' });
            globalThis.pendingRequests.delete(requestId);
            return;
          }
          
          console.log(`Forwarding ${request.action} request to content script on tab ${targetTabId}, id: ${requestId}`);
          chrome.tabs.sendMessage(targetTabId, {
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
  
  // Handle responses from content script for bridge requests
  if (sender.tab && sender.tab.url && sender.tab.url.includes('mail.google.com')) {
    // Check if this is a response to a bridge request
    if (request.response !== undefined && request.id) {
      console.log(`Received async response from content script for request ${request.id}`);
      const bridgeRequestHandler = globalThis.bridgeRequests?.get(request.id);
      if (bridgeRequestHandler) {
        console.log('Found matching bridge request, sending response');
        bridgeRequestHandler(request.response);
        sendResponse({ acknowledged: true });
        return false;
      } else {
        console.log('No matching bridge request found for ID:', request.id);
      }
    }
  }
  
  // Default: keep channel open for async response from content script
  return true;
});

// Log extension ID on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`Gmail MCP Bridge Extension ID: ${chrome.runtime.id}`);
  if (details.reason === 'install') {
    console.log('Extension installed. Please run the setup script with this ID:', chrome.runtime.id);
  }
  
  // Inject content script into existing Gmail tabs with retry
  console.log('Checking for existing Gmail tabs...');
  chrome.tabs.query({ url: 'https://mail.google.com/*' }, (tabs) => {
    console.log(`Found ${tabs.length} Gmail tabs`);
    tabs.forEach(tab => {
      console.log(`Injecting content script into tab ${tab.id}: ${tab.url}`);

      // Try injection with retry
      function injectWithRetry(attempts = 3) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error(`Failed to inject content script into tab ${tab.id} (attempt ${4-attempts}):`, chrome.runtime.lastError.message);
            if (attempts > 1) {
              setTimeout(() => injectWithRetry(attempts - 1), 1000);
            }
          } else {
            console.log(`Content script successfully injected into tab ${tab.id}`);
          }
        });
      }

      injectWithRetry();
    });
  });
});

// Tab lifecycle management
chrome.tabs.onRemoved.addListener((tabId) => {
  accountManager.removeAccount(tabId);
});

// Tab update monitoring
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes('mail.google.com') && changeInfo.status === 'complete') {
    // Tab loaded, may need to re-detect account
    accountManager.updateLastActive(tabId);
  }
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