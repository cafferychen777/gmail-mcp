/**
 * Gmail MCP Bridge - Migration Example
 * 
 * This shows how to migrate from the old scattered error handling
 * to the new unified core system. Use this as a guide to refactor
 * existing code throughout the project.
 * 
 * @author Gmail MCP Bridge Team
 * @version 2.0.0
 */

/**
 * BEFORE: Old scattered error handling (from content.js)
 */

// OLD CODE - DON'T USE THIS ANYMORE!
/*
async function getEmailContent_OLD(emailId) {
  console.log(`Attempting to read email with ID: ${emailId}`);
  console.log('Current URL:', window.location.href);

  try {
    // ... email processing logic ...
    
    if (!emailRow) {
      return {
        id: emailId,
        subject: 'Email row not found',
        content: 'Could not find the email row to click.',
        sender: 'Unknown',
        date: 'Unknown',
        isOpen: false,
        debug: {
          foundSelector: 'none',
          // ... more debug info
        }
      };
    }

    // ... more code with scattered try-catch blocks ...
    
  } catch (error) {
    console.error('Error in getEmailContent:', error);
    return { error: error.message };
  }
}
*/

/**
 * AFTER: Using the new core system
 */

// Import the core manager (adjust path as needed)
// const { getCoreManager } = require('./core-manager.js');

async function getEmailContent_NEW(emailId) {
  // Get the unified API
  const coreAPI = getCoreManager().getAPI();
  
  // Wrap the function with intelligent error handling
  const wrappedFunction = coreAPI.wrapFunction(async () => {
    // The actual email processing logic - clean, no try-catch needed!
    const emailRow = findEmailRow(emailId);
    
    if (!emailRow) {
      // Instead of returning error objects, just throw - the wrapper handles it
      throw new Error(`Email row not found for ID: ${emailId}`);
    }
    
    emailRow.click();
    await waitForEmailToLoad();
    
    return extractEmailContent(emailId);
    
  }, { 
    component: 'gmailInterface', 
    operation: 'getEmailContent' 
  });
  
  // Execute the wrapped function - all errors are handled intelligently
  return await wrappedFunction();
}

/**
 * BEFORE: Old bridge server error handling
 */

// OLD CODE - DON'T USE THIS ANYMORE!
/*
app.post('/mcp/request', async (req, res) => {
  const { action, params } = req.body;
  
  console.log(`Received MCP request: action=${action}, params=`, params);
  
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
*/

/**
 * AFTER: Using the new core system
 */

app.post('/mcp/request', async (req, res) => {
  const coreAPI = getCoreManager().getAPI();
  
  // Handle the request through the intelligent error system
  const result = await coreAPI.handleError(async () => {
    const { action, params } = req.body;
    
    // Update system status
    coreAPI.updateStatus('bridgeServer', 'processing', { 
      action, 
      requestTime: Date.now() 
    });
    
    const response = await processRequest(action, params);
    
    // Update status on success
    coreAPI.updateStatus('bridgeServer', 'running', { 
      lastRequest: Date.now(),
      successful: true
    });
    
    return response;
    
  }, { component: 'bridgeServer', operation: 'mcpRequest' });
  
  // The result contains user-friendly error messages and auto-fix info
  if (result.resolved || !result.errorInfo) {
    res.json({ success: true, data: result });
  } else {
    res.status(500).json({ 
      success: false, 
      error: result.userMessage, // User-friendly message
      errorId: result.errorId,   // For tracking
      autoFixAttempted: result.autoFixAttempted
    });
  }
});

/**
 * BEFORE: Old Chrome extension message handling
 */

// OLD CODE - DON'T USE THIS ANYMORE!
/*
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);

  (async () => {
    try {
      let responseData;

      switch (request.action) {
        case 'getEmails':
          const emailResult = this.getEmailList();
          console.log('Email list result:', emailResult);
          responseData = emailResult;
          break;
          
        // ... other cases with scattered error handling ...
          
        default:
          responseData = { error: 'Unknown action' };
      }

      sendResponse(responseData);

    } catch (error) {
      console.error('Error processing request:', error);
      sendResponse({ error: error.message });
    }
  })();

  return true;
});
*/

