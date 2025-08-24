/**
 * Outlook Email Provider Plugin
 * 
 * 演示如何扩展 Gmail MCP Bridge 支持其他邮箱服务
 * 基于 Linus "好品味" 设计原则：
 * 1. 消除特殊情况 - 使用与 Gmail 相同的操作接口
 * 2. 数据结构优先 - 统一的邮件数据格式
 * 3. Never break userspace - 完全兼容现有 MCP 工具
 * 4. 实用主义 - 解决真实的多邮箱服务需求
 */

import { EmailHandlerPlugin } from '../plugin-interface.js';

export default class OutlookPlugin extends EmailHandlerPlugin {
  constructor(options = {}) {
    super(options);
    
    // 插件元数据
    this.name = 'outlook-provider';
    this.version = '1.0.0';
    this.description = 'Outlook/Hotmail email provider for Gmail MCP Bridge';
    this.author = 'Gmail MCP Team';
    
    // 插件依赖
    this.dependencies = ['gmail-mcp-core'];
    
    // 权限声明
    this.permissions.push(
      'outlook-access',
      'web-request',
      'storage-access'
    );
    
    // Outlook 特定配置
    this.outlookConfig = {
      baseUrl: 'https://outlook.live.com',
      apiVersion: 'v2.0',
      maxRetries: 3,
      timeout: 30000,
      ...this.config.outlook
    };
    
    // 邮件选择器 - Outlook 特有的 DOM 结构
    this.selectors = {
      emailList: '[data-testid="message-list"]',
      emailItem: '[data-testid="message-item"]', 
      emailSubject: '[data-testid="message-subject"]',
      emailSender: '[data-testid="message-sender"]',
      emailDate: '[data-testid="message-date"]',
      emailBody: '[data-testid="message-body"]',
      composeButton: '[data-testid="compose-button"]',
      sendButton: '[data-testid="send-button"]',
      deleteButton: '[data-testid="delete-button"]',
      archiveButton: '[data-testid="archive-button"]',
      starButton: '[data-testid="star-button"]',
      ...this.config.selectors
    };
    
    // 支持的邮件操作
    this.supportedActions = [
      'read', 'send', 'delete', 'archive',
      'star', 'unstar', 'mark-read', 'mark-unread',
      'move-folder', 'get-folders', 'search'
    ];
    
    // 内部状态
    this.outlookTab = null;
    this.isConnected = false;
    this.authToken = null;
    
    // 绑定方法上下文
    this.detectOutlookTab = this.detectOutlookTab.bind(this);
    this.injectContentScript = this.injectContentScript.bind(this);
  }

  /**
   * 插件初始化
   */
  async onInitialize() {
    this.log('Initializing Outlook plugin...');
    
    // 检测 Outlook 标签页
    await this.detectOutlookTab();
    
    // 注入内容脚本
    if (this.outlookTab) {
      await this.injectContentScript();
    }
    
    // 注册 Outlook 特有的钩子
    this.registerOutlookHooks();
    
    // 初始化认证
    await this.initializeAuth();
    
    this.log('Outlook plugin initialized successfully');
  }

  /**
   * 插件激活
   */
  async onActivate() {
    this.log('Activating Outlook plugin...');
    
    // 建立与 Outlook 的连接
    await this.connectToOutlook();
    
    // 注册为邮件提供者
    await this.registerEmailProvider();
    
    this.log('Outlook plugin activated successfully');
  }

  /**
   * 插件停用
   */
  async onDeactivate() {
    this.log('Deactivating Outlook plugin...');
    
    // 断开连接
    this.disconnectFromOutlook();
    
    // 注销邮件提供者
    await this.unregisterEmailProvider();
    
    this.log('Outlook plugin deactivated successfully');
  }

  // === 邮件操作处理方法 ===

