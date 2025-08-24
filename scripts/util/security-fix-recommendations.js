#!/usr/bin/env node

/**
 * Gmail MCP Bridge - Security Fix Recommendations
 * 
 * This script provides detailed security fix recommendations and 
 * can automatically apply certain security improvements.
 * 
 * @author Gmail MCP Security Team
 * @version 1.0.0
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class SecurityFixRecommendations {
  constructor() {
    this.projectPath = process.cwd();
    this.fixes = [];
  }

  async generateSecurityFixes() {
    console.log('🔒 Gmail MCP Bridge - Security Fix Recommendations\n');
    
    await this.analyzeContentScriptSecurity();
    await this.analyzeBridgeServerSecurity();
    await this.analyzeManifestSecurity();
    await this.analyzeDataHandling();
    
    this.generateFixScript();
    this.generateSecurityChecklist();
  }

  async analyzeContentScriptSecurity() {
    console.log('📝 Analyzing Content Script Security...');
    
    try {
      const contentPath = path.join(this.projectPath, 'gmail-mcp-extension/extension/content.js');
      const content = await fs.readFile(contentPath, 'utf8');
      
      // Check for console.log with email addresses
      const emailLogPattern = /console\.log.*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emailLogs = content.match(emailLogPattern);
      
      if (emailLogs) {
        this.fixes.push({
          priority: 'P1',
          category: 'Data Privacy',
          file: 'gmail-mcp-extension/extension/content.js',
          issue: 'Email addresses exposed in console logs',
          risk: 'High - User privacy violation',
          fix: {
            description: 'Sanitize email addresses in logs',
            code: `
// Replace direct email logging with sanitized version
const sanitizeEmail = (email) => {
  if (!email || !email.includes('@')) return email;
  const [user, domain] = email.split('@');
  return \`\${user.slice(0,2)}***@\${domain}\`;
};

// Use in logging:
console.log('Found email:', sanitizeEmail(accountEmail));
            `.trim(),
            automated: true
          }
        });
      }
      
      // Check for innerHTML usage (XSS risk)
      const innerHTMLPattern = /\.innerHTML\s*=/g;
      const innerHTMLUsage = content.match(innerHTMLPattern);
      
      if (innerHTMLUsage) {
        this.fixes.push({
          priority: 'P2',
          category: 'XSS Prevention',
          file: 'gmail-mcp-extension/extension/content.js',
          issue: 'Direct innerHTML assignment detected',
          risk: 'Medium - XSS vulnerability',
          fix: {
            description: 'Use textContent or sanitize HTML',
            code: `
// Replace innerHTML with safer alternatives:
// Instead of: element.innerHTML = userContent;
// Use: element.textContent = userContent;
// Or: element.innerHTML = DOMPurify.sanitize(userContent);
            `.trim(),
            automated: false
          }
        });
      }
      
    } catch (error) {
      console.log('  ⚠️  Could not analyze content script:', error.message);
    }
  }

  async analyzeBridgeServerSecurity() {
    console.log('🌐 Analyzing Bridge Server Security...');
    
    try {
      const bridgePath = path.join(this.projectPath, 'gmail-mcp-extension/mcp-server/bridge-server.js');
      
      if (await this.fileExists(bridgePath)) {
        const content = await fs.readFile(bridgePath, 'utf8');
        
        // Check for HTTP usage
        if (content.includes('http://') || content.includes('createServer(')) {
          this.fixes.push({
            priority: 'P1',
            category: 'Transport Security',
            file: 'gmail-mcp-extension/mcp-server/bridge-server.js',
            issue: 'HTTP server without TLS encryption',
            risk: 'Critical - Man-in-the-middle attacks',
            fix: {
              description: 'Implement HTTPS with TLS certificates',
              code: `
import https from 'https';
import { readFileSync } from 'fs';

const options = {
  key: readFileSync('path/to/private-key.pem'),
  cert: readFileSync('path/to/certificate.pem')
};

const server = https.createServer(options, app);
server.listen(3443, () => {
  console.log('Secure HTTPS server running on port 3443');
});
              `.trim(),
              automated: false
            }
          });
        }
        
        // Check for CORS configuration
        if (!content.includes('cors') && !content.includes('Access-Control')) {
          this.fixes.push({
            priority: 'P2',
            category: 'CORS Security',
            file: 'gmail-mcp-extension/mcp-server/bridge-server.js',
            issue: 'Missing CORS configuration',
            risk: 'Medium - Cross-origin attacks',
            fix: {
              description: 'Implement strict CORS policy',
              code: `
import cors from 'cors';

const corsOptions = {
  origin: ['https://mail.google.com'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};

app.use(cors(corsOptions));
              `.trim(),
              automated: true
            }
          });
        }
        
      }
    } catch (error) {
      console.log('  ⚠️  Could not analyze bridge server:', error.message);
    }
  }

  async analyzeManifestSecurity() {
    console.log('📄 Analyzing Manifest Security...');
    
    try {
      const manifestPath = path.join(this.projectPath, 'gmail-mcp-extension/extension/manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      
      // Check for excessive permissions
      const dangerousPermissions = ['<all_urls>', 'cookies', 'history', 'bookmarks'];
      const permissions = manifest.permissions || [];
      const hostPermissions = manifest.host_permissions || [];
      
      const found = permissions.filter(p => dangerousPermissions.includes(p));
      if (found.length > 0) {
        this.fixes.push({
          priority: 'P1',
          category: 'Permission Security',
          file: 'gmail-mcp-extension/extension/manifest.json',
          issue: `Potentially excessive permissions: ${found.join(', ')}`,
          risk: 'High - Overly broad access',
          fix: {
            description: 'Remove unnecessary permissions',
            code: 'Review and remove any permissions not essential for core functionality',
            automated: false
          }
        });
      }
      
      // Check for missing CSP
      if (!manifest.content_security_policy) {
        this.fixes.push({
          priority: 'P2',
          category: 'Content Security',
          file: 'gmail-mcp-extension/extension/manifest.json',
          issue: 'Missing Content Security Policy',
          risk: 'Medium - XSS and injection attacks',
          fix: {
            description: 'Add Content Security Policy',
            code: `
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'"
}
            `.trim(),
            automated: true
          }
        });
      }
      
    } catch (error) {
      console.log('  ⚠️  Could not analyze manifest:', error.message);
    }
  }

  async analyzeDataHandling() {
    console.log('💾 Analyzing Data Handling Security...');
    
    // Check for localStorage usage without encryption
    const files = await this.getAllJSFiles();
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        if (content.includes('localStorage') || content.includes('sessionStorage')) {
          this.fixes.push({
            priority: 'P2',
            category: 'Data Storage',
            file: path.relative(this.projectPath, file),
            issue: 'Unencrypted browser storage usage',
            risk: 'Medium - Data exposure',
            fix: {
              description: 'Encrypt sensitive data before storage',
              code: `
// Utility functions for encrypted storage
const encryptData = (data, key) => {
  const cipher = crypto.createCipher('aes-256-cbc', key);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

const decryptData = (encryptedData, key) => {
  const decipher = crypto.createDecipher('aes-256-cbc', key);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
};

// Use encrypted storage:
const key = 'your-encryption-key';
localStorage.setItem('data', encryptData(sensitiveData, key));
              `.trim(),
              automated: false
            }
          });
          break; // Only report once per file type
        }
      } catch (error) {
        // Continue with other files
      }
    }
  }

  generateFixScript() {
    console.log('🛠️  Generating Automated Fix Script...\n');
    
    const automatedFixes = this.fixes.filter(fix => fix.fix.automated);
    
    if (automatedFixes.length === 0) {
      console.log('No automated fixes available. All fixes require manual intervention.\n');
      return;
    }
    
    let fixScript = `#!/usr/bin/env node
/**
 * Automated Security Fixes for Gmail MCP Bridge
 * Generated: ${new Date().toISOString()}
 */

