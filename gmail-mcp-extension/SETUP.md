# Gmail MCP Bridge Setup Guide

## Quick Setup (2 minutes)

### Step 1: Install the Chrome Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `extension` folder from this project
5. The extension will be installed and you'll see its ID

### Step 2: Configure Native Messaging
Run this command in Terminal:
```bash
cd ~/CascadeProjects/gmail-mcp/gmail-mcp-extension
./fix-extension-id.sh
```

When prompted, paste the Extension ID from Step 1.

### Step 3: Start the MCP Server
```bash
cd mcp-server
npm start
```

### Step 4: Test the Connection
1. Click the Gmail MCP Bridge extension icon in Chrome
2. You should see "Connected to MCP server"
3. Navigate to Gmail (https://mail.google.com)
4. The extension is now ready to use!

## Troubleshooting

### "Specified native messaging host not found" Error
This means the extension ID doesn't match. Run `./fix-extension-id.sh` again.

### Extension shows "Not connected"
1. Make sure the MCP server is running (`npm start` in mcp-server folder)
2. Reload the extension in Chrome
3. Check Chrome DevTools console for error messages

### Still having issues?
1. Check that Node.js is installed: `node --version`
2. Verify the manifest file exists: `ls ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/`
3. Look for errors in the MCP server console

## How It Works
- The Chrome extension communicates with Gmail web pages
- It connects to a local MCP server via Native Messaging
- The MCP server provides tools that can be called by AI assistants
- No manual Extension ID configuration needed after initial setup!