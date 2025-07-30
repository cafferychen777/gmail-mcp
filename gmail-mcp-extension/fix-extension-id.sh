#!/bin/bash

# Script to fix extension ID in Native Messaging Host manifest

echo "=== Fix Extension ID for Gmail MCP Bridge ==="
echo ""
echo "Please follow these steps:"
echo "1. Open Chrome and navigate to: chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Find 'Gmail MCP Bridge' extension"
echo "4. Copy the Extension ID (looks like: abcdefghijklmnopqrstuvwxyz123456)"
echo ""
read -p "Paste your Extension ID here: " EXTENSION_ID

if [ -z "$EXTENSION_ID" ]; then
    echo "Error: Extension ID cannot be empty"
    exit 1
fi

# Update the manifest file
MANIFEST_PATH="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.gmail.mcp.bridge.json"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HOST_PATH="$SCRIPT_DIR/mcp-server/native-host.py"
NODE_PATH=$(which node)

# Create updated manifest
cat > "$MANIFEST_PATH" <<EOF
{
  "name": "com.gmail.mcp.bridge",
  "description": "Gmail MCP Bridge Native Host",
  "path": "${HOST_PATH}",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://${EXTENSION_ID}/"
  ]
}
EOF

echo ""
echo "✅ Extension ID updated successfully!"
echo ""
echo "Now please:"
echo "1. Go back to Chrome extensions page"
echo "2. Click the refresh button on 'Gmail MCP Bridge'"
echo "3. The extension should now connect properly"
echo ""
echo "Updated manifest:"
cat "$MANIFEST_PATH"