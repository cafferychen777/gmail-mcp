// Simple content script for testing
console.log('=== Simple Content Script Loading ===');
console.log('URL:', window.location.href);
console.log('Chrome runtime available:', typeof chrome !== 'undefined' && !!chrome.runtime);

// Simple test class
class SimpleGmailInterface {
  constructor() {
    console.log('SimpleGmailInterface constructor called');
  }

  async getEmailContent(emailId) {
    console.log('getEmailContent called with ID:', emailId);
    
    // Find the email span
    const spanWithId = document.querySelector(`span[data-legacy-thread-id="${emailId}"]`);
    if (!spanWithId) {
      return { error: 'Email span not found' };
    }
    
    // Find the parent row
    const emailRow = spanWithId.closest('tr.zA') || spanWithId.closest('tr');
    if (!emailRow) {
      return { error: 'Email row not found' };
    }
    
    console.log('Found email row, clicking...');
    emailRow.click();
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Find email content
    const contentContainers = document.querySelectorAll('.ii.gt');
    console.log('Found content containers:', contentContainers.length);
    
    if (contentContainers.length > 0) {
      const content = contentContainers[0].querySelector('.a3s');
      const subjectElement = contentContainers[0].querySelector('.hP') || 
                            contentContainers[0].querySelector('h2') ||
                            spanWithId;
      
      return {
        id: emailId,
        subject: subjectElement ? subjectElement.textContent.trim() : 'Unknown',
        content: content ? content.innerText.trim() : 'Content not found',
        sender: 'Unknown',
        date: 'Unknown',
        isOpen: true
      };
    }
    
    return { error: 'Email content not found after opening' };
  }
}

// Create and set global instance
console.log('Creating SimpleGmailInterface instance...');
try {
  const simpleInterface = new SimpleGmailInterface();
  window.simpleGmailInterface = simpleInterface;
  console.log('window.simpleGmailInterface set:', !!window.simpleGmailInterface);
} catch (error) {
  console.error('Error creating SimpleGmailInterface:', error);
}

console.log('=== Simple Content Script Loaded ===');
