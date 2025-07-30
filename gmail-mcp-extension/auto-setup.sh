#!/bin/bash

# Auto-setup script for Gmail MCP Native Messaging Host

echo "=== Gmail MCP Native Messaging Host Auto-Setup ==="
echo ""

# Configuration
HOST_NAME="com.gmail.mcp.bridge"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HOST_PATH="$SCRIPT_DIR/mcp-server/native-host.py"

# Check if running on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    NATIVE_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    NATIVE_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

# Create directory if it doesn't exist
mkdir -p "$NATIVE_DIR"

# Check for Node.js
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
    echo "Error: Node.js not found. Please install Node.js first."
    exit 1
fi

# Get extension ID from stdin or argument
if [ -n "$1" ]; then
    EXTENSION_ID="$1"
else
    read -p "Enter Extension ID (or press Enter to auto-detect): " EXTENSION_ID
fi

# If no ID provided, try to detect from existing installation
if [ -z "$EXTENSION_ID" ]; then
    echo "Attempting to auto-detect extension ID..."
    
    # Check if Chrome is running with the extension
    if command -v lsof &> /dev/null; then
        # Try to find extension ID from Chrome process
        DETECTED_ID=$(lsof -p $(pgrep -f "Google Chrome") 2>/dev/null | grep -o 'chrome-extension://[a-z]*' | head -1 | cut -d'/' -f3)
        if [ -n "$DETECTED_ID" ]; then
            echo "Detected extension ID: $DETECTED_ID"
            read -p "Use this ID? (y/n): " confirm
            if [[ $confirm == "y" ]]; then
                EXTENSION_ID="$DETECTED_ID"
            fi
        fi
    fi
fi

# Final check for extension ID
if [ -z "$EXTENSION_ID" ]; then
    echo ""
    echo "Extension ID is required. Please:"
    echo "1. Open Chrome and go to chrome://extensions/"
    echo "2. Enable Developer mode"
    echo "3. Find 'Gmail MCP Bridge' and copy its ID"
    echo "4. Run this script again with the ID"
    exit 1
fi

# Create the manifest file
MANIFEST_PATH="$NATIVE_DIR/${HOST_NAME}.json"
cat > "$MANIFEST_PATH" <<EOF
{
  "name": "${HOST_NAME}",
  "description": "Gmail MCP Bridge Native Host",
  "path": "${HOST_PATH}",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://${EXTENSION_ID}/"
  ]
}
EOF

# Make native host executable
chmod +x "${HOST_PATH}"

echo ""
echo "✅ Native messaging host installed successfully!"
echo ""
echo "Details:"
echo "- Extension ID: ${EXTENSION_ID}"
echo "- Manifest: ${MANIFEST_PATH}"
echo "- Host script: ${HOST_PATH}"
echo ""
echo "Please reload the Chrome extension for changes to take effect."
echo ""

# Offer to test the connection
read -p "Would you like to start the MCP server now? (y/n): " start_server
if [[ $start_server == "y" ]]; then
    echo "Starting MCP server..."
    cd "$SCRIPT_DIR/mcp-server"
    npm start
fi