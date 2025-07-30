// Content script loaded
console.log('=== Gmail MCP Bridge Content Script Loading ===');
console.log('URL:', window.location.href);
console.log('Document ready state:', document.readyState);
console.log('Chrome runtime available:', typeof chrome !== 'undefined' && !!chrome.runtime);

// Prevent duplicate execution
if (window.gmailMcpBridgeLoaded) {
  console.log('Gmail MCP Bridge already loaded, skipping');
} else {
  window.gmailMcpBridgeLoaded = true;

// Wait for DOM to be fully ready
function initializeWhenReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWhenReady);
    return;
  }

  // Additional wait for Gmail to initialize
  setTimeout(initializeGmailInterface, 1000);
}

function initializeGmailInterface() {
  console.log('Initializing Gmail Interface...');

class GmailInterface {
  constructor() {
    console.log('GmailInterface constructor called');
    this.observer = null;
    this.init();
  }

  init() {
    console.log('Gmail MCP Bridge initialized');
    this.setupListeners();
  }

  setupListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Received message:', request);

      // Handle ping immediately
      if (request.action === 'ping') {
        sendResponse({ status: 'pong', timestamp: new Date().toISOString() });
        return true;
      }

      // Process request asynchronously
      (async () => {
        try {
          let responseData;

          switch (request.action) {
            case 'getEmails':
              const emails = this.getEmailList();
              console.log('Found emails:', emails);
              responseData = { emails };
              break;

            case 'getEmailContent':
              const contentEmailId = request.params?.emailId || request.emailId;
              const emailContent = await this.getEmailContent(contentEmailId);
              responseData = emailContent;
              break;

            case 'composeReply':
            case 'replyEmail':
              const emailId = request.params?.emailId || request.emailId;
              const replyContent = request.params?.content || request.content;
              await this.composeReply(emailId, replyContent);
              responseData = { success: true };
              break;

            case 'sendEmail':
              await this.sendEmail(request.params?.to || request.to,
                            request.params?.subject || request.subject,
                            request.params?.body || request.body);
              responseData = { success: true, message: 'Email compose window opened' };
              break;

            case 'debugPage':
              responseData = this.debugPageState();
              break;

            case 'searchEmails':
              const searchQuery = request.params?.query || request.query;
              const searchOptions = request.params?.options || request.options || {};
              responseData = await this.searchEmails(searchQuery, searchOptions);
              break;

            default:
              responseData = { error: 'Unknown action' };
          }

          // Send response directly using sendResponse
          console.log('Sending response:', responseData);
          sendResponse(responseData);

        } catch (error) {
          console.error('Error processing request:', error);
          const errorResponse = { error: error.message };
          sendResponse(errorResponse);
        }
      })();

      // Return true to indicate async response
      return true;
    });
  }

  async getEmailContent(emailId) {
    console.log(`Attempting to read email with ID: ${emailId}`);
    console.log('Current URL:', window.location.href);

    // If we're already viewing this specific email, extract content directly
    const currentUrl = window.location.href;
    if (currentUrl.includes(emailId)) {
      console.log('Already viewing the requested email, extracting content...');
      return this.extractCurrentEmailContent(emailId);
    }

    // Ensure we're in inbox view for email searching
    if (!currentUrl.includes('#inbox') && !currentUrl.includes('#all')) {
      console.log('Navigating to inbox...');
      window.location.hash = '#inbox';
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Find the email span
    console.log('Looking for email with ID:', emailId);
    const spanWithId = document.querySelector(`span[data-legacy-thread-id="${emailId}"]`);
    if (!spanWithId) {
      console.log('Email span not found');
      return {
        id: emailId,
        subject: 'Email not found',
        content: 'Email with the specified ID was not found in the current view.',
        sender: 'Unknown',
        date: 'Unknown',
        isOpen: false,
        debug: {
          foundSelector: 'none',
          contentLength: 0,
          hasSubject: false,
          hasSender: false,
          hasDate: false,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          reason: 'Email span not found'
        }
      };
    }

    console.log('Found email span:', spanWithId.textContent);

    // Find the email row and click it
    const emailRow = spanWithId.closest('tr.zA') || spanWithId.closest('tr');
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
          contentLength: 0,
          hasSubject: false,
          hasSender: false,
          hasDate: false,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          reason: 'Email row not found'
        }
      };
    }

    console.log('Found email row, clicking...');
    emailRow.click();

    // Wait for email to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extract content from the opened email
    return this.extractCurrentEmailContent(emailId);
  }

  extractCurrentEmailContent(emailId) {
    console.log('Extracting content from currently opened email');

    // Extract content from the currently opened email
    const contentElement = document.querySelector('.a3s.aiL') ||
                          document.querySelector('.a3s');

    const subjectElement = document.querySelector('h2[data-legacy-thread-id]') ||
                          document.querySelector('.hP') ||
                          document.querySelector('h2');

    const senderElement = document.querySelector('[email]') ||
                         document.querySelector('.gD') ||
                         document.querySelector('.go span');

    const dateElement = document.querySelector('span[title]') ||
                       document.querySelector('.g3');

    const result = {
      id: emailId,
      subject: subjectElement ? subjectElement.textContent.trim() : 'Unknown',
      content: contentElement ? contentElement.innerText.trim() : 'Content not found',
      sender: senderElement ? (senderElement.getAttribute('email') || senderElement.textContent.trim()) : 'Unknown',
      date: dateElement ? (dateElement.getAttribute('title') || dateElement.textContent.trim()) : 'Unknown',
      isOpen: true,
      debug: {
        foundSelector: contentElement ? contentElement.className : 'none',
        contentLength: contentElement ? contentElement.innerText.length : 0,
        hasSubject: !!subjectElement,
        hasSender: !!senderElement,
        hasDate: !!dateElement,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        extractionMethod: 'direct'
      }
    };

    console.log('Direct extraction result:', result);
    return result;
  }

  getEmailList() {
    console.log('Getting email list...');
    const emails = [];

    // Find all email rows in the current view
    const emailRows = document.querySelectorAll('tr.zA');
    console.log(`Found ${emailRows.length} email rows`);

    emailRows.forEach((row, index) => {
      try {
        // Find the span with thread ID
        const threadSpan = row.querySelector('span[data-legacy-thread-id]');
        if (!threadSpan) return;

        const threadId = threadSpan.getAttribute('data-legacy-thread-id');
        const subject = threadSpan.textContent.trim();

        // Find sender
        const senderElement = row.querySelector('[email]') ||
                             row.querySelector('.yW span') ||
                             row.querySelector('.bA4 span');
        const sender = senderElement ?
          (senderElement.getAttribute('email') || senderElement.textContent.trim()) : 'Unknown';

        // Find date
        const dateElement = row.querySelector('.xW span[title]') ||
                           row.querySelector('.xW');
        const date = dateElement ?
          (dateElement.getAttribute('title') || dateElement.textContent.trim()) : 'Unknown';

        // Check if unread
        const isUnread = row.classList.contains('zE') ||
                        row.querySelector('.yW .zE') !== null;

        emails.push({
          id: threadId,
          subject: subject,
          sender: sender,
          date: date,
          isUnread: isUnread,
          index: index
        });
      } catch (error) {
        console.error(`Error processing email row ${index}:`, error);
      }
    });

    console.log(`Extracted ${emails.length} emails`);
    return emails;
  }

  async sendEmail(to, subject, body) {
    console.log('Opening compose window for new email...');
    console.log('To:', to, 'Subject:', subject);

    try {
      // Find compose button with multiple selectors
      const composeSelectors = [
        '[gh="cm"]',
        'div[role="button"][gh="cm"]',
        '.T-I.T-I-KE.L3',
        '.z0 > .L3',  // Compose button in Gmail
        'div.T-I.T-I-KE'
      ];

      let composeButton = null;
      for (const selector of composeSelectors) {
        composeButton = document.querySelector(selector);
        if (composeButton && composeButton.offsetParent !== null) {
          console.log(`Found compose button with selector: ${selector}`);
          break;
        }
      }

      if (!composeButton) {
        throw new Error('Could not find compose button. Make sure you are on Gmail inbox.');
      }

      // Click compose button
      composeButton.click();
      console.log('Compose button clicked');

      // Wait for compose window to fully load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fill in the To field
      if (to) {
        const toSelectors = [
          'textarea[name="to"]',
          'input[name="to"]',
          '[aria-label*="To"][role="combobox"]',
          '[aria-label="To"]',
          'div[name="to"]'
        ];

        let toField = null;
        for (const selector of toSelectors) {
          toField = document.querySelector(selector);
          if (toField) {
            console.log(`Found To field with selector: ${selector}`);
            break;
          }
        }

        if (toField) {
          toField.focus();
          toField.value = to;
          toField.dispatchEvent(new Event('input', { bubbles: true }));
          toField.dispatchEvent(new Event('change', { bubbles: true }));
          // Tab to next field
          toField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        } else {
          console.warn('Could not find To field');
        }
      }

      // Small delay between fields
      await new Promise(resolve => setTimeout(resolve, 500));

      // Fill in the Subject field
      if (subject) {
        const subjectSelectors = [
          'input[name="subjectbox"]',
          'input[name="subject"]',
          '[aria-label="Subject"]',
          'input[placeholder*="Subject"]'
        ];

        let subjectField = null;
        for (const selector of subjectSelectors) {
          subjectField = document.querySelector(selector);
          if (subjectField) {
            console.log(`Found Subject field with selector: ${selector}`);
            break;
          }
        }

        if (subjectField) {
          subjectField.focus();
          subjectField.value = subject;
          subjectField.dispatchEvent(new Event('input', { bubbles: true }));
          subjectField.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          console.warn('Could not find Subject field');
        }
      }

      // Small delay before body
      await new Promise(resolve => setTimeout(resolve, 500));

      // Fill in the Body field
      if (body) {
        const bodySelectors = [
          '[aria-label="Message Body"]',
          '[aria-label*="Message body"]',
          'div[role="textbox"][aria-label*="Message"]',
          'div[contenteditable="true"][role="textbox"]',
          '.Am.Al.editable',
          '.editable[contenteditable="true"]'
        ];

        let bodyField = null;
        let attempts = 0;
        const maxAttempts = 5;

        // Try multiple times as compose area might load slowly
        while (!bodyField && attempts < maxAttempts) {
          for (const selector of bodySelectors) {
            bodyField = document.querySelector(selector);
            if (bodyField && bodyField.offsetParent !== null) {
              console.log(`Found Body field with selector: ${selector}`);
              break;
            }
          }
          
          if (!bodyField) {
            attempts++;
            console.log(`Body field not found, attempt ${attempts}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (bodyField) {
          bodyField.focus();
          // Convert newlines to HTML breaks for proper formatting
          const formattedBody = body.replace(/\n/g, '<br>');
          bodyField.innerHTML = formattedBody;
          bodyField.dispatchEvent(new Event('input', { bubbles: true }));
          bodyField.dispatchEvent(new Event('change', { bubbles: true }));
          bodyField.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        } else {
          console.warn('Could not find Body field after multiple attempts');
        }
      }

      console.log('Compose window opened and filled successfully');
      
      return {
        success: true,
        message: 'Email compose window opened',
        to: to,
        subject: subject
      };
      
    } catch (error) {
      console.error('Error in sendEmail:', error);
      throw error;
    }
  }

  async composeReply(emailId, content) {
    console.log(`Composing reply for email ${emailId}`);
    console.log('Reply content:', content);

    try {
      // First, make sure the email is open
      const emailData = await this.getEmailContent(emailId);
      
      if (!emailData || emailData.error) {
        throw new Error(`Failed to open email: ${emailData?.error || 'Unknown error'}`);
      }

      // Wait for email to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Look for reply button with multiple selectors
      const replySelectors = [
        '[aria-label*="Reply"]',
        '[data-tooltip*="Reply"]',
        'div[role="button"][aria-label*="Reply"]',
        'span[role="button"][aria-label*="Reply"]',
        '.ams.bkH',  // Gmail's reply button class
        '.T-I.J-J5-Ji.T-I-Js-Gs.aaq.T-I-ax7.L3'
      ];

      let replyButton = null;
      for (const selector of replySelectors) {
        replyButton = document.querySelector(selector);
        if (replyButton && replyButton.offsetParent !== null) { // Check if visible
          console.log(`Found reply button with selector: ${selector}`);
          break;
        }
      }

      if (!replyButton) {
        // Try to find reply button in the email actions area
        const actionsArea = document.querySelector('.iN') || document.querySelector('.btb');
        if (actionsArea) {
          replyButton = actionsArea.querySelector('[role="button"]');
        }
      }

      if (!replyButton) {
        throw new Error('Could not find reply button. Make sure the email is open.');
      }

      // Click the reply button
      replyButton.click();
      console.log('Reply button clicked');

      // Wait for reply compose area to appear
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find the compose area - it might be in different states
      const composeSelectors = [
        '[aria-label="Message Body"]',
        '[aria-label*="Message body"]',
        'div[role="textbox"][aria-label*="Message"]',
        'div[contenteditable="true"][role="textbox"]',
        '.Am.Al.editable',
        '.editable[contenteditable="true"]'
      ];

      let bodyField = null;
      let attempts = 0;
      const maxAttempts = 5;

      // Try multiple times as compose area might load slowly
      while (!bodyField && attempts < maxAttempts) {
        for (const selector of composeSelectors) {
          bodyField = document.querySelector(selector);
          if (bodyField && bodyField.offsetParent !== null) {
            console.log(`Found compose field with selector: ${selector}`);
            break;
          }
        }
        
        if (!bodyField) {
          attempts++;
          console.log(`Compose field not found, attempt ${attempts}/${maxAttempts}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!bodyField) {
        throw new Error('Could not find reply compose field after opening reply window');
      }

      // Focus the field first
      bodyField.focus();
      
      // Clear any existing content
      bodyField.innerHTML = '';
      
      // Set the reply content
      if (content) {
        // Convert newlines to HTML breaks for proper formatting
        const formattedContent = content.replace(/\n/g, '<br>');
        
        // Use innerHTML for formatted content (Gmail's compose uses contenteditable)
        bodyField.innerHTML = formattedContent;
        
        // Trigger input events to ensure Gmail recognizes the change
        bodyField.dispatchEvent(new Event('input', { bubbles: true }));
        bodyField.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Also trigger a keyup event
        bodyField.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      }

      console.log('Reply window opened and content filled successfully');
      
      return {
        success: true,
        message: 'Reply compose window opened',
        emailId: emailId
      };
      
    } catch (error) {
      console.error('Error in composeReply:', error);
      throw error;
    }
  }

  async searchEmails(query, options = {}) {
    console.log(`Searching emails with query: ${query}`);
    console.log('Search options:', options);

    const limit = options.limit || 10;

    // Build the full search query with options
    let fullQuery = query;
    
    // Add additional filters from options
    if (options.from) {
      fullQuery += ` from:${options.from}`;
    }
    if (options.subject) {
      fullQuery += ` subject:${options.subject}`;
    }
    if (options.unread === true) {
      fullQuery += ` is:unread`;
    }
    if (options.dateFrom) {
      fullQuery += ` after:${options.dateFrom}`;
    }
    if (options.dateTo) {
      fullQuery += ` before:${options.dateTo}`;
    }

    console.log('Full search query:', fullQuery);

    // Find the search box
    const searchBox = document.querySelector('input[aria-label*="Search"]') ||
                     document.querySelector('input[name="q"]') ||
                     document.querySelector('.gb_hf');

    if (!searchBox) {
      throw new Error('Could not find search box');
    }

    // Focus the search box first
    searchBox.focus();
    
    // Clear existing value
    searchBox.value = '';
    
    // Set new search query
    searchBox.value = fullQuery;
    searchBox.dispatchEvent(new Event('input', { bubbles: true }));

    // Trigger search by simulating Enter key
    const enterEvent = new KeyboardEvent('keydown', { 
      key: 'Enter', 
      keyCode: 13,
      which: 13,
      bubbles: true 
    });
    searchBox.dispatchEvent(enterEvent);

    // Wait for search results to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get search results
    const emails = this.getEmailList().slice(0, limit);

    return {
      query: fullQuery,
      results: emails,
      count: emails.length,
      url: window.location.href
    };
  }

  debugPageState() {
    console.log('Debugging Gmail page state...');

    const state = {
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
      timestamp: new Date().toISOString(),

      // Gmail-specific elements
      gmailElements: {
        composeButton: !!document.querySelector('[gh="cm"]'),
        searchBox: !!document.querySelector('input[aria-label*="Search"]'),
        emailRows: document.querySelectorAll('tr.zA').length,
        openEmail: !!document.querySelector('.a3s'),
        sidebarVisible: !!document.querySelector('[role="navigation"]')
      },

      // Content script state
      contentScript: {
        loaded: window.gmailMcpBridgeLoaded || false,
        interfaceExists: !!window.gmailInterface,
        chromeRuntime: typeof chrome !== 'undefined' && !!chrome.runtime
      },

      // Available email IDs
      availableEmails: this.getEmailList().slice(0, 5).map(e => ({
        id: e.id,
        subject: e.subject.substring(0, 50)
      }))
    };

    console.log('Debug state:', state);
    return state;
  }
}

  // Create and set global instance
  console.log('Creating GmailInterface instance...');
  try {
    const gmailInterface = new GmailInterface();
    window.gmailInterface = gmailInterface;
    console.log('window.gmailInterface set:', !!window.gmailInterface);

    // Send ready signal to background script
    chrome.runtime.sendMessage({ action: 'contentScriptReady' }, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to send ready signal:', chrome.runtime.lastError.message);
      } else {
        console.log('Content script ready signal sent successfully');
      }
    });

  } catch (error) {
    console.error('Error creating GmailInterface:', error);
  }
}

// Start initialization
initializeWhenReady();

} // End of duplicate prevention check