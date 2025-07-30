# Gmail MCP Server Usage Guide

## Overview

The Gmail MCP Server allows AI assistants like Claude to interact with Gmail through a Chrome extension bridge.

## Available Tools

### 1. list_emails
List emails from Gmail inbox.

**Parameters**: None

**Example**:
```
Use the list_emails tool to show me my recent emails
```

### 2. read_email
Read the content of a specific email.

**Parameters**:
- `emailId` (string, required): The ID of the email to read

**Example**:
```
Use the read_email tool to read email with ID "email-1"
```

### 3. reply_email
Reply to an email.

**Parameters**:
- `emailId` (string, required): The ID of the email to reply to
- `content` (string, required): The reply content

**Example**:
```
Use the reply_email tool to reply to email "email-1" with "Thanks for your message!"
```

### 4. send_email
Send a new email.

**Parameters**:
- `to` (string, required): Recipient email address
- `subject` (string, required): Email subject
- `body` (string, required): Email body content

**Example**:
```
Use the send_email tool to send an email to test@example.com with subject "Hello" and body "This is a test"
```

## Setup for Claude Desktop

1. **Add to Claude Desktop config**:
   ```bash
   # On macOS
   cp claude-mcp-config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. **Ensure Chrome extension is running**:
   - Open Chrome
   - Check that Gmail MCP Bridge shows "Connected"
   - Navigate to Gmail

3. **Start using in Claude**:
   - Restart Claude Desktop
   - The Gmail tools should be available

## Testing the MCP Server

### Standalone test (without Chrome):
```bash
cd mcp-server
node test-mcp-standalone.js
```

### With Chrome extension:
1. Ensure extension is connected
2. Update native host to use `native-host-mcp.py`
3. Test in Claude Desktop

## Architecture

```
Claude Desktop
    ↓ (MCP Protocol)
MCP Server (index.js)
    ↓ (When integrated)
Native Host (native-host-mcp.py)
    ↓ (Native Messaging)
Chrome Extension
    ↓ (Content Script)
Gmail Web Interface
```

## Troubleshooting

1. **MCP server not starting**:
   - Check Node.js is installed: `node --version`
   - Check logs in Claude Desktop

2. **Tools not showing in Claude**:
   - Restart Claude Desktop
   - Check config file location

3. **Chrome extension not connected**:
   - Check extension status in popup
   - Verify native host is running

## Current Status

- ✅ MCP Server: Working (with mock data)
- ✅ Chrome Extension: Connected
- 🚧 Full Integration: In progress

The MCP server currently returns mock data. Full integration with the Chrome extension is being implemented.