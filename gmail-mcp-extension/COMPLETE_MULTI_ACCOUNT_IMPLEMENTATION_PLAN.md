# Gmail MCP Bridge - 完整多账号支持实施方案

## 📋 项目现状分析

### 当前架构概览
```
Claude Desktop/Cherry Studio
       ↓ (MCP Protocol)
MCP Server (index.js)
       ↓ (HTTP Requests)
Bridge Server (bridge-server.js)
       ↓ (HTTP Polling)
Chrome Extension (background.js)
       ↓ (Content Script)
Gmail Web Interface
```

### 核心问题识别

**1. Tab选择问题**
- `background.js` 第123行和326行：`tabs[0].id` 总是选择第一个Gmail标签页
- 无法区分不同账号的Gmail窗口
- 可能操作错误的账号

**2. 账号识别缺失**
- Content script没有账号检测机制
- 无法获取当前Gmail账号信息
- 缺乏账号与标签页的映射关系

**3. MCP工具限制**
- 所有工具都操作默认账号
- 无法指定目标账号
- 缺乏账号管理工具

## 🎯 完整解决方案

### 阶段1: Content Script 账号检测增强

#### 1.1 修改 `extension/content.js`

**在GmailInterface类中添加账号检测：**

```javascript
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
    
    // 方法1: 从Gmail界面元素获取
    const accountSelectors = [
      // Google账号信息区域
      '[data-email]',
      '.gb_A[aria-label]',
      '.gb_B',
      '.gb_C .gb_D',
      // Gmail特定选择器
      '.gb_Aa .gb_Ab',
      '[role="button"][aria-label*="Account"]',
      // 用户头像和名称
      '.gb_A img[alt]',
      '.gb_A[title]'
    ];

    for (const selector of accountSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // 尝试获取邮箱
        accountEmail = element.getAttribute('data-email') || 
                      element.getAttribute('aria-label') ||
                      element.getAttribute('title') ||
                      element.textContent?.trim();
        
        // 验证是否为有效邮箱
        if (accountEmail && accountEmail.includes('@')) {
          console.log(`Found account email via ${selector}:`, accountEmail);
          break;
        }
      }
    }

    // 方法2: 从URL参数获取账号索引
    const urlParams = new URLSearchParams(window.location.search);
    const authUser = urlParams.get('authuser');
    let accountIndex = authUser || '0';

    // 方法3: 从页面标题提取
    if (!accountEmail && document.title) {
      const titleMatch = document.title.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (titleMatch) {
        accountEmail = titleMatch[1];
      }
    }

    // 方法4: 从localStorage或sessionStorage获取
    if (!accountEmail) {
      try {
        const storageKeys = ['gmail_user', 'google_user', 'account_email'];
        for (const key of storageKeys) {
          const stored = localStorage.getItem(key) || sessionStorage.getItem(key);
          if (stored && stored.includes('@')) {
            accountEmail = stored;
            break;
          }
        }
      } catch (e) {
        console.log('Storage access failed:', e);
      }
    }

    // 生成账号信息
    this.accountInfo = {
      email: accountEmail || `account_${accountIndex}`,
      name: accountName || 'Unknown User',
      index: accountIndex,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      detectionMethod: accountEmail ? 'dom_extraction' : 'url_parameter'
    };

    console.log('Detected account info:', this.accountInfo);
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
    return this.accountInfo;
  }
}
```

#### 1.2 添加账号相关的消息处理

```javascript
// 在setupListeners方法中添加新的action处理
case 'getAccountInfo':
  responseData = this.getAccountInfo();
  break;

case 'refreshAccount':
  await this.detectAccount();
  this.registerWithBackground();
  responseData = { success: true, accountInfo: this.accountInfo };
  break;
```

### 阶段2: Background Script 账号管理

#### 2.1 修改 `extension/background.js`

**添加账号管理器类：**

