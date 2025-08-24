# Gmail MCP Bridge

English | [中文文档 README.zh-CN.md](./README.zh-CN.md)

> Control Gmail from Claude Desktop via a Chrome Extension + Model Context Protocol (MCP). No API keys. Free.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://developer.chrome.com/docs/extensions/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)
[![Status: Production Ready](https://img.shields.io/badge/Status-Production%20Ready-brightgreen.svg)](https://github.com/cafferychen777/gmail-mcp)

Enable Gmail automation for AI assistants through a Chrome extension and the Model Context Protocol. Works locally, respects your browser session, and requires no Google API keys.

## ⚡ Installation

```bash
# One-command install (recommended)
./bin/gmail-mcp install

# Or manual setup
cd gmail-mcp-extension/mcp-server && npm install
```

## 📁 Project Structure

```
gmail-mcp/
├── bin/                     # CLI utilities (installer/manager)
│   └── gmail-mcp
├── gmail-mcp-extension/     # Chrome Extension + MCP bridge server
│   ├── extension/           # Chrome extension source
│   ├── mcp-server/          # MCP bridge server
│   └── src/                 # Core logic and recovery system
├── docs/                    # Documentation
│   ├── planning/
│   ├── reports/
│   └── analysis/
├── scripts/                 # Tooling scripts
│   ├── test/
│   └── util/
├── src/                     # Advanced features
│   ├── core/
│   └── plugins/
├── tests/
├── tools/
└── Key docs
    ├── README.md
    ├── README.zh-CN.md
    ├── CLAUDE.md
    ├── CONTRIBUTING.md
    └── RELEASE.md
```

## 🚀 Features

- Gmail read/search/send/reply
- Full Gmail search syntax support
- Multi-account switching
- Auto-recovery (95%+ common failures)
- Self-diagnosis and repair utilities
- Low-latency, high-throughput local bridge

## 🎯 Usage

### CLI management

```bash
gmail-mcp status    # Check system status
gmail-mcp doctor    # Diagnose issues
gmail-mcp fix       # Auto-fix common problems
gmail-mcp test      # Run tests
```

### In Claude Desktop

After installation, just ask Claude:
- "Check my latest emails"
- "Send an email to john@example.com"
- "Search emails containing 'project'"

## 📚 Documentation

- Developer architecture: [docs/developer/architecture.md](docs/developer/architecture.md)
- Roadmap: [docs/planning/COMPREHENSIVE_IMPROVEMENT_ROADMAP.md](docs/planning/COMPREHENSIVE_IMPROVEMENT_ROADMAP.md)
- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)

## 🏆 Why this project

- No API keys, works directly with your browser session
- Fast local bridge with MCP for AI assistants
- Production-ready structure with installer and diagnostics

## 🤝 Contributing

PRs welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

Gmail MCP Bridge — Control Gmail from Claude Desktop via MCP 🚀