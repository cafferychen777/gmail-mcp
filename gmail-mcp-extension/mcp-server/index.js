import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

class GmailMCPServer {
  constructor() {
    this.server = new Server(
      { 
        name: 'gmail-mcp', 
        version: '1.0.0' 
      },
      { 
        capabilities: { 
          tools: {} 
        } 
      }
    );
    
    this.setupTools();
  }

  setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_emails',
          description: 'List emails in Gmail inbox',
          inputSchema: {
            type: 'object',
            properties: {
              accountEmail: { 
                type: 'string', 
                description: 'Optional: specific Gmail account to use (email address)' 
              }
            }
          }
        },
        {
          name: 'read_email',
          description: 'Read a specific email content',
          inputSchema: {
            type: 'object',
            properties: {
              emailId: { type: 'string', description: 'Email ID to read' }
            },
            required: ['emailId']
          }
        },
        {
          name: 'reply_email',
          description: 'Reply to an email. IMPORTANT: This will immediately send the email. Always ask user for confirmation before using this tool. Consider using draft_reply first to show the user what will be sent.',
          inputSchema: {
            type: 'object',
            properties: {
              emailId: { type: 'string', description: 'Email ID to reply to' },
              content: { type: 'string', description: 'Reply content' },
              confirmed: { type: 'boolean', description: 'User confirmation that email should be sent', default: false }
            },
            required: ['emailId', 'content', 'confirmed']
          }
        },
        {
          name: 'send_email',
          description: 'Send a new email. IMPORTANT: This will immediately send the email. Always ask user for confirmation before using this tool. Consider using draft_email first to show the user what will be sent.',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Recipient email' },
              subject: { type: 'string', description: 'Email subject' },
              body: { type: 'string', description: 'Email body' },
              accountEmail: { 
                type: 'string', 
                description: 'Optional: specific Gmail account to use (email address)' 
              },
              confirmed: { type: 'boolean', description: 'User confirmation that email should be sent', default: false }
            },
            required: ['to', 'subject', 'body', 'confirmed']
          }
        },
        {
          name: 'search_emails',
          description: 'Search emails in Gmail using query and filters',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (supports Gmail search syntax like "from:sender@example.com", "subject:keyword", "has:attachment", "is:unread")'
              },
              options: {
                type: 'object',
                description: 'Additional search filters',
                properties: {
                  from: { type: 'string', description: 'Filter by sender email or name' },
                  subject: { type: 'string', description: 'Filter by subject keywords' },
                  unread: { type: 'boolean', description: 'Filter by unread status' },
                  dateFrom: { type: 'string', description: 'Filter emails from this date (YYYY-MM-DD)' },
                  dateTo: { type: 'string', description: 'Filter emails to this date (YYYY-MM-DD)' },
                  limit: { type: 'integer', description: 'Maximum number of results to return' },
                  returnToOriginalView: { type: 'boolean', description: 'Return to original view after search (default: false)' }
                }
              }
            },
            required: ['query']
          }
        },
        {
          name: 'mark_emails_read',
          description: 'Mark email(s) as read or unread',
          inputSchema: {
            type: 'object',
            properties: {
              emailIds: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Array of email IDs to mark' 
              },
              markAsRead: { 
                type: 'boolean', 
                description: 'true to mark as read, false to mark as unread' 
              }
            },
            required: ['emailIds', 'markAsRead']
          }
        },
        {
          name: 'delete_emails',
          description: 'Delete email(s)',
          inputSchema: {
            type: 'object',
            properties: {
              emailIds: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Array of email IDs to delete' 
              },
              permanent: {
                type: 'boolean',
                description: 'true for permanent delete, false for move to trash',
                default: false
              }
            },
            required: ['emailIds']
          }
        },
        {
          name: 'archive_emails',
          description: 'Archive email(s)',
          inputSchema: {
            type: 'object',
            properties: {
              emailIds: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Array of email IDs to archive' 
              }
            },
            required: ['emailIds']
          }
        },
        {
          name: 'get_email_attachments',
          description: 'Get list of attachments in an email',
          inputSchema: {
            type: 'object',
            properties: {
              emailId: { type: 'string', description: 'Email ID to check for attachments' }
            },
            required: ['emailId']
          }
        },
        {
          name: 'download_attachment',
          description: 'Download an email attachment',
          inputSchema: {
            type: 'object',
            properties: {
              emailId: { type: 'string', description: 'Email ID containing the attachment' },
              attachmentId: { type: 'string', description: 'Attachment ID or filename' }
            },
            required: ['emailId', 'attachmentId']
          }
        },
        {
          name: 'list_gmail_accounts',
          description: 'List all available Gmail accounts',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'set_active_gmail_account',
          description: 'Set the active Gmail account for operations',
          inputSchema: {
            type: 'object',
            properties: {
              accountEmail: { 
                type: 'string', 
                description: 'Email address of the account to activate' 
              }
            },
            required: ['accountEmail']
          }
        },
        {
          name: 'get_active_gmail_account',
          description: 'Get the currently active Gmail account',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'draft_reply',
          description: 'Create a draft reply to show user before sending. This is safe to use without confirmation.',
          inputSchema: {
            type: 'object',
            properties: {
              emailId: { type: 'string', description: 'Email ID to reply to' },
              content: { type: 'string', description: 'Reply content' },
              accountEmail: { 
                type: 'string', 
                description: 'Optional: specific Gmail account to use (email address)' 
              }
            },
            required: ['emailId', 'content']
          }
        },
        {
          name: 'draft_email',
          description: 'Create a draft email to show user before sending. This is safe to use without confirmation.',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Recipient email' },
              subject: { type: 'string', description: 'Email subject' },
              body: { type: 'string', description: 'Email body' },
              accountEmail: { 
                type: 'string', 
                description: 'Optional: specific Gmail account to use (email address)' 
              }
            },
            required: ['to', 'subject', 'body']
          }
        },
        // ========== P0核心功能：Gmail标签系统 ==========
        {
          name: 'gmail_list_labels',
          description: 'List all Gmail labels (system and custom labels)',
          inputSchema: {
            type: 'object',
            properties: {
              accountEmail: { 
                type: 'string', 
                description: 'Optional: specific Gmail account to use (email address)' 
              }
            }
          }
        },
        {
          name: 'gmail_add_labels',
          description: 'Add labels to emails',
          inputSchema: {
            type: 'object',
            properties: {
              emailIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of email IDs to add labels to'
              },
              labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of label names to add'
              },
              accountEmail: { 
                type: 'string', 
                description: 'Optional: specific Gmail account to use (email address)' 
              }
            },
            required: ['emailIds', 'labels']
          }
        },
        {
          name: 'gmail_remove_labels',
          description: 'Remove labels from emails',
          inputSchema: {
            type: 'object',
            properties: {
              emailIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of email IDs to remove labels from'
              },
              labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of label names to remove'
              },
              accountEmail: { 
                type: 'string', 
                description: 'Optional: specific Gmail account to use (email address)' 
              }
            },
            required: ['emailIds', 'labels']
          }
        },
        {
          name: 'gmail_search_by_label',
          description: 'Search emails by label',
          inputSchema: {
            type: 'object',
            properties: {
              labelName: {
                type: 'string',
                description: 'Name of the label to search by'
              },
              limit: {
                type: 'integer',
                description: 'Maximum number of emails to return',
                default: 50
              },
              accountEmail: { 
                type: 'string', 
                description: 'Optional: specific Gmail account to use (email address)' 
              }
            },
            required: ['labelName']
          }
        },
        {
          name: 'gmail_create_label',
          description: 'Create a new Gmail label (if supported by Gmail interface)',
          inputSchema: {
            type: 'object',
            properties: {
              labelName: {
                type: 'string',
                description: 'Name of the new label to create'
              },
              parentLabel: {
                type: 'string',
                description: 'Optional: parent label name for nested labels'
              },
              accountEmail: { 
                type: 'string', 
                description: 'Optional: specific Gmail account to use (email address)' 
              }
            },
            required: ['labelName']
          }
        },
        // ========== P0核心功能：邮件转发 ==========
        {
          name: 'gmail_forward_email',
          description: 'Forward an email to recipients. IMPORTANT: This will immediately send the email. Always ask user for confirmation before using this tool.',
          inputSchema: {
            type: 'object',
            properties: {
              emailId: {
                type: 'string',
                description: 'Email ID to forward'
              },
              recipients: {
                oneOf: [
                  { type: 'string', description: 'Single recipient email address' },
                  { type: 'array', items: { type: 'string' }, description: 'Array of recipient email addresses' }
                ],
                description: 'Recipient email address(es)'
              },
              message: {
                type: 'string',
                description: 'Optional message to add before the forwarded content',
                default: ''
              },
              includeAttachments: {
                type: 'boolean',
                description: 'Whether to include attachments in the forward',
                default: true
              },
              confirmed: {
                type: 'boolean',
                description: 'User confirmation that email should be forwarded and sent',
                default: false
              },
              accountEmail: { 
                type: 'string', 
                description: 'Optional: specific Gmail account to use (email address)' 
              }
            },
            required: ['emailId', 'recipients', 'confirmed']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Call bridge server
        const bridgeUrl = 'http://localhost:3456';
        
        switch (name) {
          case 'list_emails':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'getEmails',
                  params: { accountEmail: args.accountEmail }
                })
              });
              
              const result = await response.json();
              
              if (result.success && result.data?.emails) {
                return { 
                  content: [{ 
                    type: 'text', 
                    text: JSON.stringify(result.data.emails, null, 2)
                  }] 
                };
              } else {
                return { 
                  content: [{ 
                    type: 'text', 
                    text: JSON.stringify({
                      error: result.error || 'Failed to get emails',
                      message: "Please ensure Chrome extension is connected and Gmail is open"
                    }, null, 2)
                  }] 
                };
              }
            } catch (error) {
              return { 
                content: [{ 
                  type: 'text', 
                  text: JSON.stringify({
                    error: error.message,
                    message: "Bridge server not available. Please run: node bridge-server.js"
                  }, null, 2)
                }] 
              };
            }

          case 'read_email':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'getEmailContent',
                  params: {
                    emailId: args.emailId,
                    accountEmail: args.accountEmail
                  }
                })
              });
              
              const result = await response.json();
              
              if (result.success && result.data) {
                return { 
                  content: [{ 
                    type: 'text', 
                    text: JSON.stringify(result.data, null, 2)
                  }] 
                };
              } else {
                return { 
                  content: [{ 
                    type: 'text', 
                    text: `Error: ${result.error || 'Failed to read email'}`
                  }] 
                };
              }
            } catch (error) {
              return { 
                content: [{ 
                  type: 'text', 
                  text: `Error: ${error.message}`
                }] 
              };
            }

          case 'reply_email':
            // Check for confirmation
            if (!args.confirmed) {
              return {
                content: [{
                  type: 'text',
                  text: 'Email reply requires user confirmation. Please confirm you want to send this reply:\n\n' +
                        `To: [Reply to email ${args.emailId}]\n` +
                        `Content: ${args.content}\n\n` +
                        'If you want to proceed, please ask me to send with confirmation.'
                }]
              };
            }
            
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'replyEmail',
                  params: {
                    emailId: args.emailId,
                    content: args.content,
                    accountEmail: args.accountEmail
                  }
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                // Use the sent status returned by Chrome extension
                if (result.data?.sent) {
                  return { 
                    content: [{ 
                      type: 'text', 
                      text: result.data.message || 'Reply sent successfully!'
                    }] 
                  };
                } else {
                  return { 
                    content: [{ 
                      type: 'text', 
                      text: result.data?.message || 'Reply saved as draft. Please manually send in Gmail.'
                    }] 
                  };
                }
              } else {
                return { 
                  content: [{ 
                    type: 'text', 
                    text: `Error: ${result.error || 'Failed to send reply'}`
                  }] 
                };
              }
            } catch (error) {
              return { 
                content: [{ 
                  type: 'text', 
                  text: `Error: ${error.message}`
                }] 
              };
            }

          case 'send_email':
            // Check for confirmation
            if (!args.confirmed) {
              return {
                content: [{
                  type: 'text',
                  text: 'Email sending requires user confirmation. Please confirm you want to send this email:\n\n' +
                        `To: ${args.to}\n` +
                        `Subject: ${args.subject}\n` +
                        `Body: ${args.body}\n\n` +
                        'If you want to proceed, please ask me to send with confirmation.'
                }]
              };
            }
            
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'sendEmail',
                  params: {
                    to: args.to,
                    subject: args.subject,
                    body: args.body,
                    accountEmail: args.accountEmail
                  }
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                // Use the sent status returned by Chrome extension
                if (result.data?.sent) {
                  return { 
                    content: [{ 
                      type: 'text', 
                      text: result.data.message || 'Email sent successfully!'
                    }] 
                  };
                } else {
                  return { 
                    content: [{ 
                      type: 'text', 
                      text: result.data?.message || 'Email saved as draft. Please manually send in Gmail.'
                    }] 
                  };
                }
              } else {
                return { 
                  content: [{ 
                    type: 'text', 
                    text: `Error: ${result.error || 'Failed to send email'}`
                  }] 
                };
              }
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: `Error: ${error.message}`
                }]
              };
            }

          case 'search_emails':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'searchEmails',
                  params: {
                    query: args.query,
                    options: args.options || {},
                    accountEmail: args.accountEmail
                  }
                })
              });

              const result = await response.json();

              if (result.success && result.data) {
                const searchData = result.data;
                const emails = searchData.results || searchData.emails || [];
                return {
                  content: [{
                    type: 'text',
                    text: `Search Results for "${searchData.query}":

Found ${searchData.count || emails.length} emails:

${emails.map((email, index) =>
  `${index + 1}. From: ${email.sender}
   Subject: ${email.subject}
   Date: ${email.date}
   ID: ${email.id}
   ${email.isUnread ? '📧 UNREAD' : '📖 Read'}
`).join('\n')}

Search URL: ${searchData.url || 'https://mail.google.com'}`
                  }]
                };
              } else {
                return {
                  content: [{
                    type: 'text',
                    text: `Search failed: ${result.error || 'Unknown error'}`
                  }]
                };
              }
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: `Error: ${error.message}`
                }]
              };
            }

          case 'mark_emails_read':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'markEmailsRead',
                  params: {
                    emailIds: args.emailIds,
                    markAsRead: args.markAsRead
                  }
                })
              });

              const result = await response.json();

              if (result.success && result.data) {
                const { results, totalProcessed } = result.data;
                const successCount = results.filter(r => r.success).length;
                
                return {
                  content: [{
                    type: 'text',
                    text: `Marked ${successCount}/${totalProcessed} emails as ${args.markAsRead ? 'read' : 'unread'}

${results.map(r => 
  `${r.emailId}: ${r.success ? '✓' : '✗'} ${r.error || r.message || ''}`
).join('\n')}`
                  }]
                };
              } else {
                return {
                  content: [{
                    type: 'text',
                    text: `Error: ${result.error || 'Failed to mark emails'}`
                  }]
                };
              }
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: `Error: ${error.message}`
                }]
              };
            }

          case 'delete_emails':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'deleteEmails',
                  params: {
                    emailIds: args.emailIds,
                    permanent: args.permanent || false
                  }
                })
              });

              const result = await response.json();

              if (result.success && result.data) {
                const { results, totalProcessed, action } = result.data;
                const successCount = results.filter(r => r.success).length;
                
                return {
                  content: [{
                    type: 'text',
                    text: `${action === 'permanently_deleted' ? 'Permanently deleted' : 'Moved to trash'} ${successCount}/${totalProcessed} emails

${results.map(r => 
  `${r.emailId}: ${r.success ? '✓' : '✗'} ${r.error || ''}`
).join('\n')}`
                  }]
                };
              } else {
                return {
                  content: [{
                    type: 'text',
                    text: `Error: ${result.error || 'Failed to delete emails'}`
                  }]
                };
              }
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: `Error: ${error.message}`
                }]
              };
            }

          case 'archive_emails':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'archiveEmails',
                  params: {
                    emailIds: args.emailIds
                  }
                })
              });

              const result = await response.json();

              if (result.success && result.data) {
                const { results, totalProcessed } = result.data;
                const successCount = results.filter(r => r.success).length;
                
                return {
                  content: [{
                    type: 'text',
                    text: `Archived ${successCount}/${totalProcessed} emails

${results.map(r => 
  `${r.emailId}: ${r.success ? '✓' : '✗'} ${r.error || ''}`
).join('\n')}`
                  }]
                };
              } else {
                return {
                  content: [{
                    type: 'text',
                    text: `Error: ${result.error || 'Failed to archive emails'}`
                  }]
                };
              }
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: `Error: ${error.message}`
                }]
              };
            }

          case 'get_email_attachments':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'getEmailAttachments',
                  params: {
                    emailId: args.emailId
                  }
                })
              });

              const result = await response.json();

              if (result.success && result.data) {
                const { emailId, attachments, totalAttachments, hasAttachments } = result.data;
                
                if (!hasAttachments) {
                  return {
                    content: [{
                      type: 'text',
                      text: `No attachments found in email ${emailId}`
                    }]
                  };
                }
                
                return {
                  content: [{
                    type: 'text',
                    text: `Found ${totalAttachments} attachment(s) in email ${emailId}:

${attachments.map((att, index) => 
  `${index + 1}. ${att.filename}
   Type: ${att.type}
   Size: ${att.size}
   ID: ${att.id}
   Downloadable: ${att.canDownload ? 'Yes' : 'No'}`
).join('\n\n')}`
                  }]
                };
              } else {
                return {
                  content: [{
                    type: 'text',
                    text: `Error: ${result.error || 'Failed to get attachments'}`
                  }]
                };
              }
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: `Error: ${error.message}`
                }]
              };
            }

          case 'download_attachment':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'downloadAttachment',
                  params: {
                    emailId: args.emailId,
                    attachmentId: args.attachmentId
                  }
                })
              });

              const result = await response.json();

              if (result.success && result.data) {
                return {
                  content: [{
                    type: 'text',
                    text: `Attachment download initiated:
Filename: ${result.data.filename}
Size: ${result.data.size}
Status: ${result.data.message}`
                  }]
                };
              } else {
                return {
                  content: [{
                    type: 'text',
                    text: `Error: ${result.error || result.data?.error || 'Failed to download attachment'}`
                  }]
                };
              }
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: `Error: ${error.message}`
                }]
              };
            }

          case 'list_gmail_accounts':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  action: 'getAccounts',
                  params: {} 
                })
              });
              
              const result = await response.json();
              
              if (result.success && result.data) {
                const accounts = result.data.accounts || [];
                const activeAccount = result.data.activeAccount;
                
                return { 
                  content: [{ 
                    type: 'text', 
                    text: `Available Gmail Accounts:

${accounts.map((account, index) => 
  `${index + 1}. ${account.email} ${account.isActive ? '(Active)' : ''}
     Tab ID: ${account.tabId}
     Registered: ${new Date(account.registeredAt).toLocaleString()}
     Last Active: ${new Date(account.lastActive).toLocaleString()}`
).join('\n\n')}

${activeAccount ? `\nCurrently Active: ${activeAccount.account.email}` : '\nNo active account set'}`
                  }] 
                };
              } else {
                return { 
                  content: [{ 
                    type: 'text', 
                    text: 'No Gmail accounts found. Please ensure Gmail tabs are open and the extension is connected.' 
                  }] 
                };
              }
            } catch (error) {
              return { 
                content: [{ 
                  type: 'text', 
                  text: `Error retrieving accounts: ${error.message}` 
                }] 
              };
            }

          case 'set_active_gmail_account':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  action: 'setActiveAccount',
                  params: { accountEmail: args.accountEmail } 
                })
              });
              
              const result = await response.json();
              
              if (result.success && result.data?.success) {
                return { 
                  content: [{ 
                    type: 'text', 
                    text: `Successfully switched to account: ${args.accountEmail}` 
                  }] 
                };
              } else {
                return { 
                  content: [{ 
                    type: 'text', 
                    text: `Failed to switch account: ${result.error || result.data?.error || 'Unknown error'}` 
                  }] 
                };
              }
            } catch (error) {
              return { 
                content: [{ 
                  type: 'text', 
                  text: `Error switching account: ${error.message}` 
                }] 
              };
            }

          case 'get_active_gmail_account':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'getActiveAccount',
                  params: {}
                })
              });
              
              const result = await response.json();

              if (result.success && result.data?.success && result.data?.activeAccount) {
                const activeAccount = result.data.activeAccount;
                return {
                  content: [{
                    type: 'text',
                    text: `Active Gmail Account:
Email: ${activeAccount.account.email}
Tab ID: ${activeAccount.tabId}
Last Active: ${new Date(activeAccount.account.lastActive).toLocaleString()}
Total Accounts: ${result.data.totalAccounts || 'Unknown'}`
                  }]
                };
              } else {
                return {
                  content: [{
                    type: 'text',
                    text: 'No active Gmail account set. Use set_active_gmail_account to activate one.'
                  }]
                };
              }
            } catch (error) {
              return { 
                content: [{ 
                  type: 'text', 
                  text: `Error retrieving active account: ${error.message}` 
                }] 
              };
            }

          case 'draft_reply':
            return {
              content: [{
                type: 'text',
                text: `📝 DRAFT REPLY PREVIEW\n\n` +
                      `Email ID: ${args.emailId}\n` +
                      `Content: ${args.content}\n\n` +
                      `This is just a preview. To actually send this reply, please confirm you want me to proceed with sending it.`
              }]
            };

          case 'draft_email':
            return {
              content: [{
                type: 'text',
                text: `📧 DRAFT EMAIL PREVIEW\n\n` +
                      `To: ${args.to}\n` +
                      `Subject: ${args.subject}\n` +
                      `Body: ${args.body}\n\n` +
                      `This is just a preview. To actually send this email, please confirm you want me to proceed with sending it.`
              }]
            };

          // ========== P0核心功能：Gmail标签系统处理 ==========
          case 'gmail_list_labels':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'listLabels',
                  params: { accountEmail: args.accountEmail }
                })
              });

              const result = await response.json();

              if (result.success && result.data) {
                const { labels, currentView, timestamp } = result.data;
                const totalLabels = labels.total;
                const systemCount = labels.system.length;
                const customCount = labels.custom.length;

                let output = `📋 Gmail Labels (${totalLabels} total)\n\n`;
                
                if (systemCount > 0) {
                  output += `🔧 System Labels (${systemCount}):\n`;
                  labels.system.forEach(label => {
                    const unreadBadge = label.unreadCount > 0 ? ` (${label.unreadCount})` : '';
                    output += `  • ${label.displayName}${unreadBadge}\n`;
                  });
                  output += '\n';
                }
                
                if (customCount > 0) {
                  output += `🏷️ Custom Labels (${customCount}):\n`;
                  labels.custom.forEach(label => {
                    const unreadBadge = label.unreadCount > 0 ? ` (${label.unreadCount})` : '';
                    output += `  • ${label.displayName}${unreadBadge}\n`;
                  });
                } else {
                  output += `🏷️ Custom Labels (0): No custom labels found\n`;
                }
                
                output += `\nCurrent view: ${currentView}\nUpdated: ${new Date(timestamp).toLocaleString()}`;

                return {
                  content: [{
                    type: 'text',
                    text: output
                  }]
                };
              } else {
                return {
                  content: [{
                    type: 'text',
                    text: `Error: ${result.error || 'Failed to list labels'}`
                  }]
                };
              }
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: `Error: ${error.message}`
                }]
              };
            }

          case 'gmail_add_labels':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'addLabelsToEmails',
                  params: {
                    emailIds: args.emailIds,
                    labels: args.labels,
                    accountEmail: args.accountEmail
                  }
                })
              });

              const result = await response.json();

              if (result.success && result.data) {
                const { results, totalProcessed, successCount, labels } = result.data;
                
                let output = `✅ Added labels [${labels.join(', ')}] to ${successCount}/${totalProcessed} emails\n\n`;
                
                results.forEach(r => {
                  const status = r.success ? '✅' : '❌';
                  const message = r.error || r.message || '';
                  output += `${status} ${r.emailId}: ${message}\n`;
                });

                return {
                  content: [{
                    type: 'text',
                    text: output
                  }]
                };
              } else {
                return {
                  content: [{
                    type: 'text',
                    text: `Error: ${result.error || 'Failed to add labels'}`
                  }]
                };
              }
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: `Error: ${error.message}`
                }]
              };
            }

          case 'gmail_remove_labels':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'removeLabelsFromEmails',
                  params: {
                    emailIds: args.emailIds,
                    labels: args.labels,
                    accountEmail: args.accountEmail
                  }
                })
              });

              const result = await response.json();

              if (result.success && result.data) {
                const { results, totalProcessed, successCount, labels } = result.data;
                
                let output = `🗑️ Removed labels [${labels.join(', ')}] from ${successCount}/${totalProcessed} emails\n\n`;
                
                results.forEach(r => {
                  const status = r.success ? '✅' : '❌';
                  const message = r.error || r.message || '';
                  output += `${status} ${r.emailId}: ${message}\n`;
                });

                return {
                  content: [{
                    type: 'text',
                    text: output
                  }]
                };
              } else {
                return {
                  content: [{
                    type: 'text',
                    text: `Error: ${result.error || 'Failed to remove labels'}`
                  }]
                };
              }
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: `Error: ${error.message}`
                }]
              };
            }

          case 'gmail_search_by_label':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'searchByLabel',
                  params: {
                    labelName: args.labelName,
                    limit: args.limit || 50,
                    accountEmail: args.accountEmail
                  }
                })
              });

              const result = await response.json();

              if (result.success && result.data) {
                const { label, emails, count, searchQuery, url } = result.data;
                
                let output = `🔍 Search Results for Label "${label}" (${count} emails found)\n\n`;
                
                if (count > 0) {
                  emails.forEach((email, index) => {
                    const unreadBadge = email.isUnread ? '📧 UNREAD' : '📖 Read';
                    output += `${index + 1}. From: ${email.sender}\n`;
                    output += `   Subject: ${email.subject}\n`;
                    output += `   Date: ${email.date}\n`;
                    output += `   ID: ${email.id}\n`;
                    output += `   Status: ${unreadBadge}\n\n`;
                  });
                } else {
                  output += `No emails found with label "${label}"\n`;
                }
                
                output += `Search query: ${searchQuery}\nURL: ${url}`;

                return {
                  content: [{
                    type: 'text',
                    text: output
                  }]
                };
              } else {
                return {
                  content: [{
                    type: 'text',
                    text: `Error: ${result.error || 'Failed to search by label'}`
                  }]
                };
              }
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: `Error: ${error.message}`
                }]
              };
            }

          case 'gmail_create_label':
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'createLabel',
                  params: {
                    labelName: args.labelName,
                    parentLabel: args.parentLabel,
                    accountEmail: args.accountEmail
                  }
                })
              });

              const result = await response.json();

              if (result.success && result.data?.success) {
                return {
                  content: [{
                    type: 'text',
                    text: `✅ Successfully created label "${args.labelName}"${args.parentLabel ? ` under "${args.parentLabel}"` : ''}`
                  }]
                };
              } else {
                const errorMsg = result.data?.error || result.error || 'Failed to create label';
                const suggestion = result.data?.suggestion || 'Please create labels manually in Gmail settings';
                
                return {
                  content: [{
                    type: 'text',
                    text: `❌ ${errorMsg}\n\n💡 ${suggestion}`
                  }]
                };
              }
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: `Error: ${error.message}`
                }]
              };
            }

          // ========== P0核心功能：邮件转发处理 ==========
          case 'gmail_forward_email':
            // 检查用户确认
            if (!args.confirmed) {
              const recipientText = Array.isArray(args.recipients) ? 
                args.recipients.join(', ') : args.recipients;
              
              return {
                content: [{
                  type: 'text',
                  text: '📧 EMAIL FORWARD CONFIRMATION REQUIRED\n\n' +
                        `Email ID: ${args.emailId}\n` +
                        `Recipients: ${recipientText}\n` +
                        `Message: ${args.message || '(none)'}\n` +
                        `Include Attachments: ${args.includeAttachments ? 'Yes' : 'No'}\n\n` +
                        '⚠️ This will immediately forward and send the email.\n' +
                        'Please confirm you want to proceed with forwarding.'
                }]
              };
            }

            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'forwardEmail',
                  params: {
                    emailId: args.emailId,
                    recipients: args.recipients,
                    message: args.message || '',
                    includeAttachments: args.includeAttachments,
                    accountEmail: args.accountEmail
                  }
                })
              });

              const result = await response.json();

              if (result.success && result.data) {
                const { sent, message, recipients } = result.data;
                
                if (sent) {
                  return {
                    content: [{
                      type: 'text',
                      text: `✅ ${message || 'Email forwarded successfully'}\n\nRecipients: ${recipients}`
                    }]
                  };
                } else {
                  return {
                    content: [{
                      type: 'text',
                      text: `⚠️ ${message || 'Forward saved as draft'}\n\nRecipients: ${recipients}\n\nPlease manually send from Gmail.`
                    }]
                  };
                }
              } else {
                return {
                  content: [{
                    type: 'text',
                    text: `Error: ${result.error || 'Failed to forward email'}`
                  }]
                };
              }
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: `Error: ${error.message}`
                }]
              };
            }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Gmail MCP Server started');
  }
}

const server = new GmailMCPServer();
server.start().catch(console.error);