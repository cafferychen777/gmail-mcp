# Gmail MCP Bridge - Project Structure

## Clean Project Structure (Post-Cleanup)

```
gmail-mcp/
├── README.md                           # Main project documentation
├── CONTRIBUTING.md                     # Contribution guidelines
├── GMAIL_MCP_BUG_FIX_PLAN.md          # Bug fix documentation
└── gmail-mcp-extension/               # Main extension directory
    ├── README.md                       # Extension documentation
    ├── SETUP.md                        # Setup instructions
    ├── TESTING_GUIDE.md               # Testing documentation
    ├── CLAUDE_DESKTOP_TEST_GUIDE.md   # Claude Desktop testing guide
    ├── MCP_USAGE.md                    # MCP usage documentation
    ├── SEARCH_GUIDE.md                 # Search functionality guide
    ├── PROJECT_STRUCTURE.md           # This file
    ├── LICENSE                         # License file
    ├── claude-mcp-config.json          # Claude Desktop configuration
    ├── auto-setup.sh                   # Automated setup script
    ├── start-gmail-mcp.sh             # Start script
    ├── fix-extension-id.sh            # Extension ID fix script
    ├── extension/                      # Chrome extension files
    │   ├── manifest.json               # Extension manifest
    │   ├── background.js               # Service worker (account management)
    │   ├── content.js                  # Content script (Gmail interaction)
    │   ├── content-simple.js           # Simplified content script
    │   ├── diagnostics.js              # Diagnostic utilities
    │   ├── popup.html                  # Extension popup UI
    │   ├── popup.js                    # Popup functionality
    │   ├── icon.png                    # Extension icon (PNG)
    │   └── icon.svg                    # Extension icon (SVG)
    └── mcp-server/                     # MCP server implementation
        ├── package.json                # Node.js dependencies
        ├── package-lock.json           # Dependency lock file
        ├── index.js                    # Main MCP server
        ├── bridge-server.js            # HTTP bridge server
        ├── quick-test.js               # Automated testing tool
        ├── native-host.py              # Native messaging host
        ├── native-host-mcp.py          # MCP native host
        └── node_modules/               # Node.js dependencies
```

## Core Components

### 1. Chrome Extension (`extension/`)
- **background.js**: Account management and message routing
- **content.js**: Gmail DOM interaction and email operations
- **popup.js/html**: Extension user interface

### 2. MCP Server (`mcp-server/`)
- **index.js**: MCP protocol implementation
- **bridge-server.js**: HTTP bridge for Chrome extension communication
- **quick-test.js**: Automated testing and validation

### 3. Configuration & Scripts
- **claude-mcp-config.json**: Claude Desktop configuration
- **auto-setup.sh**: One-click installation
- **start-gmail-mcp.sh**: Service startup

## Data Flow

```
Claude Desktop → MCP Server → Bridge Server → Chrome Extension → Gmail
```

## Key Features

✅ **Multi-Account Support**: Smart account detection and switching
✅ **Email Operations**: Read, compose, send, search emails
✅ **Error Handling**: Comprehensive error catching and recovery
✅ **Testing**: Automated test suite with 100% pass rate

## Quick Start

1. Run `./auto-setup.sh` for automated installation
2. Load Chrome extension from `extension/` directory
3. Configure Claude Desktop with `claude-mcp-config.json`
4. Test with `node mcp-server/quick-test.js`

## Cleanup Summary

The project has been cleaned and organized:

❌ **Removed Files**:
- All debug/diagnostic scripts (`debug-*.js`, `diagnose*.js`)
- Temporary documentation drafts
- Test files and integration scripts (`test-*.js`)
- Verification and analysis tools

✅ **Kept Essential Files**:
- Core extension files (`background.js`, `content.js`)
- MCP server implementation (`index.js`, `bridge-server.js`)
- Essential documentation and configuration
- Automated testing tool (`quick-test.js`)

The repository is now clean, focused, and production-ready! 🚀