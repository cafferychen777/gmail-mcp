# Gmail MCP Bridge - Core System v2.0

基于 Linus Torvalds 的"好品味"哲学重新设计的核心系统。

## 🎯 设计原则

1. **消除特殊情况** - 所有错误用同一套处理机制
2. **数据结构优先** - 用 Map 管理错误和恢复策略，避免 if/else 地狱  
3. **好品味** - 将现有代码中散布的 try-catch 和 console.log 统一处理
4. **实用主义** - 只处理用户真正遇到的错误

## 📁 文件结构

```
src/core/
├── system-state.js      - 系统状态的唯一真实来源
├── error-handler.js     - 智能错误处理器
├── status-manager.js    - 自适应状态管理器
├── auto-recovery.js     - 自动恢复引擎
├── health-checker.js    - 组件健康检查系统
├── core-manager.js      - 核心管理器（统一入口）
├── migration-example.js - 代码迁移示例
└── README.md           - 本文档
```

## 🚀 快速开始

### 1. 基础使用

```javascript
// 获取核心管理器实例
const coreManager = getCoreManager();
await coreManager.initialize();

// 获取统一API
const coreAPI = coreManager.getAPI();

// 使用智能错误处理
const result = await coreAPI.handleError(async () => {
  // 你的业务逻辑
  return await someBusinessFunction();
}, { component: 'myComponent', operation: 'myOperation' });
```

### 2. 错误处理迁移

**旧代码：**
```javascript
try {
  const result = await someFunction();
  console.log('Success:', result);
  return result;
} catch (error) {
  console.error('Error:', error);
  return { error: error.message };
}
```

**新代码：**
```javascript
const wrappedFunction = coreAPI.wrapFunction(async () => {
  return await someFunction();
}, { component: 'myComponent' });

return await wrappedFunction(); // 自动处理所有错误
```

### 3. 状态管理

```javascript
// 更新组件状态
coreAPI.updateStatus('myComponent', 'running', { 
  progress: 75,
  message: 'Processing emails...' 
});

// 监听状态变化
coreAPI.onStatusChange((event) => {
  console.log(`${event.component} status: ${event.status}`);
});

// 获取系统状态
const status = coreAPI.getSystemStatus();
```

### 4. 健康检查

```javascript
// 检查单个组件
const health = await coreAPI.checkHealth('bridgeServer');
console.log(`Bridge Server health: ${health.grade} (${health.score}/100)`);

// 检查所有组件
const allHealth = await coreAPI.checkAllHealth();
console.log(`System health: ${allHealth.systemHealth.grade}`);
```

## 🔧 核心组件详解

### SystemState - 系统状态管理

- **作用**：系统状态的唯一真实来源
- **消除**：散布在各处的状态变量
- **特性**：
  - 统一的组件状态结构
  - 实时状态更新和通知
  - 性能指标收集
  - 错误统计和追踪

### IntelligentErrorHandler - 智能错误处理

- **作用**：统一的错误处理机制
- **消除**：散布的 try-catch 块和 console.log
- **特性**：
  - 用户友好的错误消息
  - 自动修复建议
  - 错误分类和统计
  - 结构化日志记录

### AdaptiveStatusManager - 状态管理器

- **作用**：实时监控所有组件状态
- **消除**：手动状态检查和更新
- **特性**：
  - 自动健康检查调度
  - 状态变化事件通知
  - 性能指标收集
  - 故障检测和恢复触发

### AutoRecoveryEngine - 自动恢复引擎

- **作用**：自动恢复失败的组件
- **消除**：手动重启和修复操作
- **特性**：
  - 指数退避重试策略
  - 熔断器模式
  - 恢复策略注册
  - 恢复成功率统计

### HealthChecker - 健康检查系统

- **作用**：组件健康状况评估
- **消除**：散布的健康检查代码
- **特性**：
  - 标准化健康检查接口
  - 健康评分算法
  - 重试机制
  - 依赖关系检查

## 📊 系统监控

### 健康评分算法

```
健康分数 = 状态权重(40%) + 响应时间权重(30%) + 错误率权重(20%) + 正常运行时间权重(10%)

评级标准：
- 90-100分：优秀 (excellent)
- 75-89分：良好 (good)  
- 50-74分：一般 (fair)
- 25-49分：较差 (poor)
- 0-24分：危险 (critical)
```

### 错误分类