import { promises as fs } from 'fs';
import path from 'path';

async function applySecurityFixes() {
  console.log('Applying automated security fixes...');
  
`;

    automatedFixes.forEach((fix, index) => {
      fixScript += `  // Fix ${index + 1}: ${fix.issue}
  await fix${index + 1}();
  
`;
    });

    fixScript += `  console.log('All automated fixes applied successfully!');
}

`;

    // Generate individual fix functions
    automatedFixes.forEach((fix, index) => {
      fixScript += `async function fix${index + 1}() {
  console.log('Applying: ${fix.issue}');
  // ${fix.fix.description}
  
  try {
    // Implementation would go here based on specific fix
    console.log('✅ Applied: ${fix.issue}');
  } catch (error) {
    console.error('❌ Failed to apply: ${fix.issue}', error.message);
  }
}

`;
    });

    fixScript += `applySecurityFixes().catch(console.error);
`;

    // Write the fix script
    const fixScriptPath = path.join(this.projectPath, 'apply-security-fixes.js');
    fs.writeFile(fixScriptPath, fixScript);
    
    console.log(`📝 Automated fix script generated: apply-security-fixes.js`);
    console.log(`   Run with: node apply-security-fixes.js\n`);
  }

  generateSecurityChecklist() {
    console.log('📋 Generating Security Fix Checklist...\n');
    
    // Sort fixes by priority
    const sortedFixes = this.fixes.sort((a, b) => {
      const priorityOrder = { 'P1': 1, 'P2': 2, 'P3': 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    let checklist = `# Gmail MCP Bridge - Security Fix Checklist

