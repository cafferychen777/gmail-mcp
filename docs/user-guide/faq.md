# 常见问题解答 (FAQ)

> **最常问的问题和简明答案**

## 🚀 安装和设置

### Q1: Gmail MCP Bridge是什么？

**A:** Gmail MCP Bridge是一个连接Claude Desktop和Gmail的桥接工具。它让你可以通过Claude直接管理Gmail邮件，无需API密钥，完全免费。

### Q2: 为什么选择这个项目而不是官方Gmail MCP？

**A:** 对比如下：

| 特性 | Gmail MCP Bridge | 官方Gmail MCP |
|------|------------------|---------------|
| 发送邮件 | ✅ 支持 | ❌ 不支持 |
| API密钥 | ❌ 不需要 | ✅ 需要 |
| Google Cloud | ❌ 不需要 | ✅ 需要 |
| 教育账户 | ✅ 完全支持 | ❓ 可能被限制 |
| 费用 | 🆓 完全免费 | 💰 可能产生费用 |

### Q3: 安装需要多长时间？

**A:** 按照我们的[2分钟安装指南](../quick-start/installation.md)，大多数用户可以在5分钟内完成安装。

### Q4: 支持哪些操作系统？

**A:** 支持所有能运行Chrome和Node.js的系统：
- ✅ macOS 10.14+
- ✅ Windows 10/11
- ✅ Linux (Ubuntu, CentOS, etc.)

---

## 🔧 技术问题

### Q5: 为什么需要Chrome扩展？

**A:** Chrome扩展是唯一能安全访问Gmail界面的方法，无需API密钥或OAuth配置。这样做的好处：
- 使用你已登录的Gmail账户
- 不需要额外权限设置
- 与Gmail界面完全同步
- 支持所有Gmail功能

### Q6: Bridge服务器是做什么的？

**A:** Bridge服务器充当Claude Desktop和Chrome扩展之间的通信桥梁：
```
Claude Desktop ↔ Bridge服务器 ↔ Chrome扩展 ↔ Gmail
```

### Q7: 为什么不直接连接Gmail API？

**A:** Gmail API的限制：
- 需要Google Cloud项目设置
- 需要OAuth2认证流程
- 许多教育/企业账户被限制
- 有使用配额和潜在费用
- 无法发送邮件（只能读取）

### Q8: 端口3456是否可以修改？

**A:** 可以。编辑 `mcp-server/bridge-server.js` 文件：
```javascript
const PORT = 3457; // 修改为其他端口
```

---

## 🛡️ 安全和隐私

### Q9: 我的邮件数据是否安全？

**A:** 绝对安全：
- ✅ 所有数据都在你的本机处理
- ✅ 不会上传任何邮件内容到外部服务器
- ✅ 使用你现有的Gmail登录状态
- ✅ 开源代码，可以审查
- ✅ 不存储任何邮件或密码

### Q10: 会存储我的Gmail密码吗？

**A:** 不会。Gmail MCP Bridge：
- 不需要你的Gmail密码
- 不存储任何登录凭证
- 使用Chrome已登录的会话
- 所有认证由Google处理

### Q11: 可以用于企业邮箱吗？

**A:** 可以，但需要满足：
- 能够安装Chrome扩展
- 能够运行Node.js应用
- 网络策略允许本地端口通信

---

## 📧 使用问题

### Q12: 支持多个Gmail账户吗？

**A:** 支持。如果Chrome中登录了多个Gmail账户，可以：
- 手动切换账户标签页
- Claude会操作当前激活的Gmail账户
- 通过告诉Claude切换到特定账户

### Q13: 可以处理带附件的邮件吗？

**A:** 当前版本：
- ✅ 可以查看附件列表
- ✅ 可以下载附件
- 🚧 发送附件功能正在开发中

### Q14: 支持Gmail的所有功能吗？

**A:** 主要功能都支持：
- ✅ 读取邮件
- ✅ 发送邮件
- ✅ 回复邮件
- ✅ 转发邮件
- ✅ 搜索邮件
- ✅ 标记邮件
- ✅ 归档邮件
- 🚧 标签管理（部分支持）
- 🚧 草稿管理（开发中）

### Q15: Claude无法看到最新邮件怎么办？

