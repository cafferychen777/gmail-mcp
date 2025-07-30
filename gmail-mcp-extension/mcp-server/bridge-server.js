import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

class GmailBridgeServer {
  constructor(port = 3456) {
    this.app = express();
    this.port = port;
    this.pendingRequests = new Map();
    this.chromeConnected = false;
    this.lastPing = null;
    
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }
  
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        chromeConnected: this.chromeConnected,
        lastPing: this.lastPing,
        pendingRequests: this.pendingRequests.size
      });
    });
    
    // Chrome extension endpoints
    // Extension polls this endpoint for pending requests
    this.app.get('/chrome/poll', (req, res) => {
      this.chromeConnected = true;
      this.lastPing = new Date();
      
      // Check for pending requests
      const pending = Array.from(this.pendingRequests.values())
        .find(req => !req.sent);
      
      if (pending) {
        pending.sent = true;
        res.json({
          id: pending.id,
          action: pending.action,
          params: pending.params
        });
      } else {
        res.json({ status: 'no_requests' });
      }
    });
    
    // Extension sends responses here
    this.app.post('/chrome/response', (req, res) => {
      const { id, response, error } = req.body;
      
      const pendingRequest = this.pendingRequests.get(id);
      if (pendingRequest) {
        this.pendingRequests.delete(id);
        
        // Resolve the promise with the response
        if (error) {
          pendingRequest.reject(new Error(error));
        } else {
          pendingRequest.resolve(response);
        }
        
        res.json({ status: 'received' });
      } else {
        res.status(404).json({ error: 'Request not found' });
      }
    });
    
    // MCP server endpoints
    // MCP server calls this to request Gmail data
    this.app.post('/mcp/request', async (req, res) => {
      const { action, params } = req.body;
      const requestId = uuidv4();
      
      // Check if Chrome is connected
      if (!this.chromeConnected || 
          (this.lastPing && (new Date() - this.lastPing) > 10000)) {
        res.status(503).json({ 
          error: 'Chrome extension not connected',
          message: 'Please ensure Chrome is running with Gmail MCP Bridge extension'
        });
        return;
      }
      
      // Create a promise that will be resolved when Chrome responds
      const promise = new Promise((resolve, reject) => {
        this.pendingRequests.set(requestId, {
          id: requestId,
          action,
          params,
          sent: false,
          resolve,
          reject,
          timestamp: new Date()
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId);
            reject(new Error('Request timeout'));
          }
        }, 30000);
      });
      
      try {
        const response = await promise;
        res.json({ success: true, data: response });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });
  }
  
  start() {
    this.app.listen(this.port, () => {
      console.log(`Gmail Bridge Server running on http://localhost:${this.port}`);
      console.log('Endpoints:');
      console.log(`  Health: http://localhost:${this.port}/health`);
      console.log(`  Chrome Poll: http://localhost:${this.port}/chrome/poll`);
      console.log(`  MCP Request: http://localhost:${this.port}/mcp/request`);
    });
    
    // Clean up old requests periodically
    setInterval(() => {
      const now = new Date();
      for (const [id, request] of this.pendingRequests) {
        if (now - request.timestamp > 60000) { // 1 minute
          this.pendingRequests.delete(id);
        }
      }
    }, 10000);
  }
}

// Start the server
const server = new GmailBridgeServer();
server.start();