# Gmail MCP Bridge

A browser extension-based Gmail integration for Claude Desktop and other MCP-compatible AI assistants that works **without API keys or fees**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://developer.chrome.com/docs/extensions/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)
[![Status: Production Ready](https://img.shields.io/badge/Status-Production%20Ready-brightgreen.svg)](https://github.com/cafferychen777/gmail-mcp)

> **🎉 Project Status: All modules are completed and fully functional!**  
> The Gmail MCP Bridge is now production-ready with all core features implemented and tested.

## 🎯 Why Gmail MCP Bridge?

### The Problem with Existing Solutions

**Official Gmail MCP implementation limitations:**
- ❌ Can only read emails (no sending capability)
- ❌ Requires complex Google Cloud setup
- ❌ Needs OAuth2 authentication flow

**Third-party Gmail API implementations:**
- 💰 Requires paid Google Cloud Platform account
- 🔐 Many educational/institutional accounts block Gmail API access
- 📝 Complex API key management and quotas

### Our Solution

Gmail MCP Bridge uses a **browser extension approach** that:
- ✅ Works with ANY Gmail account (personal, edu, enterprise)
- ✅ No API keys, OAuth, or Google Cloud setup required
- ✅ Completely FREE - no API quotas or charges
- ✅ Full functionality: read, send, reply, and search emails
- ✅ Works directly with the Gmail interface you already use
- ✅ Privacy-focused: all data stays local between your browser and Claude

## ✨ Features

- 📧 **List emails** from Gmail inbox
- 📖 **Read email content** with full formatting
- ✍️ **Compose new emails** with auto-filled recipients, subjects, and content
- 💬 **Reply to emails** with intelligent content insertion
- 🔍 **Search emails** using Gmail's powerful search syntax
- 📎 **Handle attachments** (view, download)
- 🏷️ **Mark emails** as read/unread
- 🗑️ **Delete and archive** emails
- 👥 **Multi-account support** for managing multiple Gmail accounts
- 🔄 **Real-time synchronization** with Gmail interface

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd gmail-mcp-extension/mcp-server
npm install
```

### 2. Install Chrome Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right corner)
3. Click **"Load unpacked"** and select the `gmail-mcp-extension/extension` folder
4. Note the extension ID (e.g., `abcdefghijklmnopqrstuvwxyz`)

### 3. Start Bridge Server
```bash
cd gmail-mcp-extension/mcp-server
npm run bridge
```

### 4. Configure Claude Desktop
Add to your Claude Desktop MCP configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gmail-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/gmail-mcp-extension/mcp-server/index.js"]
    }
  }
}
```

### 5. Start Using
1. Open Gmail in Chrome
2. Restart Claude Desktop
3. Ask Claude: *"Show me my recent emails"*

## 📁 Project Structure

```
gmail-mcp/
├── README.md                          # This file - project overview
├── CONTRIBUTING.md                    # Contribution guidelines
└── gmail-mcp-extension/               # Main implementation
    ├── README.md                      # Detailed documentation
    ├── SETUP.md                       # Complete setup guide
    ├── extension/                     # Chrome extension
    │   ├── manifest.json
    │   ├── background.js
    │   ├── content.js
    │   └── popup.html
    ├── mcp-server/                    # MCP server implementation
    │   ├── index.js                   # Main MCP server
    │   ├── bridge-server.js           # HTTP bridge server
    │   └── package.json
    └── docs/                          # Additional documentation
        ├── SEARCH_GUIDE.md
        ├── TESTING_GUIDE.md
        └── MCP_USAGE.md
```

## 🔧 Architecture

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

## 📖 Documentation

- **[Complete Setup Guide](gmail-mcp-extension/SETUP.md)** - Detailed installation instructions
- **[Usage Guide](gmail-mcp-extension/MCP_USAGE.md)** - How to use with Claude Desktop
- **[Search Guide](gmail-mcp-extension/SEARCH_GUIDE.md)** - Advanced email search features
- **[Testing Guide](gmail-mcp-extension/TESTING_GUIDE.md)** - How to test the extension
- **[Project Structure](gmail-mcp-extension/PROJECT_STRUCTURE.md)** - Technical architecture details

## 🎯 Use Cases

### With Claude Desktop
```
"Show me my recent emails"
"Search for emails from GitHub about pull requests"
"Send an email to alice@example.com saying I'll be 10 minutes late"
"Reply to the latest email from Bob with 'Thanks for the update!'"
"Mark all emails from newsletters as read"
"Archive emails older than 30 days"
```

### Multi-Account Support
```
"List all my Gmail accounts"
"Switch to my work email account"
"Send an email from my personal account"
"Search for project emails in my work account"
```

## 🛡️ Privacy & Security

- **No data leaves your machine** - All communication happens locally
- **No credentials stored** - Uses your existing Gmail session
- **Open source** - Audit the code yourself
- **No tracking or analytics** - Your email data stays private

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Clone your fork
3. Follow the setup instructions above
4. Make your changes
5. Test thoroughly
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](gmail-mcp-extension/LICENSE) file for details.

## 🙏 Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/anthropics/mcp)
- Inspired by the need for accessible Gmail integration in AI assistants
- Thanks to the Claude Desktop team for MCP support

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/cafferychen777/gmail-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/cafferychen777/gmail-mcp/discussions)
- **Documentation**: [Project Wiki](https://github.com/cafferychen777/gmail-mcp/wiki)

---

**Made with ❤️ for the AI community**
