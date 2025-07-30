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

    // Click the compose button
    const composeButton = document.querySelector('[gh="cm"]') ||
                         document.querySelector('div[role="button"][gh="cm"]') ||
                         document.querySelector('.T-I.T-I-KE.L3');

    if (composeButton) {
      composeButton.click();

      // Wait for compose window to open
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fill in the fields
      if (to) {
        const toField = document.querySelector('textarea[name="to"]') ||
                       document.querySelector('[aria-label*="To"]');
        if (toField) {
          toField.value = to;
          toField.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      if (subject) {
        const subjectField = document.querySelector('input[name="subjectbox"]') ||
                            document.querySelector('[aria-label*="Subject"]');
        if (subjectField) {
          subjectField.value = subject;
          subjectField.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      if (body) {
        const bodyField = document.querySelector('[aria-label*="Message body"]') ||
                         document.querySelector('div[role="textbox"]');
        if (bodyField) {
          bodyField.innerHTML = body;
          bodyField.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      console.log('Compose window opened and filled');
    } else {
      throw new Error('Could not find compose button');
    }
  }

  async composeReply(emailId, content) {
    console.log(`Composing reply for email ${emailId}`);

    // First, make sure the email is open
    await this.getEmailContent(emailId);

    // Wait a moment for the email to be fully loaded
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Look for reply button
    const replyButton = document.querySelector('[aria-label*="Reply"]') ||
                       document.querySelector('[data-tooltip*="Reply"]') ||
                       document.querySelector('.T-I.J-J5-Ji.T-I-Js-Gs.aaq.T-I-ax7.L3');

    if (replyButton) {
      replyButton.click();

      // Wait for reply window to open
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fill in the reply content
      if (content) {
        const bodyField = document.querySelector('[aria-label*="Message body"]') ||
                         document.querySelector('div[role="textbox"]');
        if (bodyField) {
          bodyField.innerHTML = content;
          bodyField.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      console.log('Reply window opened and filled');
    } else {
      throw new Error('Could not find reply button');
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