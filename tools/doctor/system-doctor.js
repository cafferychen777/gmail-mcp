/**
 * 系统诊断工具
 * 
 * Linus 哲学实践:
 * 1. 好数据结构: 统一的检查项格式，消除特殊情况
 * 2. 简洁性: 每个检查函数只做一件事
 * 3. 实用性: 检查真实存在的问题
 */

import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 检查结果的数据结构
 * 好品味: 统一格式，无特殊情况
 */
class CheckResult {
    constructor(name, status, message, details = null, autoFixable = false) {
        this.name = name;           // 检查项名称
        this.status = status;       // 'pass' | 'warning' | 'fail'
        this.message = message;     // 用户友好的消息
        this.details = details;     // 详细信息（可选）
        this.autoFixable = autoFixable; // 是否可以自动修复
        this.timestamp = new Date().toISOString();
    }

    /**
     * 创建成功结果
     */
    static pass(name, message, details = null) {
        return new CheckResult(name, 'pass', message, details, false);
    }

    /**
     * 创建警告结果
     */
    static warning(name, message, details = null, autoFixable = false) {
        return new CheckResult(name, 'warning', message, details, autoFixable);
    }

    /**
     * 创建失败结果
     */
    static fail(name, message, details = null, autoFixable = false) {
        return new CheckResult(name, 'fail', message, details, autoFixable);
    }
}

/**
 * 系统诊断核心类
 * 遵循Unix哲学：组合小工具完成复杂任务
 */
export class SystemDoctor {
    constructor() {
        this.platform = os.platform();
        this.checks = [];
        this.results = [];
    }

    /**
     * 执行所有检查
     * 好品味: 统一的检查流程，无特殊情况处理
     */
    async diagnose() {
        console.log('🔍 开始系统诊断...\n');
        
        // 注册所有检查项
        this.registerChecks();
        
        // 并行执行检查（Unix哲学：利用并发）
        const checkPromises = this.checks.map(check => this.runCheck(check));
        this.results = await Promise.all(checkPromises);
        
        return this.generateReport();
    }

    /**
     * 注册所有检查项
     * 简洁性: 每个检查都是独立的函数
     */
    registerChecks() {
        this.checks = [
            this.checkNodeJS,
            this.checkChrome,
            this.checkClaudeDesktop,
            this.checkMCPServer,
            this.checkChromeExtension,
            this.checkNetworkConnectivity,
            this.checkPermissions,
            this.checkPorts
        ];
    }

    /**
     * 安全地运行单个检查
     */
    async runCheck(checkFunction) {
        try {
            return await checkFunction.call(this);
        } catch (error) {
            return CheckResult.fail(
                checkFunction.name || 'Unknown Check',
                '检查过程中出现错误',
                error.message,
                false
            );
        }
    }

    /**
     * 检查 Node.js 版本和安装
     */
    async checkNodeJS() {
        try {
            const version = process.version;
            const majorVersion = parseInt(version.slice(1).split('.')[0]);
            
            if (majorVersion >= 18) {
                return CheckResult.pass(
                    'Node.js 版本',
                    `${version} (支持的版本)`,
                    { version, majorVersion }
                );
            } else {
                return CheckResult.fail(
                    'Node.js 版本',
                    `${version} 版本过低，需要 Node.js >= 18`,
                    { version, required: '>=18', majorVersion },
                    false // Node.js版本需要手动升级
                );
            }
        } catch (error) {
            return CheckResult.fail(
                'Node.js 版本',
                'Node.js 未安装或无法检测版本',
                error.message
            );
        }
    }

    /**
     * 检查 Chrome 浏览器安装
     */
    async checkChrome() {
        const chromePaths = this.getChromePaths();
        
        for (const chromePath of chromePaths) {
            try {
                await fs.access(chromePath);
                // Chrome存在，尝试获取版本
                const version = await this.getChromeVersion(chromePath);
                return CheckResult.pass(
                    'Chrome 浏览器',
                    `已安装 (${version || '版本未知'})`,
                    { path: chromePath, version }
                );
            } catch (error) {
                continue; // 尝试下一个路径
            }
        }
        
        return CheckResult.fail(
            'Chrome 浏览器',
            'Chrome 浏览器未安装或未找到',
            { searchedPaths: chromePaths },
            false // 需要用户手动安装Chrome
        );
    }

    /**
     * 检查 Claude Desktop 安装和配置
     */
    async checkClaudeDesktop() {
        const claudePaths = this.getClaudeDesktopPaths();
        
        for (const claudePath of claudePaths) {
            try {
                await fs.access(claudePath);
                
                // 检查配置文件
                const configPath = this.getClaudeConfigPath();
                try {
                    await fs.access(configPath);
                    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
                    
                    // 检查MCP配置
                    if (config.mcpServers && config.mcpServers['gmail-mcp']) {
                        return CheckResult.pass(
                            'Claude Desktop',
                            '已安装并正确配置 MCP',
                            { path: claudePath, configPath, config: config.mcpServers['gmail-mcp'] }
                        );
                    } else {
                        return CheckResult.warning(
                            'Claude Desktop',
                            '已安装但缺少 Gmail MCP 配置',
                            { path: claudePath, configPath },
                            true // 可以自动配置
                        );
                    }
                } catch (configError) {
                    return CheckResult.warning(
                        'Claude Desktop',
                        '已安装但配置文件有问题',
                        { path: claudePath, configPath, error: configError.message },
                        true // 可以自动修复配置
                    );
                }
            } catch (error) {
                continue;
            }
        }
        
        return CheckResult.fail(
            'Claude Desktop',
            'Claude Desktop 未安装',
            { searchedPaths: claudePaths },
            false // 需要用户手动安装
        );
    }

