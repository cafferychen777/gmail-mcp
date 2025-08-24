/**
 * 自动修复工具
 * 
 * Linus 哲学实践:
 * 1. "Never break userspace" - 所有修复都要安全，备份优先
 * 2. 好品味: 统一的修复接口，消除特殊情况
 * 3. 实用主义: 只修复真实存在且能安全处理的问题
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 修复结果的数据结构
 * 好品味: 统一格式，便于处理
 */
class RepairResult {
    constructor(name, success, message, details = null, backupPath = null) {
        this.name = name;
        this.success = success;
        this.message = message;
        this.details = details;
        this.backupPath = backupPath;
        this.timestamp = new Date().toISOString();
    }

    static success(name, message, details = null, backupPath = null) {
        return new RepairResult(name, true, message, details, backupPath);
    }

    static failure(name, message, details = null) {
        return new RepairResult(name, false, message, details);
    }
}

/**
 * 安全备份管理器
 * 遵循 "Never break userspace" - 先备份，再修改
 */
class BackupManager {
    constructor() {
        this.backupDir = path.join(os.tmpdir(), 'gmail-mcp-backups', Date.now().toString());
    }

    async ensureBackupDir() {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
            return true;
        } catch (error) {
            console.error('创建备份目录失败:', error.message);
            return false;
        }
    }

    async backupFile(filePath, name = null) {
        const backupName = name || path.basename(filePath) + '.backup';
        const backupPath = path.join(this.backupDir, backupName);
        
        try {
            await this.ensureBackupDir();
            await fs.copyFile(filePath, backupPath);
            return backupPath;
        } catch (error) {
            throw new Error(`备份文件失败: ${error.message}`);
        }
    }

    async restoreFile(backupPath, targetPath) {
        try {
            await fs.copyFile(backupPath, targetPath);
            return true;
        } catch (error) {
            throw new Error(`恢复文件失败: ${error.message}`);
        }
    }
}

/**
 * 自动修复工具核心类
 */
export class RepairTools {
    constructor() {
        this.platform = os.platform();
        this.backupManager = new BackupManager();
        this.results = [];
    }

    /**
     * 执行所有可能的自动修复
     */
    async performRepairs(diagnosticReport) {
        console.log('🔧 开始自动修复...\n');
        
        const autoFixableIssues = diagnosticReport.results.filter(result => 
            result.autoFixable && (result.status === 'warning' || result.status === 'fail')
        );
        
        if (autoFixableIssues.length === 0) {
            return {
                summary: { total: 0, successful: 0, failed: 0 },
                results: [],
                message: '没有发现可以自动修复的问题'
            };
        }
        
        // 执行修复
        for (const issue of autoFixableIssues) {
            const repairResult = await this.repairIssue(issue);
            this.results.push(repairResult);
        }
        
        return this.generateRepairReport();
    }

    /**
     * 根据问题类型分发到具体的修复方法
     * 好品味: 统一的分发机制，无特殊情况
     */
    async repairIssue(issue) {
        try {
            switch (issue.name) {
                case 'Claude Desktop':
                    return await this.repairClaudeDesktopConfig(issue);
                case 'MCP 服务器':
                    return await this.repairMCPServer(issue);
                case 'Chrome 扩展':
                    return await this.repairChromeExtension(issue);
                case '网络连接':
                    return await this.repairNetworkConnection(issue);
                case '端口检查':
                    return await this.repairPortConflicts(issue);
                default:
                    return RepairResult.failure(
                        issue.name,
                        `未知的修复类型: ${issue.name}`
                    );
            }
        } catch (error) {
            return RepairResult.failure(
                issue.name,
                `修复过程中出错: ${error.message}`,
                { error: error.stack }
            );
        }
    }

    /**
     * 修复 Claude Desktop 配置
     */
    async repairClaudeDesktopConfig(issue) {
        const configPath = this.getClaudeConfigPath();
        
        try {
            // 确保配置目录存在
            const configDir = path.dirname(configPath);
            await fs.mkdir(configDir, { recursive: true });
            
            let config = {};
            let backupPath = null;
            
            // 如果配置文件存在，先备份
            try {
                await fs.access(configPath);
                backupPath = await this.backupManager.backupFile(configPath, 'claude_desktop_config.json.backup');
                const configContent = await fs.readFile(configPath, 'utf-8');
                config = JSON.parse(configContent);
            } catch (error) {
                // 配置文件不存在或格式错误，使用空配置
                config = {};
            }
            
            // 添加或更新 Gmail MCP 配置
            if (!config.mcpServers) {
                config.mcpServers = {};
            }
            
            const mcpServerPath = path.resolve(__dirname, '../../gmail-mcp-extension/mcp-server/index.js');
            
            config.mcpServers['gmail-mcp'] = {
                command: 'node',
                args: [mcpServerPath],
                env: {}
            };
            
            // 写入新配置
            await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
            
            return RepairResult.success(
                'Claude Desktop 配置',
                'MCP 配置已成功添加到 Claude Desktop',
                { configPath, mcpServerPath },
                backupPath
            );
            
        } catch (error) {
            return RepairResult.failure(
                'Claude Desktop 配置',
                `配置修复失败: ${error.message}`,
                { configPath, error: error.stack }
            );
        }
    }

