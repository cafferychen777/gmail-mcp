# Gmail MCP Bridge - 高优先级功能实现方案

## 📋 概述

本文档详细描述了Gmail MCP Bridge项目中三个高优先级功能的完整实现方案：
1. **邮件标记功能（已读/未读）**
2. **邮件删除和归档**
3. **附件基础处理**

## 🎯 功能1: 邮件标记功能（已读/未读）

### 功能描述
允许用户通过MCP接口标记邮件为已读或未读状态，支持单个邮件和批量操作。

### 技术实现方案

#### 1.1 MCP Server 新增工具

在 `mcp-server/index.js` 中添加新的工具定义：

```javascript
{
  name: 'mark_email_read',
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
}
```

#### 1.2 Content Script 实现

在 `extension/content.js` 的 `GmailInterface` 类中添加方法：

```javascript
async markEmailsRead(emailIds, markAsRead = true) {
  console.log(`Marking ${emailIds.length} emails as ${markAsRead ? 'read' : 'unread'}`);
  
  const results = [];
  
  for (const emailId of emailIds) {
    try {
      // 找到邮件行
      const emailRow = document.querySelector(`span[data-legacy-thread-id="${emailId}"]`)?.closest('tr.zA');
      
      if (!emailRow) {
        results.push({ emailId, success: false, error: 'Email not found' });
        continue;
      }
      
      // 检查当前状态
      const isCurrentlyUnread = emailRow.classList.contains('zE') || 
                               emailRow.querySelector('.yW .zE') !== null;
      
      // 如果状态已经是目标状态，跳过
      if ((markAsRead && !isCurrentlyUnread) || (!markAsRead && isCurrentlyUnread)) {
        results.push({ emailId, success: true, message: 'Already in target state' });
        continue;
      }
      
      // 选择邮件行（如果未选中）
      const checkbox = emailRow.querySelector('td.oZ-x3 input[type="checkbox"]') ||
                      emailRow.querySelector('input[type="checkbox"]');
      
      if (checkbox && !checkbox.checked) {
        checkbox.click();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 查找标记按钮
      const markButton = this.findMarkReadButton(markAsRead);
      
      if (markButton) {
        markButton.click();
        await new Promise(resolve => setTimeout(resolve, 200));
        results.push({ emailId, success: true });
      } else {
        // 尝试键盘快捷键
        if (markAsRead) {
          // Shift+I 标记为已读
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'I',
            shiftKey: true,
            bubbles: true
          }));
        } else {
          // Shift+U 标记为未读
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'U',
            shiftKey: true,
            bubbles: true
          }));
        }
        await new Promise(resolve => setTimeout(resolve, 200));
        results.push({ emailId, success: true, method: 'keyboard' });
      }
      
    } catch (error) {
      results.push({ emailId, success: false, error: error.message });
    }
  }
  
  return { results, totalProcessed: emailIds.length };
}

findMarkReadButton(markAsRead) {
  // Gmail工具栏中的标记按钮选择器
  const selectors = markAsRead ? [
    '[aria-label*="Mark as read"]',
    '[data-tooltip*="Mark as read"]',
    '.ar9.T-I-J3.J-J5-Ji'  // 标记为已读按钮的CSS类
  ] : [
    '[aria-label*="Mark as unread"]',
    '[data-tooltip*="Mark as unread"]',
    '.ar8.T-I-J3.J-J5-Ji'  // 标记为未读按钮的CSS类
  ];
  
  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button && button.offsetParent !== null) {
      return button;
    }
  }
  
  return null;
}
```

#### 1.3 Bridge Server 集成

在 `mcp-server/bridge-server.js` 中处理新的action：

```javascript
case 'markEmailsRead':
  // 转发到Chrome扩展
  break;
```

### 测试方案

1. **单元测试**：测试单个邮件标记
2. **批量测试**：测试多个邮件同时标记
3. **状态验证**：确认标记后状态正确更新
4. **错误处理**：测试不存在的邮件ID处理

## 🗑️ 功能2: 邮件删除和归档

### 功能描述
提供邮件删除和归档功能，支持单个和批量操作，包括撤销功能。

### 技术实现方案

#### 2.1 MCP Server 新增工具

```javascript
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
}
```

#### 2.2 Content Script 实现

