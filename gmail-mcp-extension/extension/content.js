// Content script loaded
console.log('=== Gmail MCP Bridge Content Script Loading ===');
console.log('URL:', window.location.href);
console.log('Document ready state:', document.readyState);
console.log('Chrome runtime available:', typeof chrome !== 'undefined' && !!chrome.runtime);

class GmailInterface {
  constructor() {
    console.log('GmailInterface constructor called');
    this.observer = null;
    this.init();
  }

  init() {
    console.log('Gmail MCP Bridge initialized');
    // Notify background script that content script is ready
    chrome.runtime.sendMessage({ action: 'contentScriptReady' }, (response) => {
      if (chrome.runtime.lastError) {
        const errorMessage = chrome.runtime.lastError.message || 'Unknown error';
        console.error('Error notifying background:', errorMessage);
      } else {
        console.log('Background notified:', response);
      }
    });
    this.waitForGmailLoad();
  }

  waitForGmailLoad() {
    const checkInterval = setInterval(() => {
      if (this.isGmailLoaded()) {
        clearInterval(checkInterval);
        this.setupListeners();
        this.observeChanges();
      }
    }, 1000);
  }

  isGmailLoaded() {
    return document.querySelector('[role="main"]') !== null;
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
              responseData = { content: emailContent };
              break;

            case 'composeReply':
            case 'replyEmail':
              // Handle both action names for compatibility
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

  observeChanges() {
    this.observer = new MutationObserver((mutations) => {
      // Can be used to detect Gmail state changes
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  getEmailList() {
    const emails = [];

    // Enhanced selectors for different Gmail views
    const emailRowSelectors = [
      'tr.zA',                           // Standard Gmail view
      '[role="row"][tabindex="-1"]',     // Alternative view
      'tr[jsaction*="click"]',           // Some Gmail versions
      '.zA.yO',                          // Conversation view
      '[data-legacy-thread-id]'         // Direct thread ID selector
    ];

    let rows = [];
    for (const selector of emailRowSelectors) {
      rows = document.querySelectorAll(selector);
      if (rows.length > 0) {
        console.log(`Found ${rows.length} email rows using selector: ${selector}`);
        break;
      }
    }

    rows.forEach((row, index) => {
      try {
        // Enhanced sender detection
        const senderSelectors = [
          '.yW span[email]',              // Sender with email attribute
          '.yW span',                     // Standard sender
          '.bA4 span',                    // Alternative sender
          '[email]',                      // Any element with email
          '.yX span',                     // Another sender variant
          '.a4W span'                     // Yet another variant
        ];

        let sender = '';
        for (const sel of senderSelectors) {
          const elem = row.querySelector(sel);
          if (elem) {
            sender = elem.getAttribute('email') || elem.textContent || '';
            if (sender) break;
          }
        }

        // Enhanced subject detection
        const subjectSelectors = [
          '.y6 span[id]',                 // Standard subject
          '.bog',                         // Alternative subject
          '[data-legacy-thread-id]',     // Thread ID element
          '.y6',                          // Subject container
          '.a4W'                          // Another subject variant
        ];

        let subject = '';
        for (const sel of subjectSelectors) {
          const elem = row.querySelector(sel);
          if (elem) {
            subject = elem.textContent || '';
            if (subject && !subject.includes('data-legacy-thread-id')) break;
          }
        }

        // Enhanced snippet detection
        const snippetSelectors = [
          '.y2',                          // Standard snippet
          '.Zt span',                     // Alternative snippet
          '.y3',                          // Another snippet variant
          '.a4W .y2'                      // Nested snippet
        ];

        let snippet = '';
        for (const sel of snippetSelectors) {
          const elem = row.querySelector(sel);
          if (elem) {
            snippet = elem.textContent || '';
            if (snippet) break;
          }
        }

        // Enhanced date detection
        const dateSelectors = [
          '.xW span[title]',              // Date with title
          '.xW',                          // Date container
          '.xY span',                     // Alternative date
          '.a4W .xW'                      // Nested date
        ];

        let date = '';
        for (const sel of dateSelectors) {
          const elem = row.querySelector(sel);
          if (elem) {
            date = elem.getAttribute('title') || elem.textContent || '';
            if (date) break;
          }
        }

        // Enhanced unread detection
        const isUnread = row.classList.contains('zE') ||
                        row.querySelector('.zE') !== null ||
                        row.classList.contains('yW') ||
                        row.querySelector('.yW') !== null;

        // Enhanced email ID detection
        const emailId = row.getAttribute('data-legacy-thread-id') ||
                       row.querySelector('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id') ||
                       row.getAttribute('data-thread-id') ||
                       row.id ||
                       `email-${index}`;

        if (subject || sender) {  // Only add if we found some content
          emails.push({
            id: emailId,
            sender: sender.trim(),
            subject: subject.trim(),
            snippet: snippet.trim(),
            date: date.trim(),
            isUnread
          });
        }
      } catch (error) {
        console.error('Error parsing email row:', error);
      }
    });

    // If no emails found, provide debugging info
    if (emails.length === 0) {
      console.log('No emails found. Current URL:', window.location.href);
      console.log('Available email-like elements:');

      // Debug: show what elements are available
      const debugSelectors = ['tr', '[role="row"]', '[data-legacy-thread-id]'];
      debugSelectors.forEach(sel => {
        const elements = document.querySelectorAll(sel);
        console.log(`${sel}: ${elements.length} elements`);
      });
    }

    return emails;
  }

  async getEmailContent(emailId) {
    console.log(`Attempting to read email with ID: ${emailId}`);

    // Strategy 1: Look for opened email content containers first
    const openEmailContentSelectors = [
      `.ii.gt[data-legacy-thread-id="${emailId}"]`,
      `[data-legacy-thread-id="${emailId}"].ii.gt`,
      `.ii.gt:has([data-legacy-thread-id="${emailId}"])`
    ];

    let emailContainer = null;

    // Try to find the actual email content container
    for (const selector of openEmailContentSelectors) {
      try {
        emailContainer = document.querySelector(selector);
        if (emailContainer && emailContainer.classList.contains('ii')) {
          console.log('Found email content container:', emailContainer);
          break;
        }
      } catch (e) {
        // Some selectors might not be supported
        continue;
      }
    }

    // Strategy 2: If no content container found, look for any element with the ID
    if (!emailContainer) {
      console.log('No content container found, looking for any element with the ID...');

      const anyElementWithId = document.querySelector(`[data-legacy-thread-id="${emailId}"]`);
      if (anyElementWithId) {
        console.log('Found element with ID:', anyElementWithId);

        // Try to find the nearest email content container
        emailContainer = anyElementWithId.closest('.ii.gt') ||
                        anyElementWithId.closest('[role="main"]') ||
                        anyElementWithId.closest('.nH');

        console.log('Found nearest container:', emailContainer);
      }
    }

    // Strategy 3: If still no container, look for currently visible email content
    if (!emailContainer) {
      console.log('No specific container found, looking for any open email content...');

      const visibleEmailContainers = document.querySelectorAll('.ii.gt');
      console.log(`Found ${visibleEmailContainers.length} visible email containers`);

      // Use the first visible email container as fallback
      if (visibleEmailContainers.length > 0) {
        emailContainer = visibleEmailContainers[0];
        console.log('Using first visible email container as fallback');
      }
    }

    if (emailContainer) {
      console.log('Using email container:', emailContainer);

      // Check if this is actually an email content container or just a list item
      const isActualEmailContent = emailContainer.classList.contains('ii') ||
                                  emailContainer.classList.contains('gt') ||
                                  emailContainer.querySelector('.a3s') !== null ||
                                  emailContainer.innerHTML.length > 200;

      console.log('Is actual email content container:', isActualEmailContent);

      if (!isActualEmailContent) {
        console.log('Container appears to be a list item, not opened email content');

        // Try to find and click the email to open it
        // Gmail stores the thread ID in a span inside the tr, not on the tr itself
        let emailRow = document.querySelector(`tr[data-legacy-thread-id="${emailId}"]`);

        // If not found, look for the span with the ID and find its parent row
        if (!emailRow) {
          const spanWithId = document.querySelector(`span[data-legacy-thread-id="${emailId}"]`);
          if (spanWithId) {
            emailRow = spanWithId.closest('tr.zA') || spanWithId.closest('tr');
            console.log('Found email via span, parent row:', emailRow);
          }
        }

        if (emailRow) {
          console.log('Found email row, attempting to open email...');

          // Try to click the email row to open it
          emailRow.click();

          // Wait a moment for the email to load, then try again
          return new Promise((resolve) => {
            setTimeout(async () => {
              console.log('Retrying email content extraction after opening...');
              const result = await this.getEmailContent(emailId);
              resolve(result);
            }, 2000);
          });
        }

        // This is likely a list item, extract what we can and indicate it's not fully open
        const listItemSubject = emailContainer.textContent.trim();

        return {
          id: emailId,
          subject: listItemSubject,
          content: 'Email not fully opened and could not be automatically opened. Please manually click on the email to view its content.',
          sender: 'Unknown (email not opened)',
          date: 'Unknown (email not opened)',
          isOpen: false,
          debug: {
            foundSelector: 'list-item',
            contentLength: 0,
            hasSubject: !!listItemSubject,
            hasSender: false,
            hasDate: false,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            containerType: emailContainer.tagName + '.' + emailContainer.className,
            containerHtml: emailContainer.innerHTML.substring(0, 200),
            reason: 'Email container is a list item, not opened email content'
          }
        };
      }

      // Enhanced content extraction WITHIN the specific email container
      // Prioritize the most reliable selectors first, but search within the container
      const contentSelectors = [
        '.a3s.aiL',                    // Standard email content (HIGHEST PRIORITY)
        '.a3s',                        // Any email content
        '.ii.gt .a3s',                 // Alternative content
        '[data-message-id] .a3s',      // Message ID based
        '.Am .a3s',                    // Alternative message
        '.gs .a3s',                    // Another variant
        'div[dir="ltr"]',              // Directional content
        '.adn.ads',                    // Message container
        'div',                         // Any div in message
        'span',                        // Any span in message
        'p'                            // Any paragraph in message
      ];

      let content = '';
      let foundSelector = '';

      console.log('Attempting to extract email content from container...');

      for (const selector of contentSelectors) {
        // Search WITHIN the email container, not globally
        const contentElement = emailContainer.querySelector(selector);
        if (contentElement) {
          console.log(`Found content element with selector: ${selector} within email container`);
          console.log(`Element details:`, {
            tagName: contentElement.tagName,
            className: contentElement.className,
            id: contentElement.id,
            childrenCount: contentElement.children.length,
            hasInnerText: !!contentElement.innerText,
            hasTextContent: !!contentElement.textContent,
            innerHTML: contentElement.innerHTML.substring(0, 200)
          });

          // Try different text extraction methods
          let extractedText = '';

          // Method 1: innerText (most reliable for Gmail)
          if (contentElement.innerText) {
            extractedText = contentElement.innerText.trim();
            if (extractedText) {
              console.log(`Method 1 (innerText) success: ${extractedText.substring(0, 100)}...`);
              console.log(`Content length: ${extractedText.length} characters`);
            }
          }

          // Method 2: textContent (fallback)
          if (!extractedText && contentElement.textContent) {
            extractedText = contentElement.textContent.trim();
            if (extractedText) {
              console.log(`Method 2 (textContent) success: ${extractedText.substring(0, 100)}...`);
            }
          }

          // Method 3: innerHTML parsing (remove HTML tags)
          if (!extractedText && contentElement.innerHTML) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = contentElement.innerHTML;
            extractedText = (tempDiv.textContent || tempDiv.innerText || '').trim();
            if (extractedText) {
              console.log(`Method 3 (innerHTML parsing) success: ${extractedText.substring(0, 100)}...`);
            }
          }

          // Method 4: Deep text extraction
          if (!extractedText) {
            const walker = document.createTreeWalker(
              contentElement,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );

            let textParts = [];
            let node;
            while (node = walker.nextNode()) {
              const nodeText = node.textContent.trim();
              if (nodeText) {
                textParts.push(nodeText);
              }
            }

            if (textParts.length > 0) {
              extractedText = textParts.join(' ').trim();
              console.log(`Method 4 (tree walker) success: ${extractedText.substring(0, 100)}...`);
            }
          }

          if (extractedText) {
            content = extractedText;
            foundSelector = selector;
            console.log(`Successfully extracted content using: ${selector}`);
            console.log(`Final content length: ${content.length} characters`);
            break;
          } else {
            console.log(`Element found but no text content extracted: ${selector}`);
          }
        }
      }

      // If still no content, try to get any visible text from the email container
      if (!content.trim()) {
        console.log('No content found with standard selectors, trying text walker on email container...');

        // Get all text nodes within the email container
        const walker = document.createTreeWalker(
          emailContainer,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        let textContent = '';
        let node;
        while (node = walker.nextNode()) {
          if (node.textContent.trim()) {
            textContent += node.textContent.trim() + ' ';
          }
        }

        if (textContent.trim()) {
          content = textContent.trim();
          foundSelector = `email container (text walker)`;
          console.log(`Extracted content using text walker from email container`);
        }
      }

      // Debug: Log available elements if still no content
      if (!content.trim()) {
        console.log('Still no content found. Available elements in page:');
        const allElements = document.querySelectorAll('*');
        const elementCounts = {};

        allElements.forEach(el => {
          const tagName = el.tagName.toLowerCase();
          elementCounts[tagName] = (elementCounts[tagName] || 0) + 1;
        });

        console.log('Element counts:', elementCounts);

        // Log elements with class names that might contain email content
        const potentialElements = document.querySelectorAll('[class*="a3"], [class*="ii"], [class*="message"], [class*="content"]');
        console.log(`Found ${potentialElements.length} potential content elements:`,
          Array.from(potentialElements).map(el => ({
            tag: el.tagName,
            classes: el.className,
            hasText: !!el.textContent.trim()
          }))
        );
      }

      // Enhanced subject extraction - search globally for specific ID first, then in container
      let subject = '';

      // First try to find subject by specific email ID
      const specificSubjectElement = document.querySelector(`h2[data-legacy-thread-id="${emailId}"]`);
      if (specificSubjectElement) {
        subject = specificSubjectElement.textContent || '';
      }

      // If not found, search within the email container
      if (!subject.trim()) {
        const subjectSelectors = [
          '.hP',                         // Subject header
          '.bog',                        // Alternative subject
          'h2',                          // Any h2 in container
          '.a4W .bog'                    // Nested subject
        ];

        for (const selector of subjectSelectors) {
          const subjectElement = emailContainer.querySelector(selector);
          if (subjectElement) {
            subject = subjectElement.textContent || '';
            if (subject.trim()) break;
          }
        }
      }

      // Enhanced sender extraction - search within email container
      const senderSelectors = [
        '.gD[email]',                  // Sender with email attribute
        '.go span[email]',             // Alternative sender
        '.h2 .g2',                     // Header sender
        '.yW span[email]',             // List view sender
        '[email]'                      // Any element with email attribute
      ];

      let sender = '';
      for (const selector of senderSelectors) {
        const senderElement = emailContainer.querySelector(selector);
        if (senderElement) {
          sender = senderElement.getAttribute('email') || senderElement.textContent || '';
          if (sender.trim()) break;
        }
      }

      // Enhanced date extraction - search within email container
      const dateSelectors = [
        '.g3',                         // Standard date
        '.g3 span[title]',             // Date with title
        '.xW span[title]',             // Alternative date
        '.a4W .xW',                    // Nested date
        'span[title]'                  // Any span with title
      ];

      let date = '';
      for (const selector of dateSelectors) {
        const dateElement = emailContainer.querySelector(selector);
        if (dateElement) {
          date = dateElement.getAttribute('title') || dateElement.textContent || '';
          if (date.trim()) break;
        }
      }

      return {
        id: emailId,
        subject: subject.trim(),
        content: content.trim() || 'Email content could not be extracted',
        sender: sender.trim(),
        date: date.trim(),
        isOpen: true,
        debug: {
          foundSelector: foundSelector || 'none',
          contentLength: content.length,
          hasSubject: !!subject.trim(),
          hasSender: !!sender.trim(),
          hasDate: !!date.trim(),
          url: window.location.href,
          timestamp: new Date().toISOString(),
          containerType: emailContainer.tagName + '.' + emailContainer.className,
          containerHtml: emailContainer.innerHTML.substring(0, 200)
        }
      };
    }

    // If email is not open, try to find it in the list
    let emailRow = document.querySelector(`tr[data-legacy-thread-id="${emailId}"]`);

    // Gmail stores the thread ID in a span inside the tr, not on the tr itself
    if (!emailRow) {
      const spanWithId = document.querySelector(`span[data-legacy-thread-id="${emailId}"]`);
      if (spanWithId) {
        emailRow = spanWithId.closest('tr.zA') || spanWithId.closest('tr');
        console.log('Found email row via span for list extraction:', emailRow);
      }
    }

    if (!emailRow && emailId.startsWith('email-')) {
      // Try to find by index if emailId is in format "email-X"
      const index = parseInt(emailId.split('-')[1]);
      const allRows = document.querySelectorAll('tr.zA');
      if (allRows[index]) {
        emailRow = allRows[index];
      }
    }

    if (emailRow) {
      // Extract available information from the email row
      const rowSubject = emailRow.querySelector('.y6 span[id], .bog')?.textContent || '';
      const rowSender = emailRow.querySelector('.yW span, .bA4 span')?.textContent ||
                       emailRow.querySelector('[email]')?.getAttribute('email') || '';
      const rowSnippet = emailRow.querySelector('.y2')?.textContent || '';
      const rowDate = emailRow.querySelector('.xW span')?.getAttribute('title') ||
                     emailRow.querySelector('.xW')?.textContent || '';

      return {
        id: emailId,
        subject: rowSubject.trim(),
        sender: rowSender.trim(),
        snippet: rowSnippet.trim(),
        date: rowDate.trim(),
        isOpen: false,
        message: 'Email found but not open. Only basic information available.',
        hint: 'To read full content, please click on the email to open it first.'
      };
    }

    return {
      error: `Email with ID ${emailId} not found`,
      availableEmails: this.getEmailList().map(e => ({ id: e.id, subject: e.subject })),
      suggestion: 'Use list_emails to see available emails and their IDs'
    };
  }

  // Helper function to wait for element to appear
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  async composeReply(emailId, content) {
    console.log(`Attempting to reply to email ${emailId} with content:`, content);

    try {
      // First try to find the email row and click it to open
      let emailRow = document.querySelector(`tr[data-legacy-thread-id="${emailId}"]`);

      if (!emailRow && emailId.startsWith('email-')) {
        // Try to find by index
        const index = parseInt(emailId.split('-')[1]);
        const allRows = document.querySelectorAll('tr.zA');
        if (allRows[index]) {
          emailRow = allRows[index];
        }
      }

      if (emailRow) {
        emailRow.click();
        console.log('Clicked email row, waiting for email to open...');

        // Wait for email to open and reply button to appear
        const replyButtonSelectors = [
          '[data-tooltip="Reply"]',
          '[aria-label="Reply"]',
          '.ams.bkH',
          '[role="button"][aria-label*="Reply"]',
          '.T-I.J-J5-Ji.T-I-Js-Gs.aaq.T-I-ax7.L3'
        ];

        let replyButton = null;
        for (const selector of replyButtonSelectors) {
          try {
            replyButton = await this.waitForElement(selector, 3000);
            console.log(`Found reply button with selector: ${selector}`);
            break;
          } catch (error) {
            console.log(`Reply button not found with selector: ${selector}`);
          }
        }

        if (replyButton) {
          replyButton.click();
          console.log('Clicked reply button, waiting for compose box...');

          // Wait for compose box to appear
          const composeBoxSelectors = [
            '[role="textbox"][aria-label*="Message Body"]',
            '.Am.Al.editable',
            '[contenteditable="true"]',
            '.editable',
            '.ii.gt div[contenteditable="true"]'
          ];

          let composeBox = null;
          for (const selector of composeBoxSelectors) {
            try {
              composeBox = await this.waitForElement(selector, 3000);
              console.log(`Found compose box with selector: ${selector}`);
              break;
            } catch (error) {
              console.log(`Compose box not found with selector: ${selector}`);
            }
          }

          if (composeBox) {
            console.log('Found compose box, inserting content...');

            // Clear existing content and insert new content
            composeBox.innerHTML = '';
            composeBox.innerText = content;

            // Trigger events to ensure Gmail recognizes the change
            composeBox.dispatchEvent(new Event('input', { bubbles: true }));
            composeBox.dispatchEvent(new Event('change', { bubbles: true }));
            composeBox.focus();

            console.log('Reply content inserted successfully');
          } else {
            console.error('Could not find compose box after clicking reply');
          }
        } else {
          console.error('Could not find reply button');
        }
      } else {
        console.error(`Could not find email with ID ${emailId}`);

        // Fallback: try to use any visible reply button
        const fallbackReplyButton = document.querySelector('[data-tooltip="Reply"]');
        if (fallbackReplyButton) {
          console.log('Using first available reply button as fallback');
          fallbackReplyButton.click();

          try {
            const composeBox = await this.waitForElement('[role="textbox"][aria-label*="Message Body"]', 3000);
            composeBox.innerText = content;
            composeBox.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('Fallback reply successful');
          } catch (error) {
            console.error('Fallback reply failed:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error in composeReply:', error);
    }
  }

  async sendEmail(to, subject, body) {
    console.log(`Attempting to send email to: ${to}, subject: ${subject}`);

    try {
      // Enhanced compose button selectors
      const composeButtonSelectors = [
        '.T-I.T-I-KE.L3',                    // Standard compose button
        '[role="button"][aria-label*="Compose"]',
        '.z0 .T-I',                          // Alternative compose
        '.aic .T-I-KE',                      // Another variant
        '[data-tooltip="Compose"]'          // Tooltip-based selector
      ];

      let composeButton = null;
      for (const selector of composeButtonSelectors) {
        composeButton = document.querySelector(selector);
        if (composeButton) {
          console.log(`Found compose button with selector: ${selector}`);
          break;
        }
      }

      if (composeButton) {
        composeButton.click();
        console.log('Clicked compose button, waiting for compose window...');

        // Wait for compose window to appear and fill fields
        try {
          // Wait for recipient field
          const toFieldSelectors = [
            'input[name="to"]',
            '.vR input[type="text"]',
            '.aoD input',
            '[aria-label*="To"]'
          ];

          let toField = null;
          for (const selector of toFieldSelectors) {
            try {
              toField = await this.waitForElement(selector, 3000);
              console.log(`Found recipient field with selector: ${selector}`);
              break;
            } catch (error) {
              console.log(`Recipient field not found with selector: ${selector}`);
            }
          }

          if (toField) {
            toField.value = to;
            toField.dispatchEvent(new Event('input', { bubbles: true }));
            toField.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('Recipient field filled');
          }

          // Wait for subject field
          const subjectFieldSelectors = [
            'input[name="subjectbox"]',
            '.aoT input',
            '[aria-label*="Subject"]',
            '.aYF input'
          ];

          let subjectField = null;
          for (const selector of subjectFieldSelectors) {
            try {
              subjectField = await this.waitForElement(selector, 2000);
              console.log(`Found subject field with selector: ${selector}`);
              break;
            } catch (error) {
              console.log(`Subject field not found with selector: ${selector}`);
            }
          }

          if (subjectField) {
            subjectField.value = subject;
            subjectField.dispatchEvent(new Event('input', { bubbles: true }));
            subjectField.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('Subject field filled');
          }

          // Wait for body field
          const bodyFieldSelectors = [
            '[role="textbox"][aria-label*="Message Body"]',
            '.Am.Al.editable',
            '[contenteditable="true"]',
            '.editable',
            '.ii.gt div[contenteditable="true"]'
          ];

          let bodyField = null;
          for (const selector of bodyFieldSelectors) {
            try {
              bodyField = await this.waitForElement(selector, 2000);
              console.log(`Found body field with selector: ${selector}`);
              break;
            } catch (error) {
              console.log(`Body field not found with selector: ${selector}`);
            }
          }

          if (bodyField) {
            bodyField.innerHTML = '';
            bodyField.innerText = body;
            bodyField.dispatchEvent(new Event('input', { bubbles: true }));
            bodyField.dispatchEvent(new Event('change', { bubbles: true }));
            bodyField.focus();
            console.log('Body field filled');
          }

          console.log('Email compose window filled successfully');

        } catch (error) {
          console.error('Error filling compose fields:', error);
        }
      } else {
        console.error('Could not find compose button');
      }
    } catch (error) {
      console.error('Error in sendEmail:', error);
    }
  }

  debugPageState() {
    console.log('=== Gmail Page Debug Information ===');

    const debugInfo = {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      gmailLoaded: this.isGmailLoaded(),
      emailElements: {},
      contentElements: {},
      openEmails: []
    };

    // Check for email list elements
    const emailSelectors = [
      'tr.zA',
      '[role="row"][tabindex="-1"]',
      'tr[jsaction*="click"]',
      '.zA.yO',
      '[data-legacy-thread-id]'
    ];

    emailSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      debugInfo.emailElements[selector] = elements.length;
    });

    // Check for content elements
    const contentSelectors = [
      '.a3s.aiL',
      '.ii.gt .a3s',
      '.ii.gt div[dir="ltr"]',
      '.ii.gt',
      '.adn.ads .ii.gt',
      '.message .ii.gt',
      '[data-message-id] .a3s',
      '.Am .a3s',
      '.gs .a3s'
    ];

    contentSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      debugInfo.contentElements[selector] = {
        count: elements.length,
        hasText: elements.length > 0 ? !!elements[0].textContent.trim() : false
      };
    });

    // Check for open emails
    const openEmailElements = document.querySelectorAll('[data-legacy-thread-id]');
    openEmailElements.forEach((element, index) => {
      const threadId = element.getAttribute('data-legacy-thread-id');
      if (threadId) {
        debugInfo.openEmails.push({
          index,
          threadId,
          tagName: element.tagName,
          hasText: !!element.textContent.trim(),
          textPreview: element.textContent.trim().substring(0, 100)
        });
      }
    });

    // Check current view
    debugInfo.currentView = {
      isInbox: window.location.href.includes('#inbox'),
      isEmail: window.location.href.includes('#inbox/') && window.location.href.split('/').length > 2,
      hasMainRole: !!document.querySelector('[role="main"]'),
      hasEmailContent: !!document.querySelector('.ii.gt'),
      hasEmailList: !!document.querySelector('tr.zA')
    };

    console.log('Debug info:', debugInfo);
    return debugInfo;
  }

  async searchEmails(query, options = {}) {
    console.log(`Searching emails with query: "${query}"`, options);

    try {
      // Check if Gmail is loaded
      if (!this.isGmailLoaded()) {
        return {
          success: false,
          error: 'Gmail is not loaded',
          suggestion: 'Please open Gmail and wait for it to load completely'
        };
      }

      // If we're not in the inbox, navigate to it first
      if (!window.location.href.includes('#inbox')) {
        console.log('Navigating to inbox for search...');
        window.location.href = 'https://mail.google.com/mail/u/0/#inbox';
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Find and use Gmail's search box
      console.log('Attempting to perform Gmail search...');
      const searchResult = await this.performGmailSearch(query);

      if (searchResult.success) {
        console.log('Search submitted successfully, waiting for results...');
        // Wait for search results to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get the search results
        console.log('Retrieving search results...');
        const searchResults = this.getEmailList();
        console.log(`Found ${searchResults.length} search results`);

        // Apply additional filtering if specified
        const filteredResults = this.applySearchFilters(searchResults, options);
        console.log(`After filtering: ${filteredResults.length} results`);

        return {
          success: true,
          query: query,
          totalResults: filteredResults.length,
          emails: filteredResults,
          searchUrl: window.location.href,
          debug: {
            originalResults: searchResults.length,
            filteredResults: filteredResults.length,
            appliedFilters: Object.keys(options).length > 0 ? options : 'none'
          }
        };
      } else {
        console.error('Search failed:', searchResult.error);
        return {
          success: false,
          error: searchResult.error,
          suggestion: 'Make sure Gmail is loaded and try again',
          debug: {
            currentUrl: window.location.href,
            gmailLoaded: this.isGmailLoaded()
          }
        };
      }
    } catch (error) {
      console.error('Error in searchEmails:', error);
      return {
        success: false,
        error: error.message,
        suggestion: 'Please ensure Gmail is open and loaded',
        debug: {
          currentUrl: window.location.href,
          gmailLoaded: this.isGmailLoaded(),
          errorStack: error.stack
        }
      };
    }
  }

  async performGmailSearch(query) {
    console.log(`Performing Gmail search for: "${query}"`);

    try {
      // Find Gmail's search box
      const searchBoxSelectors = [
        'input[aria-label="Search mail"]',
        'input[placeholder*="Search"]',
        '.gb_Xe input',
        '.aZ6 input',
        'input[name="q"]',
        '.gb_Xe'
      ];

      let searchBox = null;
      for (const selector of searchBoxSelectors) {
        searchBox = document.querySelector(selector);
        if (searchBox) {
          console.log(`Found search box with selector: ${selector}`);
          break;
        }
      }

      if (!searchBox) {
        // Try to find and click the search button first
        const searchButtonSelectors = [
          '[aria-label="Search mail"]',
          '.gb_Xe',
          '.aZ6',
          '[data-tooltip="Search mail"]'
        ];

        let searchButton = null;
        for (const selector of searchButtonSelectors) {
          searchButton = document.querySelector(selector);
          if (searchButton) {
            console.log(`Found search button with selector: ${selector}`);
            searchButton.click();
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Try to find search box again
            searchBox = document.querySelector('input[aria-label="Search mail"]') ||
                       document.querySelector('input[placeholder*="Search"]');
            break;
          }
        }
      }

      if (searchBox) {
        // Clear existing search
        searchBox.value = '';
        searchBox.focus();

        // Enter search query
        searchBox.value = query;

        // Trigger input events
        searchBox.dispatchEvent(new Event('input', { bubbles: true }));
        searchBox.dispatchEvent(new Event('change', { bubbles: true }));

        // Press Enter to search
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true
        });
        searchBox.dispatchEvent(enterEvent);

        console.log('Search query submitted successfully');
        return { success: true };
      } else {
        return {
          success: false,
          error: 'Could not find Gmail search box'
        };
      }
    } catch (error) {
      console.error('Error performing Gmail search:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  applySearchFilters(emails, options) {
    let filteredEmails = [...emails];

    // Filter by sender
    if (options.from) {
      filteredEmails = filteredEmails.filter(email =>
        email.sender.toLowerCase().includes(options.from.toLowerCase())
      );
    }

    // Filter by subject
    if (options.subject) {
      filteredEmails = filteredEmails.filter(email =>
        email.subject.toLowerCase().includes(options.subject.toLowerCase())
      );
    }

    // Filter by unread status
    if (options.unread !== undefined) {
      filteredEmails = filteredEmails.filter(email =>
        email.isUnread === options.unread
      );
    }

    // Filter by date range
    if (options.dateFrom || options.dateTo) {
      filteredEmails = filteredEmails.filter(email => {
        const emailDate = new Date(email.date);
        if (options.dateFrom && emailDate < new Date(options.dateFrom)) {
          return false;
        }
        if (options.dateTo && emailDate > new Date(options.dateTo)) {
          return false;
        }
        return true;
      });
    }

    // Limit results
    if (options.limit && options.limit > 0) {
      filteredEmails = filteredEmails.slice(0, options.limit);
    }

    return filteredEmails;
  }
}

console.log('Creating GmailInterface instance...');
const gmailInterface = new GmailInterface();
console.log('GmailInterface instance created:', !!gmailInterface);

// Make it globally accessible for debugging
window.gmailInterface = gmailInterface;
console.log('window.gmailInterface set:', !!window.gmailInterface);

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    gmailInterface.init();
    console.log('Gmail MCP Bridge content script initialized (DOMContentLoaded)');
  });
} else {
  gmailInterface.init();
  console.log('Gmail MCP Bridge content script initialized (immediate)');
}

// Send ready signal to background script
chrome.runtime.sendMessage({ action: 'contentScriptReady' }, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Failed to send ready signal:', chrome.runtime.lastError.message);
  } else {
    console.log('Content script ready signal sent successfully');
  }
});