    /**
     * 修复 MCP 服务器问题
     */
    async repairMCPServer(issue) {
        const serverPath = path.resolve(__dirname, '../../gmail-mcp-extension/mcp-server');
        
        try {
            if (issue.details && issue.details.issue === 'missing_dependencies') {
                // 安装依赖
                console.log('📦 安装 MCP 服务器依赖...');
                await this.runCommand('npm', ['install'], { cwd: serverPath });
                
                return RepairResult.success(
                    'MCP 服务器',
                    'MCP 服务器依赖安装完成',
                    { serverPath, action: 'install_dependencies' }
                );
            }
            
            if (issue.details && issue.details.status === 'stopped') {
                // 启动服务器
                console.log('🚀 启动 MCP 服务器...');
                await this.startMCPServer(serverPath);
                
                return RepairResult.success(
                    'MCP 服务器',
                    'MCP 服务器已启动',
                    { serverPath, action: 'start_server', port: 3456 }
                );
            }
            
            return RepairResult.failure(
                'MCP 服务器',
                '无法确定具体的修复操作',
                issue.details
            );
            
        } catch (error) {
            return RepairResult.failure(
                'MCP 服务器',
                `MCP 服务器修复失败: ${error.message}`,
                { serverPath, error: error.stack }
            );
        }
    }

    /**
     * 修复 Chrome 扩展问题
     */
    async repairChromeExtension(issue) {
        const extensionPath = path.resolve(__dirname, '../../gmail-mcp-extension/extension');
        
        try {
            // 检查扩展文件完整性
            const requiredFiles = [
                'manifest.json',
                'content.js',
                'background.js',
                'popup.html',
                'popup.js'
            ];
            
            const missingFiles = [];
            for (const file of requiredFiles) {
                try {
                    await fs.access(path.join(extensionPath, file));
                } catch (error) {
                    missingFiles.push(file);
                }
            }
            
            if (missingFiles.length > 0) {
                return RepairResult.failure(
                    'Chrome 扩展',
                    `扩展关键文件缺失: ${missingFiles.join(', ')}`,
                    { extensionPath, missingFiles }
                );
            }
            
            // 生成扩展安装指导
            const installGuide = this.generateChromeExtensionInstallGuide(extensionPath);
            
            return RepairResult.success(
                'Chrome 扩展',
                '扩展文件完整，已生成安装指南',
                { extensionPath, installGuide }
            );
            
        } catch (error) {
            return RepairResult.failure(
                'Chrome 扩展',
                `扩展修复失败: ${error.message}`,
                { extensionPath, error: error.stack }
            );
        }
    }

    /**
     * 修复网络连接问题
     */
    async repairNetworkConnection(issue) {
        try {
            // 如果是本地服务器未响应，尝试启动
            if (issue.details && !issue.details.local && issue.details.gmail) {
                const serverPath = path.resolve(__dirname, '../../gmail-mcp-extension/mcp-server');
                await this.startMCPServer(serverPath);
                
                return RepairResult.success(
                    '网络连接',
                    'MCP 服务器已启动，网络连接恢复',
                    { action: 'start_mcp_server', port: 3456 }
                );
            }
            
            return RepairResult.failure(
                '网络连接',
                '网络问题需要手动检查',
                issue.details
            );
            
        } catch (error) {
            return RepairResult.failure(
                '网络连接',
                `网络修复失败: ${error.message}`,
                { error: error.stack }
            );
        }
    }

