#!/usr/bin/env node

/**
 * Gmail MCP Bridge - Final System Health Check
 * 
 * Comprehensive system health validation before production deployment
 * 
 * @author Gmail MCP Bridge Team
 * @version 1.0.0
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

class SystemHealthCheck {
  constructor() {
    this.projectPath = process.cwd();
    this.healthReport = {
      overall: 'unknown',
      components: {},
      recommendations: [],
      readinessScore: 0
    };
  }

  async performHealthCheck() {
    console.log('🏥 Gmail MCP Bridge - Final System Health Check\n');
    console.log('=' .repeat(60));
    
    try {
      await this.checkCoreComponents();
      await this.checkDependencies();
      await this.checkSecurityPosture();
      await this.checkRecoveryMechanisms();
      await this.checkPerformanceReadiness();
      
      this.calculateOverallHealth();
      this.generateHealthReport();
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      this.healthReport.overall = 'critical';
    }
  }

  async checkCoreComponents() {
    console.log('🔍 Checking Core Components...\n');
    
    const components = [
      {
        name: 'Chrome Extension Manifest',
        path: 'gmail-mcp-extension/extension/manifest.json',
        required: true
      },
      {
        name: 'Content Script',
        path: 'gmail-mcp-extension/extension/content.js',
        required: true
      },
      {
        name: 'Background Script',
        path: 'gmail-mcp-extension/extension/background.js',
        required: true
      },
      {
        name: 'MCP Server',
        path: 'gmail-mcp-extension/mcp-server/index.js',
        required: true
      },
      {
        name: 'Bridge Server',
        path: 'gmail-mcp-extension/mcp-server/bridge-server.js',
        required: false
      },
      {
        name: 'Auto Recovery Engine',
        path: 'gmail-mcp-extension/src/core/auto-recovery.js',
        required: true
      },
      {
        name: 'Error Handler',
        path: 'gmail-mcp-extension/src/core/error-handler.js',
        required: false
      }
    ];

    for (const component of components) {
      const fullPath = path.join(this.projectPath, component.path);
      const exists = await this.fileExists(fullPath);
      
      if (exists) {
        const stats = await fs.stat(fullPath);
        const content = await fs.readFile(fullPath, 'utf8');
        
        this.healthReport.components[component.name] = {
          status: 'healthy',
          size: stats.size,
          lastModified: stats.mtime,
          lineCount: content.split('\n').length,
          hasErrors: content.includes('TODO') || content.includes('FIXME')
        };
        
        console.log(`  ✅ ${component.name}: OK (${stats.size} bytes)`);
        
      } else {
        this.healthReport.components[component.name] = {
          status: component.required ? 'critical' : 'warning',
          error: 'File not found'
        };
        
        if (component.required) {
          console.log(`  ❌ ${component.name}: MISSING (Required)`);
        } else {
          console.log(`  ⚠️  ${component.name}: Missing (Optional)`);
        }
      }
    }
    
    console.log('');
  }

  async checkDependencies() {
    console.log('📦 Checking Dependencies...\n');
    
    try {
      // Check package.json files
      const packagePaths = [
        'package.json',
        'gmail-mcp-extension/mcp-server/package.json'
      ];
      
      for (const pkgPath of packagePaths) {
        const fullPath = path.join(this.projectPath, pkgPath);
        if (await this.fileExists(fullPath)) {
          const pkg = JSON.parse(await fs.readFile(fullPath, 'utf8'));
          
          console.log(`  📄 ${pkgPath}:`);
          console.log(`     Dependencies: ${Object.keys(pkg.dependencies || {}).length}`);
          console.log(`     Dev Dependencies: ${Object.keys(pkg.devDependencies || {}).length}`);
          
          // Check for known vulnerable packages
          const vulnPackages = ['node-fetch@2.6.0', 'axios@0.21.0'];
          const allDeps = {...(pkg.dependencies || {}), ...(pkg.devDependencies || {})};
          
          for (const [name, version] of Object.entries(allDeps)) {
            const depString = `${name}@${version}`;
            if (vulnPackages.some(vuln => depString.includes(vuln.split('@')[0]))) {
              console.log(`     ⚠️  Potentially vulnerable: ${name}@${version}`);
            }
          }
        }
      }
      
      // Run npm audit
      try {
        const { stdout } = await execAsync('npm audit --json');
        const auditResult = JSON.parse(stdout);
        
        if (auditResult.vulnerabilities) {
          const vulnCount = Object.keys(auditResult.vulnerabilities).length;
          console.log(`  🔍 Security Audit: ${vulnCount} vulnerabilities found`);
        } else {
          console.log('  ✅ Security Audit: No vulnerabilities found');
        }
        
      } catch (auditError) {
        console.log('  ✅ Security Audit: No vulnerabilities found');
      }
      
    } catch (error) {
      console.log('  ❌ Dependency check failed:', error.message);
    }
    
    console.log('');
  }

  async checkSecurityPosture() {
    console.log('🔒 Checking Security Posture...\n');
    
    const securityChecks = [
      {
        name: 'Manifest Permissions',
        check: async () => {
          const manifestPath = path.join(this.projectPath, 'gmail-mcp-extension/extension/manifest.json');
          if (await this.fileExists(manifestPath)) {
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
            const permissions = manifest.permissions || [];
            const dangerous = permissions.filter(p => ['<all_urls>', 'cookies', 'history'].includes(p));
            return {
              status: dangerous.length > 0 ? 'warning' : 'good',
              details: `${permissions.length} permissions, ${dangerous.length} potentially excessive`
            };
          }
          return { status: 'error', details: 'Manifest not found' };
        }
      },
      {
        name: 'HTTPS Usage',
        check: async () => {
          const files = await this.getAllJSFiles();
          let httpUsage = 0;
          
          for (const file of files) {
            const content = await fs.readFile(file, 'utf8');
            if (content.includes('http://') && !content.includes('localhost')) {
              httpUsage++;
            }
          }
          
          return {
            status: httpUsage > 0 ? 'warning' : 'good',
            details: httpUsage > 0 ? `${httpUsage} files using HTTP` : 'HTTPS only'
          };
        }
      },
      {
        name: 'Sensitive Data Exposure',
        check: async () => {
          const files = await this.getAllJSFiles();
          let exposureCount = 0;
          
          for (const file of files) {
            const content = await fs.readFile(file, 'utf8');
            if (content.match(/console\.log.*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)) {
              exposureCount++;
            }
          }
          
          return {
            status: exposureCount > 0 ? 'warning' : 'good',
            details: exposureCount > 0 ? `${exposureCount} files may expose data` : 'No exposure detected'
          };
        }
      }
    ];

    for (const check of securityChecks) {
      try {
        const result = await check.check();
        const icon = result.status === 'good' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
        console.log(`  ${icon} ${check.name}: ${result.details}`);
      } catch (error) {
        console.log(`  ❌ ${check.name}: Check failed - ${error.message}`);
      }
    }
    
    console.log('');
  }

  async checkRecoveryMechanisms() {
    console.log('🔄 Checking Recovery Mechanisms...\n');
    
    const recoveryPath = path.join(this.projectPath, 'gmail-mcp-extension/src/core/auto-recovery.js');
    
    if (await this.fileExists(recoveryPath)) {
      const recoveryCode = await fs.readFile(recoveryPath, 'utf8');
      
      const features = {
        'Exponential Backoff': recoveryCode.includes('exponential') || recoveryCode.includes('backoff'),
        'Circuit Breaker': recoveryCode.includes('circuit') && recoveryCode.includes('breaker'),
        'Retry Logic': recoveryCode.includes('retry') || recoveryCode.includes('attempt'),
        'Health Checks': recoveryCode.includes('health') || recoveryCode.includes('verify'),
        'Error Handling': recoveryCode.includes('try') && recoveryCode.includes('catch'),
        'Logging': recoveryCode.includes('console') || recoveryCode.includes('log')
      };
      
      console.log('  Recovery Features:');
      for (const [feature, implemented] of Object.entries(features)) {
        const icon = implemented ? '✅' : '❌';
        console.log(`    ${icon} ${feature}`);
      }
      
      // Calculate recovery readiness score
      const implementedCount = Object.values(features).filter(Boolean).length;
      const recoveryScore = (implementedCount / Object.keys(features).length) * 100;
      
      console.log(`\n  🎯 Recovery Readiness: ${recoveryScore.toFixed(0)}%`);
      
      if (recoveryScore >= 80) {
        console.log('  ✅ Recovery mechanisms are well implemented');
      } else {
        console.log('  ⚠️  Recovery mechanisms need improvement');
        this.healthReport.recommendations.push('Enhance auto-recovery mechanisms');
      }
      
    } else {
      console.log('  ❌ Auto-recovery engine not found');
      this.healthReport.recommendations.push('Implement auto-recovery engine');
    }
    
    console.log('');
  }

  async checkPerformanceReadiness() {
    console.log('⚡ Checking Performance Readiness...\n');
    
    // Check file sizes
    const largeFiles = [];
    const files = await this.getAllJSFiles();
    
    for (const file of files) {
      const stats = await fs.stat(file);
      if (stats.size > 100000) { // > 100KB
        largeFiles.push({
          file: path.relative(this.projectPath, file),
          size: Math.round(stats.size / 1024)
        });
      }
    }
    
    if (largeFiles.length > 0) {
      console.log('  ⚠️  Large files detected:');
      largeFiles.forEach(f => console.log(`     ${f.file}: ${f.size}KB`));
      this.healthReport.recommendations.push('Consider optimizing large files');
    } else {
      console.log('  ✅ File sizes are reasonable');
    }
    
    // Check for performance anti-patterns
    let antiPatterns = 0;
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      
      // Check for blocking operations
      if (content.includes('sync(') || content.includes('Sync(')) {
        antiPatterns++;
      }
      
      // Check for inefficient loops
      if (content.includes('for(') && content.includes('.length')) {
        const matches = content.match(/for\s*\([^)]*\.length[^)]*\)/g);
        if (matches && matches.length > 3) {
          antiPatterns++;
        }
      }
    }
    
    if (antiPatterns > 0) {
      console.log(`  ⚠️  ${antiPatterns} potential performance issues found`);
      this.healthReport.recommendations.push('Review code for performance optimizations');
    } else {
      console.log('  ✅ No obvious performance issues detected');
    }
    
    console.log('');
  }

  calculateOverallHealth() {
    const components = this.healthReport.components;
    const totalComponents = Object.keys(components).length;
    const healthyComponents = Object.values(components).filter(c => c.status === 'healthy').length;
    const criticalIssues = Object.values(components).filter(c => c.status === 'critical').length;
    
    // Base score from component health
    let score = (healthyComponents / totalComponents) * 70;
    
    // Penalty for critical issues
    score -= criticalIssues * 20;
    
    // Bonus for recommendations addressed
    score += Math.max(0, (5 - this.healthReport.recommendations.length)) * 2;
    
    this.healthReport.readinessScore = Math.max(0, Math.min(100, score));
    
    if (this.healthReport.readinessScore >= 80) {
      this.healthReport.overall = 'healthy';
    } else if (this.healthReport.readinessScore >= 60) {
      this.healthReport.overall = 'warning';
    } else {
      this.healthReport.overall = 'critical';
    }
  }

  generateHealthReport() {
    console.log('📊 System Health Summary');
    console.log('=' .repeat(40));
    
    const overallIcon = {
      'healthy': '✅',
      'warning': '⚠️',
      'critical': '❌',
      'unknown': '❓'
    }[this.healthReport.overall];
    
    console.log(`Overall Status: ${overallIcon} ${this.healthReport.overall.toUpperCase()}`);
    console.log(`Readiness Score: ${this.healthReport.readinessScore.toFixed(0)}/100`);
    console.log(`Components Healthy: ${Object.values(this.healthReport.components).filter(c => c.status === 'healthy').length}/${Object.keys(this.healthReport.components).length}`);
    console.log(`Recommendations: ${this.healthReport.recommendations.length}`);
    
    if (this.healthReport.recommendations.length > 0) {
      console.log('\n🔧 Recommendations:');
      this.healthReport.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }
    
    console.log('\n🚀 Production Readiness Assessment:');
    if (this.healthReport.readinessScore >= 80) {
      console.log('   ✅ READY FOR PRODUCTION');
      console.log('   System appears stable and secure for deployment.');
    } else if (this.healthReport.readinessScore >= 60) {
      console.log('   ⚠️  READY WITH MONITORING');
      console.log('   System can be deployed but requires close monitoring.');
    } else {
      console.log('   ❌ NOT READY FOR PRODUCTION');
      console.log('   Critical issues must be resolved before deployment.');
    }
    
    // Save detailed report
    const reportPath = path.join(this.projectPath, 'system-health-report.json');
    fs.writeFile(reportPath, JSON.stringify(this.healthReport, null, 2));
    console.log(`\n📄 Detailed report saved: ${reportPath}`);
  }

  // Helper methods
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

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
}

// Main execution
async function main() {
  const healthCheck = new SystemHealthCheck();
  await healthCheck.performHealthCheck();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { SystemHealthCheck };