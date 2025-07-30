# Gmail MCP Bridge - Project Structure

## Current File Structure

```
gmail-mcp-extension/
├── extension/              # Chrome Extension
│   ├── manifest.json      # Chrome extension manifest
│   ├── background.js      # Service worker - handles native messaging
│   ├── content.js         # Content script - interacts with Gmail DOM
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Popup JavaScript
│   └── icon.png          # Extension icon
│
├── mcp-server/            # MCP Server Components
│   ├── index.js          # Main MCP server implementation
│   ├── native-host.py    # Python native messaging host (ACTIVE)
│   ├── package.json      # Node.js dependencies
│   └── test-report.md    # MCP server test results
│
├── auto-setup.sh         # Automated setup script
├── fix-extension-id.sh   # Update extension ID in native host config
└── SETUP.md             # User setup guide
```

## Active Components

### 1. Chrome Extension (`extension/`)
- **Status**: ✅ Working
- **Purpose**: Bridges Gmail web page with native messaging host
- **Key files**: 
  - `background.js` - Manages native messaging connection
  - `content.js` - Extracts data from Gmail interface

### 2. Native Messaging Host (`mcp-server/native-host.py`)
- **Status**: ✅ Working
- **Purpose**: Bridges Chrome extension with MCP server
- **Location**: Configured in Chrome native messaging manifest
- **Log file**: `/tmp/native-host-py.log`

### 3. MCP Server (`mcp-server/index.js`)
- **Status**: ✅ Ready (not actively used yet)
- **Purpose**: Provides MCP protocol interface for AI assistants
- **Tools**: list_emails, read_email, reply_email, send_email

## Configuration Files

1. **Chrome Native Messaging Host**:
   - Path: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.gmail.mcp.bridge.json`
   - Points to: `native-host.py`
   - Extension ID: `fbibeobdejgjgodpmofcmodbompkipnp`

2. **Extension Manifest**:
   - Permissions: nativeMessaging, tabs
   - Host permissions: https://mail.google.com/*
   - Content script: Injected into Gmail pages

## Data Flow

```
Gmail Web Page
    ↕️ (DOM interaction)
Content Script (content.js)
    ↕️ (Chrome messaging)
Background Script (background.js)
    ↕️ (Native messaging)
Native Host (native-host.py)
    ↕️ (Subprocess - future)
MCP Server (index.js)
    ↕️ (MCP protocol)
AI Assistant (Claude, etc.)
```

## Next Steps

1. Integrate native-host.py with MCP server
2. Test end-to-end functionality
3. Add error recovery and reconnection logic
4. Improve Gmail content extraction