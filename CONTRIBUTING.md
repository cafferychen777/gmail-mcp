# Contributing to Gmail MCP Bridge

First off, thank you for considering contributing to Gmail MCP Bridge! It's people like you that make this tool better for everyone.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible using our bug report template.

**Great Bug Reports** tend to have:
- A quick summary and/or background
- Steps to reproduce
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please use the feature request template and include:
- A clear and descriptive title
- A detailed description of the proposed feature
- Explain why this enhancement would be useful
- List any additional resources or mockups if applicable

### Pull Requests

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Ensure the test suite passes.
4. Make sure your code lints.
5. Issue that pull request!

## Development Setup

1. **Prerequisites**
   - Node.js v20.0.0 or higher
   - Chrome browser
   - Claude Desktop app

2. **Setup**
   ```bash
   # Clone your fork
   git clone https://github.com/your-username/gmail-mcp.git
   cd gmail-mcp

   # Install dependencies
   cd gmail-mcp-extension/mcp-server
   npm install

   # Start the bridge server
   npm run bridge

   # In another terminal, configure Claude Desktop
   npm run configure
   ```

3. **Load the Chrome Extension**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `gmail-mcp-extension/extension` directory

## Project Structure

```
gmail-mcp/
├── gmail-mcp-extension/
│   ├── extension/          # Chrome extension files
│   │   ├── manifest.json
│   │   ├── background.js   # Service worker
│   │   ├── content.js      # Gmail page interaction
│   │   └── popup.html      # Extension popup
│   └── mcp-server/         # MCP server implementation
│       ├── index.js        # Main MCP server
│       └── bridge-server.js # HTTP bridge server
```

## Coding Standards

### JavaScript Style Guide
- Use ES6+ features where appropriate
- Use async/await for asynchronous code
- Add JSDoc comments for functions
- Keep functions small and focused

### Commit Messages
- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

### Testing
- Test Chrome extension functionality manually in Chrome
- Test MCP server integration with Claude Desktop
- Verify bridge server handles edge cases

## Architecture Decisions

### Why HTTP Bridge Instead of Native Messaging?
We chose HTTP bridge architecture because:
1. **Simplicity**: No platform-specific native messaging setup
2. **Reliability**: Avoids Chrome's native messaging restrictions
3. **Debugging**: Easier to debug HTTP requests
4. **Cross-platform**: Works the same on all operating systems

### Security Considerations
- The bridge server only listens on localhost
- No authentication is required (localhost only)
- Gmail data is not persisted anywhere
- All communication is ephemeral

## Need Help?

Feel free to open an issue with the question label if you need help with development setup or understanding the codebase.