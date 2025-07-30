#!/usr/bin/env python3

import sys
import json
import struct
import subprocess
import threading
import time
import queue
import os

# Logging
def log(message):
    with open('/tmp/native-host-mcp.log', 'a') as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {message}\n")
        f.flush()

class MCPBridge:
    def __init__(self):
        self.mcp_process = None
        self.mcp_queue = queue.Queue()
        self.chrome_queue = queue.Queue()
        self.pending_requests = {}
        self.request_counter = 0
        
    def start_mcp_server(self):
        """Start the MCP server as a subprocess"""
        try:
            mcp_path = os.path.join(os.path.dirname(__file__), 'index.js')
            self.mcp_process = subprocess.Popen(
                ['node', mcp_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            log("MCP server started")
            
            # Start thread to read MCP output
            threading.Thread(target=self.read_mcp_output, daemon=True).start()
            
            # Initialize MCP connection
            self.send_to_mcp({
                "jsonrpc": "2.0",
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {
                        "name": "gmail-mcp-bridge",
                        "version": "1.0.0"
                    }
                },
                "id": self.get_next_id()
            })
            
        except Exception as e:
            log(f"Failed to start MCP server: {e}")
    
    def read_mcp_output(self):
        """Read output from MCP server"""
        while self.mcp_process and self.mcp_process.poll() is None:
            try:
                line = self.mcp_process.stdout.readline()
                if line:
                    log(f"MCP output: {line.strip()}")
                    try:
                        message = json.loads(line)
                        self.handle_mcp_message(message)
                    except json.JSONDecodeError:
                        pass
            except Exception as e:
                log(f"Error reading MCP output: {e}")
    
    def handle_mcp_message(self, message):
        """Handle messages from MCP server"""
        if 'id' in message and message['id'] in self.pending_requests:
            # This is a response to our request
            request_info = self.pending_requests.pop(message['id'])
            
            # Forward response to Chrome
            if 'result' in message:
                chrome_response = {
                    "id": request_info['chrome_id'],
                    "response": message['result']
                }
            else:
                chrome_response = {
                    "id": request_info['chrome_id'],
                    "error": message.get('error', 'Unknown error')
                }
            
            self.send_to_chrome(chrome_response)
    
    def send_to_mcp(self, message):
        """Send message to MCP server"""
        if self.mcp_process and self.mcp_process.poll() is None:
            try:
                self.mcp_process.stdin.write(json.dumps(message) + '\n')
                self.mcp_process.stdin.flush()
                log(f"Sent to MCP: {message}")
            except Exception as e:
                log(f"Error sending to MCP: {e}")
    
    def send_to_chrome(self, message):
        """Send message to Chrome extension"""
        try:
            encoded_message = json.dumps(message).encode('utf-8')
            sys.stdout.buffer.write(struct.pack('I', len(encoded_message)))
            sys.stdout.buffer.write(encoded_message)
            sys.stdout.buffer.flush()
            log(f"Sent to Chrome: {message}")
        except Exception as e:
            log(f"Error sending to Chrome: {e}")
    
    def get_next_id(self):
        """Get next request ID"""
        self.request_counter += 1
        return self.request_counter
    
    def handle_chrome_message(self, message):
        """Handle messages from Chrome extension"""
        log(f"Received from Chrome: {message}")
        
        # Handle ping
        if message.get('action') == 'ping':
            self.send_to_chrome({
                "id": message.get('id'),
                "response": {"status": "pong", "mcp_connected": self.mcp_process is not None}
            })
            return
        
        # Handle responses from Chrome extension (content script results)
        if message.get('response') and message.get('id'):
            # This is a response from content script, check if we have a pending MCP request
            for mcp_id, info in self.pending_requests.items():
                if info.get('chrome_id') == message.get('id'):
                    # Found the matching request, send to MCP
                    self.pending_requests.pop(mcp_id)
                    # Forward the actual data to whoever requested it
                    self.send_to_chrome({
                        "id": message.get('id'),
                        "response": message.get('response')
                    })
                    return
            return
        
        # Handle Gmail actions - for now just forward back to Chrome to get real data
        action = message.get('action')
        if action in ['getEmails', 'getEmailContent', 'composeReply', 'sendEmail']:
            # We need to forward this to Chrome extension to get real Gmail data
            # For now, just acknowledge and wait for the real implementation
            log(f"Received {action} request, needs real Gmail data")
            
            # Since we're not fully integrated yet, return mock data
            if action == 'getEmails':
                self.send_to_chrome({
                    "id": message.get('id'),
                    "response": {
                        "emails": [
                            {"id": "1", "sender": "MCP Test", "subject": "MCP Integration Working", 
                             "snippet": "Your MCP server is connected!", "date": "Today", "isUnread": True}
                        ]
                    }
                })
            else:
                self.send_to_chrome({
                    "id": message.get('id'),
                    "response": {"message": f"{action} acknowledged"}
                })
        else:
            # Unknown action
            self.send_to_chrome({
                "id": message.get('id'),
                "error": f"Unknown action: {action}"
            })
    
    def run(self):
        """Main loop"""
        log("MCP Bridge started")
        
        # Start MCP server
        self.start_mcp_server()
        
        # Send ready message to Chrome
        time.sleep(0.5)  # Give MCP time to start
        self.send_to_chrome({"type": "ready", "message": "MCP Bridge is ready"})
        
        # Read messages from Chrome
        while True:
            try:
                # Read message length
                raw_length = sys.stdin.buffer.read(4)
                if len(raw_length) == 0:
                    break
                
                message_length = struct.unpack('I', raw_length)[0]
                
                # Read message
                message_data = sys.stdin.buffer.read(message_length).decode('utf-8')
                message = json.loads(message_data)
                
                # Handle message
                self.handle_chrome_message(message)
                
            except Exception as e:
                log(f"Error in main loop: {e}")
    
    def cleanup(self):
        """Clean up resources"""
        if self.mcp_process:
            self.mcp_process.terminate()
            self.mcp_process.wait()

if __name__ == '__main__':
    bridge = MCPBridge()
    try:
        bridge.run()
    except Exception as e:
        log(f"Fatal error: {e}")
    finally:
        bridge.cleanup()