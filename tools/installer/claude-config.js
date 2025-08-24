import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Claude Desktop 配置管理器
 * 
 * Linus 哲学应用:
 * 1. "Never break userspace" - 永远备份用户现有配置
 * 2. 数据结构优先 - 用配置模板而非代码生成配置  
 * 3. 消除特殊情况 - 统一的 JSON 操作，不管平台
 */
export class ClaudeConfigManager {
    constructor() {
        // 平台无关的配置路径映射
        this.PLATFORM_CONFIG_PATHS = {
            darwin: '~/Library/Application Support/Claude/claude_desktop_config.json',
            win32: '%APPDATA%\\Claude\\claude_desktop_config.json', 
            linux: '~/.config/Claude/claude_desktop_config.json'
        };
        
        // MCP 服务器配置模板
        // 用数据描述配置，而不是代码生成
        this.MCP_CONFIG_TEMPLATE = {
            name: "gmail-mcp",
            description: "Gmail MCP Bridge - Claude Desktop integration for Gmail",
            command: "node",
            args: [],
            env: {
                "NODE_ENV": "production"
            }
        };
        
        this.platform = os.platform();
        this.configPath = this._resolvePath(this.PLATFORM_CONFIG_PATHS[this.platform]);
    }

    /**
     * 更新 Claude Desktop 配置
     * 核心原则: 增量更新，不破坏现有配置
     */
    async updateConfig(installPath) {
        if (!installPath) {
            throw new Error('安装路径不能为空');
        }

        const serverScript = path.join(installPath, 'mcp-server', 'index.js');
        
        // 验证服务器脚本存在
        try {
            await fs.access(serverScript);
        } catch {
            throw new Error(`MCP 服务器脚本不存在: ${serverScript}`);
        }

        // 确保配置目录存在
        const configDir = path.dirname(this.configPath);
        await fs.mkdir(configDir, { recursive: true });

        // 读取或创建配置
        let config = await this._readConfig();
        
        // 构建 MCP 服务器配置
        const mcpConfig = {
            ...this.MCP_CONFIG_TEMPLATE,
            args: [serverScript]
        };

        // 更新配置（增量合并，不破坏现有配置）
        config = this._mergeConfig(config, mcpConfig);

        // 写入配置
        await this._writeConfig(config);
        
        return {
            configPath: this.configPath,
            serverPath: serverScript,
            config: config
        };
    }

    /**
     * 读取现有配置
     * 处理各种边界情况：文件不存在、JSON 无效等
     */
    async _readConfig() {
        try {
            const content = await fs.readFile(this.configPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // 文件不存在，返回默认配置
                return this._getDefaultConfig();
            } else if (error instanceof SyntaxError) {
                // JSON 格式错误，备份并创建新配置
                await this._backupInvalidConfig();
                return this._getDefaultConfig();
            } else {
                throw new Error(`读取配置文件失败: ${error.message}`);
            }
        }
    }

    /**
     * 写入配置文件
     * 原子操作：先写临时文件，再替换
     */
    async _writeConfig(config) {
        const tempPath = `${this.configPath}.tmp`;
        
        try {
            // 格式化 JSON，保持可读性
            const jsonContent = JSON.stringify(config, null, 2);
            
            // 先写入临时文件
            await fs.writeFile(tempPath, jsonContent, 'utf-8');
            
            // 原子替换
            await fs.rename(tempPath, this.configPath);
            
        } catch (error) {
            // 清理临时文件
            try {
                await fs.unlink(tempPath);
            } catch {}
            
            throw new Error(`写入配置文件失败: ${error.message}`);
        }
    }

    /**
     * 合并配置
     * 智能合并：新增我们的 MCP 服务器，保留用户其他配置
     */
    _mergeConfig(existingConfig, mcpConfig) {
        // 确保配置结构存在
        if (!existingConfig.mcpServers) {
            existingConfig.mcpServers = {};
        }

        // 更新或添加我们的 MCP 服务器配置
        existingConfig.mcpServers[mcpConfig.name] = {
            command: mcpConfig.command,
            args: mcpConfig.args,
            env: mcpConfig.env
        };

        return existingConfig;
    }

