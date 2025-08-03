# Gmail MCP Bridge - 多账号支持解决方案

## 🚨 当前问题分析

### 问题描述
当用户同时打开多个Gmail窗口/标签页使用不同账号时，当前实现存在以下严重问题：

1. **Tab选择混乱**：`tabs[0]` 总是选择第一个Gmail标签页，无法区分账号
2. **操作错误账号**：用户想操作账号A，但实际操作了账号B
3. **数据混乱**：不同账号的邮件数据可能混合显示
4. **无法指定目标**：MCP工具无法指定要操作的具体账号

### 当前代码问题点

<augment_code_snippet path="gmail-mcp-extension/extension/background.js" mode="EXCERPT">
```javascript
// 问题：总是选择第一个Gmail标签页
chrome.tabs.query({ url: 'https://mail.google.com/*' }, (tabs) => {
  if (tabs.length > 0) {
    chrome.tabs.sendMessage(tabs[0].id, { // ❌ 总是tabs[0]
      action: data.action,
      params: data.params,
      id: requestId
    }, (response) => {
      // 处理响应...
    });
  }
});
```
</augment_code_snippet>

## 🎯 解决方案设计

### 方案1: 账号识别与选择机制

#### 1.1 账号识别实现

**Content Script 增强**：在每个Gmail标签页中识别当前账号

```javascript
// 在 content.js 中添加账号识别
class GmailInterface {
  constructor() {
    this.accountInfo = null;
    this.tabId = null;
    this.init();
  }

  async init() {
    await this.detectAccount();
    this.setupListeners();
    this.registerWithBackground();
  }

  async detectAccount() {
    // 方法1: 从Gmail界面提取账号信息
    const accountSelectors = [
      '[data-email]',  // 账号邮箱
      '.gb_A',         // 用户头像区域
      '.gb_B',         // 用户名显示
      '[aria-label*="Account"]'
    ];

    let accountEmail = null;
    let accountName = null;

    // 尝试从页面元素获取账号信息
    for (const selector of accountSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        accountEmail = element.getAttribute('data-email') || 
                      element.getAttribute('title') ||
                      element.textContent.trim();
        if (accountEmail && accountEmail.includes('@')) {
          break;
        }
      }
    }

    // 方法2: 从URL参数获取账号信息
    if (!accountEmail) {
      const urlParams = new URLSearchParams(window.location.search);
      const authUser = urlParams.get('authuser');
      if (authUser) {
        accountEmail = `account_${authUser}`;
      }
    }

    // 方法3: 从页面标题获取
    if (!accountEmail && document.title) {
      const titleMatch = document.title.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (titleMatch) {
        accountEmail = titleMatch[1];
      }
    }

    this.accountInfo = {
      email: accountEmail || 'unknown',
      name: accountName || 'Unknown User',
      url: window.location.href,
      timestamp: new Date().toISOString()
    };

    console.log('Detected account:', this.accountInfo);
  }

  registerWithBackground() {
    // 向background script注册当前标签页的账号信息
    chrome.runtime.sendMessage({
      action: 'registerAccount',
      accountInfo: this.accountInfo,
      tabId: this.tabId
    });
  }
}
```

#### 1.2 Background Script 账号管理

```javascript
// 在 background.js 中添加账号管理
class AccountManager {
  constructor() {
    this.accounts = new Map(); // tabId -> accountInfo
    this.activeAccount = null;
  }

  registerAccount(tabId, accountInfo) {
    this.accounts.set(tabId, {
      ...accountInfo,
      tabId,
      lastActive: Date.now()
    });
    
    console.log(`Registered account: ${accountInfo.email} on tab ${tabId}`);
    
    // 如果没有活跃账号，设置为默认
    if (!this.activeAccount) {
      this.activeAccount = tabId;
    }
  }

  getAccountList() {
    return Array.from(this.accounts.values());
  }

  getAccountByEmail(email) {
    for (const [tabId, account] of this.accounts) {
      if (account.email === email) {
        return { tabId, account };
      }
    }
    return null;
  }

  setActiveAccount(tabId) {
    if (this.accounts.has(tabId)) {
      this.activeAccount = tabId;
      return true;
    }
    return false;
  }

  getActiveAccount() {
    return this.activeAccount ? this.accounts.get(this.activeAccount) : null;
  }

  removeAccount(tabId) {
    this.accounts.delete(tabId);
    if (this.activeAccount === tabId) {
      // 选择另一个活跃账号
      const remaining = Array.from(this.accounts.keys());
      this.activeAccount = remaining.length > 0 ? remaining[0] : null;
    }
  }
}

// 全局账号管理器
const accountManager = new AccountManager();

// 处理账号注册
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'registerAccount') {
    accountManager.registerAccount(sender.tab.id, request.accountInfo);
    sendResponse({ success: true });
    return true;
  }
  
  // 其他消息处理...
});

// 标签页关闭时清理账号
chrome.tabs.onRemoved.addListener((tabId) => {
  accountManager.removeAccount(tabId);
});
```

#### 1.3 MCP Server 账号选择

```javascript
// 在 mcp-server/index.js 中添加账号选择工具
{
  name: 'list_gmail_accounts',
  description: 'List all available Gmail accounts',
  inputSchema: {
    type: 'object',
    properties: {}
  }
},
{
  name: 'set_active_account',
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
  name: 'get_active_account',
  description: 'Get the currently active Gmail account',
  inputSchema: {
    type: 'object',
    properties: {}
  }
}

// 修改现有工具以支持账号选择
{
  name: 'list_emails',
  description: 'List emails in Gmail inbox',
  inputSchema: {
    type: 'object',
    properties: {
      accountEmail: { 
        type: 'string', 
        description: 'Optional: specific account email to use' 
      }
    }
  }
}
```