    /**
     * 检查 MCP 服务器状态
     */
    async checkMCPServer() {
        const serverPath = path.resolve(__dirname, '../../gmail-mcp-extension/mcp-server');
        
        try {
            // 检查服务器文件存在
            await fs.access(path.join(serverPath, 'index.js'));
            await fs.access(path.join(serverPath, 'package.json'));
            
            // 检查node_modules
            try {
                await fs.access(path.join(serverPath, 'node_modules'));
            } catch (error) {
                return CheckResult.warning(
                    'MCP 服务器',
                    '服务器文件存在但依赖未安装',
                    { serverPath, issue: 'missing_dependencies' },
                    true // 可以自动安装依赖
                );
            }
            
            // 尝试连接正在运行的服务器
            try {
                const response = await fetch('http://localhost:3456/health', {
                    timeout: 2000
                });
                
                if (response.ok) {
                    return CheckResult.pass(
                        'MCP 服务器',
                        '正在运行且响应正常',
                        { serverPath, port: 3456, status: 'running' }
                    );
                }
            } catch (fetchError) {
                return CheckResult.warning(
                    'MCP 服务器',
                    '服务器文件存在但未运行',
                    { serverPath, port: 3456, status: 'stopped' },
                    true // 可以自动启动
                );
            }
            
            return CheckResult.pass(
                'MCP 服务器',
                '服务器文件完整',
                { serverPath }
            );
            
        } catch (error) {
            return CheckResult.fail(
                'MCP 服务器',
                '服务器文件缺失或损坏',
                { serverPath, error: error.message },
                false // 需要重新安装
            );
        }
    }

    /**
     * 检查 Chrome 扩展状态
     */
    async checkChromeExtension() {
        // Chrome扩展状态较难通过文件系统检查
        // 这里提供基础的文件存在性检查
        const extensionPath = path.resolve(__dirname, '../../gmail-mcp-extension/extension');
        
        try {
            await fs.access(path.join(extensionPath, 'manifest.json'));
            await fs.access(path.join(extensionPath, 'content.js'));
            await fs.access(path.join(extensionPath, 'background.js'));
            
            return CheckResult.pass(
                'Chrome 扩展',
                '扩展文件完整（需要手动验证安装状态）',
                { extensionPath, note: 'file_check_only' }
            );
        } catch (error) {
            return CheckResult.fail(
                'Chrome 扩展',
                '扩展文件缺失',
                { extensionPath, error: error.message },
                false
            );
        }
    }

    /**
     * 检查网络连接
     */
    async checkNetworkConnectivity() {
        try {
            // 检查本地连接（MCP服务器）
            const localResponse = await this.testConnection('http://localhost:3456', 2000);
            
            // 检查Gmail访问（模拟）
            const gmailResponse = await this.testConnection('https://mail.google.com', 3000);
            
            if (localResponse && gmailResponse) {
                return CheckResult.pass(
                    '网络连接',
                    '本地服务和Gmail访问正常',
                    { local: true, gmail: true }
                );
            } else if (gmailResponse) {
                return CheckResult.warning(
                    '网络连接',
                    'Gmail可访问，但本地MCP服务器未响应',
                    { local: false, gmail: true },
                    true // 可以启动服务器
                );
            } else {
                return CheckResult.fail(
                    '网络连接',
                    '网络连接有问题',
                    { local: localResponse, gmail: gmailResponse },
                    false
                );
            }
        } catch (error) {
            return CheckResult.fail(
                '网络连接',
                '网络检查失败',
                error.message,
                false
            );
        }
    }

    /**
     * 检查必要的权限
     */
    async checkPermissions() {
        const checks = [];
        
        try {
            // 检查项目目录写权限
            const projectRoot = path.resolve(__dirname, '../..');
            const testFile = path.join(projectRoot, '.permission_test');
            
            await fs.writeFile(testFile, 'test');
            await fs.unlink(testFile);
            checks.push({ name: 'project_write', success: true });
        } catch (error) {
            checks.push({ name: 'project_write', success: false, error: error.message });
        }
        
        // 检查配置目录权限
        try {
            const configPath = this.getClaudeConfigPath();
            const configDir = path.dirname(configPath);
            await fs.access(configDir, fs.constants.W_OK);
            checks.push({ name: 'config_write', success: true });
        } catch (error) {
            checks.push({ name: 'config_write', success: false, error: error.message });
        }
        
        const failedChecks = checks.filter(c => !c.success);
        
        if (failedChecks.length === 0) {
            return CheckResult.pass(
                '文件权限',
                '所有必要权限正常',
                checks
            );
        } else {
            return CheckResult.fail(
                '文件权限',
                `缺少 ${failedChecks.length} 项权限`,
                { checks, failedChecks },
                false // 权限问题需要用户手动解决
            );
        }
    }