```javascript
// 在文件开头添加账号管理器
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
      lastActive: Date.now()
    };
    
    this.accounts.set(tabId, account);
    this.lastActiveTime.set(tabId, Date.now());
    
    // 如果没有活跃账号，设置为默认
    if (!this.activeAccountTabId || !this.accounts.has(this.activeAccountTabId)) {
      this.activeAccountTabId = tabId;
    }
    
    console.log(`Registered account: ${accountInfo.email} on tab ${tabId}`);
    console.log(`Total accounts: ${this.accounts.size}`);
    
    return { success: true, isActive: this.activeAccountTabId === tabId };
  }

  getAccountList() {
    return Array.from(this.accounts.values()).map(account => ({
      ...account,
      isActive: account.tabId === this.activeAccountTabId
    }));
  }

  getAccountByEmail(email) {
    for (const [tabId, account] of this.accounts) {
      if (account.email === email) {
        return { tabId, account };
      }
    }
    return null;
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
    
    // 如果删除的是活跃账号，选择另一个
    if (this.activeAccountTabId === tabId) {
      const remaining = Array.from(this.accounts.keys());
      if (remaining.length > 0) {
        // 选择最近活跃的账号
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
    }
  }

  // 智能选择目标标签页
  selectTargetTab(accountEmail = null) {
    if (accountEmail) {
      // 指定了账号，查找对应标签页
      const result = this.getAccountByEmail(accountEmail);
      return result ? result.tabId : null;
    } else {
      // 使用活跃账号
      const active = this.getActiveAccount();
      return active ? active.tabId : null;
    }
  }
}

// 创建全局账号管理器实例
const accountManager = new AccountManager();
```

#### 2.2 修改消息处理逻辑

**替换现有的tabs[0]选择逻辑：**

```javascript
// 修改第109-139行的bridge请求处理
chrome.tabs.query({ url: 'https://mail.google.com/*' }, async (tabs) => {
  if (tabs.length > 0) {
    // 智能选择目标标签页
    let targetTabId = accountManager.selectTargetTab(data.params?.accountEmail);
    
    if (!targetTabId && tabs.length > 0) {
      // 如果没有找到指定账号，使用第一个可用的
      targetTabId = tabs[0].id;
      console.warn('No specific account found, using first available tab');
    }
    
    if (!targetTabId) {
      resolve({ error: 'No suitable Gmail tab found' });
      return;
    }

    try {
      // 更新最后活跃时间
      accountManager.updateLastActive(targetTabId);
      
      // 发送到指定标签页
      chrome.tabs.sendMessage(targetTabId, {
        action: data.action,
        params: data.params,
        id: requestId
      }, (response) => {
        // 处理响应...
      });
    } catch (error) {
      resolve({ error: `Failed to send to tab ${targetTabId}: ${error.message}` });
    }
  } else {
    resolve({ error: 'No Gmail tabs open' });
  }
});
```

**添加账号管理消息处理：**

```javascript
// 在chrome.runtime.onMessage.addListener中添加
if (request.action === 'registerAccount') {
  const result = accountManager.registerAccount(sender.tab.id, request.accountInfo);
  sendResponse(result);
  return true;
}

if (request.action === 'getAccounts') {
  sendResponse({
    accounts: accountManager.getAccountList(),
    activeAccount: accountManager.getActiveAccount()
  });
  return true;
}

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
  return true;
}
```

**修改标签页关闭处理：**

```javascript
// 修改现有的chrome.tabs.onRemoved.addListener
chrome.tabs.onRemoved.addListener((tabId) => {
  accountManager.removeAccount(tabId);
});

// 添加标签页更新监听
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes('mail.google.com') && changeInfo.status === 'complete') {
    // 标签页加载完成，可能需要重新检测账号
    accountManager.updateLastActive(tabId);
  }
});
```

### 阶段3: Bridge Server 账号路由

#### 3.1 修改 `mcp-server/bridge-server.js`

**添加账号管理端点：**

```javascript
// 在setupRoutes方法中添加账号管理路由
this.app.get('/accounts', (req, res) => {
  // 通过Chrome扩展获取账号列表
  // 这里需要实现与Chrome扩展的通信
  res.json({
    accounts: [], // 将通过扩展获取
    message: 'Account list endpoint - implementation needed'
  });
});

this.app.post('/accounts/set-active', (req, res) => {
  const { accountEmail } = req.body;
  // 实现账号切换逻辑
  res.json({
    success: false,
    message: 'Account switching endpoint - implementation needed'
  });
});
```

**修改MCP请求处理以支持账号选择：**

