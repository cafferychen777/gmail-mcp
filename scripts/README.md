# Scripts 脚本集合

项目相关的所有脚本工具，按功能分类组织。

## 📂 目录结构

```
scripts/
├── test/           # 测试脚本
├── util/           # 工具脚本  
└── setup/          # 安装设置脚本（预留）
```

## 🧪 test/ - 测试脚本

- `chrome-extension-test.js` - Chrome扩展功能测试
- `quick-performance-test.js` - 快速性能基准测试
- `test-auto-recovery.js` - 自动恢复机制测试
- `test-circuit-breaker.js` - 断路器模式测试
- `integration-test-suite.js` - 集成测试套件
- `user-journey-simulation.js` - 用户使用流程模拟

## 🔧 util/ - 工具脚本

- `security-fix-recommendations.js` - 安全修复建议工具
- `security-stability-test-suite.js` - 安全稳定性测试
- `apply-security-fixes.js` - 自动安全修复工具
- `final-system-health-check.js` - 系统健康检查

## 🚀 快速使用

```bash
# 运行性能测试
node scripts/test/quick-performance-test.js

# 系统健康检查
node scripts/util/final-system-health-check.js

# 完整集成测试
node scripts/test/integration-test-suite.js
```

## 📋 脚本说明

每个脚本都有详细的输出和错误处理，可以独立运行。建议配合项目主要工具 `bin/gmail-mcp` 一起使用。