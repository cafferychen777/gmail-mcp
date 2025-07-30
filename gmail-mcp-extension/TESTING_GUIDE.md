# Gmail MCP Bridge Testing Guide

## ⚠️ Important: Use the Correct Console

DO NOT test in the Gmail page console. You need to use the extension's background console.

## Step 1: Open Extension Background Console

1. Navigate to `chrome://extensions/`
2. Find "Gmail MCP Bridge" extension
3. Click "background page" or "Service Worker"
4. A new DevTools window will open - this is where you test

## Step 2: Test Commands

In the background console, run these commands:

### Basic Connection Test
```javascript
// Check if connected
window.nativePort
// Should show: Port object if connected, null if not

// Test ping
testGmail.ping()
// Should show: "Sending ping with id: ..." 
// Then: "Received from native: {id: ..., response: {status: 'pong', ...}}"
```

### Gmail Functions Test
```javascript
// Get emails list
testGmail.getEmails()

// Send email
testGmail.sendEmail('test@example.com', 'Test Subject', 'Test message body')

// Direct native port access (if needed)
window.nativePort.postMessage({ action: 'getEmails', id: Date.now() })
```

## Expected Responses

### Successful Ping Response:
```javascript
Received from native: {
  id: 1234567890,
  response: {
    status: "pong",
    timestamp: 1234567890.123
  }
}
```

### Get Emails Response:
```javascript
Received from native: {
  id: 1234567890,
  error: "Unknown action: getEmails"  // Current response since Gmail integration is pending
}
```

## Troubleshooting

### "Native port not connected"
- Reload the extension
- Check if Native Host is installed correctly
- Look for connection errors in console

### No response from native host
- Check `/tmp/native-host-py.log` for errors
- Ensure Python script has execute permissions
- Verify Chrome native messaging manifest

## Console Locations

- **Extension Background**: chrome://extensions/ → "background page"
- **Gmail Content Script**: Right-click Gmail page → Inspect
- **Extension Popup**: Right-click extension icon → Inspect popup

Always use the Extension Background console for testing native messaging!