  /**
   * 读取邮件
   */
  async handleRead(params) {
    if (!this.isConnected) {
      throw new Error('Not connected to Outlook');
    }
    
    const { messageId, folder = 'inbox' } = params;
    
    if (messageId) {
      return await this.readSingleEmail(messageId);
    } else {
      return await this.readEmailList(folder, params);
    }
  }

  /**
   * 发送邮件
   */
  async handleSend(params) {
    const { to, cc, bcc, subject, body, attachments = [] } = params;
    
    if (!to || !subject || !body) {
      throw new Error('Missing required fields: to, subject, body');
    }
    
    return await this.sendEmail({
      to: this.parseEmailAddresses(to),
      cc: cc ? this.parseEmailAddresses(cc) : [],
      bcc: bcc ? this.parseEmailAddresses(bcc) : [],
      subject,
      body,
      attachments
    });
  }

  /**
   * 删除邮件
   */
  async handleDelete(params) {
    const { messageIds } = params;
    
    if (!messageIds || messageIds.length === 0) {
      throw new Error('No message IDs provided');
    }
    
    const results = [];
    
    for (const messageId of messageIds) {
      try {
        await this.deleteEmail(messageId);
        results.push({ messageId, success: true });
      } catch (error) {
        results.push({ 
          messageId, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return { results };
  }

  /**
   * 归档邮件
   */
  async handleArchive(params) {
    const { messageIds } = params;
    
    return await this.moveEmails(messageIds, 'archive');
  }

  /**
   * 标星邮件
   */
  async handleStar(params) {
    const { messageIds } = params;
    
    return await this.toggleEmailFlag(messageIds, 'starred', true);
  }

  /**
   * 取消标星
   */
  async handleUnstar(params) {
    const { messageIds } = params;
    
    return await this.toggleEmailFlag(messageIds, 'starred', false);
  }

  /**
   * 标记为已读
   */
  async handleMarkRead(params) {
    const { messageIds } = params;
    
    return await this.toggleEmailFlag(messageIds, 'read', true);
  }

  /**
   * 标记为未读
   */
  async handleMarkUnread(params) {
    const { messageIds } = params;
    
    return await this.toggleEmailFlag(messageIds, 'read', false);
  }

  /**
   * 移动邮件到文件夹
   */
  async handleMoveFolder(params) {
    const { messageIds, targetFolder } = params;
    
    return await this.moveEmails(messageIds, targetFolder);
  }

  /**
   * 获取文件夹列表
   */
  async handleGetFolders(params) {
    return await this.getFolders();
  }

  /**
   * 搜索邮件
   */
  async handleSearch(params) {
    const { query, folder, limit = 50 } = params;
    
    return await this.searchEmails(query, folder, limit);
  }

  // === Outlook 特定实现方法 ===

  /**
   * 检测 Outlook 标签页
   */
  async detectOutlookTab() {
    try {
      // 通过 Chrome 扩展 API 检测 Outlook 标签页
      const tabs = await this.executeInContext(async () => {
        return new Promise((resolve) => {
          chrome.tabs.query({ 
            url: ['*://outlook.live.com/*', '*://outlook.office.com/*'] 
          }, resolve);
        });
      });
      
      if (tabs && tabs.length > 0) {
        this.outlookTab = tabs[0];
        this.log(`Found Outlook tab: ${this.outlookTab.url}`);
      } else {
        this.warn('No Outlook tab found');
      }
    } catch (error) {
      this.error('Failed to detect Outlook tab:', error.message);
    }
  }

  /**
   * 注入内容脚本
   */
  async injectContentScript() {
    if (!this.outlookTab) return;
    
    try {
      // 注入 Outlook 页面操作脚本
      await this.executeInContext(async () => {
        return new Promise((resolve, reject) => {
          chrome.scripting.executeScript({
            target: { tabId: this.outlookTab.id },
            func: this.createOutlookInterface,
            args: [this.selectors]
          }, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });
      });
      
      this.log('Content script injected successfully');
    } catch (error) {
      this.error('Failed to inject content script:', error.message);
    }
  }

  /**
   * 创建 Outlook 操作接口（在页面中执行）
   */
  createOutlookInterface(selectors) {
    // 这个函数将在 Outlook 页面中执行
    window.outlookMCP = {
      selectors,
      
      // 获取邮件列表
      getEmailList: () => {
        const emailElements = document.querySelectorAll(selectors.emailItem);
        return Array.from(emailElements).map(el => ({
          id: el.dataset.messageId || el.id,
          subject: el.querySelector(selectors.emailSubject)?.textContent?.trim(),
          sender: el.querySelector(selectors.emailSender)?.textContent?.trim(),
          date: el.querySelector(selectors.emailDate)?.textContent?.trim(),
          isRead: !el.classList.contains('unread'),
          isStarred: el.classList.contains('starred')
        }));
      },
      
      // 点击邮件
      clickEmail: (messageId) => {
        const emailEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (emailEl) {
          emailEl.click();
          return true;
        }
        return false;
      },
      
      // 获取邮件内容
      getEmailContent: () => {
        const bodyEl = document.querySelector(selectors.emailBody);
        return bodyEl ? bodyEl.innerHTML : null;
      },
      
      // 撰写邮件
      composeEmail: (emailData) => {
        const composeBtn = document.querySelector(selectors.composeButton);
        if (composeBtn) {
          composeBtn.click();
          
          // 等待撰写界面加载
          setTimeout(() => {
            // 填充邮件字段
            if (emailData.to) {
              const toField = document.querySelector('input[aria-label*="收件人"]');
              if (toField) toField.value = emailData.to;
            }
            
            if (emailData.subject) {
              const subjectField = document.querySelector('input[aria-label*="主题"]');
              if (subjectField) subjectField.value = emailData.subject;
            }
            
            if (emailData.body) {
              const bodyField = document.querySelector('[aria-label*="邮件正文"]');
              if (bodyField) bodyField.innerHTML = emailData.body;
            }
          }, 1000);
          
          return true;
        }
        return false;
      }
    };
    
    // 通知注入完成
    console.log('Outlook MCP interface created');
  }

  /**
   * 连接到 Outlook
   */
  async connectToOutlook() {
    if (!this.outlookTab) {
      await this.detectOutlookTab();
      if (!this.outlookTab) {
        throw new Error('Outlook tab not found. Please open Outlook in a tab.');
      }
    }
    
    // 测试连接
    const isConnected = await this.testConnection();
    
    if (isConnected) {
      this.isConnected = true;
      this.log('Connected to Outlook successfully');
    } else {
      throw new Error('Failed to establish connection to Outlook');
    }
  }

  /**
   * 断开 Outlook 连接
   */
  disconnectFromOutlook() {
    this.isConnected = false;
    this.outlookTab = null;
    this.authToken = null;
    this.log('Disconnected from Outlook');
  }

  /**
   * 测试连接
   */
  async testConnection() {
    if (!this.outlookTab) return false;
    
    try {
      const result = await this.executeInTab(this.outlookTab.id, () => {
        return document.title.includes('Outlook') || 
               document.title.includes('Hotmail') ||
               window.location.host.includes('outlook');
      });
      
      return result;
    } catch (error) {
      return false;
    }
  }

  /**
   * 读取单个邮件
   */
  async readSingleEmail(messageId) {
    const email = await this.executeInTab(this.outlookTab.id, (id) => {
      // 点击邮件打开
      if (window.outlookMCP.clickEmail(id)) {
        // 等待加载完成
        return new Promise((resolve) => {
          setTimeout(() => {
            const content = window.outlookMCP.getEmailContent();
            resolve({
              id,
              content,
              timestamp: new Date().toISOString()
            });
          }, 2000);
        });
      }
      return null;
    }, messageId);
    
    return this.normalizeEmailData(email);
  }

  /**
   * 读取邮件列表
   */
  async readEmailList(folder, params) {
    const { limit = 20, offset = 0 } = params;
    
    const emails = await this.executeInTab(this.outlookTab.id, () => {
      return window.outlookMCP.getEmailList();
    });
    
    // 应用分页
    const paginatedEmails = emails.slice(offset, offset + limit);
    
    return {
      emails: paginatedEmails.map(email => this.normalizeEmailData(email)),
      total: emails.length,
      folder,
      hasMore: offset + limit < emails.length
    };
  }

  /**
   * 发送邮件
   */
  async sendEmail(emailData) {
    const success = await this.executeInTab(this.outlookTab.id, (data) => {
      return window.outlookMCP.composeEmail(data);
    }, emailData);
    
    if (success) {
      // 等待用户手动发送或实现自动发送
      return {
        success: true,
        messageId: this.generateMessageId(),
        timestamp: new Date().toISOString()
      };
    } else {
      throw new Error('Failed to compose email');
    }
  }

  /**
   * 删除邮件
   */
  async deleteEmail(messageId) {
    // 实现邮件删除逻辑
    return await this.executeEmailAction(messageId, 'delete');
  }

  /**
   * 移动邮件
   */
  async moveEmails(messageIds, targetFolder) {
    const results = [];
    
    for (const messageId of messageIds) {
      try {
        const result = await this.executeEmailAction(messageId, 'move', { folder: targetFolder });
        results.push({ messageId, success: true, result });
      } catch (error) {
        results.push({ messageId, success: false, error: error.message });
      }
    }
    
    return { results };
  }

  /**
   * 切换邮件标记
   */
  async toggleEmailFlag(messageIds, flagType, value) {
    const results = [];
    
    for (const messageId of messageIds) {
      try {
        const result = await this.executeEmailAction(messageId, 'flag', { 
          type: flagType, 
          value 
        });
        results.push({ messageId, success: true, result });
      } catch (error) {
        results.push({ messageId, success: false, error: error.message });
      }
    }
    
    return { results };
  }

  /**
   * 获取文件夹列表
   */
  async getFolders() {
    // Outlook 常见文件夹
    return [
      { id: 'inbox', name: '收件箱', type: 'inbox' },
      { id: 'sent', name: '已发送邮件', type: 'sent' },
      { id: 'drafts', name: '草稿', type: 'drafts' },
      { id: 'deleted', name: '已删除邮件', type: 'trash' },
      { id: 'archive', name: '存档', type: 'archive' },
      { id: 'spam', name: '垃圾邮件', type: 'spam' }
    ];
  }

  /**
   * 搜索邮件
   */
  async searchEmails(query, folder, limit) {
    // 实现邮件搜索逻辑
    const searchResult = await this.executeInTab(this.outlookTab.id, (q, f, l) => {
      // 在页面中执行搜索
      const searchBox = document.querySelector('input[aria-label*="搜索"]');
      if (searchBox) {
        searchBox.value = q;
        searchBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        
        // 等待搜索结果
        return new Promise((resolve) => {
          setTimeout(() => {
            const results = window.outlookMCP.getEmailList();
            resolve(results.slice(0, l));
          }, 3000);
        });
      }
      return [];
    }, query, folder, limit);
    
    return {
      query,
      folder,
      results: searchResult.map(email => this.normalizeEmailData(email)),
      total: searchResult.length
    };
  }

  // === 工具方法 ===

  /**
   * 标准化邮件数据格式
   */
  normalizeEmailData(rawEmail) {
    return {
      id: rawEmail.id,
      subject: rawEmail.subject || '',
      sender: this.parseEmailAddress(rawEmail.sender || ''),
      recipients: this.parseEmailAddresses(rawEmail.to || ''),
      date: rawEmail.date ? new Date(rawEmail.date).toISOString() : new Date().toISOString(),
      body: rawEmail.content || rawEmail.body || '',
      isRead: rawEmail.isRead !== false,
      isStarred: rawEmail.isStarred === true,
      provider: 'outlook',
      folder: rawEmail.folder || 'inbox'
    };
  }

  /**
   * 解析邮箱地址
   */
  parseEmailAddress(emailString) {
    const match = emailString.match(/([^<]+)<([^>]+)>/) || 
                 emailString.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    
    if (match) {
      return {
        name: match[1]?.trim() || '',
        email: match[2]?.trim() || match[1]?.trim()
      };
    }
    
    return {
      name: '',
      email: emailString.trim()
    };
  }

  /**
   * 解析多个邮箱地址
   */
  parseEmailAddresses(emailString) {
    if (!emailString) return [];
    
    return emailString.split(/[,;]/)
      .map(addr => this.parseEmailAddress(addr))
      .filter(addr => addr.email);
  }

  /**
   * 执行邮件操作
   */
  async executeEmailAction(messageId, action, params = {}) {
    // 根据操作类型执行相应的页面操作
    return await this.executeInTab(this.outlookTab.id, (id, act, par) => {
      // 在页面中执行具体操作
      const emailEl = document.querySelector(`[data-message-id="${id}"]`);
      if (!emailEl) return false;
      
      switch (act) {
        case 'delete':
          const deleteBtn = emailEl.querySelector('[aria-label*="删除"]');
          if (deleteBtn) deleteBtn.click();
          break;
        case 'move':
          // 实现移动逻辑
          break;
        case 'flag':
          // 实现标记逻辑
          break;
      }
      
      return true;
    }, messageId, action, params);
  }

  /**
   * 在标签页中执行代码
   */
  async executeInTab(tabId, func, ...args) {
    return await this.executeInContext(async () => {
      return new Promise((resolve, reject) => {
        chrome.scripting.executeScript({
          target: { tabId },
          func,
          args
        }, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result?.[0]?.result);
          }
        });
      });
    });
  }

  /**
   * 在扩展上下文中执行代码
   */
  async executeInContext(func) {
    if (!this.checkPermission('web-request')) {
      throw new Error('Permission denied for web request');
    }
    
    return await func();
  }

  /**
   * 生成消息 ID
   */
  generateMessageId() {
    return `outlook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 注册 Outlook 钩子
   */
  registerOutlookHooks() {
    // 注册邮件收取钩子
    this.registerHook('email-received', async (context) => {
      if (context.provider === 'outlook') {
        this.log('Outlook email received:', context.email.subject);
        // 可以在这里添加 Outlook 特有的处理逻辑
      }
      return context;
    });
    
    // 注册邮件发送钩子
    this.registerHook('email-sent', async (context) => {
      if (context.provider === 'outlook') {
        this.log('Outlook email sent:', context.email.subject);
      }
      return context;
    });
  }

  /**
   * 注册为邮件提供者
   */
  async registerEmailProvider() {
    const providerInfo = {
      name: 'outlook',
      displayName: 'Outlook/Hotmail',
      plugin: this,
      supportedActions: this.supportedActions,
      isActive: () => this.isActive && this.isConnected,
      
      // 提供给 MCP 系统的统一接口
      handleAction: async (action, params) => {
        return await this.handleEmailAction(action, params);
      }
    };
    
    // 通过插件系统注册提供者
    if (this.pluginSystem) {
      await this.pluginSystem.triggerHook('register-email-provider', providerInfo);
    }
  }

  /**
   * 注销邮件提供者
   */
  async unregisterEmailProvider() {
    if (this.pluginSystem) {
      await this.pluginSystem.triggerHook('unregister-email-provider', {
        name: 'outlook'
      });
    }
  }

  /**
   * 初始化认证
   */
  async initializeAuth() {
    // 简化的认证实现
    // 实际使用中应该实现 OAuth 流程
    this.authToken = 'dummy-token';
  }
}

// 导出插件类
export { OutlookPlugin };