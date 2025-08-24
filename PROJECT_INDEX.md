# 📂 Gmail MCP Bridge 项目索引

> **快速定位项目中的任何文件或功能**

## 🎯 快速导航

### 🚀 **立即使用**
```bash
./bin/gmail-mcp install    # 一键安装
./bin/gmail-mcp status     # 检查状态  
./bin/gmail-mcp doctor     # 诊断问题
```

### 📚 **核心文档**
- [README.md](README.md) - 项目总览和快速开始
- [CLAUDE.md](CLAUDE.md) - Claude Desktop配置
- [CONTRIBUTING.md](CONTRIBUTING.md) - 贡献指南
- [RELEASE.md](RELEASE.md) - 版本发布说明

## 🗂️ **目录功能索引**

### `/bin/` - 命令行工具 🔧
- `gmail-mcp` - 主要管理工具，包含安装、诊断、修复等功能

### `/gmail-mcp-extension/` - 核心功能模块 ⚡
```
├── extension/      # Chrome扩展源码
├── mcp-server/    # MCP桥接服务器  
└── src/core/      # 核心逻辑（错误恢复、状态管理等）
```

### `/docs/` - 完整文档 📖
```
├── quick-start/   # 新手指南
├── user-guide/    # 使用手册
├── developer/     # 开发文档
├── planning/      # 项目规划和架构设计
├── reports/       # 测试分析报告
└── analysis/      # 技术分析文档
```

### `/scripts/` - 脚本工具 🛠️
```
├── test/          # 各种测试脚本
└── util/          # 工具和修复脚本
```

### `/src/` - 高级功能 🚀
```  
├── core/          # 配置管理、插件系统
└── plugins/       # 插件示例和接口
```

### `/tests/` - 测试套件 🧪
```
├── installer/     # 安装器测试
├── integration/   # 集成测试
└── performance/   # 性能测试
```

### `/tools/` - 开发工具 🔨
```
├── installer/     # 安装系统组件
└── doctor/        # 诊断修复工具
```

## 🔍 **按功能查找文件**

### **安装相关**
- 自动安装器: `bin/gmail-mcp`
- 安装系统: `tools/installer/`
- 安装测试: `tests/installer/`
- 安装指南: `docs/quick-start/installation.md`

### **Chrome扩展**
- 扩展源码: `gmail-mcp-extension/extension/`
- 清单文件: `gmail-mcp-extension/extension/manifest.json`
- 内容脚本: `gmail-mcp-extension/extension/content.js`
- UI界面: `gmail-mcp-extension/extension/ui/`

### **MCP服务器**
- 桥接服务器: `gmail-mcp-extension/mcp-server/bridge-server.js`
- MCP入口: `gmail-mcp-extension/mcp-server/index.js`
- 配置文件: `gmail-mcp-extension/mcp-server/package.json`

### **错误恢复系统**
- 自动恢复: `gmail-mcp-extension/src/core/auto-recovery.js`
- 错误处理: `gmail-mcp-extension/src/core/error-handler.js`
- 健康检查: `gmail-mcp-extension/src/core/health-checker.js`
- 状态管理: `gmail-mcp-extension/src/core/status-manager.js`

### **测试和诊断**
- 快速测试: `scripts/test/quick-performance-test.js`
- 系统诊断: `tools/doctor/system-doctor.js`
- 健康检查: `scripts/util/final-system-health-check.js`
- 集成测试: `scripts/test/integration-test-suite.js`

### **文档和指南**
- 用户文档: `docs/user-guide/`
- 技术架构: `docs/developer/architecture.md`
- 故障排除: `docs/user-guide/troubleshooting.md`
- 测试报告: `docs/reports/`

## 🎨 **开发者快速定位**

### **修改核心功能**
- Gmail交互逻辑: `gmail-mcp-extension/extension/content.js`
- MCP协议处理: `gmail-mcp-extension/mcp-server/index.js`
- HTTP桥接服务: `gmail-mcp-extension/mcp-server/bridge-server.js`

### **修改UI界面**  
- 扩展弹窗: `gmail-mcp-extension/extension/popup.html`
- 状态面板: `gmail-mcp-extension/extension/ui/status-dashboard.html`
- 设置向导: `gmail-mcp-extension/extension/ui/setup-wizard.html`

### **添加新功能**
- 插件系统: `src/plugins/`
- 核心管理: `src/core/`
- 扩展监控: `gmail-mcp-extension/extension/monitoring/`

### **测试和验证**
- 单元测试: `tests/installer/unit-tests.js`
- 性能测试: `tests/performance/`
- E2E测试: `tests/integration/e2e-test.js`

## 📋 **文件类型索引**

### **配置文件**
- `package.json` - Node.js依赖配置 (多个位置)
- `manifest.json` - Chrome扩展配置
- `CLAUDE.md` - Claude Desktop配置说明

### **核心代码**
- `.js` 文件 - 主要功能实现
- `.html` 文件 - 用户界面
- `.sh` 脚本 - Shell自动化脚本

### **文档文件**
- `README.md` - 说明文档 (多个模块)  
- `*.md` 文件 - Markdown文档
- `docs/` 目录 - 完整文档体系

---

**💡 提示**: 使用 `Ctrl+F` 或 `Cmd+F` 在此页面搜索特定文件或功能！