/**
 * AFTER: Using the new core system
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const coreAPI = getCoreManager().getAPI();
  
  // Create action handlers map (no more switch statement hell!)
  const actionHandlers = {
    getEmails: () => getEmailList(),
    getEmailContent: (params) => getEmailContent(params.emailId),
    sendEmail: (params) => sendEmail(params.to, params.subject, params.body),
    // ... add more handlers as needed
  };
  
  // Process request through intelligent error handling
  (async () => {
    const result = await coreAPI.handleError(async () => {
      const handler = actionHandlers[request.action];
      
      if (!handler) {
        throw new Error(`Unknown action: ${request.action}`);
      }
      
      // Update status
      coreAPI.updateStatus('chromeExtension', 'processing', { 
        action: request.action,
        timestamp: Date.now() 
      });
      
      const response = await handler(request.params || {});
      
      // Update status on success
      coreAPI.updateStatus('chromeExtension', 'active', { 
        lastAction: request.action,
        timestamp: Date.now() 
      });
      
      return response;
      
    }, { component: 'chromeExtension', operation: request.action });
    
    // Send intelligent response
    if (result.resolved || !result.errorInfo) {
      sendResponse(result);
    } else {
      sendResponse({ 
        error: result.userMessage,
        errorId: result.errorId,
        canAutoRecover: result.autoFixResult?.success === true
      });
    }
  })();
  
  return true; // Indicate async response
});

/**
 * MIGRATION CHECKLIST
 * 
 * To migrate existing code to the new system:
 * 
 * 1. ✅ Replace all try-catch blocks with coreAPI.wrapFunction() or coreAPI.handleError()
 * 2. ✅ Replace all console.log/console.error with the structured logging (automatic)
 * 3. ✅ Replace scattered status variables with coreAPI.updateStatus()
 * 4. ✅ Replace manual error objects with proper Error throwing
 * 5. ✅ Use coreAPI.checkHealth() instead of manual health checks
 * 6. ✅ Remove duplicate error handling logic
 * 7. ✅ Update initialization code to use CoreManager
 * 8. ✅ Add proper component status updates throughout the code
 * 9. ✅ Test that auto-recovery works for your components
 * 10. ✅ Verify user-friendly error messages are displayed
 */

/**
 * EXAMPLE: How to initialize the new system in your main files
 */

// In background.js or main initialization file:
async function initializeApplication() {
  try {
    // Initialize core systems first
    const coreManager = getCoreManager({
      autoStart: true,
      enableRecovery: true,
      enableMonitoring: true
    });
    
    await coreManager.initialize();
    
    // Get the API for the rest of the application
    const coreAPI = coreManager.getAPI();
    
    // Set up status change monitoring
    coreAPI.onStatusChange((event) => {
      console.log(`[Status] ${event.component}: ${event.status}`);
      
      // Update UI or notify user if needed
      updateStatusUI(event);
    });
    
    // Your application initialization code here
    await initializeYourApp(coreAPI);
    
    console.log('[App] Application initialized successfully');
    
  } catch (error) {
    console.error('[App] Application initialization failed:', error);
    // The error handler will provide user-friendly messages
  }
}

// Example of using the API in your application
async function initializeYourApp(coreAPI) {
  // Update status to show we're initializing
  coreAPI.updateStatus('application', 'initializing');
  
  // Your initialization logic here...
  
  // Update status to show we're ready
  coreAPI.updateStatus('application', 'ready', {
    initTime: Date.now(),
    version: '2.0.0'
  });
}

/**
 * TESTING: How to verify the migration worked
 */

// Test error handling
async function testErrorHandling() {
  const coreAPI = getCoreManager().getAPI();
  
  // Test 1: Automatic error handling
  const result = await coreAPI.handleError(async () => {
    throw new Error('Test error');
  }, { component: 'test' });
  
  console.log('Error handling test:', result.userMessage);
  
  // Test 2: Function wrapping
  const wrappedFunction = coreAPI.wrapFunction(async () => {
    throw new Error('Wrapped error');
  }, { component: 'test' });
  
  try {
    await wrappedFunction();
  } catch (error) {
    console.log('Wrapped function test:', error.message);
  }
  
  // Test 3: Status updates
  coreAPI.updateStatus('test', 'running');
  const status = coreAPI.getSystemStatus();
  console.log('System status:', status);
  
  // Test 4: Health checks
  const health = await coreAPI.checkAllHealth();
  console.log('Health check:', health);
}

// Export for use in migration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getEmailContent_NEW,
    testErrorHandling,
    initializeApplication
  };
}