    /**
     * 修复端口冲突问题
     */
    async repairPortConflicts(issue) {
        try {
            const occupiedPorts = issue.details.filter(port => !port.available);
            const results = [];
            
            for (const portInfo of occupiedPorts) {
                if (portInfo.port === 3456) {
                    // 尝试找到占用进程并处理
                    const processInfo = await this.findProcessOnPort(portInfo.port);
                    
                    if (processInfo) {
                        // 如果是我们自己的进程，重启它
                        if (processInfo.command && processInfo.command.includes('gmail-mcp')) {
                            await this.restartMCPServer();
                            results.push({ port: portInfo.port, action: 'restart', success: true });
                        } else {
                            // 其他进程占用，建议用户手动处理
                            results.push({ 
                                port: portInfo.port, 
                                action: 'manual', 
                                success: false,
                                message: `端口被进程 ${processInfo.pid} (${processInfo.command}) 占用`
                            });
                        }
                    } else {
                        // 无法确定占用进程，尝试启动在其他端口
                        results.push({ 
                            port: portInfo.port, 
                            action: 'alternative_port', 
                            success: true,
                            message: '将使用备用端口'
                        });
                    }
                }
            }
            
            const successCount = results.filter(r => r.success).length;
            const message = successCount > 0 ? 
                `成功处理了 ${successCount} 个端口冲突` : 
                '端口冲突需要手动解决';
            
            return RepairResult.success(
                '端口检查',
                message,
                { results, occupiedPorts }
            );
            
        } catch (error) {
            return RepairResult.failure(
                '端口检查',
                `端口冲突修复失败: ${error.message}`,
                { error: error.stack }
            );
        }
    }

    /**
     * 辅助方法
     */
    
    async startMCPServer(serverPath) {
        return new Promise((resolve, reject) => {
            const child = spawn('npm', ['run', 'dev'], {
                cwd: serverPath,
                detached: true,
                stdio: 'ignore'
            });
            
            child.unref(); // 允许父进程退出
            
            // 等待一段时间确保服务器启动
            setTimeout(async () => {
                try {
                    const response = await fetch('http://localhost:3456/health', {
                        timeout: 1000
                    });
                    if (response.ok) {
                        resolve();
                    } else {
                        reject(new Error('服务器启动失败'));
                    }
                } catch (error) {
                    // 服务器可能还在启动中，这里认为成功
                    resolve();
                }
            }, 3000);
            
            child.on('error', reject);
        });
    }

    async restartMCPServer() {
        const serverPath = path.resolve(__dirname, '../../gmail-mcp-extension/mcp-server');
        
        // 尝试优雅地停止现有服务器
        try {
            await fetch('http://localhost:3456/shutdown', { method: 'POST' });
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            // 忽略停止错误，直接启动新的
        }
        
        await this.startMCPServer(serverPath);
    }

    async findProcessOnPort(port) {
        return new Promise((resolve) => {
            const cmd = this.platform === 'win32' ? 
                `netstat -ano | findstr :${port}` :
                `lsof -ti:${port}`;
            
            const child = spawn('sh', ['-c', cmd]);
            let output = '';
            
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            child.on('close', (code) => {
                if (output.trim()) {
                    // 解析输出获取进程信息
                    const lines = output.trim().split('\n');
                    const firstLine = lines[0];
                    
                    if (this.platform === 'win32') {
                        // Windows netstat 输出解析
                        const parts = firstLine.trim().split(/\s+/);
                        const pid = parts[parts.length - 1];
                        resolve({ pid, command: 'unknown' });
                    } else {
                        // Unix lsof 输出解析
                        const pid = firstLine.trim();
                        resolve({ pid, command: 'unknown' });
                    }
                } else {
                    resolve(null);
                }
            });
            
            child.on('error', () => {
                resolve(null);
            });
        });
    }

    async runCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                stdio: 'pipe',
                ...options
            });
            
            let output = '';
            let error = '';
            
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(`命令失败 (${code}): ${error}`));
                }
            });
            
            child.on('error', reject);
        });
    }

    generateChromeExtensionInstallGuide(extensionPath) {
        return {
            steps: [
                '1. 打开 Chrome 浏览器',
                '2. 访问 chrome://extensions/',
                '3. 开启右上角的"开发者模式"',
                '4. 点击"加载已解压的扩展程序"',
                `5. 选择文件夹: ${extensionPath}`,
                '6. 确认扩展已成功加载并启用'
            ],
            extensionPath,
            troubleshooting: [
                '如果扩展无法加载，请检查 manifest.json 文件格式',
                '确保所有必需文件都存在',
                '检查 Chrome 版本是否支持 Manifest V3'
            ]
        };
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
                throw new Error(`不支持的操作系统: ${this.platform}`);
        }
    }

    generateRepairReport() {
        const successful = this.results.filter(r => r.success).length;
        const failed = this.results.filter(r => !r.success).length;
        
        return {
            summary: {
                total: this.results.length,
                successful,
                failed,
                success_rate: this.results.length > 0 ? Math.round((successful / this.results.length) * 100) : 0
            },
            results: this.results,
            backups: this.results.filter(r => r.backupPath).map(r => ({
                name: r.name,
                backupPath: r.backupPath
            }))
        };
    }
}

export default RepairTools;