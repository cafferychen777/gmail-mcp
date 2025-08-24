import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * 跨平台适配器
 * 
 * Linus 哲学的完美体现:
 * 1. "好品味" - 用一个统一的接口消除所有平台特殊情况
 * 2. 数据结构优先 - 所有平台差异都在配置数据中
 * 3. 消除条件分支 - 调用者不需要知道平台差异
 */
export class PlatformAdapters {
    constructor() {
        // 核心理念: 把所有平台差异都抽象到这个数据结构中
        // 这样其他模块就不需要任何 if (platform === 'xxx') 的分支了
        this.PLATFORM_CONFIGS = {
            darwin: {
                name: 'macOS',
                homeDir: os.homedir(),
                pathSeparator: '/',
                
                // 路径配置
                paths: {
                    claude: '~/Library/Application Support/Claude',
                    chromeData: '~/Library/Application Support/Google/Chrome',
                    chromeExecutable: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                    nativeMessaging: '~/Library/Application Support/Google/Chrome/NativeMessagingHosts',
                    backup: '~/Library/Application Support/gmail-mcp-backups'
                },
                
                // 命令配置
                commands: {
                    node: 'node',
                    npm: 'npm',
                    chrome: '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome'
                },
                
                // 文件权限
                permissions: {
                    executable: 0o755,
                    configFile: 0o644,
                    directory: 0o755
                },
                
                // 环境变量
                envVars: {
                    home: 'HOME',
                    user: 'USER',
                    path: 'PATH'
                }
            },
            
            win32: {
                name: 'Windows',
                homeDir: os.homedir(),
                pathSeparator: '\\',
                
                paths: {
                    claude: '%APPDATA%\\Claude',
                    chromeData: '%LOCALAPPDATA%\\Google\\Chrome\\User Data',
                    chromeExecutable: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    nativeMessaging: '%LOCALAPPDATA%\\Google\\Chrome\\User Data\\NativeMessagingHosts',
                    backup: '%APPDATA%\\gmail-mcp-backups'
                },
                
                commands: {
                    node: 'node.exe',
                    npm: 'npm.cmd',
                    chrome: '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"'
                },
                
                permissions: {
                    executable: null, // Windows doesn't use Unix permissions
                    configFile: null,
                    directory: null
                },
                
                envVars: {
                    home: 'USERPROFILE',
                    user: 'USERNAME',
                    path: 'PATH'
                }
            },
            
            linux: {
                name: 'Linux',
                homeDir: os.homedir(),
                pathSeparator: '/',
                
                paths: {
                    claude: '~/.config/Claude',
                    chromeData: '~/.config/google-chrome',
                    chromeExecutable: '/usr/bin/google-chrome',
                    nativeMessaging: '~/.config/google-chrome/NativeMessagingHosts',
                    backup: '~/.local/share/gmail-mcp-backups'
                },
                
                commands: {
                    node: 'node',
                    npm: 'npm',
                    chrome: 'google-chrome'
                },
                
                permissions: {
                    executable: 0o755,
                    configFile: 0o644,
                    directory: 0o755
                },
                
                envVars: {
                    home: 'HOME',
                    user: 'USER',
                    path: 'PATH'
                }
            }
        };
        
        this.currentPlatform = os.platform();
        this.config = this.PLATFORM_CONFIGS[this.currentPlatform];
        
        if (!this.config) {
            throw new Error(`不支持的操作系统: ${this.currentPlatform}`);
        }
    }

    /**
     * 配置平台适配器
     * 虽然构造函数已经做了配置，但保留这个方法以防需要重新配置
     */
    configure(platform) {
        if (platform && platform !== this.currentPlatform) {
            this.currentPlatform = platform;
            this.config = this.PLATFORM_CONFIGS[platform];
            
            if (!this.config) {
                throw new Error(`不支持的操作系统: ${platform}`);
            }
        }
        
        return this.config;
    }

    /**
     * 获取 Claude Desktop 配置路径
     * 统一接口，消除平台差异
     */
    async getClaudeConfigPath() {
        const claudeDir = this.resolvePath(this.config.paths.claude);
        return path.join(claudeDir, 'claude_desktop_config.json');
    }

    /**
     * 获取 Chrome 数据目录路径
     */
    async getChromeDataPath() {
        return this.resolvePath(this.config.paths.chromeData);
    }

    /**
     * 获取 Chrome 可执行文件路径
     */
    async getChromeExecutablePath() {
        return this.config.paths.chromeExecutable;
    }

    /**
     * 获取扩展配置路径
     */
    async getExtensionConfigPath() {
        const chromeData = await this.getChromeDataPath();
        return path.join(chromeData, 'Default', 'Extensions');
    }

    /**
     * 获取 Native Messaging 主机配置路径
     */
    async getNativeMessagingPath() {
        return this.resolvePath(this.config.paths.nativeMessaging);
    }

    /**
     * 获取备份目录路径
     */
    async getBackupDir() {
        return this.resolvePath(this.config.paths.backup);
    }

    /**
     * 解析路径
     * 处理所有平台的路径变量和特殊符号
     */
    resolvePath(pathStr) {
        if (!pathStr) return pathStr;
        
        let resolvedPath = pathStr;
        
        // 处理波浪号 (Unix-like 系统)
        if (resolvedPath.startsWith('~')) {
            resolvedPath = path.join(this.config.homeDir, resolvedPath.slice(1));
        }
        
        // 处理环境变量
        resolvedPath = this._expandEnvironmentVariables(resolvedPath);
        
        // 规范化路径分隔符
        resolvedPath = this._normalizePath(resolvedPath);
        
        return path.resolve(resolvedPath);
    }