```javascript
async deleteEmails(emailIds, permanent = false) {
  console.log(`${permanent ? 'Permanently deleting' : 'Moving to trash'} ${emailIds.length} emails`);
  
  const results = [];
  
  // 批量选择邮件
  const selectedEmails = await this.selectEmails(emailIds);
  
  if (selectedEmails.length === 0) {
    return { results: [], error: 'No emails found to delete' };
  }
  
  try {
    if (permanent) {
      // 永久删除：Shift + Delete
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Delete',
        shiftKey: true,
        bubbles: true
      }));
    } else {
      // 移到垃圾箱：Delete 或点击删除按钮
      const deleteButton = this.findDeleteButton();
      if (deleteButton) {
        deleteButton.click();
      } else {
        // 使用键盘快捷键
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true
        }));
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 检查是否出现确认对话框
    const confirmDialog = document.querySelector('[role="dialog"]');
    if (confirmDialog) {
      const confirmButton = confirmDialog.querySelector('[aria-label*="Delete"]') ||
                           confirmDialog.querySelector('button:contains("Delete")');
      if (confirmButton) {
        confirmButton.click();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return {
      results: emailIds.map(id => ({ emailId: id, success: true })),
      totalProcessed: emailIds.length,
      action: permanent ? 'permanently_deleted' : 'moved_to_trash'
    };
    
  } catch (error) {
    return {
      results: emailIds.map(id => ({ emailId: id, success: false, error: error.message })),
      error: error.message
    };
  }
}

async archiveEmails(emailIds) {
  console.log(`Archiving ${emailIds.length} emails`);
  
  const selectedEmails = await this.selectEmails(emailIds);
  
  if (selectedEmails.length === 0) {
    return { results: [], error: 'No emails found to archive' };
  }
  
  try {
    // 查找归档按钮
    const archiveButton = this.findArchiveButton();
    
    if (archiveButton) {
      archiveButton.click();
    } else {
      // 使用键盘快捷键 'e'
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'e',
        bubbles: true
      }));
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      results: emailIds.map(id => ({ emailId: id, success: true })),
      totalProcessed: emailIds.length,
      action: 'archived'
    };
    
  } catch (error) {
    return {
      results: emailIds.map(id => ({ emailId: id, success: false, error: error.message })),
      error: error.message
    };
  }
}

async selectEmails(emailIds) {
  const selectedEmails = [];
  
  for (const emailId of emailIds) {
    const emailRow = document.querySelector(`span[data-legacy-thread-id="${emailId}"]`)?.closest('tr.zA');
    
    if (emailRow) {
      const checkbox = emailRow.querySelector('td.oZ-x3 input[type="checkbox"]') ||
                      emailRow.querySelector('input[type="checkbox"]');
      
      if (checkbox && !checkbox.checked) {
        checkbox.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        selectedEmails.push(emailId);
      }
    }
  }
  
  return selectedEmails;
}

findDeleteButton() {
  const selectors = [
    '[aria-label*="Delete"]',
    '[data-tooltip*="Delete"]',
    '.ar5.T-I-J3.J-J5-Ji',  // 删除按钮CSS类
    'div[role="button"][aria-label*="Delete"]'
  ];
  
  return this.findButtonBySelectors(selectors);
}

findArchiveButton() {
  const selectors = [
    '[aria-label*="Archive"]',
    '[data-tooltip*="Archive"]',
    '.ar3.T-I-J3.J-J5-Ji',  // 归档按钮CSS类
    'div[role="button"][aria-label*="Archive"]'
  ];
  
  return this.findButtonBySelectors(selectors);
}

findButtonBySelectors(selectors) {
  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button && button.offsetParent !== null) {
      return button;
    }
  }
  return null;
}
```

### 测试方案

1. **删除测试**：测试移到垃圾箱和永久删除
2. **归档测试**：测试邮件归档功能
3. **批量操作**：测试多邮件同时操作
4. **撤销功能**：测试Gmail的撤销提示

## 📎 功能3: 附件基础处理

### 功能描述
提供附件检测、列表、下载和发送带附件邮件的基础功能。

### 技术实现方案

#### 3.1 MCP Server 新增工具

```javascript
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
```

#### 3.2 Content Script 实现