    /**
     * 获取默认配置
     */
    _getDefaultConfig() {
        return {
            mcpServers: {}
        };
    }

    /**
     * 备份无效的配置文件
     */
    async _backupInvalidConfig() {
        const backupPath = `${this.configPath}.invalid.${Date.now()}`;
        try {
            await fs.copyFile(this.configPath, backupPath);
            console.warn(`警告: 原配置文件格式无效，已备份为: ${backupPath}`);
        } catch {
            // 备份失败就算了，不影响主流程
        }
    }

    /**
     * 验证配置
     */
    async verify() {
        try {
            const config = await this._readConfig();
            
            // 检查我们的 MCP 服务器是否存在
            const ourConfig = config.mcpServers?.[this.MCP_CONFIG_TEMPLATE.name];
            if (!ourConfig) {
                throw new Error('Gmail MCP 服务器配置未找到');
            }

            // 检查服务器脚本路径
            const serverScript = ourConfig.args?.[0];
            if (!serverScript) {
                throw new Error('MCP 服务器脚本路径未配置');
            }

            try {
                await fs.access(serverScript);
            } catch {
                throw new Error(`MCP 服务器脚本不存在: ${serverScript}`);
            }

            return {
                valid: true,
                configPath: this.configPath,
                serverScript: serverScript,
                config: ourConfig
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                configPath: this.configPath
            };
        }
    }

    /**
     * 移除配置
     * 卸载时使用
     */
    async removeConfig() {
        try {
            const config = await this._readConfig();
            
            // 移除我们的 MCP 服务器配置
            if (config.mcpServers && config.mcpServers[this.MCP_CONFIG_TEMPLATE.name]) {
                delete config.mcpServers[this.MCP_CONFIG_TEMPLATE.name];
                
                // 如果 mcpServers 为空，也可以保留（不破坏用户配置结构）
                await this._writeConfig(config);
            }
            
            return true;
        } catch (error) {
            throw new Error(`移除配置失败: ${error.message}`);
        }
    }

    /**
     * 获取配置状态
     * 用于状态检查命令
     */
    async getStatus() {
        const verification = await this.verify();
        
        if (verification.valid) {
            return {
                status: 'configured',
                message: 'Claude Desktop 配置正常',
                details: {
                    configPath: verification.configPath,
                    serverScript: verification.serverScript
                }
            };
        } else {
            return {
                status: 'error',
                message: `配置问题: ${verification.error}`,
                details: {
                    configPath: verification.configPath
                }
            };
        }
    }

    /**
     * 修复配置
     * 尝试自动修复常见问题
     */
    async repairConfig(installPath) {
        const issues = [];
        const fixes = [];
        
        try {
            // 检查配置文件是否存在
            try {
                await fs.access(this.configPath);
            } catch {
                issues.push('配置文件不存在');
                await this.updateConfig(installPath);
                fixes.push('已创建配置文件');
                return { issues, fixes };
            }

            // 检查配置是否有效
            const verification = await this.verify();
            if (!verification.valid) {
                issues.push(verification.error);
                
                // 尝试重新配置
                await this.updateConfig(installPath);
                fixes.push('已修复配置');
            }

            return { issues, fixes };
        } catch (error) {
            throw new Error(`配置修复失败: ${error.message}`);
        }
    }

    /**
     * 路径解析
     * 处理 ~ 和环境变量
     */
    _resolvePath(pathStr) {
        if (!pathStr) return pathStr;
        
        // 处理波浪号
        if (pathStr.startsWith('~')) {
            pathStr = path.join(os.homedir(), pathStr.slice(1));
        }
        
        // 处理环境变量
        pathStr = pathStr.replace(/%([^%]+)%/g, (match, envVar) => {
            return process.env[envVar] || match;
        });
        
        return path.resolve(pathStr);
    }

    /**
     * 显示当前配置
     * 调试用
     */
    async showCurrentConfig() {
        try {
            const config = await this._readConfig();
            return {
                path: this.configPath,
                content: config,
                ourConfig: config.mcpServers?.[this.MCP_CONFIG_TEMPLATE.name] || null
            };
        } catch (error) {
            return {
                path: this.configPath,
                error: error.message
            };
        }
    }
}