```javascript
// 修改/mcp/request端点
this.app.post('/mcp/request', async (req, res) => {
  const { action, params } = req.body;
  const targetAccount = params?.accountEmail;
  const requestId = uuidv4();
  
  // 检查Chrome连接状态
  if (!this.chromeConnected || 
      (this.lastPing && (new Date() - this.lastPing) > 10000)) {
    res.status(503).json({ 
      error: 'Chrome extension not connected',
      message: 'Please ensure Chrome is running with Gmail MCP Bridge extension'
    });
    return;
  }
  
  // 创建请求，包含账号信息
  const promise = new Promise((resolve, reject) => {
    this.pendingRequests.set(requestId, {
      id: requestId,
      action,
      params: {
        ...params,
        accountEmail: targetAccount // 传递账号信息
      },
      sent: false,
      resolve,
      reject,
      timestamp: new Date()
    });
    
    // 30秒超时
    setTimeout(() => {
      if (this.pendingRequests.has(requestId)) {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
  
  try {
    const response = await promise;
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

### 阶段4: MCP Server 工具增强

#### 4.1 修改 `mcp-server/index.js`

**添加账号管理工具：**

```javascript
// 在setupTools方法中添加新工具
{
  name: 'list_gmail_accounts',
  description: 'List all available Gmail accounts',
  inputSchema: {
    type: 'object',
    properties: {}
  }
},
{
  name: 'set_active_gmail_account',
  description: 'Set the active Gmail account for operations',
  inputSchema: {
    type: 'object',
    properties: {
      accountEmail: { 
        type: 'string', 
        description: 'Email address of the account to activate' 
      }
    },
    required: ['accountEmail']
  }
},
{
  name: 'get_active_gmail_account',
  description: 'Get the currently active Gmail account',
  inputSchema: {
    type: 'object',
    properties: {}
  }
}
```

**修改现有工具支持账号选择：**

```javascript
// 修改现有工具的inputSchema，添加可选的accountEmail参数
{
  name: 'list_emails',
  description: 'List emails in Gmail inbox',
  inputSchema: {
    type: 'object',
    properties: {
      accountEmail: { 
        type: 'string', 
        description: 'Optional: specific Gmail account to use (email address)' 
      }
    }
  }
},
{
  name: 'send_email',
  description: 'Send a new email',
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body' },
      accountEmail: { 
        type: 'string', 
        description: 'Optional: specific Gmail account to use (email address)' 
      }
    },
    required: ['to', 'subject', 'body']
  }
}
```

**实现账号管理工具的处理逻辑：**

```javascript
// 在CallToolRequestSchema处理中添加
case 'list_gmail_accounts':
  try {
    const response = await fetch(`${bridgeUrl}/mcp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'getAccounts',
        params: {} 
      })
    });
    
    const result = await response.json();
    
    if (result.success && result.data) {
      const accounts = result.data.accounts || [];
      const activeAccount = result.data.activeAccount;
      
      return { 
        content: [{ 
          type: 'text', 
          text: `Available Gmail Accounts:

${accounts.map((account, index) => 
  `${index + 1}. ${account.email} ${account.isActive ? '(Active)' : ''}
     Tab ID: ${account.tabId}
     Registered: ${new Date(account.registeredAt).toLocaleString()}
     Last Active: ${new Date(account.lastActive).toLocaleString()}`
).join('\n\n')}

${activeAccount ? `\nCurrently Active: ${activeAccount.account.email}` : '\nNo active account set'}`
        }] 
      };
    } else {
      return { 
        content: [{ 
          type: 'text', 
          text: 'No Gmail accounts found. Please ensure Gmail tabs are open and the extension is connected.' 
        }] 
      };
    }
  } catch (error) {
    return { 
      content: [{ 
        type: 'text', 
        text: `Error retrieving accounts: ${error.message}` 
      }] 
    };
  }

case 'set_active_gmail_account':
  try {
    const response = await fetch(`${bridgeUrl}/mcp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'setActiveAccount',
        params: { accountEmail: args.accountEmail } 
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Successfully switched to account: ${args.accountEmail}` 
        }] 
      };
    } else {
      return { 
        content: [{ 
          type: 'text', 
          text: `Failed to switch account: ${result.error || 'Unknown error'}` 
        }] 
      };
    }
  } catch (error) {
    return { 
      content: [{ 
        type: 'text', 
        text: `Error switching account: ${error.message}` 
      }] 
    };
  }
```

## 🔧 实施步骤总结

### 第一步：Content Script 修改
1. 在 `GmailInterface` 类中添加账号检测逻辑
2. 实现多种账号检测方法
3. 添加账号注册功能

### 第二步：Background Script 修改  
1. 创建 `AccountManager` 类
2. 修改标签页选择逻辑
3. 添加账号管理消息处理

### 第三步：Bridge Server 修改
1. 添加账号管理端点
2. 修改请求路由支持账号选择

### 第四步：MCP Server 修改
1. 添加账号管理工具
2. 修改现有工具支持账号参数
3. 实现账号切换逻辑

### 第五步：测试验证
1. 多账号检测测试
2. 账号切换功能测试
3. 端到端功能验证

## ⚠️ 重要注意事项

1. **向后兼容**：确保现有功能在单账号环境下正常工作
2. **错误处理**：提供清晰的多账号错误信息
3. **性能优化**：避免频繁的账号检测操作
4. **隐私保护**：账号信息仅在本地处理，不上传到服务器

这个方案将彻底解决多账号冲突问题，让用户能够安全、准确地管理多个Gmail账号。
