#!/usr/bin/env python3

import sys
import json
import struct
import threading
import time

# Logging
def log(message):
    with open('/tmp/native-host-py.log', 'a') as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {message}\n")
        f.flush()

# Send message to Chrome
def send_message(message):
    encoded_message = json.dumps(message).encode('utf-8')
    # Send 4-byte message length
    sys.stdout.buffer.write(struct.pack('I', len(encoded_message)))
    # Send message
    sys.stdout.buffer.write(encoded_message)
    sys.stdout.buffer.flush()
    log(f"Sent: {message}")

# Read message from Chrome
def read_message():
    # Read 4-byte message length
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0:
        return None
    message_length = struct.unpack('I', raw_length)[0]
    # Read message
    message_data = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message_data)

# Main message loop
def main():
    log("Python native host started")
    
    # Send initial ready message
    send_message({"type": "ready", "message": "Native host is ready"})
    
    # Read messages
    while True:
        try:
            message = read_message()
            if message is None:
                log("No more messages, exiting")
                break
                
            log(f"Received: {message}")
            
            # Handle ping
            if message.get('action') == 'ping':
                send_message({
                    "id": message.get('id'),
                    "response": {"status": "pong", "timestamp": time.time()}
                })
            elif message.get('action') == 'getEmails':
                # This is from background.js, we need to wait for content script response
                # For now, just acknowledge
                log("getEmails request received, waiting for content script response")
            elif message.get('action') == 'sendEmail':
                # Mock send email response
                params = message.get('params', {})
                send_message({
                    "id": message.get('id'),
                    "response": {
                        "success": True,
                        "message": f"Email to {params.get('to', 'unknown')} queued for sending"
                    }
                })
            elif message.get('response'):
                # This is a response from background.js, don't echo it back
                log(f"Received response from extension: {message.get('response')}")
            elif message.get('action'):
                # Unknown action - forward to Chrome extension
                log(f"Unknown action: {message.get('action')} - would forward to extension")
                send_message({
                    "id": message.get('id'),
                    "error": f"Action '{message.get('action')}' not implemented yet"
                })
            else:
                # Other messages - don't echo to avoid loops
                log("Received message without action")
                
        except Exception as e:
            log(f"Error: {e}")
            send_message({"error": str(e)})

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        log(f"Fatal error: {e}")
        sys.exit(1)