```javascript
async getEmailAttachments(emailId) {
  console.log(`Getting attachments for email: ${emailId}`);
  
  // 确保邮件已打开
  const emailData = await this.getEmailContent(emailId);
  if (!emailData || emailData.error) {
    return { error: 'Failed to open email' };
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 查找附件
  const attachments = [];
  
  // Gmail附件选择器
  const attachmentSelectors = [
    '.aZo',  // 附件容器
    '.aQH',  // 附件项
    '.aZp',  // 附件链接
    '[role="listitem"]'  // 附件列表项
  ];
  
  const attachmentContainers = document.querySelectorAll('.aZo, .aQH');
  
  attachmentContainers.forEach((container, index) => {
    try {
      const nameElement = container.querySelector('.aZr') || 
                         container.querySelector('.aQI') ||
                         container.querySelector('span[title]');
      
      const sizeElement = container.querySelector('.aZm') ||
                         container.querySelector('.aQJ');
      
      const downloadLink = container.querySelector('a[download]') ||
                          container.querySelector('.aZp');
      
      if (nameElement) {
        const attachment = {
          id: `attachment_${index}`,
          filename: nameElement.textContent.trim() || nameElement.getAttribute('title'),
          size: sizeElement ? sizeElement.textContent.trim() : 'Unknown',
          downloadUrl: downloadLink ? downloadLink.href : null,
          type: this.getFileType(nameElement.textContent || ''),
          canDownload: !!downloadLink
        };
        
        attachments.push(attachment);
      }
    } catch (error) {
      console.error(`Error processing attachment ${index}:`, error);
    }
  });
  
  return {
    emailId,
    attachments,
    totalAttachments: attachments.length,
    hasAttachments: attachments.length > 0
  };
}

async downloadAttachment(emailId, attachmentId) {
  console.log(`Downloading attachment ${attachmentId} from email ${emailId}`);
  
  // 获取附件信息
  const attachmentData = await this.getEmailAttachments(emailId);
  
  if (!attachmentData.hasAttachments) {
    return { error: 'No attachments found in email' };
  }
  
  const attachment = attachmentData.attachments.find(att => 
    att.id === attachmentId || att.filename === attachmentId
  );
  
  if (!attachment) {
    return { error: 'Attachment not found' };
  }
  
  if (!attachment.canDownload || !attachment.downloadUrl) {
    return { error: 'Attachment cannot be downloaded' };
  }
  
  try {
    // 触发下载
    const downloadLink = document.querySelector(`a[href="${attachment.downloadUrl}"]`);
    
    if (downloadLink) {
      downloadLink.click();
      
      return {
        success: true,
        filename: attachment.filename,
        size: attachment.size,
        message: 'Download started'
      };
    } else {
      // 创建临时下载链接
      const tempLink = document.createElement('a');
      tempLink.href = attachment.downloadUrl;
      tempLink.download = attachment.filename;
      tempLink.style.display = 'none';
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      
      return {
        success: true,
        filename: attachment.filename,
        size: attachment.size,
        message: 'Download started via temporary link'
      };
    }
    
  } catch (error) {
    return {
      error: `Download failed: ${error.message}`,
      filename: attachment.filename
    };
  }
}

getFileType(filename) {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  const typeMap = {
    'pdf': 'document',
    'doc': 'document',
    'docx': 'document',
    'txt': 'document',
    'jpg': 'image',
    'jpeg': 'image',
    'png': 'image',
    'gif': 'image',
    'mp4': 'video',
    'avi': 'video',
    'mp3': 'audio',
    'wav': 'audio',
    'zip': 'archive',
    'rar': 'archive',
    'xlsx': 'spreadsheet',
    'xls': 'spreadsheet',
    'ppt': 'presentation',
    'pptx': 'presentation'
  };
  
  return typeMap[extension] || 'unknown';
}

// 扩展现有的sendEmail方法以支持附件提醒
async sendEmailWithAttachmentSupport(to, subject, body, attachmentNote = null) {
  // 调用现有的sendEmail方法
  const result = await this.sendEmail(to, subject, body);
  
  if (attachmentNote && result.success) {
    // 在邮件正文中添加附件提醒
    const noteText = `\n\n[Note: ${attachmentNote}]`;
    
    // 尝试在compose窗口中添加附件提醒
    const bodyField = document.querySelector('[aria-label="Message Body"]') ||
                     document.querySelector('div[contenteditable="true"][role="textbox"]');
    
    if (bodyField) {
      bodyField.innerHTML += noteText.replace(/\n/g, '<br>');
      bodyField.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  
  return result;
}
```

### 测试方案

1. **附件检测**：测试有无附件邮件的检测
2. **附件列表**：验证附件信息提取准确性
3. **下载功能**：测试各种文件类型下载
4. **错误处理**：测试无效附件ID处理

## 🔧 集成和部署

### 代码集成步骤

1. **更新MCP Server**
   - 在`index.js`中添加新工具定义
   - 实现对应的处理逻辑

2. **更新Content Script**
   - 在`content.js`中添加新方法
   - 更新消息处理器

3. **更新Bridge Server**
   - 在`bridge-server.js`中添加新action处理

4. **测试验证**
   - 运行集成测试
   - 验证所有功能正常工作

### 配置更新

无需更新manifest.json，现有权限已足够。

## 📊 性能考虑

1. **批量操作优化**：使用适当的延迟避免Gmail限制
2. **错误恢复**：实现重试机制
3. **内存管理**：及时清理DOM引用
4. **用户体验**：提供操作进度反馈

## 🔒 安全考虑

1. **输入验证**：验证所有邮件ID和参数
2. **权限检查**：确保操作在Gmail域内
3. **错误处理**：避免敏感信息泄露
4. **操作确认**：重要操作提供确认机制

## 📈 后续扩展

1. **撤销功能**：实现操作撤销
2. **批量附件下载**：支持多附件同时下载
3. **附件预览**：添加附件预览功能
4. **操作历史**：记录用户操作历史

---

*本实现方案基于当前Gmail界面结构，可能需要根据Gmail更新进行调整。*