**A:** 常见解决方案：
1. 刷新Gmail页面（F5）
2. 检查Bridge服务器是否运行
3. 确保扩展状态为"已连接"
4. 重新加载Chrome扩展

---

## ⚡ 性能和稳定性

### Q16: 会影响Chrome性能吗？

**A:** 影响极小：
- 扩展只在Gmail页面激活
- 内存占用 < 10MB
- CPU使用率接近0（空闲时）
- 不会影响其他网页浏览

### Q17: Bridge服务器需要一直运行吗？

**A:** 是的。使用Gmail功能时Bridge服务器必须运行。可以：
- 手动启动：`npm run bridge`
- 设置开机自启（可选）
- 使用时启动，不用时关闭

### Q18: 如果忘记启动Bridge服务器会怎样？

**A:** Claude会提示"Gmail工具不可用"。只需：
```bash
cd ~/gmail-mcp/gmail-mcp-extension/mcp-server
npm run bridge
```

---

## 🔄 更新和维护

### Q19: 如何更新到最新版本？

**A:** 使用git更新：
```bash
cd ~/gmail-mcp
git pull origin main
cd gmail-mcp-extension/mcp-server
npm install  # 更新依赖
```
然后重新加载Chrome扩展。

### Q20: 如何备份配置？

**A:** 主要配置文件：
```bash
# Claude Desktop配置
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json ~/backup/

# 项目文件（如有自定义）
cp -r ~/gmail-mcp ~/backup/gmail-mcp-backup
```

### Q21: 如何完全卸载？

**A:** 清理步骤：
1. 在Chrome中删除扩展
2. 删除项目文件夹
3. 从Claude Desktop配置中移除gmail-mcp项
4. 重启Claude Desktop

---

## 🆘 故障排除

### Q22: "Bridge server not connected"怎么解决？

**A:** 按顺序检查：
1. Bridge服务器是否运行：`curl http://localhost:3456/health`
2. 端口是否被占用：`lsof -i :3456`
3. Chrome扩展是否已加载
4. 重启Bridge服务器

### Q23: Claude说找不到Gmail工具？

**A:** MCP配置问题：
1. 检查`claude_desktop_config.json`路径
2. 验证JSON格式正确
3. 确认文件路径是绝对路径
4. 完全重启Claude Desktop

### Q24: 邮件操作没有反应？

**A:** 通常是Gmail页面问题：
1. 确保Gmail完全加载
2. 检查是否登录正确账户
3. 刷新Gmail页面
4. 查看Chrome Console错误

---

## 📚 学习资源

### Q25: 在哪里能找到使用教程？

**A:** 完整文档：
- [2分钟安装指南](../quick-start/installation.md)
- [首次使用教程](../quick-start/first-use.md)
- [完整功能指南](features.md)
- [故障排除](troubleshooting.md)

### Q26: 如何贡献代码或报告问题？

**A:** 欢迎参与：
- **报告问题：**[GitHub Issues](https://github.com/cafferychen777/gmail-mcp/issues)
- **功能建议：**[GitHub Discussions](https://github.com/cafferychen777/gmail-mcp/discussions)
- **代码贡献：**查看 [CONTRIBUTING.md](../../CONTRIBUTING.md)

### Q27: 有社区支持吗？

**A:** 多个渠道：
- GitHub Discussions（推荐）
- GitHub Issues（Bug报告）
- 项目Wiki（知识库）

---

## 🔮 未来计划

### Q28: 会支持其他邮件服务吗？

**A:** 计划中：
- 🔜 Outlook/Hotmail支持
- 🔜 Yahoo Mail支持
- 🔜 企业邮箱支持

### Q29: 会有移动端支持吗？

**A:** 移动端受限于：
- Chrome扩展在移动端不可用
- 需要不同的技术架构
- 暂无明确时间表

### Q30: 如何获取最新消息？

**A:** 关注渠道：
- ⭐ Star项目仓库获取更新通知
- 👀 Watch项目获取所有动态  
- 📢 关注Releases页面

---

**💡 没找到你的问题？**

1. 查看[故障排除指南](troubleshooting.md)获得详细帮助
2. 在[GitHub Discussions](https://github.com/cafferychen777/gmail-mcp/discussions)提问
3. 创建[GitHub Issue](https://github.com/cafferychen777/gmail-mcp/issues)报告新问题

**这个FAQ有帮助吗？欢迎建议新增问题！**