# Gmail MCP Search功能使用指南

## 🔍 搜索功能概述

Gmail MCP Bridge 现在支持强大的邮件搜索功能，让你可以通过自然语言或Gmail搜索语法快速找到需要的邮件。

## 🎯 基础搜索

### 简单搜索
```
search_emails query: "Augment"
```
搜索包含"Augment"的所有邮件

### 发件人搜索
```
search_emails query: "from:auggie@augmentcode.com"
```
搜索来自特定发件人的邮件

### 主题搜索
```
search_emails query: "subject:Launch Week"
```
搜索主题包含"Launch Week"的邮件

## 🔧 高级搜索语法

### Gmail 原生搜索语法支持

| 语法 | 说明 | 示例 |
|------|------|------|
| `from:` | 按发件人搜索 | `from:github.com` |
| `to:` | 按收件人搜索 | `to:me` |
| `subject:` | 按主题搜索 | `subject:urgent` |
| `has:attachment` | 有附件的邮件 | `has:attachment` |
| `is:unread` | 未读邮件 | `is:unread` |
| `is:read` | 已读邮件 | `is:read` |
| `is:important` | 重要邮件 | `is:important` |
| `label:` | 按标签搜索 | `label:work` |
| `after:` | 指定日期后 | `after:2024/1/1` |
| `before:` | 指定日期前 | `before:2024/12/31` |

### 组合搜索
```
search_emails query: "from:augmentcode.com subject:Launch Week is:unread"
```
搜索来自Augment Code、主题包含"Launch Week"的未读邮件

## 🎛️ 搜索选项

### 使用options参数进行额外过滤

```javascript
search_emails query: "Augment" options: {
  "from": "auggie",
  "unread": true,
  "limit": 10,
  "dateFrom": "2024-07-01",
  "dateTo": "2024-07-31"
}
```

### 可用选项

- **from**: 按发件人名称或邮箱过滤
- **subject**: 按主题关键词过滤
- **unread**: 按未读状态过滤 (true/false)
- **dateFrom**: 起始日期 (YYYY-MM-DD)
- **dateTo**: 结束日期 (YYYY-MM-DD)
- **limit**: 限制结果数量

## 💡 实用搜索示例

### 1. 查找最近的重要邮件
```
search_emails query: "is:important is:unread" options: {"limit": 5}
```

### 2. 查找特定项目的邮件
```
search_emails query: "subject:项目名称 OR 项目名称" options: {"limit": 20}
```

### 3. 查找本周的工作邮件
```
search_emails query: "label:work" options: {
  "dateFrom": "2024-07-29",
  "limit": 15
}
```

### 4. 查找有附件的邮件
```
search_emails query: "has:attachment from:colleague@company.com"
```

### 5. 查找GitHub通知
```
search_emails query: "from:github.com OR from:noreply@github.com" options: {
  "unread": true,
  "limit": 10
}
```

## 🚀 在Claude Desktop中使用

### 自然语言搜索
你可以用自然语言告诉Claude你想搜索什么：

- "帮我找一下Augment Code最近发的邮件"
- "搜索一下GitHub的未读通知"
- "找一下上周关于项目的邮件"
- "查看一下有附件的重要邮件"

Claude会自动转换为合适的搜索查询。

### 直接使用搜索工具
```
search_emails query: "your search terms here"
```

## 🔧 搜索结果

搜索结果包含：
- **总结果数量**
- **邮件列表**，每封邮件包含：
  - 发件人
  - 主题
  - 日期
  - 邮件ID（用于后续读取）
  - 未读状态
  - 邮件摘要
- **搜索URL**（可以在浏览器中查看）

## ⚠️ 注意事项

1. **Gmail必须打开**：搜索功能需要Gmail在浏览器中打开
2. **搜索会导航**：搜索时会自动导航到Gmail搜索页面
3. **等待加载**：搜索结果需要时间加载，请耐心等待
4. **语法准确性**：使用Gmail搜索语法时请确保语法正确

## 🐛 故障排除

### 搜索无结果
- 检查搜索语法是否正确
- 确认Gmail中确实有匹配的邮件
- 尝试简化搜索条件

### 搜索失败
- 确保Gmail页面已完全加载
- 检查网络连接
- 重新加载Gmail页面

### 搜索速度慢
- 减少搜索范围
- 使用更具体的搜索条件
- 设置limit限制结果数量

## 📚 更多资源

- [Gmail搜索官方文档](https://support.google.com/mail/answer/7190?hl=zh-Hans)
- [Gmail搜索操作符完整列表](https://support.google.com/mail/answer/7190)