    /**
     * 展开环境变量
     * 支持 Unix 风格 ($VAR) 和 Windows 风格 (%VAR%)
     */
    _expandEnvironmentVariables(pathStr) {
        // Windows 风格: %VARIABLE%
        pathStr = pathStr.replace(/%([^%]+)%/g, (match, varName) => {
            return process.env[varName] || match;
        });
        
        // Unix 风格: $VARIABLE
        pathStr = pathStr.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, varName) => {
            return process.env[varName] || match;
        });
        
        return pathStr;
    }

    /**
     * 规范化路径
     * 确保使用当前平台的路径分隔符
     */
    _normalizePath(pathStr) {
        // 将所有分隔符都替换为当前平台的分隔符
        return pathStr.replace(/[/\\]/g, path.sep);
    }

    /**
     * 获取命令
     * 返回平台特定的命令名称
     */
    getCommand(commandName) {
        return this.config.commands[commandName] || commandName;
    }

    /**
     * 设置文件权限
     * 跨平台的权限设置
     */
    async setFilePermissions(filePath, type = 'configFile') {
        const permission = this.config.permissions[type];
        
        if (permission !== null && permission !== undefined) {
            try {
                await fs.chmod(filePath, permission);
            } catch (error) {
                // 权限设置失败不应该中断主流程
                console.warn(`警告: 无法设置文件权限 ${filePath}: ${error.message}`);
            }
        }
    }

    /**
     * 创建目录
     * 跨平台的目录创建，自动设置权限
     */
    async createDirectory(dirPath) {
        await fs.mkdir(dirPath, { recursive: true });
        await this.setFilePermissions(dirPath, 'directory');
    }

    /**
     * 检查路径是否存在
     */
    async pathExists(pathStr) {
        try {
            await fs.access(this.resolvePath(pathStr));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 获取系统信息
     */
    getSystemInfo() {
        return {
            platform: this.currentPlatform,
            platformName: this.config.name,
            arch: os.arch(),
            nodeVersion: process.version,
            homeDir: this.config.homeDir,
            pathSeparator: this.config.pathSeparator
        };
    }

    /**
     * 获取环境变量
     */
    getEnvironmentVariable(varName) {
        const platformVarName = this.config.envVars[varName] || varName;
        return process.env[platformVarName];
    }

    /**
     * 检查是否是管理员/root权限
     */
    async isElevated() {
        switch (this.currentPlatform) {
            case 'win32':
                // Windows: 检查是否是管理员
                try {
                    await fs.access('C:\\Windows\\System32', fs.constants.W_OK);
                    return true;
                } catch {
                    return false;
                }
                
            case 'darwin':
            case 'linux':
                // Unix-like: 检查是否是 root 或有 sudo 权限
                return process.getuid && process.getuid() === 0;
                
            default:
                return false;
        }
    }

    /**
     * 获取临时目录
     */
    getTempDir() {
        return os.tmpdir();
    }

    /**
     * 创建平台特定的启动脚本
     */
    async createLaunchScript(scriptName, command, args = []) {
        const tempDir = this.getTempDir();
        let scriptPath, scriptContent;
        
        switch (this.currentPlatform) {
            case 'win32':
                scriptPath = path.join(tempDir, `${scriptName}.bat`);
                scriptContent = `@echo off\n"${command}" ${args.join(' ')}`;
                break;
                
            case 'darwin':
            case 'linux':
                scriptPath = path.join(tempDir, `${scriptName}.sh`);
                scriptContent = `#!/bin/bash\n"${command}" ${args.join(' ')}`;
                break;
                
            default:
                throw new Error(`不支持在 ${this.currentPlatform} 上创建启动脚本`);
        }
        
        await fs.writeFile(scriptPath, scriptContent, 'utf-8');
        await this.setFilePermissions(scriptPath, 'executable');
        
        return scriptPath;
    }

    /**
     * 获取所有配置路径
     * 一次性返回所有需要的路径，避免多次调用
     */
    async getAllPaths() {
        const paths = {};
        
        for (const [key, pathTemplate] of Object.entries(this.config.paths)) {
            paths[key] = this.resolvePath(pathTemplate);
        }
        
        // 添加一些派生路径
        paths.claudeConfig = path.join(paths.claude, 'claude_desktop_config.json');
        paths.extensionDir = path.join(paths.chromeData, 'Default', 'Extensions');
        paths.nativeHostConfig = path.join(paths.nativeMessaging, 'com.gmail_mcp.native_host.json');
        
        return paths;
    }

    /**
     * 检查所有关键路径的可写性
     */
    async checkPathPermissions() {
        const paths = await this.getAllPaths();
        const results = {};
        
        for (const [name, pathStr] of Object.entries(paths)) {
            try {
                const parentDir = path.dirname(pathStr);
                await fs.access(parentDir, fs.constants.W_OK);
                results[name] = { writable: true, path: pathStr };
            } catch (error) {
                results[name] = { 
                    writable: false, 
                    path: pathStr, 
                    error: error.message 
                };
            }
        }
        
        return results;
    }

    /**
     * 平台特定的清理操作
     */
    async cleanup() {
        // 不同平台可能有不同的清理需求
        // 目前保持简单，未来可以扩展
        try {
            // 清理临时文件
            // 这里可以添加平台特定的清理逻辑
        } catch (error) {
            console.warn(`清理操作警告: ${error.message}`);
        }
    }
}