    /**
     * 检查端口占用
     */
    async checkPorts() {
        const requiredPorts = [3456]; // MCP服务器默认端口
        const results = [];
        
        for (const port of requiredPorts) {
            try {
                const isAvailable = await this.isPortAvailable(port);
                results.push({
                    port,
                    available: isAvailable,
                    status: isAvailable ? 'available' : 'occupied'
                });
            } catch (error) {
                results.push({
                    port,
                    available: false,
                    status: 'error',
                    error: error.message
                });
            }
        }
        
        const occupiedPorts = results.filter(r => !r.available);
        
        if (occupiedPorts.length === 0) {
            return CheckResult.pass(
                '端口检查',
                '所有必要端口可用',
                results
            );
        } else {
            return CheckResult.warning(
                '端口检查',
                `端口 ${occupiedPorts.map(p => p.port).join(', ')} 被占用`,
                results,
                true // 可以自动处理端口冲突
            );
        }
    }

    /**
     * 生成诊断报告
     */
    generateReport() {
        const passCount = this.results.filter(r => r.status === 'pass').length;
        const warningCount = this.results.filter(r => r.status === 'warning').length;
        const failCount = this.results.filter(r => r.status === 'fail').length;
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.results.length,
                passed: passCount,
                warnings: warningCount,
                failed: failCount,
                score: Math.round((passCount / this.results.length) * 100)
            },
            results: this.results,
            autoFixable: this.results.filter(r => r.autoFixable),
            recommendations: this.generateRecommendations()
        };
        
        return report;
    }

    /**
     * 生成修复建议
     */
    generateRecommendations() {
        const recommendations = [];
        
        const failedResults = this.results.filter(r => r.status === 'fail');
        const warningResults = this.results.filter(r => r.status === 'warning');
        
        if (failedResults.length > 0) {
            recommendations.push({
                priority: 'high',
                message: `发现 ${failedResults.length} 个严重问题需要解决`,
                items: failedResults.map(r => r.name)
            });
        }
        
        if (warningResults.length > 0) {
            const autoFixable = warningResults.filter(r => r.autoFixable);
            if (autoFixable.length > 0) {
                recommendations.push({
                    priority: 'medium',
                    message: `${autoFixable.length} 个问题可以自动修复`,
                    items: autoFixable.map(r => r.name),
                    action: 'gmail-mcp fix'
                });
            }
        }
        
        return recommendations;
    }

    /**
     * 平台相关的路径获取方法
     */
    getChromePaths() {
        switch (this.platform) {
            case 'darwin': // macOS
                return [
                    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                    '/Applications/Google Chrome.app'
                ];
            case 'win32': // Windows
                return [
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
                ];
            case 'linux':
                return [
                    '/usr/bin/google-chrome',
                    '/usr/bin/google-chrome-stable',
                    '/usr/bin/chromium-browser'
                ];
            default:
                return [];
        }
    }

    getClaudeDesktopPaths() {
        switch (this.platform) {
            case 'darwin':
                return ['/Applications/Claude.app'];
            case 'win32':
                return [
                    'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Programs\\Claude\\Claude.exe'
                ];
            case 'linux':
                return ['/opt/Claude/claude', '~/.local/share/applications/claude'];
            default:
                return [];
        }
    }

    getClaudeConfigPath() {
        switch (this.platform) {
            case 'darwin':
                return path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');
            case 'win32':
                return path.join(os.homedir(), 'AppData\\Roaming\\Claude\\claude_desktop_config.json');
            case 'linux':
                return path.join(os.homedir(), '.config/Claude/claude_desktop_config.json');
            default:
                return '';
        }
    }

    /**
     * 辅助方法
     */
    async getChromeVersion(chromePath) {
        return new Promise((resolve, reject) => {
            const child = spawn(chromePath, ['--version']);
            let output = '';
            
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    const match = output.match(/[\d.]+/);
                    resolve(match ? match[0] : 'Unknown');
                } else {
                    resolve('Unknown');
                }
            });
            
            child.on('error', () => {
                resolve('Unknown');
            });
            
            // 超时处理
            setTimeout(() => {
                child.kill();
                resolve('Unknown');
            }, 3000);
        });
    }

    async testConnection(url, timeout = 3000) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url, {
                signal: controller.signal,
                method: 'HEAD'
            });
            
            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = require('net').createServer();
            
            server.listen(port, () => {
                server.once('close', () => {
                    resolve(true);
                });
                server.close();
            });
            
            server.on('error', () => {
                resolve(false);
            });
        });
    }
}

export default SystemDoctor;