### 方案2: 智能账号检测与用户选择

#### 2.1 Bridge Server 增强

```javascript
// 在 bridge-server.js 中添加账号管理端点
class GmailBridgeServer {
  constructor(port = 3456) {
    this.app = express();
    this.port = port;
    this.pendingRequests = new Map();
    this.accounts = new Map(); // 账号信息缓存
    this.activeAccount = null;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupRoutes() {
    // 现有路由...

    // 账号管理路由
    this.app.get('/accounts', (req, res) => {
      const accountList = Array.from(this.accounts.values());
      res.json({
        accounts: accountList,
        activeAccount: this.activeAccount,
        totalAccounts: accountList.length
      });
    });

    this.app.post('/accounts/set-active', (req, res) => {
      const { accountEmail } = req.body;
      
      for (const [tabId, account] of this.accounts) {
        if (account.email === accountEmail) {
          this.activeAccount = tabId;
          res.json({ success: true, activeAccount: account });
          return;
        }
      }
      
      res.status(404).json({ error: 'Account not found' });
    });

    // 修改现有的MCP请求处理
    this.app.post('/mcp/request', async (req, res) => {
      const { action, params } = req.body;
      const targetAccount = params?.accountEmail;
      
      let targetTabId = this.activeAccount;
      
      // 如果指定了账号，查找对应的标签页
      if (targetAccount) {
        for (const [tabId, account] of this.accounts) {
          if (account.email === targetAccount) {
            targetTabId = tabId;
            break;
          }
        }
        
        if (!targetTabId) {
          res.status(404).json({
            error: `Account ${targetAccount} not found`,
            availableAccounts: Array.from(this.accounts.values()).map(a => a.email)
          });
          return;
        }
      }
      
      // 检查目标账号是否连接
      if (!targetTabId || !this.accounts.has(targetTabId)) {
        res.status(503).json({
          error: 'No active Gmail account available',
          availableAccounts: Array.from(this.accounts.values()).map(a => a.email)
        });
        return;
      }
      
      // 继续现有的请求处理逻辑...
    });
  }
}
```

### 方案3: 用户界面改进

#### 3.1 Popup 界面增强

```html
<!-- 在 popup.html 中添加账号选择 -->
<div class="account-section">
  <h3>Gmail Accounts</h3>
  <div id="account-list">
    <!-- 动态生成账号列表 -->
  </div>
  <div class="active-account">
    <strong>Active:</strong> <span id="active-account-email">None</span>
  </div>
</div>
```

```javascript
// 在 popup.js 中添加账号管理
function updateAccountList() {
  fetch('http://localhost:3456/accounts')
    .then(response => response.json())
    .then(data => {
      const accountList = document.getElementById('account-list');
      const activeAccountSpan = document.getElementById('active-account-email');
      
      accountList.innerHTML = '';
      
      data.accounts.forEach(account => {
        const accountDiv = document.createElement('div');
        accountDiv.className = `account-item ${account.tabId === data.activeAccount ? 'active' : ''}`;
        accountDiv.innerHTML = `
          <div class="account-email">${account.email}</div>
          <button onclick="setActiveAccount('${account.email}')">
            ${account.tabId === data.activeAccount ? 'Active' : 'Select'}
          </button>
        `;
        accountList.appendChild(accountDiv);
      });
      
      const activeAccount = data.accounts.find(a => a.tabId === data.activeAccount);
      activeAccountSpan.textContent = activeAccount ? activeAccount.email : 'None';
    })
    .catch(error => {
      console.error('Failed to load accounts:', error);
    });
}

function setActiveAccount(email) {
  fetch('http://localhost:3456/accounts/set-active', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountEmail: email })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      updateAccountList();
    }
  });
}
```

## 🔧 实施步骤

### 第一阶段：基础账号识别
1. 修改 `content.js` 添加账号检测
2. 修改 `background.js` 添加账号管理
3. 测试多账号识别功能

### 第二阶段：MCP工具增强
1. 添加账号管理相关的MCP工具
2. 修改现有工具支持账号选择
3. 更新 `bridge-server.js` 支持账号路由

### 第三阶段：用户界面
1. 更新popup界面显示账号列表
2. 添加账号切换功能
3. 改进状态显示

### 第四阶段：智能默认行为
1. 实现智能账号选择（最近活跃）
2. 添加账号切换提醒
3. 优化用户体验

## 🎯 使用场景示例

### 场景1：Claude Desktop中指定账号
```
"使用 work@company.com 账号发送邮件给团队"
"切换到 personal@gmail.com 账号查看邮件"
"列出所有可用的Gmail账号"
```

### 场景2：自动账号检测
- 系统自动识别当前打开的Gmail账号
- 默认使用最近活跃的账号
- 提供账号切换建议

### 场景3：多账号批量操作
```
"在 work@company.com 中搜索项目邮件"
"在 personal@gmail.com 中标记邮件为已读"
```

## ⚠️ 注意事项

1. **隐私保护**：账号信息仅在本地存储，不上传到服务器
2. **会话管理**：账号信息随标签页关闭自动清理
3. **错误处理**：账号不可用时提供清晰的错误信息
4. **性能优化**：避免频繁的账号检测操作

## 🚀 后续优化

1. **账号偏好记忆**：记住用户的账号使用偏好
2. **智能推荐**：根据操作类型推荐合适的账号
3. **批量账号操作**：支持同时操作多个账号
4. **账号同步状态**：显示各账号的连接状态

这个解决方案将彻底解决多账号冲突问题，让用户能够安全、准确地操作指定的Gmail账号。