- **CHROME_EXTENSION_NOT_FOUND** - Chrome扩展未找到（可自动修复）
- **GMAIL_TAB_NOT_FOUND** - Gmail标签页未找到（需用户操作）
- **BRIDGE_SERVER_UNAVAILABLE** - 桥接服务器不可用（可自动修复）
- **MCP_SERVER_NOT_RUNNING** - MCP服务器未运行（可自动修复）
- **CLAUDE_DESKTOP_NOT_CONFIGURED** - Claude Desktop未配置（需手动配置）

### 恢复策略

- **指数退避**：重试间隔呈指数增长，避免重试风暴
- **熔断器**：连续失败后暂停重试，一段时间后再试
- **最大重试**：防止无限重试，保护系统资源
- **恢复统计**：跟踪恢复成功率，优化策略

## 🧪 测试和调试

### 导出诊断信息

```javascript
const diagnostics = coreAPI.exportDiagnostics();
console.log('System diagnostics:', JSON.stringify(diagnostics, null, 2));
```

### 测试错误处理

```javascript
// 测试自动错误处理
const result = await coreAPI.handleError(async () => {
  throw new Error('Test error');
}, { component: 'test' });

console.log('Error result:', result.userMessage);
```

### 手动恢复测试

```javascript
// 手动触发组件恢复
const recovery = await coreAPI.recoverComponent('bridgeServer');
console.log('Recovery result:', recovery.success);
```

## 🔄 迁移指南

### 步骤 1：初始化核心系统

在你的主要入口文件（如 background.js）中：

```javascript
import { getCoreManager } from './src/core/core-manager.js';

async function initApp() {
  const coreManager = getCoreManager();
  await coreManager.initialize();
  
  const coreAPI = coreManager.getAPI();
  // 继续你的应用初始化...
}
```

### 步骤 2：替换错误处理

查找所有 `try-catch` 块并替换为：

```javascript
// 替换这种模式：
try {
  const result = await someFunction();
  return result;
} catch (error) {
  console.error('Error:', error);
  return { error: error.message };
}

// 用这种模式：
const result = await coreAPI.handleError(async () => {
  return await someFunction();
}, { component: 'yourComponent', operation: 'yourOperation' });
```

### 步骤 3：更新状态管理

替换散布的状态变量：

```javascript
// 替换这种：
let serverStatus = 'unknown';
let lastCheck = null;

// 用这种：
coreAPI.updateStatus('server', 'running', { lastCheck: Date.now() });
```

### 步骤 4：移除冗余日志

移除所有 `console.log` 和 `console.error`，系统会自动记录结构化日志。

## 📈 性能指标

系统自动收集以下指标：

- **响应时间**：滚动平均响应时间
- **错误率**：错误发生频率
- **成功率**：操作成功率  
- **内存使用**：内存占用情况
- **组件健康度**：各组件健康评分
- **恢复成功率**：自动恢复成功率

## 🛡️ 错误恢复策略

### 自动恢复的错误类型

1. **网络连接问题**：自动重连
2. **服务进程崩溃**：自动重启
3. **扩展上下文失效**：自动重新连接
4. **临时资源不可用**：延迟重试

### 需要用户干预的错误

1. **配置缺失**：需要手动配置
2. **权限不足**：需要用户授权
3. **Gmail页面未打开**：需要用户操作

## 🔍 故障排查

### 常见问题

**Q: 系统显示"未初始化"错误**
A: 确保在使用API之前调用了 `coreManager.initialize()`

**Q: 自动恢复不工作**
A: 检查组件是否注册了恢复策略，查看恢复统计信息

**Q: 错误消息不够友好**
A: 检查错误是否有对应的用户消息映射，添加自定义错误处理

**Q: 健康检查失败**
A: 查看健康检查配置，确保超时设置合理

### 调试命令

```javascript
// 获取系统状态
coreAPI.getSystemStatus()

// 获取错误统计
coreAPI.getErrorStats()

// 获取恢复统计  
coreAPI.getRecoveryStats()

// 导出完整诊断
coreAPI.exportDiagnostics()
```

## 📝 最佳实践

1. **始终使用coreAPI.wrapFunction()包装异步函数**
2. **及时更新组件状态，让系统了解当前状态**
3. **为自定义组件注册健康检查**
4. **定期检查系统诊断信息**
5. **测试错误场景，确保恢复机制工作**

---

## 🎖️ Linus 语录

> "Bad programmers worry about the code. Good programmers worry about data structures and their relationships."

这个核心系统完全体现了这一点 - 我们用好的数据结构（Map、统一状态对象）解决了复杂的错误处理问题，而不是用复杂的代码逻辑。

> "Talk is cheap. Show me the code."

代码就在这里，简洁、实用、可靠。没有过度设计，没有无用功能，只解决实际问题。