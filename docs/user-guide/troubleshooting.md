# 故障排除指南

> **快速诊断和解决Gmail MCP Bridge的常见问题**

## 🚨 紧急问题快速修复

### 问题："完全无法工作"

**症状：**Claude中看不到任何Gmail工具，扩展显示未连接

**5秒钟诊断：**
```bash
# 检查Bridge服务器是否运行
curl http://localhost:3456/health
```

**快速修复：**
```bash
cd ~/gmail-mcp/gmail-mcp-extension/mcp-server
npm run bridge
```

---

## 📊 问题诊断流程图

```
开始
  ↓
Claude中能看到Gmail工具吗？
  ↓ 否 → 检查MCP配置 → 修复Claude配置
  ↓ 是
扩展图标显示"已连接"吗？  
  ↓ 否 → 检查Bridge服务器 → 重启Bridge服务器
  ↓ 是
Gmail是否已打开并登录？
  ↓ 否 → 打开Gmail → 刷新页面
  ↓ 是  
功能是否正常工作？
  ↓ 否 → 查看详细错误排除 ↓
  ↓ 是 → 问题已解决！
```

---

## 🔧 按组件分类的问题排除

### 1. Claude Desktop集成问题

#### 问题1.1：Claude中看不到Gmail工具

**可能原因：**
- MCP配置文件位置错误
- MCP配置文件格式错误  
- Claude Desktop未重启

**解决步骤：**

1. **确认配置文件位置：**
   ```bash
   # Mac用户
   ls -la ~/Library/Application\ Support/Claude/claude_desktop_config.json
   
   # Windows用户  
   dir %APPDATA%\Claude\claude_desktop_config.json
   ```

2. **验证配置文件格式：**
   ```json
   {
     "mcpServers": {
       "gmail-mcp": {
         "command": "node",
         "args": ["/完整绝对路径/gmail-mcp-extension/mcp-server/index.js"]
       }
     }
   }
   ```

3. **完全重启Claude Desktop：**
   - 完全退出Claude Desktop（检查系统托盘）
   - 等待5秒
   - 重新打开Claude Desktop

**验证修复：**
在Claude中输入"你有什么工具可以帮我管理邮件？"，应该看到Gmail相关工具。

#### 问题1.2：Claude显示MCP服务器错误

**错误信息示例：**
```
MCP server 'gmail-mcp' failed to start
```

**解决步骤：**

1. **检查Node.js版本：**
   ```bash
   node --version  # 应该显示v16+
   ```

2. **手动测试MCP服务器：**
   ```bash
   cd ~/gmail-mcp/gmail-mcp-extension/mcp-server
   node index.js
   ```

3. **查看Claude Desktop日志：**
   - Mac: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\logs\`

---

### 2. Chrome扩展问题

#### 问题2.1：扩展显示"Bridge server not connected"

**可能原因：**
- Bridge服务器未启动
- 端口3456被占用
- 扩展配置错误

**解决步骤：**

1. **检查Bridge服务器状态：**
   ```bash
   curl http://localhost:3456/health
   ```
   
   **期望响应：**
   ```json
   {"status":"ok","chromeConnected":true}
   ```

2. **如果服务器未运行：**
   ```bash
   cd ~/gmail-mcp/gmail-mcp-extension/mcp-server
   npm run bridge
   ```

3. **如果端口被占用：**
   ```bash
   # 查找占用进程
   lsof -i :3456
   # 结束占用进程
   kill -9 [PID]
   # 重启Bridge服务器
   npm run bridge
   ```

#### 问题2.2：扩展无法在Chrome中安装

**症状：**点击"加载已解压的扩展程序"后没有反应

**解决步骤：**

1. **检查文件夹结构：**
   ```bash
   ls ~/gmail-mcp/gmail-mcp-extension/extension/
   ```
   应该看到：`manifest.json`、`background.js`、`content.js`等

2. **验证manifest.json格式：**
   ```bash
   cat ~/gmail-mcp/gmail-mcp-extension/extension/manifest.json | python -m json.tool
   ```

3. **检查Chrome版本：**
   - 需要Chrome 88+
   - 在`chrome://settings/help`检查版本

4. **重新安装扩展：**
   - 在`chrome://extensions/`删除现有扩展
   - 重新加载

#### 问题2.3：扩展图标点击无反应

**解决步骤：**

1. **检查扩展权限：**
   - 在`chrome://extensions/`确认扩展已启用
   - 检查"在无痕模式下启用"设置

2. **查看扩展错误：**
   - 点击"查看详情" → "错误"
   - 查看Console错误信息

3. **重置扩展：**
   ```bash
   # 重新加载扩展
   chrome://extensions/ → 点击刷新按钮
   ```

---

### 3. Gmail集成问题

#### 问题3.1：Claude说"没有找到Gmail标签页"

**可能原因：**
- Gmail未在Chrome中打开
- Gmail未完全加载
- 多账户登录导致的混乱

**解决步骤：**

1. **确认Gmail状态：**
   - 打开https://mail.google.com
   - 确保完全登录并加载完成
   - 检查URL是否为mail.google.com