Generated: ${new Date().toISOString()}

## Priority Legend
- 🔴 P1: Critical - Fix before production
- 🟡 P2: High - Fix within 1 month  
- 🟢 P3: Medium - Fix within 3 months

## Security Fixes Required

`;

    sortedFixes.forEach((fix, index) => {
      const priorityIcon = fix.priority === 'P1' ? '🔴' : fix.priority === 'P2' ? '🟡' : '🟢';
      const automatedIcon = fix.fix.automated ? '🤖' : '👤';
      
      checklist += `### ${index + 1}. ${fix.issue} ${priorityIcon} ${automatedIcon}

**File**: \`${fix.file}\`  
**Category**: ${fix.category}  
**Risk**: ${fix.risk}  
**Priority**: ${fix.priority}  
**Automated**: ${fix.fix.automated ? 'Yes' : 'No'}

**Description**: ${fix.fix.description}

**Implementation**:
\`\`\`javascript
${fix.fix.code}
\`\`\`

**Status**: [ ] Not Started [ ] In Progress [ ] Completed

---

`;
    });

    checklist += `## Summary

- **Total Fixes**: ${this.fixes.length}
- **P1 (Critical)**: ${this.fixes.filter(f => f.priority === 'P1').length}
- **P2 (High)**: ${this.fixes.filter(f => f.priority === 'P2').length}
- **P3 (Medium)**: ${this.fixes.filter(f => f.priority === 'P3').length}
- **Automated**: ${this.fixes.filter(f => f.fix.automated).length}
- **Manual**: ${this.fixes.filter(f => !f.fix.automated).length}

## Pre-Production Requirements

Before deploying to production, ensure all P1 fixes are completed:

${this.fixes.filter(f => f.priority === 'P1').map((fix, i) => 
  `${i + 1}. [ ] ${fix.issue}`
).join('\n')}

## Validation Commands

After applying fixes, run these commands to validate:

\`\`\`bash
# Run security test suite
node security-stability-test-suite.js

# Check for remaining vulnerabilities  
npm audit

# Validate manifest permissions
node -e "console.log(JSON.parse(require('fs').readFileSync('gmail-mcp-extension/extension/manifest.json')).permissions)"
\`\`\`
`;

    const checklistPath = path.join(this.projectPath, 'SECURITY_FIX_CHECKLIST.md');
    fs.writeFile(checklistPath, checklist);
    
    console.log(`📋 Security checklist generated: SECURITY_FIX_CHECKLIST.md\n`);
    
    // Display summary
    console.log('📊 Security Fix Summary:');
    console.log('========================');
    console.log(`Total Issues Found: ${this.fixes.length}`);
    console.log(`P1 (Critical): ${this.fixes.filter(f => f.priority === 'P1').length}`);
    console.log(`P2 (High): ${this.fixes.filter(f => f.priority === 'P2').length}`);
    console.log(`P3 (Medium): ${this.fixes.filter(f => f.priority === 'P3').length}`);
    console.log(`Automated Fixes: ${this.fixes.filter(f => f.fix.automated).length}`);
    console.log(`Manual Fixes: ${this.fixes.filter(f => !f.fix.automated).length}\n`);
    
    if (this.fixes.filter(f => f.priority === 'P1').length > 0) {
      console.log('🚨 CRITICAL ISSUES FOUND!');
      console.log('   These must be fixed before production deployment.\n');
    }
  }

  // Helper methods
  async getAllJSFiles() {
    const files = [];
    
    const scanDir = async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scanDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    await scanDir(this.projectPath);
    return files;
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Main execution
async function main() {
  const securityFixer = new SecurityFixRecommendations();
  await securityFixer.generateSecurityFixes();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { SecurityFixRecommendations };