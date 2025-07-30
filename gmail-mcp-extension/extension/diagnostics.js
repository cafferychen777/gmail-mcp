// Diagnostics script to check extension status
console.log('=== Gmail MCP Extension Diagnostics ===');

// Check if content script is injected
chrome.tabs.query({ url: 'https://mail.google.com/*' }, (tabs) => {
  console.log(`Found ${tabs.length} Gmail tabs`);
  
  if (tabs.length > 0) {
    // Try to send a test message to each tab
    tabs.forEach((tab, index) => {
      console.log(`Tab ${index + 1}: ${tab.url}`);
      
      // Test message to content script
      chrome.tabs.sendMessage(tab.id, { action: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(`Tab ${index + 1} - Content script not responding:`, chrome.runtime.lastError.message);
          console.log('-> Try refreshing the Gmail tab');
        } else {
          console.log(`Tab ${index + 1} - Content script is active:`, response);
        }
      });
    });
  } else {
    console.log('No Gmail tabs found. Please open Gmail in a tab.');
  }
});

// Check bridge server connection
console.log('Bridge server URL:', BRIDGE_URL);
console.log('Bridge polling active:', globalThis.bridgePolling ? 'Yes' : 'No');

// Check bridge polling status
console.log('Bridge polling status:', globalThis.bridgePolling ? 'Active' : 'Not active');

// Export for console use
globalThis.runDiagnostics = () => {
  chrome.tabs.query({ url: 'https://mail.google.com/*' }, (tabs) => {
    console.log('Gmail tabs:', tabs.map(t => ({ id: t.id, url: t.url })));
  });
};