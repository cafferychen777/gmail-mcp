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
    this.init();
  }

  async init() {
    console.log('Gmail MCP Bridge initialized');
    await this.detectAccount();     // 新增：检测账号
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
              await this.composeReply(emailId, replyContent);
              responseData = { success: true };
              break;

            case 'sendEmail':
              await this.sendEmail(request.params?.to || request.to,
                            request.params?.subject || request.subject,
                            request.params?.body || request.body);
              responseData = { success: true, message: 'Email compose window opened' };
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
    const suitableViews = ['inbox', 'all', 'sent', 'drafts', 'starred', 'important'];
    const problematicViews = ['search', 'label', 'category'];

    if (!suitableViews.includes(currentView)) {
      console.warn(`Not in a suitable view for email listing (current: ${currentView})`);

      // 对于搜索视图，提供特殊处理
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
        error: `Cannot list emails in ${currentView} view. Please switch to inbox.`,
        currentView: currentView,
        supportedViews: suitableViews
      };
    }
    
    const emails = [];

    // 尝试多种选择器，Gmail可能使用不同的结构
    const selectors = [
      'tr.zA',  // 标准邮件行（最常见）
      'div[role="main"] tr[jsaction]',  // 备用选择器
      'tbody tr[class*="z"]',  // 更宽泛的选择器
      'div[gh="tl"] tr',  // 邮件列表容器
      'table.F tbody tr.zA',  // 完整路径
      'div[role="list"] > div[role="listitem"]',  // 新版Gmail可能使用
      'tr[jsaction*="email"]',  // 包含email action的行
      'div.Cp tbody tr'  // 另一种可能的容器
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
        // Find the span with thread ID - 这是最可靠的标识符
        const threadSpan = row.querySelector('span[data-legacy-thread-id]');
        if (!threadSpan) {
          // 尝试其他方式获取ID
          const idElement = row.querySelector('[data-thread-id]') || 
                          row.querySelector('[data-message-id]');
          if (!idElement) return;
        }

        const threadId = threadSpan ? 
          threadSpan.getAttribute('data-legacy-thread-id') : 
          (row.querySelector('[data-thread-id]')?.getAttribute('data-thread-id') || 
           `email_${index}`);
           
        const subject = threadSpan ? 
          threadSpan.textContent.trim() : 
          (row.querySelector('.y6')?.textContent.trim() || 'No subject');

        // Find sender - 尝试多种选择器
        const senderElement = row.querySelector('[email]') ||
                             row.querySelector('.yW span') ||
                             row.querySelector('.bA4 span') ||
                             row.querySelector('.yX span');
        const sender = senderElement ?
          (senderElement.getAttribute('email') || 
           senderElement.getAttribute('name') ||
           senderElement.textContent.trim()) : 'Unknown';

        // Find date
        const dateElement = row.querySelector('.xW span[title]') ||
                           row.querySelector('.xW') ||
                           row.querySelector('[title*="202"]');  // 查找包含年份的元素
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

    try {
      // Build the full search query with options
      let fullQuery = query;

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

      // Find the search box
      const searchBox = document.querySelector('input[aria-label*="Search"]') ||
                       document.querySelector('input[name="q"]') ||
                       document.querySelector('.gb_hf');

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

      // Wait for search results to load
      await new Promise(resolve => setTimeout(resolve, 3000));

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
        url: window.location.href
      };

      if (errorInfo) {
        result.warning = errorInfo;
      }

      return result;

    } catch (error) {
      console.error('Error in searchEmails:', error);
      return {
        query: fullQuery || query,
        results: [],
        count: 0,
        error: `Search failed: ${error.message}`,
        url: window.location.href
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