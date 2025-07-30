#!/bin/bash

echo "Starting Gmail MCP System..."

# Start bridge server in background
cd /Users/apple/CascadeProjects/gmail-mcp/gmail-mcp-extension/mcp-server
echo "Starting bridge server..."
npm run bridge &
BRIDGE_PID=$!

echo "Bridge server started with PID: $BRIDGE_PID"
echo ""
echo "Gmail MCP System is ready!"
echo ""
echo "Next steps:"
echo "1. Make sure Chrome is running with Gmail open"
echo "2. Restart Claude Desktop to load the new MCP configuration"
echo "3. You can now use Gmail commands in Claude Desktop!"
echo ""
echo "Press Ctrl+C to stop the bridge server"

# Wait for Ctrl+C
trap "kill $BRIDGE_PID; exit" INT
wait