// Content script loaded
console.log('=== Gmail MCP Bridge Content Script Loading ===');
console.log('URL:', window.location.href);
console.log('Document ready state:', document.readyState);
console.log('Chrome runtime available:', typeof chrome !== 'undefined' && !!chrome.runtime);

// Prevent duplicate execution - but allow re-injection
if (window.gmailMcpBridgeLoaded) {
  console.log('Gmail MCP Bridge already loaded, cleaning up old instance');
  // Clean up old listener if exists
  if (window.gmailInterface) {
    window.gmailInterface = null;
  }
}
window.gmailMcpBridgeLoaded = true;

// Wait for DOM to be fully ready
function initializeWhenReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWhenReady);
    return;
  }

  // Additional wait for Gmail to initialize
  setTimeout(initializeGmailInterface, 1000);
}

function initializeGmailInterface() {
  console.log('Initializing Gmail Interface...');

  class GmailInterface {
  constructor() {
    console.log('GmailInterface constructor called');
    this.observer = null;
    this.accountInfo = null;  // 新增：账号信息
    this.tabId = null;        // 新增：标签页ID
    this.labelManager = null; // 新增：标签管理器
    this.init();
  }

  async init() {
    console.log('Gmail MCP Bridge initialized');
    await this.detectAccount();     // 新增：检测账号
    this.labelManager = new LabelManager(this); // 初始化标签管理器
    this.setupListeners();
    this.registerWithBackground();  // 新增：注册到background
  }

  // 新增方法：检测当前Gmail账号
  async detectAccount() {
    console.log('Detecting Gmail account...');
    
    let accountEmail = null;
    let accountName = null;
    
    // Wait for page to load elements
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 方法1: 从Gmail头部账号按钮获取（最可靠）
    const accountButton = document.querySelector('[aria-label*="Google Account"]') ||
                         document.querySelector('[gb-version] [role="button"] img[src*="googleusercontent"]')?.parentElement ||
                         document.querySelector('a[aria-label*="Google Account"]');
    
    if (accountButton) {
      const ariaLabel = accountButton.getAttribute('aria-label') || '';
      const emailMatch = ariaLabel.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        accountEmail = emailMatch[1];
        console.log('Found email from account button:', accountEmail);
      }
    }
    
    // 方法2: 从Gmail界面元素获取
    if (!accountEmail) {
      const accountSelectors = [
        // Google账号信息区域 - 更精确的选择器
        'div[data-ogsr-up] [data-email]',
        'div[aria-label*="@gmail.com"]',
        'div[aria-label*="@googlemail.com"]',
        '[data-hovercard-id]',
        // Gmail特定选择器
        '.gb_rb',  // Account info container
        '.gb_sb',  // Account email element
        '.gb_tb',  // Account name element
        // 账号切换器
        'div[data-identifier]'
      ];

      for (const selector of accountSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          // 尝试获取邮箱
          const dataEmail = element.getAttribute('data-email') || 
                          element.getAttribute('data-identifier') ||
                          element.getAttribute('data-hovercard-id') ||
                          element.getAttribute('aria-label') ||
                          element.textContent?.trim();
          
          // 验证是否为有效邮箱并清理格式
          if (dataEmail && dataEmail.includes('@')) {
            // 提取邮箱地址（去除多余文本）
            const emailMatch = dataEmail.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (emailMatch) {
              accountEmail = emailMatch[1];
              console.log(`Found account email via ${selector}:`, accountEmail);
              break;
            }
          }
        }
        if (accountEmail) break;
      }
    }

    // 方法3: 从URL参数获取账号索引
    const urlParams = new URLSearchParams(window.location.search);
    const authUser = urlParams.get('authuser');
    let accountIndex = authUser || '0';

    // 方法4: 从页面标题提取
    if (!accountEmail && document.title) {
      const titleMatch = document.title.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (titleMatch) {
        accountEmail = titleMatch[1];
        console.log('Found email from page title:', accountEmail);
      }
    }

    // 方法5: 尝试点击账号按钮获取信息（需要更多时间）
    if (!accountEmail) {
      const accountIcon = document.querySelector('a[aria-label*="Google Account"] img') ||
                         document.querySelector('[role="button"] img[src*="googleusercontent"]');
      if (accountIcon) {
        // 获取账号图标的父元素，可能包含账号信息
        const parent = accountIcon.closest('[aria-label]') || accountIcon.parentElement;
        if (parent) {
          const ariaLabel = parent.getAttribute('aria-label') || '';
          const emailMatch = ariaLabel.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          if (emailMatch) {
            accountEmail = emailMatch[1];
            console.log('Found email from account icon parent:', accountEmail);
          }
        }
      }
    }

    // 方法6: 使用MutationObserver等待动态加载的元素
    if (!accountEmail) {
      await new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 5;
        
        const checkForEmail = () => {
          attempts++;
          
          // 再次尝试所有方法
          const dynamicSelectors = [
            '[data-email]',
            '[aria-label*="@gmail.com"]',
            'div[data-identifier]'
          ];
          
          for (const selector of dynamicSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              const text = element.getAttribute('data-email') || 
                         element.getAttribute('data-identifier') ||
                         element.getAttribute('aria-label') ||
                         element.textContent;
              if (text && text.includes('@')) {
                const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                if (emailMatch) {
                  accountEmail = emailMatch[1];
                  console.log(`Found email dynamically via ${selector}:`, accountEmail);
                  resolve();
                  return;
                }
              }
            }
          }
          
          if (attempts < maxAttempts) {
            setTimeout(checkForEmail, 1000);
          } else {
            resolve();
          }
        };
        
        checkForEmail();
      });
    }

    // 获取当前视图状态
    const viewState = this.detectViewState();
    
    // 生成账号信息
    this.accountInfo = {
      email: accountEmail || `account_${accountIndex}`,
      name: accountName || (accountEmail ? accountEmail.split('@')[0] : 'Unknown User'),
      index: accountIndex,
      url: window.location.href,
      viewState: viewState,  // 新增：当前视图状态
      timestamp: new Date().toISOString(),
      detectionMethod: accountEmail ? 'dom_extraction' : 'url_parameter'
    };

    console.log('Detected account info:', this.accountInfo);
  }

  // 新增方法：检测当前Gmail视图状态
  detectViewState() {
    const hash = window.location.hash;
    const url = window.location.href;
    
    // 优先检查URL hash来确定基础视图（撰写窗口可能覆盖在任何视图上）
    if (hash.includes('#inbox')) return 'inbox';
    if (hash.includes('#sent')) return 'sent';
    if (hash.includes('#drafts')) return 'drafts';
    if (hash.includes('#imp')) return 'important';
    if (hash.includes('#starred')) return 'starred';
    if (hash.includes('#snoozed')) return 'snoozed';
    if (hash.includes('#all')) return 'all';
    if (hash.includes('#spam')) return 'spam';
    if (hash.includes('#trash')) return 'trash';
    if (hash.includes('#search')) return 'search';
    if (hash.includes('#label')) return 'label';
    if (hash.includes('#category')) return 'category';
    
    // 检查是否在查看特定邮件
    if (hash.match(/#[a-zA-Z]+\/[a-f0-9]+$/)) return 'email';
    
    // 只有当没有其他视图时才返回compose（撰写窗口是覆盖层，不是独立视图）
    // 注意：撰写窗口可以在任何视图上打开
    if (!hash || hash === '#' || hash === '') {
      if (document.querySelector('.z0')) return 'compose';
    }
    
    // 默认返回unknown
    return 'unknown';
  }

  // 新增方法：向background script注册账号
  registerWithBackground() {
    chrome.runtime.sendMessage({
      action: 'registerAccount',
      accountInfo: this.accountInfo
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to register account:', chrome.runtime.lastError.message);
      } else {
        console.log('Account registered successfully:', response);
      }
    });
  }

  // 新增方法：获取账号信息
  getAccountInfo() {
    // 更新视图状态再返回
    this.accountInfo.viewState = this.detectViewState();
    this.accountInfo.lastActivity = Date.now();
    return this.accountInfo;
  }
  
  // 新增方法：更新视图状态并通知background
  updateViewState() {
    const newViewState = this.detectViewState();
    if (this.accountInfo.viewState !== newViewState) {
      this.accountInfo.viewState = newViewState;
      this.accountInfo.lastActivity = Date.now();
      
      // 通知background script视图状态已改变
      chrome.runtime.sendMessage({
        action: 'updateAccountState',
        accountInfo: this.accountInfo
      });
      
      console.log('View state changed to:', newViewState);
    }
  }
  
  // 新增方法：切换到指定视图
  async switchToView(targetView = 'inbox') {
    console.log(`Switching to ${targetView} view...`);
    const currentView = this.detectViewState();
    
    if (currentView === targetView) {
      console.log(`Already in ${targetView} view`);
      return true;
    }
    
    // 构建目标URL
    const currentUrl = new URL(window.location.href);
    currentUrl.hash = `#${targetView}`;
    
    // 导航到目标视图
    window.location.href = currentUrl.toString();
    
    // 等待页面加载
    await new Promise(resolve => {
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        const newView = this.detectViewState();
        
        if (newView === targetView || attempts > 10) {
          clearInterval(checkInterval);
          if (newView === targetView) {
            console.log(`Successfully switched to ${targetView} view`);
            this.updateViewState();
            resolve(true);
          } else {
            console.error(`Failed to switch to ${targetView} view after ${attempts} attempts`);
            resolve(false);
          }
        }
      }, 500);
    });
    
    return this.detectViewState() === targetView;
  }

  setupListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Received message:', request);

      // Handle ping immediately
      if (request.action === 'ping') {
        sendResponse({ status: 'pong', timestamp: new Date().toISOString() });
        return true;
      }

      // Process request asynchronously
      (async () => {
        try {
          let responseData;

          switch (request.action) {
            case 'getEmails':
              const emailResult = this.getEmailList();
              console.log('Email list result:', emailResult);
              // 兼容旧格式和新格式
              if (emailResult.emails) {
                responseData = emailResult;
              } else if (Array.isArray(emailResult)) {
                // 旧格式兼容
                responseData = { emails: emailResult };
              } else {
                responseData = { emails: [], error: 'Failed to get email list' };
              }
              break;

            case 'getEmailContent':
              const contentEmailId = request.params?.emailId || request.emailId;
              const emailContent = await this.getEmailContent(contentEmailId);
              responseData = emailContent;
              break;

            case 'composeReply':
            case 'replyEmail':
              const emailId = request.params?.emailId || request.emailId;
              const replyContent = request.params?.content || request.content;
              const replyResult = await this.composeReply(emailId, replyContent);
              responseData = { 
                success: true, 
                sent: replyResult?.sent || false,
                message: replyResult?.message || 'Reply processed'
              };
              break;

            case 'sendEmail':
              const sendResult = await this.sendEmail(request.params?.to || request.to,
                            request.params?.subject || request.subject,
                            request.params?.body || request.body);
              responseData = { 
                success: true, 
                sent: sendResult?.sent || false,
                message: sendResult?.message || 'Email compose window opened'
              };
              break;

            case 'debugPage':
              responseData = this.debugPageState();
              break;

            case 'searchEmails':
              const searchQuery = request.params?.query || request.query;
              const searchOptions = request.params?.options || request.options || {};
              responseData = await this.searchEmails(searchQuery, searchOptions);
              break;

            case 'markEmailsRead':
              const emailIds = request.params?.emailIds || request.emailIds;
              const markAsRead = request.params?.markAsRead ?? request.markAsRead;
              responseData = await this.markEmailsRead(emailIds, markAsRead);
              break;

            case 'deleteEmails':
              const deleteEmailIds = request.params?.emailIds || request.emailIds;
              const permanent = request.params?.permanent || false;
              responseData = await this.deleteEmails(deleteEmailIds, permanent);
              break;

            case 'archiveEmails':
              const archiveEmailIds = request.params?.emailIds || request.emailIds;
              responseData = await this.archiveEmails(archiveEmailIds);
              break;

            case 'getEmailAttachments':
              const attachmentEmailId = request.params?.emailId || request.emailId;
              responseData = await this.getEmailAttachments(attachmentEmailId);
              break;

            case 'downloadAttachment':
              const downloadEmailId = request.params?.emailId || request.emailId;
              const attachmentId = request.params?.attachmentId || request.attachmentId;
              responseData = await this.downloadAttachment(downloadEmailId, attachmentId);
              break;

            case 'getAccountInfo':
              responseData = this.getAccountInfo();
              break;

            case 'refreshAccount':
              await this.detectAccount();
              this.registerWithBackground();
              responseData = { success: true, accountInfo: this.accountInfo };
              break;
              
            case 'switchView':
              const targetView = request.params?.view || 'inbox';
              const switchSuccess = await this.switchToView(targetView);
              responseData = { 
                success: switchSuccess, 
                currentView: this.detectViewState() 
              };
              break;

            // ========== 新增：标签管理功能 ==========
            case 'listLabels':
              responseData = await this.labelManager.listLabels();
              break;
              
            case 'addLabelsToEmails':
              const addEmailIds = request.params?.emailIds || request.emailIds;
              const addLabels = request.params?.labels || request.labels;
              responseData = await this.labelManager.manageEmailLabels(addEmailIds, addLabels, 'add');
              break;
              
            case 'removeLabelsFromEmails':
              const removeEmailIds = request.params?.emailIds || request.emailIds;
              const removeLabels = request.params?.labels || request.labels;
              responseData = await this.labelManager.manageEmailLabels(removeEmailIds, removeLabels, 'remove');
              break;
              
            case 'searchByLabel':
              const labelName = request.params?.labelName || request.labelName;
              const labelLimit = request.params?.limit || request.limit || 50;
              responseData = await this.labelManager.searchByLabel(labelName, labelLimit);
              break;
              
            case 'createLabel':
              const newLabelName = request.params?.labelName || request.labelName;
              const parentLabel = request.params?.parentLabel || request.parentLabel;
              responseData = await this.labelManager.createLabel(newLabelName, parentLabel);
              break;

            // ========== 新增：邮件转发功能 ==========
            case 'forwardEmail':
              const forwardEmailId = request.params?.emailId || request.emailId;
              const forwardRecipients = request.params?.recipients || request.recipients;
              const forwardMessage = request.params?.message || request.message || '';
              const includeAttachments = request.params?.includeAttachments ?? true;
              responseData = await this.forwardEmail(forwardEmailId, forwardRecipients, forwardMessage, includeAttachments);
              break;

            default:
              responseData = { error: 'Unknown action' };
          }

          // Check if this is a bridge request (has an ID)
          if (request.id) {
            console.log(`Sending bridge response for request ${request.id}:`, responseData);
            // For bridge requests, send the response back via runtime.sendMessage
            chrome.runtime.sendMessage({
              id: request.id,
              response: responseData
            }, (ack) => {
              if (chrome.runtime.lastError) {
                console.error('Failed to send bridge response:', chrome.runtime.lastError);
              } else {
                console.log('Bridge response sent successfully');
              }
            });
            // Also send via sendResponse for compatibility
            sendResponse(responseData);
          } else {
            // Regular response for non-bridge requests
            console.log('Sending regular response:', responseData);
            sendResponse(responseData);
          }

        } catch (error) {
          console.error('Error processing request:', error);
          const errorResponse = { error: error.message };
          
          // Check if this is a bridge request
          if (request.id) {
            console.log(`Sending bridge error response for request ${request.id}`);
            chrome.runtime.sendMessage({
              id: request.id,
              response: errorResponse
            });
          }
          sendResponse(errorResponse);
        }
      })();

      // Return true to indicate async response
      return true;
    });
  }

  async getEmailContent(emailId) {
    console.log(`Attempting to read email with ID: ${emailId}`);
    console.log('Current URL:', window.location.href);

    // If we're already viewing this specific email, extract content directly
    const currentUrl = window.location.href;
    if (currentUrl.includes(emailId)) {
      console.log('Already viewing the requested email, extracting content...');
      return this.extractCurrentEmailContent(emailId);
    }

    // Ensure we're in inbox view for email searching
    if (!currentUrl.includes('#inbox') && !currentUrl.includes('#all')) {
      console.log('Navigating to inbox...');
      window.location.hash = '#inbox';
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Find the email span
    console.log('Looking for email with ID:', emailId);
    const spanWithId = document.querySelector(`span[data-legacy-thread-id="${emailId}"]`);
    if (!spanWithId) {
      console.log('Email span not found');
      return {
        id: emailId,
        subject: 'Email not found',
        content: 'Email with the specified ID was not found in the current view.',
        sender: 'Unknown',
        date: 'Unknown',
        isOpen: false,
        debug: {
          foundSelector: 'none',
          contentLength: 0,
          hasSubject: false,
          hasSender: false,
          hasDate: false,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          reason: 'Email span not found'
        }
      };
    }

    console.log('Found email span:', spanWithId.textContent);

    // Find the email row and click it
    const emailRow = spanWithId.closest('tr.zA') || spanWithId.closest('tr');
    if (!emailRow) {
      return {
        id: emailId,
        subject: 'Email row not found',
        content: 'Could not find the email row to click.',
        sender: 'Unknown',
        date: 'Unknown',
        isOpen: false,
        debug: {
          foundSelector: 'none',
          contentLength: 0,
          hasSubject: false,
          hasSender: false,
          hasDate: false,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          reason: 'Email row not found'
        }
      };
    }

    console.log('Found email row, clicking...');
    emailRow.click();

    // Wait for email to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extract content from the opened email
    return this.extractCurrentEmailContent(emailId);
  }

  extractCurrentEmailContent(emailId) {
    console.log('Extracting content from currently opened email');

    // Extract content from the currently opened email
    const contentElement = document.querySelector('.a3s.aiL') ||
                          document.querySelector('.a3s');

    const subjectElement = document.querySelector('h2[data-legacy-thread-id]') ||
                          document.querySelector('.hP') ||
                          document.querySelector('h2');

    const senderElement = document.querySelector('[email]') ||
                         document.querySelector('.gD') ||
                         document.querySelector('.go span');

    const dateElement = document.querySelector('span[title]') ||
                       document.querySelector('.g3');

    const result = {
      id: emailId,
      subject: subjectElement ? subjectElement.textContent.trim() : 'Unknown',
      content: contentElement ? contentElement.innerText.trim() : 'Content not found',
      sender: senderElement ? (senderElement.getAttribute('email') || senderElement.textContent.trim()) : 'Unknown',
      date: dateElement ? (dateElement.getAttribute('title') || dateElement.textContent.trim()) : 'Unknown',
      isOpen: true,
      debug: {
        foundSelector: contentElement ? contentElement.className : 'none',
        contentLength: contentElement ? contentElement.innerText.length : 0,
        hasSubject: !!subjectElement,
        hasSender: !!senderElement,
        hasDate: !!dateElement,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        extractionMethod: 'direct'
      }
    };

    console.log('Direct extraction result:', result);
    return result;
  }

  getEmailList() {
    console.log('Getting email list...');
    const currentView = this.detectViewState();
    console.log('Current view:', currentView);
    console.log('Current URL:', window.location.href);
    
    // 检查是否有撰写窗口打开（但不阻止获取邮件列表）
    const hasComposeWindow = document.querySelector('.z0') !== null;
    if (hasComposeWindow) {
      console.log('Note: Compose window is open but will still try to get email list');
    }
    
    // 检查是否在合适的视图
    const suitableViews = ['inbox', 'all', 'sent', 'drafts', 'starred', 'important', 'search'];
    const problematicViews = ['label', 'category'];

    if (!suitableViews.includes(currentView)) {
      console.warn(`Not in a suitable view for email listing (current: ${currentView})`);

      // 对于特殊视图的处理（搜索视图现在被支持）
      if (problematicViews.includes(currentView)) {
        console.log(`Detected ${currentView} view, attempting to switch to inbox...`);

        // 尝试自动切换到收件箱（非阻塞）
        this.switchToView('inbox').then(success => {
          if (success) {
            console.log('Successfully switched to inbox view');
          } else {
            console.warn('Failed to switch to inbox view');
          }
        }).catch(error => {
          console.error('Error switching to inbox view:', error);
        });

        return {
          emails: [],
          error: `Currently in ${currentView} view. Attempting to switch to inbox. Please try again in a moment.`,
          currentView: currentView,
          autoSwitching: true,
          suggestion: 'Wait a moment and try again, or manually navigate to inbox'
        };
      }

      // 对于其他不支持的视图
      return {
        emails: [],
        error: `Cannot list emails in ${currentView} view. Please switch to a supported view.`,
        currentView: currentView,
        supportedViews: suitableViews
      };
    }
    
    const emails = [];

    // 尝试多种选择器，Gmail可能使用不同的结构
    // 为搜索结果添加更多选择器
    const selectors = [
      'tr.zA',  // 标准邮件行（最常见）
      'tr[class*="zA"]',  // 搜索结果中的邮件行
      'tr.zsO',  // 搜索结果特有的类
      'div[role="main"] tr[jsaction]',  // 备用选择器
      'tbody tr[class*="z"]',  // 更宽泛的选择器
      'div[gh="tl"] tr',  // 邮件列表容器
      'table.F tbody tr.zA',  // 完整路径
      'table.F tbody tr[class*="z"]',  // 搜索结果中的表格行
      'div[role="list"] > div[role="listitem"]',  // 新版Gmail可能使用
      'tr[jsaction*="email"]',  // 包含email action的行
      'tr[jsaction*="thread"]',  // 包含thread action的行（搜索结果）
      'div.Cp tbody tr',  // 另一种可能的容器
      'div[role="main"] tbody tr[class]',  // 搜索结果容器
      '[data-legacy-thread-id]',  // 直接查找有thread-id的元素
      'tr[data-thread-id]'  // 有thread-id属性的行
    ];
    
    let emailRows = null;
    for (const selector of selectors) {
      emailRows = document.querySelectorAll(selector);
      if (emailRows.length > 0) {
        console.log(`Found ${emailRows.length} email rows using selector: ${selector}`);
        break;
      }
    }
    
    if (!emailRows || emailRows.length === 0) {
      console.log('No email rows found with any selector');
      
      // 调试：查找页面上所有可能包含邮件的元素
      console.log('Debug: Looking for any elements with thread IDs...');
      const threadElements = document.querySelectorAll('[data-legacy-thread-id], [data-thread-id], [data-message-id]');
      console.log(`Found ${threadElements.length} elements with thread/message IDs`);
      
      // 检查是否是空收件箱
      const emptyInboxIndicators = [
        document.querySelector('.aRv'),  // "没有邮件"消息
        document.querySelector('.TD'),   // 空状态容器
        document.querySelector('[aria-label*="No conversations"]'),
        document.querySelector('[aria-label*="没有对话"]')
      ];
      
      const isEmptyInbox = emptyInboxIndicators.some(el => el && el.offsetParent !== null);
      
      if (isEmptyInbox) {
        console.log('Inbox appears to be empty (found empty inbox indicator)');
        return {
          emails: [],
          totalCount: 0,
          currentView: currentView,
          isEmpty: true,
          message: 'Inbox is empty'
        };
      }
      
      return {
        emails: [],
        error: 'No emails found in current view',
        currentView: currentView,
        debugInfo: {
          threadElementsFound: threadElements.length,
          isEmptyInbox: isEmptyInbox
        }
      };
    }

    emailRows.forEach((row, index) => {
      try {
        // Find thread ID - support multiple ways to identify emails
        let threadId = null;
        let subject = 'No subject';
        
        // Try to find thread ID in multiple ways
        const threadSpan = row.querySelector('span[data-legacy-thread-id]');
        if (threadSpan) {
          threadId = threadSpan.getAttribute('data-legacy-thread-id');
          subject = threadSpan.textContent.trim();
        } else {
          // Try other thread ID attributes
          const idElement = row.querySelector('[data-thread-id]') || 
                          row.querySelector('[data-message-id]') ||
                          row.querySelector('[jsaction*="thread"]');
          if (idElement) {
            threadId = idElement.getAttribute('data-thread-id') || 
                      idElement.getAttribute('data-message-id') ||
                      idElement.getAttribute('jsaction')?.match(/thread[_:]([\w-]+)/)?.[1];
          }
          
          // If the row itself has a thread-id attribute
          if (!threadId && row.hasAttribute('data-legacy-thread-id')) {
            threadId = row.getAttribute('data-legacy-thread-id');
          }
          if (!threadId && row.hasAttribute('data-thread-id')) {
            threadId = row.getAttribute('data-thread-id');
          }
          
          // Fallback to index-based ID
          if (!threadId) {
            threadId = `email_${index}`;
          }
          
          // Find subject in multiple ways
          const subjectElement = row.querySelector('.y6') ||
                               row.querySelector('span[data-legacy-thread-id]') ||
                               row.querySelector('.bog') ||
                               row.querySelector('[role="gridcell"] span') ||
                               row.querySelector('td span[title]');
          if (subjectElement) {
            subject = subjectElement.textContent.trim() || subjectElement.getAttribute('title') || 'No subject';
          }
        }

        // Find sender - 尝试多种选择器，包括搜索结果特有的结构
        const senderElement = row.querySelector('[email]') ||
                             row.querySelector('.yW span') ||
                             row.querySelector('.bA4 span') ||
                             row.querySelector('.yX span') ||
                             row.querySelector('.bA4') ||
                             row.querySelector('.yW') ||
                             row.querySelector('[role="gridcell"]:first-child span') ||
                             row.querySelector('td:nth-child(2) span') ||
                             row.querySelector('.a4W span');
        const sender = senderElement ?
          (senderElement.getAttribute('email') || 
           senderElement.getAttribute('name') ||
           senderElement.getAttribute('title') ||
           senderElement.textContent.trim()) : 'Unknown';

        // Find date - 加强日期查找，支持搜索结果的不同格式
        const dateElement = row.querySelector('.xW span[title]') ||
                           row.querySelector('.xW') ||
                           row.querySelector('[title*="202"]') ||  // 查找包含年份的元素
                           row.querySelector('[title*="Jan"], [title*="Feb"], [title*="Mar"], [title*="Apr"], [title*="May"], [title*="Jun"], [title*="Jul"], [title*="Aug"], [title*="Sep"], [title*="Oct"], [title*="Nov"], [title*="Dec"]') ||
                           row.querySelector('td:last-child span[title]') ||
                           row.querySelector('.xY span') ||
                           row.querySelector('.xW span');
        const date = dateElement ?
          (dateElement.getAttribute('title') || dateElement.textContent.trim()) : 'Unknown';

        // Check if unread
        const isUnread = row.classList.contains('zE') ||
                        row.querySelector('.zE') !== null;

        emails.push({
          id: threadId,
          subject: subject,
          sender: sender,
          date: date,
          isUnread: isUnread,
          index: index,
          view: currentView
        });
      } catch (error) {
        console.error(`Error processing email row ${index}:`, error);
      }
    });

    console.log(`Extracted ${emails.length} emails from ${currentView} view`);
    return {
      emails: emails,
      totalCount: emails.length,
      currentView: currentView,
      timestamp: new Date().toISOString()
    };
  }

  async sendEmail(to, subject, body) {
    console.log('Opening compose window for new email...');
    console.log('To:', to, 'Subject:', subject);

    try {
      // Find compose button with multiple selectors
      const composeSelectors = [
        '[gh="cm"]',
        'div[role="button"][gh="cm"]',
        '.T-I.T-I-KE.L3',
        '.z0 > .L3',  // Compose button in Gmail
        'div.T-I.T-I-KE'
      ];

      let composeButton = null;
      for (const selector of composeSelectors) {
        composeButton = document.querySelector(selector);
        if (composeButton && composeButton.offsetParent !== null) {
          console.log(`Found compose button with selector: ${selector}`);
          break;
        }
      }

      if (!composeButton) {
        throw new Error('Could not find compose button. Make sure you are on Gmail inbox.');
      }

      // Click compose button
      composeButton.click();
      console.log('Compose button clicked');

      // Wait for compose window to fully load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fill in the To field
      if (to) {
        const toSelectors = [
          'textarea[name="to"]',
          'input[name="to"]',
          '[aria-label*="To"][role="combobox"]',
          '[aria-label="To"]',
          'div[name="to"]'
        ];

        let toField = null;
        for (const selector of toSelectors) {
          toField = document.querySelector(selector);
          if (toField) {
            console.log(`Found To field with selector: ${selector}`);
            break;
          }
        }

        if (toField) {
          toField.focus();
          toField.value = to;
          toField.dispatchEvent(new Event('input', { bubbles: true }));
          toField.dispatchEvent(new Event('change', { bubbles: true }));
          // Tab to next field
          toField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        } else {
          console.warn('Could not find To field');
        }
      }

      // Small delay between fields
      await new Promise(resolve => setTimeout(resolve, 500));

      // Fill in the Subject field
      if (subject) {
        const subjectSelectors = [
          'input[name="subjectbox"]',
          'input[name="subject"]',
          '[aria-label="Subject"]',
          'input[placeholder*="Subject"]'
        ];

        let subjectField = null;
        for (const selector of subjectSelectors) {
          subjectField = document.querySelector(selector);
          if (subjectField) {
            console.log(`Found Subject field with selector: ${selector}`);
            break;
          }
        }

        if (subjectField) {
          subjectField.focus();
          subjectField.value = subject;
          subjectField.dispatchEvent(new Event('input', { bubbles: true }));
          subjectField.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          console.warn('Could not find Subject field');
        }
      }

      // Small delay before body
      await new Promise(resolve => setTimeout(resolve, 500));

      // Fill in the Body field
      if (body) {
        const bodySelectors = [
          '[aria-label="Message Body"]',
          '[aria-label*="Message body"]',
          'div[role="textbox"][aria-label*="Message"]',
          'div[contenteditable="true"][role="textbox"]',
          '.Am.Al.editable',
          '.editable[contenteditable="true"]'
        ];

        let bodyField = null;
        let attempts = 0;
        const maxAttempts = 5;

        // Try multiple times as compose area might load slowly
        while (!bodyField && attempts < maxAttempts) {
          for (const selector of bodySelectors) {
            bodyField = document.querySelector(selector);
            if (bodyField && bodyField.offsetParent !== null) {
              console.log(`Found Body field with selector: ${selector}`);
              break;
            }
          }
          
          if (!bodyField) {
            attempts++;
            console.log(`Body field not found, attempt ${attempts}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (bodyField) {
          bodyField.focus();
          // Convert newlines to HTML breaks for proper formatting
          const formattedBody = body.replace(/\n/g, '<br>');
          bodyField.innerHTML = formattedBody;
          bodyField.dispatchEvent(new Event('input', { bubbles: true }));
          bodyField.dispatchEvent(new Event('change', { bubbles: true }));
          bodyField.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        } else {
          console.warn('Could not find Body field after multiple attempts');
        }
      }

      console.log('Compose window opened and filled successfully');
      
      // Wait a moment for Gmail to process all fields
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Find and click the send button
      const sendButtonSelectors = [
        '[aria-label*="Send"]',
        '[data-tooltip*="Send"]',
        'div[role="button"][aria-label*="Send"]',
        '.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3',
        'div.dC > div.gU.Up > div > div.btA > div[role="button"]:nth-child(1)',
        'div[data-tooltip-delay="800"]'
      ];
      
      let sendButton = null;
      for (const selector of sendButtonSelectors) {
        const buttons = document.querySelectorAll(selector);
        for (const button of buttons) {
          // Check if it's visible and contains Send text/icon
          if (button.offsetParent !== null && 
              (button.textContent.includes('Send') || 
               button.getAttribute('aria-label')?.includes('Send'))) {
            sendButton = button;
            console.log(`Found send button with selector: ${selector}`);
            break;
          }
        }
        if (sendButton) break;
      }
      
      if (sendButton) {
        console.log('Clicking send button...');
        sendButton.click();
        
        // Wait for email to be sent
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
          success: true,
          message: 'Email sent successfully',
          to: to,
          subject: subject,
          sent: true
        };
      } else {
        console.warn('Could not find send button, email saved as draft');
        return {
          success: true,
          message: 'Email saved as draft (send button not found)',
          to: to,
          subject: subject,
          sent: false
        };
      }
      
    } catch (error) {
      console.error('Error in sendEmail:', error);
      throw error;
    }
  }

  async composeReply(emailId, content) {
    console.log(`Composing reply for email ${emailId}`);
    console.log('Reply content:', content);

    try {
      // First, make sure the email is open
      const emailData = await this.getEmailContent(emailId);
      
      if (!emailData || emailData.error) {
        throw new Error(`Failed to open email: ${emailData?.error || 'Unknown error'}`);
      }

      // Wait for email to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Look for reply button with multiple selectors
      const replySelectors = [
        '[aria-label*="Reply"]',
        '[data-tooltip*="Reply"]',
        'div[role="button"][aria-label*="Reply"]',
        'span[role="button"][aria-label*="Reply"]',
        '.ams.bkH',  // Gmail's reply button class
        '.T-I.J-J5-Ji.T-I-Js-Gs.aaq.T-I-ax7.L3'
      ];

      let replyButton = null;
      for (const selector of replySelectors) {
        replyButton = document.querySelector(selector);
        if (replyButton && replyButton.offsetParent !== null) { // Check if visible
          console.log(`Found reply button with selector: ${selector}`);
          break;
        }
      }

      if (!replyButton) {
        // Try to find reply button in the email actions area
        const actionsArea = document.querySelector('.iN') || document.querySelector('.btb');
        if (actionsArea) {
          replyButton = actionsArea.querySelector('[role="button"]');
        }
      }

      if (!replyButton) {
        throw new Error('Could not find reply button. Make sure the email is open.');
      }

      // Click the reply button
      replyButton.click();
      console.log('Reply button clicked');

      // Wait for reply compose area to appear
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find the compose area - it might be in different states
      const composeSelectors = [
        '[aria-label="Message Body"]',
        '[aria-label*="Message body"]',
        'div[role="textbox"][aria-label*="Message"]',
        'div[contenteditable="true"][role="textbox"]',
        '.Am.Al.editable',
        '.editable[contenteditable="true"]'
      ];

      let bodyField = null;
      let attempts = 0;
      const maxAttempts = 5;

      // Try multiple times as compose area might load slowly
      while (!bodyField && attempts < maxAttempts) {
        for (const selector of composeSelectors) {
          bodyField = document.querySelector(selector);
          if (bodyField && bodyField.offsetParent !== null) {
            console.log(`Found compose field with selector: ${selector}`);
            break;
          }
        }
        
        if (!bodyField) {
          attempts++;
          console.log(`Compose field not found, attempt ${attempts}/${maxAttempts}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!bodyField) {
        throw new Error('Could not find reply compose field after opening reply window');
      }

      // Focus the field first
      bodyField.focus();
      
      // Clear any existing content
      bodyField.innerHTML = '';
      
      // Set the reply content
      if (content) {
        // Convert newlines to HTML breaks for proper formatting
        const formattedContent = content.replace(/\n/g, '<br>');
        
        // Use innerHTML for formatted content (Gmail's compose uses contenteditable)
        bodyField.innerHTML = formattedContent;
        
        // Trigger input events to ensure Gmail recognizes the change
        bodyField.dispatchEvent(new Event('input', { bubbles: true }));
        bodyField.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Also trigger a keyup event
        bodyField.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      }

      console.log('Reply window opened and content filled successfully');
      
      // Wait a moment for Gmail to process the content
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Find and click the send button
      const sendButtonSelectors = [
        '[aria-label*="Send"]',
        '[data-tooltip*="Send"]',
        'div[role="button"][aria-label*="Send"]',
        '.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3',
        'div.dC > div.gU.Up > div > div.btA > div[role="button"]:nth-child(1)',
        'div[data-tooltip-delay="800"]'
      ];
      
      let sendButton = null;
      for (const selector of sendButtonSelectors) {
        const buttons = document.querySelectorAll(selector);
        for (const button of buttons) {
          // Check if it's visible and contains Send text/icon
          if (button.offsetParent !== null && 
              (button.textContent.includes('Send') || 
               button.getAttribute('aria-label')?.includes('Send'))) {
            sendButton = button;
            console.log(`Found send button with selector: ${selector}`);
            break;
          }
        }
        if (sendButton) break;
      }
      
      if (sendButton) {
        console.log('Clicking send button...');
        sendButton.click();
        
        // Wait for email to be sent
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
          success: true,
          message: 'Reply sent successfully',
          emailId: emailId,
          sent: true
        };
      } else {
        console.warn('Could not find send button, email saved as draft');
        return {
          success: true,
          message: 'Reply saved as draft (send button not found)',
          emailId: emailId,
          sent: false
        };
      }
      
    } catch (error) {
      console.error('Error in composeReply:', error);
      throw error;
    }
  }

  async searchEmails(query, options = {}) {
    console.log(`Searching emails with query: ${query}`);
    console.log('Search options:', options);

    const limit = options.limit || 10;
    let fullQuery = query; // Move outside try block to fix scope issue
    const originalView = this.detectViewState();
    const originalUrl = window.location.href;
    
    console.log(`Starting search from ${originalView} view`);

    try {
      // Build the full search query with options

      // Add additional filters from options
      if (options.from) {
        fullQuery += ` from:${options.from}`;
      }
      if (options.subject) {
        fullQuery += ` subject:${options.subject}`;
      }
      if (options.unread === true) {
        fullQuery += ` is:unread`;
      }
      if (options.dateFrom) {
        fullQuery += ` after:${options.dateFrom}`;
      }
      if (options.dateTo) {
        fullQuery += ` before:${options.dateTo}`;
      }

      console.log('Full search query:', fullQuery);

      // Find the search box with improved selectors
      const searchSelectors = [
        'input[aria-label*="Search"]',
        'input[name="q"]',
        'input[placeholder*="Search"]',
        '.gb_hf input',
        '.gb_hf',
        'form[role="search"] input',
        '.aAy input',
        '#gs_lc50 input'
      ];
      
      let searchBox = null;
      for (const selector of searchSelectors) {
        searchBox = document.querySelector(selector);
        if (searchBox && searchBox.offsetParent !== null) {
          console.log(`Found search box with selector: ${selector}`);
          break;
        }
      }

      if (!searchBox) {
        throw new Error('Could not find search box');
      }

      // Focus the search box first
      searchBox.focus();

      // Clear existing value
      searchBox.value = '';

      // Set new search query
      searchBox.value = fullQuery;
      searchBox.dispatchEvent(new Event('input', { bubbles: true }));

      // Trigger search by simulating Enter key
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });
      searchBox.dispatchEvent(enterEvent);

      // Wait for search results to load with dynamic waiting
      console.log('Waiting for search results to load...');
      let waitTime = 0;
      const maxWaitTime = 10000; // 10 seconds max
      const checkInterval = 500; // Check every 500ms
      
      while (waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
        
        // Check if URL changed to search results
        const currentUrl = window.location.href;
        if (currentUrl.includes('#search/')) {
          console.log('Search results page loaded');
          // Give a bit more time for results to render
          await new Promise(resolve => setTimeout(resolve, 1000));
          break;
        }
        
        // Check if loading indicators are gone
        const loadingIndicators = document.querySelectorAll('.K0', '.WoWk4d');
        if (loadingIndicators.length === 0) {
          console.log('Loading indicators disappeared');
          break;
        }
      }
      
      if (waitTime >= maxWaitTime) {
        console.warn('Search timeout reached');
      }

      // Get search results - safely handle getEmailList return format
      const emailListResult = this.getEmailList();
      let emails = [];
      let errorInfo = null;

      if (Array.isArray(emailListResult)) {
        // Backward compatibility: if returned as array
        emails = emailListResult.slice(0, limit);
        console.log(`Got ${emails.length} emails from search (array format)`);
      } else if (emailListResult && typeof emailListResult === 'object') {
        // Standard format: if returned as object
        if (emailListResult.error) {
          console.warn('getEmailList returned error:', emailListResult.error);
          errorInfo = emailListResult.error;
          emails = [];
        } else if (emailListResult.emails) {
          emails = emailListResult.emails.slice(0, limit);
          console.log(`Got ${emails.length} emails from search (object format)`);
        } else {
          console.warn('getEmailList returned object without emails array:', emailListResult);
          emails = [];
        }
      } else {
        // Unexpected format
        console.error('getEmailList returned unexpected format:', emailListResult);
        emails = [];
      }

      const result = {
        query: fullQuery,
        results: emails,
        count: emails.length,
        url: window.location.href,
        searchTime: new Date().toISOString(),
        debug: {
          originalQuery: query,
          finalQuery: fullQuery,
          searchOptions: options,
          limit: limit,
          emailListFormat: Array.isArray(emailListResult) ? 'array' : 'object',
          currentView: this.detectViewState()
        }
      };

      if (errorInfo) {
        result.warning = errorInfo;
      }

      console.log(`Search completed: found ${emails.length} results for "${fullQuery}"`);
      
      // Optionally return to original view if user prefers it
      // This is disabled by default to allow users to see search results
      if (options.returnToOriginalView && originalUrl !== window.location.href) {
        console.log(`Returning to original view: ${originalView}`);
        try {
          window.location.href = originalUrl;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.warn('Failed to return to original view:', error);
          result.warning = result.warning ? 
            `${result.warning}; Failed to return to original view` : 
            'Failed to return to original view';
        }
      }
      
      return result;

    } catch (error) {
      console.error('Error in searchEmails:', error);
      return {
        query: fullQuery || query,
        results: [],
        count: 0,
        error: `Search failed: ${error.message}`,
        url: window.location.href,
        searchTime: new Date().toISOString(),
        debug: {
          originalQuery: query,
          finalQuery: fullQuery || query,
          searchOptions: options,
          errorStack: error.stack,
          currentView: this.detectViewState(),
          errorName: error.name
        }
      };
    }
  }

  debugPageState() {
    console.log('Debugging Gmail page state...');

    const state = {
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
      timestamp: new Date().toISOString(),

      // Gmail-specific elements
      gmailElements: {
        composeButton: !!document.querySelector('[gh="cm"]'),
        searchBox: !!document.querySelector('input[aria-label*="Search"]'),
        emailRows: document.querySelectorAll('tr.zA').length,
        openEmail: !!document.querySelector('.a3s'),
        sidebarVisible: !!document.querySelector('[role="navigation"]')
      },

      // Content script state
      contentScript: {
        loaded: window.gmailMcpBridgeLoaded || false,
        interfaceExists: !!window.gmailInterface,
        chromeRuntime: typeof chrome !== 'undefined' && !!chrome.runtime
      },

      // Available email IDs - safely handle getEmailList return format
      availableEmails: (() => {
        const emailListResult = this.getEmailList();
        const emails = Array.isArray(emailListResult) ?
          emailListResult :
          (emailListResult?.emails || []);
        return emails.slice(0, 5).map(e => ({
          id: e.id,
          subject: e.subject ? e.subject.substring(0, 50) : 'No subject'
        }));
      })()
    };

    console.log('Debug state:', state);
    return state;
  }

  async markEmailsRead(emailIds, markAsRead = true) {
    console.log(`Marking ${emailIds.length} emails as ${markAsRead ? 'read' : 'unread'}`);
    
    const results = [];
    
    for (const emailId of emailIds) {
      try {
        // Find the email row
        const emailRow = document.querySelector(`span[data-legacy-thread-id="${emailId}"]`)?.closest('tr.zA');
        
        if (!emailRow) {
          results.push({ emailId, success: false, error: 'Email not found' });
          continue;
        }
        
        // Check current state
        const isCurrentlyUnread = emailRow.classList.contains('zE') || 
                                 emailRow.querySelector('.yW .zE') !== null;
        
        // If already in target state, skip
        if ((markAsRead && !isCurrentlyUnread) || (!markAsRead && isCurrentlyUnread)) {
          results.push({ emailId, success: true, message: 'Already in target state' });
          continue;
        }
        
        // Select the email row (if not selected)
        const checkbox = emailRow.querySelector('td.oZ-x3 input[type="checkbox"]') ||
                        emailRow.querySelector('input[type="checkbox"]');
        
        if (checkbox && !checkbox.checked) {
          checkbox.click();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Find mark button
        const markButton = this.findMarkReadButton(markAsRead);
        
        if (markButton) {
          markButton.click();
          await new Promise(resolve => setTimeout(resolve, 200));
          results.push({ emailId, success: true });
        } else {
          // Try keyboard shortcuts
          if (markAsRead) {
            // Shift+I to mark as read
            document.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'I',
              shiftKey: true,
              bubbles: true
            }));
          } else {
            // Shift+U to mark as unread
            document.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'U',
              shiftKey: true,
              bubbles: true
            }));
          }
          await new Promise(resolve => setTimeout(resolve, 200));
          results.push({ emailId, success: true, method: 'keyboard' });
        }
        
        // Deselect the checkbox
        if (checkbox && checkbox.checked) {
          checkbox.click();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        results.push({ emailId, success: false, error: error.message });
      }
    }
    
    return { results, totalProcessed: emailIds.length };
  }

  findMarkReadButton(markAsRead) {
    // Gmail toolbar mark buttons selectors
    const selectors = markAsRead ? [
      '[aria-label*="Mark as read"]',
      '[data-tooltip*="Mark as read"]',
      '.ar9.T-I-J3.J-J5-Ji',  // Mark as read button CSS class
      'div[role="button"][aria-label*="Mark as read"]'
    ] : [
      '[aria-label*="Mark as unread"]',
      '[data-tooltip*="Mark as unread"]',
      '.ar8.T-I-J3.J-J5-Ji',  // Mark as unread button CSS class
      'div[role="button"][aria-label*="Mark as unread"]'
    ];
    
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null) {
        return button;
      }
    }
    
    return null;
  }

  async deleteEmails(emailIds, permanent = false) {
    console.log(`${permanent ? 'Permanently deleting' : 'Moving to trash'} ${emailIds.length} emails`);
    
    // Select emails first
    const selectedEmails = await this.selectEmails(emailIds);
    
    if (selectedEmails.length === 0) {
      return { results: [], error: 'No emails found to delete' };
    }
    
    try {
      if (permanent) {
        // Permanent delete: Shift + Delete
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Delete',
          shiftKey: true,
          bubbles: true
        }));
      } else {
        // Move to trash: Delete or click delete button
        const deleteButton = this.findDeleteButton();
        if (deleteButton) {
          deleteButton.click();
        } else {
          // Use keyboard shortcut
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Delete',
            bubbles: true
          }));
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check for confirmation dialog
      const confirmDialog = document.querySelector('[role="dialog"]');
      if (confirmDialog) {
        const confirmButton = confirmDialog.querySelector('[aria-label*="Delete"]') ||
                             confirmDialog.querySelector('button[name="ok"]');
        if (confirmButton) {
          confirmButton.click();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      return {
        results: emailIds.map(id => ({ emailId: id, success: true })),
        totalProcessed: emailIds.length,
        action: permanent ? 'permanently_deleted' : 'moved_to_trash'
      };
      
    } catch (error) {
      return {
        results: emailIds.map(id => ({ emailId: id, success: false, error: error.message })),
        error: error.message
      };
    }
  }

  async archiveEmails(emailIds) {
    console.log(`Archiving ${emailIds.length} emails`);
    
    const selectedEmails = await this.selectEmails(emailIds);
    
    if (selectedEmails.length === 0) {
      return { results: [], error: 'No emails found to archive' };
    }
    
    try {
      // Find archive button
      const archiveButton = this.findArchiveButton();
      
      if (archiveButton) {
        archiveButton.click();
      } else {
        // Use keyboard shortcut 'e'
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'e',
          bubbles: true
        }));
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        results: emailIds.map(id => ({ emailId: id, success: true })),
        totalProcessed: emailIds.length,
        action: 'archived'
      };
      
    } catch (error) {
      return {
        results: emailIds.map(id => ({ emailId: id, success: false, error: error.message })),
        error: error.message
      };
    }
  }

  async selectEmails(emailIds) {
    const selectedEmails = [];
    
    for (const emailId of emailIds) {
      const emailRow = document.querySelector(`span[data-legacy-thread-id="${emailId}"]`)?.closest('tr.zA');
      
      if (emailRow) {
        const checkbox = emailRow.querySelector('td.oZ-x3 input[type="checkbox"]') ||
                        emailRow.querySelector('input[type="checkbox"]');
        
        if (checkbox && !checkbox.checked) {
          checkbox.click();
          await new Promise(resolve => setTimeout(resolve, 100));
          selectedEmails.push(emailId);
        } else if (checkbox && checkbox.checked) {
          selectedEmails.push(emailId);
        }
      }
    }
    
    return selectedEmails;
  }

  findDeleteButton() {
    const selectors = [
      '[aria-label*="Delete"]',
      '[data-tooltip*="Delete"]',
      '.ar5.T-I-J3.J-J5-Ji',  // Delete button CSS class
      'div[role="button"][aria-label*="Delete"]'
    ];
    
    return this.findButtonBySelectors(selectors);
  }

  findArchiveButton() {
    const selectors = [
      '[aria-label*="Archive"]',
      '[data-tooltip*="Archive"]',
      '.ar3.T-I-J3.J-J5-Ji',  // Archive button CSS class
      'div[role="button"][aria-label*="Archive"]'
    ];
    
    return this.findButtonBySelectors(selectors);
  }

  findButtonBySelectors(selectors) {
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null) {
        return button;
      }
    }
    return null;
  }

  async getEmailAttachments(emailId) {
    console.log(`Getting attachments for email: ${emailId}`);
    
    // Ensure email is open
    const emailData = await this.getEmailContent(emailId);
    if (!emailData || emailData.error) {
      return { error: 'Failed to open email' };
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Find attachments
    const attachments = [];
    
    // Gmail attachment selectors
    const attachmentContainers = document.querySelectorAll('.aZo, .aQH, .aZB');
    
    attachmentContainers.forEach((container, index) => {
      try {
        // Find attachment name
        const nameElement = container.querySelector('.aV3') || 
                           container.querySelector('.aZp') ||
                           container.querySelector('span[role="link"]') ||
                           container.querySelector('[aria-label*="Download"]');
        
        // Find size info
        const sizeElement = container.querySelector('.aZw') ||
                           container.querySelector('.yP');
        
        // Find download link
        const downloadLink = container.querySelector('a[download]') ||
                            container.querySelector('.aZp') ||
                            container.querySelector('[aria-label*="Download"]');
        
        if (nameElement) {
          const filename = nameElement.textContent?.trim() || 
                          nameElement.getAttribute('aria-label')?.replace('Download ', '') ||
                          'Unknown';
          
          const attachment = {
            id: `attachment_${index}`,
            filename: filename,
            size: sizeElement ? sizeElement.textContent.trim() : 'Unknown',
            downloadUrl: downloadLink ? downloadLink.href : null,
            type: this.getFileType(filename),
            canDownload: !!downloadLink
          };
          
          attachments.push(attachment);
        }
      } catch (error) {
        console.error(`Error processing attachment ${index}:`, error);
      }
    });
    
    return {
      emailId,
      attachments,
      totalAttachments: attachments.length,
      hasAttachments: attachments.length > 0
    };
  }

  async downloadAttachment(emailId, attachmentId) {
    console.log(`Downloading attachment ${attachmentId} from email ${emailId}`);
    
    // Get attachment info
    const attachmentData = await this.getEmailAttachments(emailId);
    
    if (!attachmentData.hasAttachments) {
      return { error: 'No attachments found in email' };
    }
    
    const attachment = attachmentData.attachments.find(att => 
      att.id === attachmentId || att.filename === attachmentId
    );
    
    if (!attachment) {
      return { error: 'Attachment not found' };
    }
    
    if (!attachment.canDownload || !attachment.downloadUrl) {
      return { error: 'Attachment cannot be downloaded' };
    }
    
    try {
      // Find the actual download element
      const downloadElements = document.querySelectorAll('a[download], [aria-label*="Download"]');
      let downloadElement = null;
      
      for (const elem of downloadElements) {
        if (elem.href === attachment.downloadUrl || 
            elem.textContent?.includes(attachment.filename) ||
            elem.getAttribute('aria-label')?.includes(attachment.filename)) {
          downloadElement = elem;
          break;
        }
      }
      
      if (downloadElement) {
        downloadElement.click();
        
        return {
          success: true,
          filename: attachment.filename,
          size: attachment.size,
          message: 'Download started'
        };
      } else {
        // Create temporary download link as fallback
        const tempLink = document.createElement('a');
        tempLink.href = attachment.downloadUrl;
        tempLink.download = attachment.filename;
        tempLink.style.display = 'none';
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        
        return {
          success: true,
          filename: attachment.filename,
          size: attachment.size,
          message: 'Download started via temporary link'
        };
      }
      
    } catch (error) {
      return {
        error: `Download failed: ${error.message}`,
        filename: attachment.filename
      };
    }
  }

  getFileType(filename) {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    const typeMap = {
      'pdf': 'document',
      'doc': 'document',
      'docx': 'document',
      'txt': 'document',
      'jpg': 'image',
      'jpeg': 'image',
      'png': 'image',
      'gif': 'image',
      'mp4': 'video',
      'avi': 'video',
      'mp3': 'audio',
      'wav': 'audio',
      'zip': 'archive',
      'rar': 'archive',
      'xlsx': 'spreadsheet',
      'xls': 'spreadsheet',
      'csv': 'spreadsheet',
      'ppt': 'presentation',
      'pptx': 'presentation'
    };
    
    return typeMap[extension] || 'unknown';
  }

  // ==================== P0级核心功能实现 ====================
  
  // Gmail标签管理系统 - 完整CRUD操作支持
  createLabelManager() {
    return new LabelManager(this);
  }

  // 邮件转发功能 - 基于现有composeReply架构
  async forwardEmail(emailId, recipients, message = '', includeAttachments = true) {
    console.log(`Forwarding email ${emailId} to ${recipients}`);
    console.log('Forward message:', message);

    try {
      // 首先确保邮件已打开
      const emailData = await this.getEmailContent(emailId);
      
      if (!emailData || emailData.error) {
        throw new Error(`Failed to open email: ${emailData?.error || 'Unknown error'}`);
      }

      // 等待邮件完全加载
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 查找转发按钮 - 使用多选择器容错策略
      const forwardSelectors = [
        '[aria-label*="Forward"]',
        '[data-tooltip*="Forward"]',
        'div[role="button"][aria-label*="Forward"]',
        'span[role="button"][aria-label*="Forward"]',
        '.ams.bkH:nth-child(3)',  // 通常转发按钮是第三个
        '.T-I.J-J5-Ji.T-I-Js-IF.aaq.T-I-ax7.L3'  // Gmail的转发按钮CSS类
      ];

      let forwardButton = null;
      for (const selector of forwardSelectors) {
        const buttons = document.querySelectorAll(selector);
        for (const button of buttons) {
          if (button && button.offsetParent !== null && 
              (button.textContent.toLowerCase().includes('forward') || 
               button.getAttribute('aria-label')?.toLowerCase().includes('forward'))) {
            forwardButton = button;
            console.log(`Found forward button with selector: ${selector}`);
            break;
          }
        }
        if (forwardButton) break;
      }

      if (!forwardButton) {
        // 尝试在邮件操作区域查找转发按钮
        const actionsArea = document.querySelector('.iN') || document.querySelector('.btb');
        if (actionsArea) {
          const actionButtons = actionsArea.querySelectorAll('[role="button"]');
          for (const button of actionButtons) {
            if (button.getAttribute('aria-label')?.toLowerCase().includes('forward')) {
              forwardButton = button;
              break;
            }
          }
        }
      }

      if (!forwardButton) {
        throw new Error('Could not find forward button. Make sure the email is open.');
      }

      // 点击转发按钮
      forwardButton.click();
      console.log('Forward button clicked');

      // 等待转发窗口打开
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 填写收件人 - 支持多个收件人
      const recipientList = Array.isArray(recipients) ? recipients.join(', ') : recipients;
      
      if (recipientList) {
        const toSelectors = [
          'textarea[name="to"]',
          'input[name="to"]',
          '[aria-label*="To"][role="combobox"]',
          '[aria-label="To"]',
          'div[name="to"]'
        ];

        let toField = null;
        for (const selector of toSelectors) {
          toField = document.querySelector(selector);
          if (toField) {
            console.log(`Found To field with selector: ${selector}`);
            break;
          }
        }

        if (toField) {
          toField.focus();
          toField.value = recipientList;
          toField.dispatchEvent(new Event('input', { bubbles: true }));
          toField.dispatchEvent(new Event('change', { bubbles: true }));
          // Tab到下一字段
          toField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        } else {
          console.warn('Could not find To field in forward window');
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      // 添加转发消息（如果提供）
      if (message) {
        const bodySelectors = [
          '[aria-label="Message Body"]',
          '[aria-label*="Message body"]',
          'div[role="textbox"][aria-label*="Message"]',
          'div[contenteditable="true"][role="textbox"]',
          '.Am.Al.editable',
          '.editable[contenteditable="true"]'
        ];

        let bodyField = null;
        let attempts = 0;
        const maxAttempts = 5;

        // 尝试多次找到正文字段（转发窗口可能加载较慢）
        while (!bodyField && attempts < maxAttempts) {
          for (const selector of bodySelectors) {
            bodyField = document.querySelector(selector);
            if (bodyField && bodyField.offsetParent !== null) {
              console.log(`Found body field with selector: ${selector}`);
              break;
            }
          }
          
          if (!bodyField) {
            attempts++;
            console.log(`Body field not found, attempt ${attempts}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (bodyField) {
          bodyField.focus();
          
          // 在转发内容前添加消息
          const formattedMessage = message.replace(/\n/g, '<br>');
          const currentContent = bodyField.innerHTML;
          
          // 插入转发消息在现有内容前面
          bodyField.innerHTML = `${formattedMessage}<br><br>${currentContent}`;
          
          bodyField.dispatchEvent(new Event('input', { bubbles: true }));
          bodyField.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          console.warn('Could not find body field in forward window');
        }
      }

      console.log('Forward window opened and filled successfully');
      
      // 等待Gmail处理所有字段
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 查找并点击发送按钮
      const sendButtonSelectors = [
        '[aria-label*="Send"]',
        '[data-tooltip*="Send"]',
        'div[role="button"][aria-label*="Send"]',
        '.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3',
        'div.dC > div.gU.Up > div > div.btA > div[role="button"]:nth-child(1)',
        'div[data-tooltip-delay="800"]'
      ];
      
      let sendButton = null;
      for (const selector of sendButtonSelectors) {
        const buttons = document.querySelectorAll(selector);
        for (const button of buttons) {
          // 检查是否可见且包含Send文本/图标
          if (button.offsetParent !== null && 
              (button.textContent.includes('Send') || 
               button.getAttribute('aria-label')?.includes('Send'))) {
            sendButton = button;
            console.log(`Found send button with selector: ${selector}`);
            break;
          }
        }
        if (sendButton) break;
      }
      
      if (sendButton) {
        console.log('Clicking send button...');
        sendButton.click();
        
        // 等待邮件发送
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
          success: true,
          message: 'Email forwarded successfully',
          emailId: emailId,
          recipients: recipientList,
          sent: true
        };
      } else {
        console.warn('Could not find send button, email saved as draft');
        return {
          success: true,
          message: 'Forward saved as draft (send button not found)',
          emailId: emailId,
          recipients: recipientList,
          sent: false
        };
      }
      
    } catch (error) {
      console.error('Error in forwardEmail:', error);
      throw error;
    }
  }
}

// ==================== LabelManager类 - Gmail标签系统完整集成 ====================
class LabelManager {
  constructor(gmailInterface) {
    this.gmail = gmailInterface;
    console.log('LabelManager initialized');
  }

  // 获取所有Gmail标签（系统+自定义）
  async listLabels() {
    console.log('Listing Gmail labels...');
    
    try {
      // 确保在合适的视图
      const currentView = this.gmail.detectViewState();
      if (!['inbox', 'all', 'sent', 'drafts'].includes(currentView)) {
        await this.gmail.switchToView('inbox');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const labels = { system: [], custom: [], total: 0 };
      
      // 多种选择器策略来找到标签
      const labelSelectors = [
        // 侧边栏标签列表
        'div[role="navigation"] [role="link"]',
        'div[role="navigation"] a[aria-label]',
        '.TK .TO .nZ',  // Gmail侧边栏标签
        '.aip .aim .n0',  // 更新版Gmail标签
        '[data-tooltip*="label"]',
        // 标签下拉菜单（如果打开）
        '.J-M.J-M-JJ .J-N:not(.J-N-JT)',
        // 搜索建议中的标签
        '.aZo[role="listbox"] .aZf'
      ];

      // 首先尝试从侧边栏获取可见标签
      let foundLabels = new Set();
      
      for (const selector of labelSelectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`Found ${elements.length} elements with selector: ${selector}`);
        
        elements.forEach((element) => {
          try {
            const labelText = element.textContent?.trim() || 
                            element.getAttribute('aria-label') ||
                            element.getAttribute('title');
            
            if (labelText && labelText.length > 0 && 
                !foundLabels.has(labelText) &&
                !this.isExcludedLabel(labelText)) {
              
              const labelInfo = {
                name: labelText,
                displayName: labelText,
                type: this.getLabelType(labelText),
                href: element.href || null,
                unreadCount: this.extractUnreadCount(element),
                isVisible: element.offsetParent !== null
              };
              
              if (labelInfo.type === 'system') {
                labels.system.push(labelInfo);
              } else {
                labels.custom.push(labelInfo);
              }
              
              foundLabels.add(labelText);
            }
          } catch (error) {
            console.warn('Error processing label element:', error);
          }
        });
      }

      // 尝试通过Gmail的内部API获取更完整的标签列表
      await this.tryGetLabelsFromGmailAPI(labels, foundLabels);
      
      // 尝试通过标签菜单获取更多标签
      await this.tryGetLabelsFromLabelMenu(labels, foundLabels);

      labels.total = labels.system.length + labels.custom.length;
      
      console.log(`Found ${labels.total} labels: ${labels.system.length} system, ${labels.custom.length} custom`);
      
      return {
        success: true,
        labels: labels,
        timestamp: new Date().toISOString(),
        currentView: this.gmail.detectViewState()
      };
      
    } catch (error) {
      console.error('Error listing labels:', error);
      return {
        success: false,
        error: error.message,
        labels: { system: [], custom: [], total: 0 }
      };
    }
  }

  // 尝试从Gmail内部API获取标签
  async tryGetLabelsFromGmailAPI(labels, foundLabels) {
    try {
      // 检查Gmail内部对象是否可用
      if (window.GM && window.GM.getLabels) {
        const gmailLabels = window.GM.getLabels();
        gmailLabels.forEach(label => {
          if (!foundLabels.has(label.name)) {
            const labelInfo = {
              name: label.name,
              displayName: label.displayName || label.name,
              type: label.type || this.getLabelType(label.name),
              unreadCount: label.unreadCount || 0,
              isVisible: true,
              gmailId: label.id
            };
            
            if (labelInfo.type === 'system') {
              labels.system.push(labelInfo);
            } else {
              labels.custom.push(labelInfo);
            }
            
            foundLabels.add(label.name);
          }
        });
      }
    } catch (error) {
      console.log('Gmail internal API not available:', error.message);
    }
  }

  // 尝试从标签菜单获取标签
  async tryGetLabelsFromLabelMenu(labels, foundLabels) {
    try {
      // 查找标签菜单按钮
      const labelMenuButton = document.querySelector('.ar9.T-I-J3.J-J5-Ji') || 
                             document.querySelector('[aria-label*="Label"]') ||
                             document.querySelector('[data-tooltip*="Labels"]');
      
      if (labelMenuButton) {
        // 临时点击菜单按钮获取标签列表
        labelMenuButton.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 查找菜单中的标签
        const menuLabels = document.querySelectorAll('.J-N:not(.J-N-JT)');
        menuLabels.forEach(labelElement => {
          const labelText = labelElement.textContent?.trim();
          if (labelText && !foundLabels.has(labelText) && !this.isExcludedLabel(labelText)) {
            const labelInfo = {
              name: labelText,
              displayName: labelText,
              type: this.getLabelType(labelText),
              unreadCount: 0,
              isVisible: true
            };
            
            if (labelInfo.type === 'system') {
              labels.system.push(labelInfo);
            } else {
              labels.custom.push(labelInfo);
            }
            
            foundLabels.add(labelText);
          }
        });
        
        // 关闭菜单
        document.addEventListener('click', (e) => {
          if (!e.target.closest('.J-M')) {
            // 点击菜单外部关闭
          }
        }, { once: true });
        
        // 按ESC关闭菜单
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      }
    } catch (error) {
      console.log('Could not access label menu:', error.message);
    }
  }

  // 批量标签操作：add/remove/replace
  async manageEmailLabels(emailIds, labels, action = 'add') {
    console.log(`${action} labels [${labels.join(', ')}] to/from ${emailIds.length} emails`);
    
    const results = [];
    const labelArray = Array.isArray(labels) ? labels : [labels];
    const emailArray = Array.isArray(emailIds) ? emailIds : [emailIds];
    
    for (const emailId of emailArray) {
      try {
        const result = await this.manageSingleEmailLabels(emailId, labelArray, action);
        results.push({ emailId, success: result.success, message: result.message });
      } catch (error) {
        results.push({ emailId, success: false, error: error.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount > 0,
      results: results,
      totalProcessed: emailArray.length,
      successCount: successCount,
      action: action,
      labels: labelArray
    };
  }

  // 单个邮件的标签操作
  async manageSingleEmailLabels(emailId, labels, action) {
    // 找到邮件行
    const emailRow = document.querySelector(`span[data-legacy-thread-id="${emailId}"]`)?.closest('tr.zA');
    
    if (!emailRow) {
      throw new Error('Email not found');
    }
    
    // 选择邮件
    const checkbox = emailRow.querySelector('input[type="checkbox"]');
    if (checkbox && !checkbox.checked) {
      checkbox.click();
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    try {
      if (action === 'add') {
        return await this.addLabelsToSelectedEmails(labels);
      } else if (action === 'remove') {
        return await this.removeLabelsFromSelectedEmails(labels);
      } else if (action === 'replace') {
        // 先移除所有标签，再添加新标签
        await this.removeAllLabelsFromSelectedEmails();
        return await this.addLabelsToSelectedEmails(labels);
      }
    } finally {
      // 取消选择邮件
      if (checkbox && checkbox.checked) {
        checkbox.click();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  // 添加标签到选中的邮件
  async addLabelsToSelectedEmails(labels) {
    // 查找标签按钮
    const labelButton = document.querySelector('.ar9.T-I-J3.J-J5-Ji') ||
                       document.querySelector('[aria-label*="Label"]') ||
                       document.querySelector('[data-tooltip*="Labels"]');
    
    if (!labelButton) {
      throw new Error('Label button not found');
    }
    
    labelButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 在标签菜单中查找并点击指定标签
    for (const labelName of labels) {
      const labelElement = this.findLabelInMenu(labelName);
      if (labelElement) {
        labelElement.click();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // 关闭菜单
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    
    return { success: true, message: `Added labels: ${labels.join(', ')}` };
  }

  // 从选中的邮件移除标签
  async removeLabelsFromSelectedEmails(labels) {
    // 类似添加标签的逻辑，但是点击已选中的标签来取消选择
    const labelButton = document.querySelector('.ar9.T-I-J3.J-J5-Ji') ||
                       document.querySelector('[aria-label*="Label"]') ||
                       document.querySelector('[data-tooltip*="Labels"]');
    
    if (!labelButton) {
      throw new Error('Label button not found');
    }
    
    labelButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 在标签菜单中查找并取消选择指定标签
    for (const labelName of labels) {
      const labelElement = this.findLabelInMenu(labelName);
      if (labelElement && labelElement.querySelector('.J-N-Jz')) { // 已选中的标签
        labelElement.click();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // 关闭菜单
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    
    return { success: true, message: `Removed labels: ${labels.join(', ')}` };
  }

  // 基于标签的邮件搜索
  async searchByLabel(labelName, limit = 50) {
    console.log(`Searching emails with label: ${labelName}`);
    
    try {
      // 使用Gmail搜索语法
      const searchQuery = `label:${labelName}`;
      
      // 复用现有的搜索功能
      const searchResult = await this.gmail.searchEmails(searchQuery, { limit: limit });
      
      return {
        success: true,
        label: labelName,
        emails: searchResult.results || [],
        count: searchResult.count || 0,
        searchQuery: searchResult.query,
        url: searchResult.url
      };
      
    } catch (error) {
      console.error('Error searching by label:', error);
      return {
        success: false,
        error: error.message,
        label: labelName,
        emails: []
      };
    }
  }

  // 创建新标签（如果Gmail支持）
  async createLabel(labelName, parentLabel = null) {
    console.log(`Creating label: ${labelName}${parentLabel ? ` under ${parentLabel}` : ''}`);
    
    try {
      // 查找标签设置或创建标签的入口
      // Gmail通常在设置中或通过右键菜单创建标签
      
      // 方法1: 尝试通过设置页面
      const settingsResult = await this.tryCreateLabelViaSettings(labelName, parentLabel);
      if (settingsResult.success) {
        return settingsResult;
      }
      
      // 方法2: 尝试通过键盘快捷键
      const shortcutResult = await this.tryCreateLabelViaShortcut(labelName, parentLabel);
      if (shortcutResult.success) {
        return shortcutResult;
      }
      
      return {
        success: false,
        error: 'Unable to create label. Please create labels manually in Gmail settings.',
        labelName: labelName,
        suggestion: 'Go to Gmail Settings > Labels to create custom labels'
      };
      
    } catch (error) {
      console.error('Error creating label:', error);
      return {
        success: false,
        error: error.message,
        labelName: labelName
      };
    }
  }

  // 尝试通过Gmail设置创建标签
  async tryCreateLabelViaSettings(labelName, parentLabel) {
    // 这个功能需要导航到Gmail设置页面，实现较复杂
    // 对于P0版本，我们返回指导信息
    return {
      success: false,
      message: 'Label creation requires manual setup in Gmail settings'
    };
  }

  // 尝试通过快捷键创建标签
  async tryCreateLabelViaShortcut(labelName, parentLabel) {
    // Gmail的 'l' 键通常用于标签操作
    // 但创建新标签通常需要通过设置页面
    return {
      success: false,
      message: 'Label creation via shortcut not supported'
    };
  }

  // 辅助方法：判断标签类型
  getLabelType(labelName) {
    const systemLabels = [
      'Inbox', 'Sent', 'Drafts', 'Trash', 'Spam', 'Starred', 'Important',
      'Unread', 'All Mail', 'Chats', 'Snoozed', 'Scheduled',
      'Promotions', 'Social', 'Updates', 'Forums', 'Primary',
      '收件箱', '已发送', '草稿', '垃圾箱', '垃圾邮件', '已加星标', '重要', 
      '未读', '所有邮件', '聊天', '稍后处理', '已计划'
    ];
    
    return systemLabels.includes(labelName) ? 'system' : 'custom';
  }

  // 辅助方法：排除不相关的标签文本
  isExcludedLabel(labelText) {
    const excludePatterns = [
      'Compose', 'Settings', 'Help', 'More', 'Less',
      '撰写', '设置', '帮助', '更多', '收起',
      'Gmail', 'Google', 'Account'
    ];
    
    return excludePatterns.some(pattern => labelText.includes(pattern)) ||
           labelText.length < 2 || 
           /^\d+$/.test(labelText); // 排除纯数字
  }

  // 辅助方法：提取未读数量
  extractUnreadCount(element) {
    try {
      // 查找未读数量指示器
      const unreadIndicator = element.querySelector('.bsU') || 
                            element.querySelector('[class*="unread"]') ||
                            element.querySelector('.n0:last-child');
      
      if (unreadIndicator) {
        const countText = unreadIndicator.textContent?.trim();
        const count = parseInt(countText);
        return isNaN(count) ? 0 : count;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }

  // 辅助方法：在标签菜单中查找标签
  findLabelInMenu(labelName) {
    const menuLabels = document.querySelectorAll('.J-N:not(.J-N-JT)');
    
    for (const labelElement of menuLabels) {
      const labelText = labelElement.textContent?.trim();
      if (labelText === labelName) {
        return labelElement;
      }
    }
    
    return null;
  }
}

  // Create and set global instance
  console.log('Creating GmailInterface instance...');
  try {
    const gmailInterface = new GmailInterface();
    window.gmailInterface = gmailInterface;
    console.log('window.gmailInterface set:', !!window.gmailInterface);

    // Send ready signal to background script
    chrome.runtime.sendMessage({ action: 'contentScriptReady' }, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to send ready signal:', chrome.runtime.lastError.message);
      } else {
        console.log('Content script ready signal sent successfully');
      }
    });

  } catch (error) {
    console.error('Error creating GmailInterface:', error);
  }
}

// Start initialization
initializeWhenReady();