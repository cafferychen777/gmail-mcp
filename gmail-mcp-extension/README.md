# Gmail MCP Bridge

A browser extension-based Gmail integration for Claude Desktop and other MCP-compatible AI assistants that works without API keys or fees.

## 🎯 Why Gmail MCP Bridge?

### The Problem with Existing Solutions

1. **Official Gmail MCP implementation limitations:**
   - ❌ Can only read emails (no sending capability)
   - ❌ Requires complex Google Cloud setup
   - ❌ Needs OAuth2 authentication flow

2. **Third-party Gmail API implementations:**
   - 💰 Requires paid Google Cloud Platform account
   - 🔐 Many educational/institutional accounts block Gmail API access
   - 📝 Complex API key management and quotas
   - 🚫 Google's AI (Gemini) doesn't integrate with Gmail directly

### Our Solution

Gmail MCP Bridge uses a **browser extension approach** that:
- ✅ Works with ANY Gmail account (personal, edu, enterprise)
- ✅ No API keys, OAuth, or Google Cloud setup required
- ✅ Completely FREE - no API quotas or charges
- ✅ Full functionality: read, send, reply, and search emails
- ✅ Works directly with the Gmail interface you already use
- ✅ Privacy-focused: all data stays local between your browser and Claude

### Comparison Table

| Feature | Gmail MCP Bridge | Official MCP | Gmail API |
|---------|-----------------|--------------|-----------|
| **Read Emails** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Send Emails** | ✅ Yes | ❌ No | ✅ Yes |
| **Reply to Emails** | ✅ Yes | ❌ No | ✅ Yes |
| **Search Emails** | ✅ Yes | ✅ Limited | ✅ Yes |
| **Cost** | 🆓 Free | 🆓 Free* | 💰 Paid |
| **API Key Required** | ❌ No | ✅ Yes | ✅ Yes |
| **Works with Edu/Enterprise** | ✅ Yes | ❓ Depends | ❌ Often blocked |
| **Setup Complexity** | 😊 Easy | 😰 Complex | 😰 Complex |
| **Privacy** | 🔒 Local only | ☁️ Cloud | ☁️ Cloud |

*Free but requires Google Cloud setup which may incur charges

## ✨ Features

- 📧 **List emails** from Gmail inbox
- 📖 **Read email content** (when emails are open)
- ✍️ **Compose new emails** with auto-filled recipients, subjects, and content
- 💬 **Reply to emails** with intelligent content insertion
- 🔄 **Real-time synchronization** with Gmail interface
- 🛡️ **No API keys required** - works directly with Gmail web interface
- 🔌 **Easy integration** with Claude Desktop and Cherry Studio

## 🏗️ Architecture

The system uses a clean, modular architecture:

1. **MCP Server** (`mcp-server/index.js`) - Implements MCP protocol for AI assistants
2. **Bridge Server** (`mcp-server/bridge-server.js`) - HTTP server that connects MCP to Chrome
3. **Chrome Extension** (`extension/`) - Accesses Gmail DOM and extracts real data
4. **Gmail Interface** - Direct DOM manipulation for reliable email operations

## 🔄 Data Flow

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

## 🚀 Quick Start

1. **Install Chrome extension** from the `extension` folder
2. **Start bridge server**: `npm run bridge`
3. **Configure Claude Desktop** with the MCP server
4. **Open Gmail** and start using!

### Example Usage in Claude Desktop

Once set up, you can ask Claude:

> "Show me my recent emails"

> "Search for emails from GitHub about pull requests"

> "Send an email to alice@example.com saying I'll be 10 minutes late to our meeting"

> "Reply to the latest email from Bob with 'Thanks for the update!'"

## 📦 Installation

### Prerequisites

- Node.js 16+ installed
- Chrome browser
- Gmail account

### Step 1: Install Dependencies

```bash
cd mcp-server
npm install
```

### Step 2: Install Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right corner)
3. Click **"Load unpacked"** and select the `extension` folder
4. **Note the extension ID** (e.g., `abcdefghijklmnopqrstuvwxyz`)
5. The extension icon should appear in your Chrome toolbar

### Step 3: Start Bridge Server

```bash
cd mcp-server
npm run bridge
```

You should see:
```
Gmail Bridge Server running on http://localhost:3456
```

### Step 4: Configure Claude Desktop

Add to your Claude Desktop MCP configuration file:

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

**Important**: Replace `/absolute/path/to/` with your actual project path.

### Step 5: Restart Claude Desktop

Close and reopen Claude Desktop to load the new MCP server.

## 🎯 Usage

### Basic Commands

1. **Ensure bridge server is running** (`npm run bridge`)
2. **Open Gmail** in Chrome (https://mail.google.com)
3. **In Claude Desktop**, you can use commands like:
   - "List my emails"
   - "Show me my recent emails"
   - "Search for emails from Augment Code"
   - "Find emails with subject containing 'Launch Week'"
   - "Search for unread emails from the last week"
   - "Send an email to john@example.com with subject 'Hello' and message 'How are you?'"
   - "Help me compose an email to my team about the project update"

### Available MCP Tools

- `list_emails` - Get list of emails from Gmail inbox
- `read_email` - Read content of a specific email (when open)
- `send_email` - Compose a new email with recipient, subject, and body
- `reply_email` - Reply to an existing email
- `search_emails` - Search emails using Gmail search syntax and filters

## 🧪 Testing

### Automated Integration Test

Run the comprehensive test suite:

```bash
node test-integration.js
```

### Manual Testing

#### Test Bridge Server Health

```bash
curl http://localhost:3456/health
```

Expected response:

```json
{
  "status": "ok",
  "chromeConnected": true,
  "lastPing": "2024-01-01T12:00:00.000Z",
  "pendingRequests": 0
}
```

#### Test Chrome Extension

1. Open Chrome extension popup (click the extension icon)
2. Check connection status (should show "Bridge server connected")
3. Click "Test Get Emails" to verify Gmail integration
4. Click "Test Send Email" to verify compose functionality

#### Test in Chrome Console

Open Chrome DevTools on the extension background page:

```javascript
// Test email retrieval
testGmail.getEmails()

// Test email sending
testGmail.sendEmail('test@example.com', 'Test Subject', 'Test Body')
```

## 🔧 Troubleshooting

### Common Issues

#### "Bridge server not connected"
- Ensure bridge server is running: `npm run bridge`
- Check if port 3456 is available
- Restart the bridge server

#### "No Gmail tabs open"
- Open Gmail in Chrome: https://mail.google.com
- Make sure you're logged into your Gmail account
- Refresh the Gmail tab if needed

#### "Extension not responding"
- Check if extension is loaded in `chrome://extensions/`
- Ensure extension is enabled
- Try reloading the extension
- Check Chrome console for errors

#### "MCP server not found in Claude"
- Verify the path in `claude_desktop_config.json` is correct
- Restart Claude Desktop after configuration changes
- Check Claude Desktop logs for MCP server errors

### Debug Mode

Enable debug logging by setting environment variable:

```bash
DEBUG=1 npm run bridge
```

## 🛡️ Security & Privacy

- **No data leaves your machine** - All communication happens locally
- **No credentials stored** - Uses your existing Gmail session
- **Open source** - Audit the code yourself
- **No tracking or analytics** - Your email data stays private

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/anthropics/mcp)
- Inspired by the need for accessible Gmail integration in AI assistants
- Thanks to the Claude Desktop team for MCP support