#!/usr/bin/env node

/**
 * Chrome 扩展详细验证测试
 * 
 * 专门测试 Chrome 扩展的配置、权限、功能完整性
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ChromeExtensionValidator {
    constructor() {
        this.projectRoot = path.resolve(__dirname);
        this.extensionPath = path.join(this.projectRoot, 'gmail-mcp-extension/extension');
        this.results = [];
    }

    async validateFullExtension() {
        console.log('🔍 Chrome 扩展详细验证测试');
        console.log('=' .repeat(50));

        const tests = [
            this.validateManifest,
            this.validateScripts,
            this.validateIcons,
            this.validatePermissions,
            this.validateContentScripts,
            this.validateBackgroundScripts,
            this.validatePopupFiles,
            this.validateNativeMessaging
        ];

        for (const test of tests) {
            try {
                const result = await test.call(this);
                this.results.push(result);
                console.log(result.passed ? `✅ ${result.name}` : `❌ ${result.name}: ${result.error}`);
            } catch (error) {
                console.log(`❌ ${test.name || 'Unknown Test'}: ${error.message}`);
                this.results.push({
                    name: test.name || 'Unknown Test',
                    passed: false,
                    error: error.message,
                    details: {}
                });
            }
        }

        return this.generateReport();
    }

    async validateManifest() {
        const manifestPath = path.join(this.extensionPath, 'manifest.json');
        
        try {
            const manifestContent = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestContent);

            // 检查必需字段
            const requiredFields = ['name', 'version', 'manifest_version', 'description'];
            const missingFields = requiredFields.filter(field => !manifest[field]);

            if (missingFields.length > 0) {
                return {
                    name: 'Manifest.json 基础字段验证',
                    passed: false,
                    error: `缺少必需字段: ${missingFields.join(', ')}`,
                    details: { missingFields, manifest }
                };
            }

            // 检查 manifest 版本
            if (manifest.manifest_version !== 3) {
                return {
                    name: 'Manifest.json 基础字段验证',
                    passed: false,
                    error: `不支持的 manifest 版本: ${manifest.manifest_version}，推荐使用 v3`,
                    details: { manifestVersion: manifest.manifest_version }
                };
            }

            return {
                name: 'Manifest.json 基础字段验证',
                passed: true,
                details: {
                    name: manifest.name,
                    version: manifest.version,
                    manifestVersion: manifest.manifest_version,
                    hasDescription: !!manifest.description
                }
            };

        } catch (error) {
            return {
                name: 'Manifest.json 基础字段验证',
                passed: false,
                error: error.message,
                details: { manifestPath }
            };
        }
    }

    async validateScripts() {
        const manifestPath = path.join(this.extensionPath, 'manifest.json');
        
        try {
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
            const scriptFiles = [];

            // 收集所有脚本文件
            if (manifest.content_scripts) {
                manifest.content_scripts.forEach(cs => {
                    if (cs.js) scriptFiles.push(...cs.js);
                });
            }

            if (manifest.background && manifest.background.scripts) {
                scriptFiles.push(...manifest.background.scripts);
            }

            if (manifest.background && manifest.background.service_worker) {
                scriptFiles.push(manifest.background.service_worker);
            }

            // 验证脚本文件存在
            const missingScripts = [];
            for (const script of scriptFiles) {
                try {
                    await fs.access(path.join(this.extensionPath, script));
                } catch (error) {
                    missingScripts.push(script);
                }
            }

            if (missingScripts.length > 0) {
                return {
                    name: '脚本文件完整性验证',
                    passed: false,
                    error: `缺少脚本文件: ${missingScripts.join(', ')}`,
                    details: { missingScripts, totalScripts: scriptFiles.length }
                };
            }

            return {
                name: '脚本文件完整性验证',
                passed: true,
                details: { 
                    scriptFiles,
                    totalScripts: scriptFiles.length
                }
            };

        } catch (error) {
            return {
                name: '脚本文件完整性验证',
                passed: false,
                error: error.message,
                details: {}
            };
        }
    }

    async validateIcons() {
        const manifestPath = path.join(this.extensionPath, 'manifest.json');
        
        try {
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
            
            if (!manifest.icons) {
                return {
                    name: '图标文件验证',
                    passed: false,
                    error: 'manifest.json 中未定义 icons',
                    details: {}
                };
            }

            const iconSizes = Object.keys(manifest.icons);
            const missingIcons = [];

            for (const size of iconSizes) {
                const iconPath = manifest.icons[size];
                try {
                    await fs.access(path.join(this.extensionPath, iconPath));
                } catch (error) {
                    missingIcons.push(`${size}px: ${iconPath}`);
                }
            }

            if (missingIcons.length > 0) {
                return {
                    name: '图标文件验证',
                    passed: false,
                    error: `缺少图标文件: ${missingIcons.join(', ')}`,
                    details: { missingIcons, definedIcons: iconSizes }
                };
            }

            return {
                name: '图标文件验证',
                passed: true,
                details: { 
                    iconSizes,
                    totalIcons: iconSizes.length
                }
            };

        } catch (error) {
            return {
                name: '图标文件验证',
                passed: false,
                error: error.message,
                details: {}
            };
        }
    }

    async validatePermissions() {
        const manifestPath = path.join(this.extensionPath, 'manifest.json');
        
        try {
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
            const permissions = manifest.permissions || [];
            
            // Gmail MCP Bridge 必需的权限
            const requiredPermissions = ['activeTab', 'storage'];
            const missingPermissions = requiredPermissions.filter(p => !permissions.includes(p));

            // 危险权限检查（应该避免的权限）
            const dangerousPermissions = ['tabs', '<all_urls>', 'webRequest', 'webRequestBlocking', 'background'];
            const foundDangerousPermissions = permissions.filter(p => dangerousPermissions.includes(p));

            // Gmail 相关权限检查
            const gmailHostPermissions = manifest.host_permissions || [];
            const hasGmailAccess = gmailHostPermissions.some(hp => 
                hp.includes('mail.google.com') || hp.includes('gmail.com')
            );

            if (missingPermissions.length > 0) {
                return {
                    name: '权限配置验证',
                    passed: false,
                    error: `缺少必需权限: ${missingPermissions.join(', ')}`,
                    details: { 
                        missingPermissions, 
                        currentPermissions: permissions,
                        hostPermissions: gmailHostPermissions
                    }
                };
            }

            // 如果有危险权限，给出警告但不算失败
            const hasSecurityConcerns = foundDangerousPermissions.length > 0;

            return {
                name: '权限配置验证',
                passed: true,
                details: {
                    permissions,
                    hostPermissions: gmailHostPermissions,
                    hasGmailAccess,
                    dangerousPermissions: foundDangerousPermissions,
                    hasSecurityConcerns,
                    securityScore: hasSecurityConcerns ? 'medium' : 'high'
                }
            };

        } catch (error) {
            return {
                name: '权限配置验证',
                passed: false,
                error: error.message,
                details: {}
            };
        }
    }

    async validateContentScripts() {
        const manifestPath = path.join(this.extensionPath, 'manifest.json');
        
        try {
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
            
            if (!manifest.content_scripts || manifest.content_scripts.length === 0) {
                return {
                    name: 'Content Scripts 配置验证',
                    passed: false,
                    error: '未配置 content_scripts，Gmail 功能需要内容脚本',
                    details: {}
                };
            }

            const contentScript = manifest.content_scripts[0];
            
            // 检查是否匹配 Gmail
            const matches = contentScript.matches || [];
            const hasGmailMatch = matches.some(match => 
                match.includes('mail.google.com') || match.includes('gmail.com')
            );

            if (!hasGmailMatch) {
                return {
                    name: 'Content Scripts 配置验证',
                    passed: false,
                    error: 'Content script 未配置匹配 Gmail 域名',
                    details: { matches }
                };
            }

            // 检查注入时机
            const runAt = contentScript.run_at || 'document_idle';
            const recommendedRunAt = ['document_start', 'document_idle'];
            
            return {
                name: 'Content Scripts 配置验证',
                passed: true,
                details: {
                    matches,
                    hasGmailMatch,
                    runAt,
                    jsFiles: contentScript.js || [],
                    cssFiles: contentScript.css || []
                }
            };

        } catch (error) {
            return {
                name: 'Content Scripts 配置验证',
                passed: false,
                error: error.message,
                details: {}
            };
        }
    }

    async validateBackgroundScripts() {
        const manifestPath = path.join(this.extensionPath, 'manifest.json');
        
        try {
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
            
            // Manifest V3 使用 service_worker
            if (manifest.manifest_version === 3) {
                if (!manifest.background || !manifest.background.service_worker) {
                    return {
                        name: 'Background Scripts 验证',
                        passed: false,
                        error: 'Manifest V3 需要配置 background.service_worker',
                        details: { manifestVersion: 3 }
                    };
                }

                const serviceWorkerPath = manifest.background.service_worker;
                try {
                    await fs.access(path.join(this.extensionPath, serviceWorkerPath));
                } catch (error) {
                    return {
                        name: 'Background Scripts 验证',
                        passed: false,
                        error: `Service Worker 文件不存在: ${serviceWorkerPath}`,
                        details: { serviceWorkerPath }
                    };
                }

                return {
                    name: 'Background Scripts 验证',
                    passed: true,
                    details: {
                        type: 'service_worker',
                        serviceWorkerPath,
                        manifestVersion: 3
                    }
                };
            }

            return {
                name: 'Background Scripts 验证',
                passed: true,
                details: { note: 'Background scripts validation skipped for non-V3 manifest' }
            };

        } catch (error) {
            return {
                name: 'Background Scripts 验证',
                passed: false,
                error: error.message,
                details: {}
            };
        }
    }

    async validatePopupFiles() {
        const manifestPath = path.join(this.extensionPath, 'manifest.json');
        
        try {
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
            
            if (!manifest.action && !manifest.browser_action) {
                return {
                    name: 'Popup 文件验证',
                    passed: true,
                    details: { note: 'No popup configured, which is acceptable' }
                };
            }

            const actionConfig = manifest.action || manifest.browser_action;
            
            if (!actionConfig.default_popup) {
                return {
                    name: 'Popup 文件验证',
                    passed: true,
                    details: { note: 'Action configured without popup' }
                };
            }

            const popupPath = actionConfig.default_popup;
            try {
                await fs.access(path.join(this.extensionPath, popupPath));
            } catch (error) {
                return {
                    name: 'Popup 文件验证',
                    passed: false,
                    error: `Popup 文件不存在: ${popupPath}`,
                    details: { popupPath }
                };
            }

            return {
                name: 'Popup 文件验证',
                passed: true,
                details: {
                    popupPath,
                    hasDefaultIcon: !!actionConfig.default_icon,
                    hasDefaultTitle: !!actionConfig.default_title
                }
            };

        } catch (error) {
            return {
                name: 'Popup 文件验证',
                passed: false,
                error: error.message,
                details: {}
            };
        }
    }

    async validateNativeMessaging() {
        const manifestPath = path.join(this.extensionPath, 'manifest.json');
        
        try {
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
            const permissions = manifest.permissions || [];
            
            const hasNativeMessaging = permissions.includes('nativeMessaging');
            
            if (!hasNativeMessaging) {
                return {
                    name: 'Native Messaging 配置验证',
                    passed: false,
                    error: 'Gmail MCP Bridge 需要 nativeMessaging 权限与 MCP 服务器通信',
                    details: { permissions }
                };
            }

            return {
                name: 'Native Messaging 配置验证',
                passed: true,
                details: { hasNativeMessaging }
            };

        } catch (error) {
            return {
                name: 'Native Messaging 配置验证',
                passed: false,
                error: error.message,
                details: {}
            };
        }
    }

    generateReport() {
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;

        console.log('\n📊 Chrome 扩展验证结果:');
        console.log(`   ✅ 通过: ${passed}/${total}`);
        console.log(`   ❌ 失败: ${failed}/${total}`);
        console.log(`   📈 成功率: ${Math.round((passed / total) * 100)}%`);

        if (failed > 0) {
            console.log('\n❌ 失败的验证项目:');
            this.results.filter(r => !r.passed).forEach(result => {
                console.log(`   • ${result.name}: ${result.error}`);
            });
        }

        const securityAnalysis = this.analyzeSecurityImplications();
        console.log('\n🔒 安全性分析:');
        console.log(`   安全级别: ${securityAnalysis.level}`);
        console.log(`   风险评估: ${securityAnalysis.risk}`);
        if (securityAnalysis.recommendations.length > 0) {
            console.log('   建议:');
            securityAnalysis.recommendations.forEach(rec => {
                console.log(`     - ${rec}`);
            });
        }

        return {
            summary: { total, passed, failed, successRate: Math.round((passed / total) * 100) },
            results: this.results,
            security: securityAnalysis,
            extensionPath: this.extensionPath,
            timestamp: new Date().toISOString()
        };
    }

    analyzeSecurityImplications() {
        const permissionsResult = this.results.find(r => r.name === '权限配置验证');
        
        if (!permissionsResult || !permissionsResult.passed) {
            return {
                level: 'UNKNOWN',
                risk: 'Cannot assess - permissions validation failed',
                recommendations: ['Fix permissions configuration first']
            };
        }

        const details = permissionsResult.details;
        const dangerousPermissions = details.dangerousPermissions || [];
        const hasSecurityConcerns = details.hasSecurityConcerns || false;

        let level = 'HIGH';
        let risk = 'Low risk';
        const recommendations = [];

        if (hasSecurityConcerns) {
            level = 'MEDIUM';
            risk = 'Medium risk - some potentially dangerous permissions detected';
            recommendations.push('Review the necessity of dangerous permissions');
            recommendations.push('Consider using more specific permissions if possible');
        }

        if (dangerousPermissions.includes('<all_urls>')) {
            level = 'LOW';
            risk = 'High risk - can access all websites';
            recommendations.push('Replace <all_urls> with specific host permissions');
        }

        if (dangerousPermissions.includes('webRequest')) {
            recommendations.push('WebRequest permission allows intercepting all network traffic');
        }

        if (!details.hasGmailAccess) {
            recommendations.push('Ensure Gmail access permissions are properly configured');
        }

        return { level, risk, recommendations };
    }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    const validator = new ChromeExtensionValidator();
    
    try {
        const report = await validator.validateFullExtension();
        console.log('\n✅ Chrome 扩展验证完成');
        
        // 如果有失败的测试，退出码为1
        process.exit(report.summary.failed > 0 ? 1 : 0);
        
    } catch (error) {
        console.error('\n💥 Chrome 扩展验证失败:', error.message);
        process.exit(1);
    }
}

export default ChromeExtensionValidator;