2. **处理多账户：**
   - 如果有多个Gmail账户，确保使用正确的账户
   - 必要时退出其他账户

3. **刷新Gmail：**
   - 按F5刷新Gmail页面
   - 等待完全加载（看到邮件列表）

#### 问题3.2：邮件操作无响应

**症状：**Claude说已发送邮件，但Gmail中没有看到

**解决步骤：**

1. **检查Chrome Developer Tools：**
   - 在Gmail页面按F12
   - 查看Console标签是否有错误

2. **验证内容脚本：**
   - 在Console中输入：`window.gmailMCP`
   - 应该返回对象而不是undefined

3. **手动测试邮件操作：**
   - 在Gmail中手动点击"撰写"
   - 确认撰写界面能正常打开

---

### 4. 网络和权限问题

#### 问题4.1：端口访问被阻止

**症状：**Bridge服务器启动失败，显示"EADDRINUSE"

**解决方案：**

1. **更改端口：**
   ```bash
   # 编辑bridge-server.js，将3456改为其他端口
   sed -i 's/3456/3457/g' ~/gmail-mcp/gmail-mcp-extension/mcp-server/bridge-server.js
   ```

2. **检查防火墙设置：**
   - Mac: 系统偏好设置 → 安全性与隐私 → 防火墙
   - Windows: 控制面板 → Windows防火墙

#### 问题4.2：Chrome安全策略阻止

**症状：**扩展加载时显示安全警告

**解决方案：**

1. **临时禁用安全检查：**
   ```bash
   # 启动Chrome时添加参数（仅用于开发）
   google-chrome --disable-web-security --user-data-dir=/tmp/chrome_test
   ```

2. **检查企业策略：**
   - 在`chrome://policy/`查看是否有限制策略

---

## 🔍 高级诊断工具

### 1. 系统健康检查脚本

创建诊断脚本：
```bash
#!/bin/bash
echo "=== Gmail MCP Bridge 诊断报告 ==="
echo "时间：$(date)"
echo ""

echo "1. Node.js版本："
node --version || echo "❌ Node.js未安装"
echo ""

echo "2. Bridge服务器状态："
curl -s http://localhost:3456/health || echo "❌ Bridge服务器未运行"
echo ""

echo "3. Chrome扩展文件："
ls ~/gmail-mcp/gmail-mcp-extension/extension/manifest.json || echo "❌ 扩展文件缺失"
echo ""

echo "4. MCP配置文件："
ls ~/Library/Application\ Support/Claude/claude_desktop_config.json || echo "❌ MCP配置文件不存在"
echo ""

echo "5. 进程检查："
ps aux | grep node | grep gmail || echo "❌ 没有Gmail MCP相关进程"
echo ""

echo "=== 诊断完成 ==="
```

### 2. 日志文件位置

**Bridge服务器日志：**
- Console输出（启动Bridge时的终端）

**Chrome扩展日志：**
- `chrome://extensions/` → 扩展详情 → 错误
- Chrome DevTools → Console（在Gmail页面）

**Claude Desktop日志：**
- Mac: `~/Library/Logs/Claude/claude-desktop.log`
- Windows: `%APPDATA%\Claude\logs\claude-desktop.log`

### 3. 手动测试命令

在Chrome扩展Console中测试：
```javascript
// 测试基础连接
window.nativePort ? "✅ 已连接" : "❌ 未连接"

// 测试Gmail检测
document.querySelector('[gh="tl"]') ? "✅ Gmail已加载" : "❌ Gmail未加载"

// 测试邮件API
testGmail.getEmails()
```

---

## 📋 问题报告模板

如果以上方法都无法解决问题，请使用以下模板报告问题：

```
### 环境信息
- 操作系统：[Mac/Windows/Linux + 版本]
- Chrome版本：[chrome://settings/help]
- Node.js版本：[node --version]
- Gmail MCP Bridge版本：[git commit hash]

### 问题描述
[详细描述问题现象]

### 复现步骤
1. [第一步]
2. [第二步]  
3. [问题出现]

### 期望结果
[应该发生什么]

### 实际结果
[实际发生了什么]

### 错误信息
[复制完整的错误信息]

### 诊断信息
[运行诊断脚本的输出]

### 已尝试的解决方案
[列出已经尝试过的修复方法]
```

---

## 🆘 获取帮助

### 自助资源
- **常见问题：**[faq.md](faq.md)
- **功能文档：**[features.md](features.md)
- **安装指南：**[../quick-start/installation.md](../quick-start/installation.md)

### 社区支持
- **GitHub Issues：**[报告Bug](https://github.com/cafferychen777/gmail-mcp/issues)
- **GitHub Discussions：**[社区讨论](https://github.com/cafferychen777/gmail-mcp/discussions)
- **官方文档：**[项目Wiki](https://github.com/cafferychen777/gmail-mcp/wiki)

### 紧急支持
如果遇到严重问题导致数据丢失风险：
1. 立即停止所有操作
2. 备份重要数据
3. 在GitHub创建高优先级Issue
4. 描述详细的问题情况

---

**💡 记住：90%的问题都可以通过重启Bridge服务器和重新加载Chrome扩展解决！**