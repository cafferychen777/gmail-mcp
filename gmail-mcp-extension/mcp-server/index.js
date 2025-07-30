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
            properties: {}
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
          description: 'Reply to an email',
          inputSchema: {
            type: 'object',
            properties: {
              emailId: { type: 'string', description: 'Email ID to reply to' },
              content: { type: 'string', description: 'Reply content' }
            },
            required: ['emailId', 'content']
          }
        },
        {
          name: 'send_email',
          description: 'Send a new email',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Recipient email' },
              subject: { type: 'string', description: 'Email subject' },
              body: { type: 'string', description: 'Email body' }
            },
            required: ['to', 'subject', 'body']
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
                  limit: { type: 'integer', description: 'Maximum number of results to return' }
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
                  params: {} 
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
                  params: { emailId: args.emailId }
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
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  action: 'replyEmail',
                  params: {
                    emailId: args.emailId,
                    content: args.content
                  }
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                if (result.data?.sent) {
                  return { 
                    content: [{ 
                      type: 'text', 
                      text: 'Reply sent successfully!'
                    }] 
                  };
                } else {
                  return { 
                    content: [{ 
                      type: 'text', 
                      text: 'Reply saved as draft. Please manually send in Gmail.'
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
            try {
              const response = await fetch(`${bridgeUrl}/mcp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  action: 'sendEmail',
                  params: {
                    to: args.to,
                    subject: args.subject,
                    body: args.body
                  }
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                if (result.data?.sent) {
                  return { 
                    content: [{ 
                      type: 'text', 
                      text: 'Email sent successfully!'
                    }] 
                  };
                } else {
                  return { 
                    content: [{ 
                      type: 'text', 
                      text: 'Email saved as draft. Please manually send in Gmail.'
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
                    options: args.options || {}
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