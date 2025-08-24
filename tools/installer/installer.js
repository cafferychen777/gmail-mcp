#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

import { SystemDetector } from './system-detector.js';
import { UserInterface } from './ui.js';
import { ClaudeConfigManager } from './claude-config.js';
import { ExtensionManager } from './extension-manager.js';
import { PlatformAdapters } from './platform-adapters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

/**
 * Gmail MCP Bridge 安装管理器
 * 
 * 设计哲学 (Linus Style):
 * 1. 好品味: 用数据结构消除所有特殊情况
 * 2. 实用主义: 解决真实问题，不是假想威胁
 * 3. 向后兼容: 永不破坏用户现有配置
 */
export class InstallationManager {
    constructor() {
        // 核心原则: 用配置驱动，消除条件分支
        this.INSTALL_STEPS = [
            { id: 'detect_system', name: '系统环境检测', weight: 10 },
            { id: 'check_deps', name: '检查依赖', weight: 15 },
            { id: 'backup_configs', name: '备份现有配置', weight: 10 },
            { id: 'install_server', name: '安装 MCP 服务器', weight: 25 },
            { id: 'configure_claude', name: '配置 Claude Desktop', weight: 20 },
            { id: 'setup_extension', name: '配置浏览器扩展', weight: 15 },
            { id: 'verify_install', name: '验证安装', weight: 5 }
        ];

        this.systemDetector = new SystemDetector();
        this.ui = new UserInterface();
        this.claudeConfig = new ClaudeConfigManager();
        this.extensionManager = new ExtensionManager();
        this.platformAdapters = new PlatformAdapters();
        
        this.state = {
            currentStep: 0,
            totalWeight: this.INSTALL_STEPS.reduce((sum, step) => sum + step.weight, 0),
            completedWeight: 0,
            errors: [],
            backups: [],
            installPath: null
        };
    }

    /**
     * 主安装流程
     * "好代码没有特殊情况" - 所有步骤都遵循相同的模式
     */
    async install(options = {}) {
        this.ui.showWelcome();
        
        try {
            // 每个步骤都遵循相同的模式: 检查-执行-验证-更新进度
            for (let i = 0; i < this.INSTALL_STEPS.length; i++) {
                const step = this.INSTALL_STEPS[i];
                this.state.currentStep = i;
                
                this.ui.showProgress(
                    this.state.completedWeight / this.state.totalWeight,
                    `正在执行: ${step.name}`
                );

                await this._executeStep(step, options);
                this.state.completedWeight += step.weight;
            }

            this.ui.showSuccess('🎉 安装完成！您的 Gmail MCP Bridge 已准备就绪。');
            await this._showPostInstallInstructions();
            
        } catch (error) {
            await this._handleInstallError(error);
            throw error;
        }
    }

    /**
     * 执行单个安装步骤
     * 统一的错误处理，没有特殊情况
     */
    async _executeStep(step, options) {
        const methodName = `_${step.id}`;
        
        if (typeof this[methodName] !== 'function') {
            throw new Error(`安装步骤未实现: ${step.id}`);
        }

        try {
            await this[methodName](options);
        } catch (error) {
            // 统一的错误处理模式
            const enrichedError = new Error(`${step.name}失败: ${error.message}`);
            enrichedError.step = step.id;
            enrichedError.originalError = error;
            throw enrichedError;
        }
    }

    /**
     * 步骤 1: 系统环境检测
     */
    async _detect_system(options) {
        const systemInfo = await this.systemDetector.detect();
        
        // 使用适配器模式消除平台特殊情况
        this.platformAdapters.configure(systemInfo.platform);
        this.state.systemInfo = systemInfo;
        
        this.ui.showInfo(`检测到系统: ${systemInfo.platform} ${systemInfo.arch}`);
    }

    /**
     * 步骤 2: 检查依赖
     */
    async _check_deps(options) {
        const requirements = await this.systemDetector.checkRequirements();
        
        // 任何不满足的要求都是错误，没有"部分满足"的特殊情况
        const missing = requirements.filter(req => !req.satisfied);
        if (missing.length > 0) {
            const missingList = missing.map(req => `- ${req.name}: ${req.issue}`).join('\n');
            throw new Error(`缺少必要依赖:\n${missingList}\n\n请先安装缺少的依赖后重试。`);
        }

        this.ui.showSuccess('✓ 所有依赖检查通过');
    }

    /**
     * 步骤 3: 备份现有配置
     */
    async _backup_configs(options) {
        const backupDir = await this.platformAdapters.getBackupDir();
        await fs.mkdir(backupDir, { recursive: true });

        // 使用数据结构描述所有需要备份的配置
        const backupTargets = [
            {
                type: 'claude_config',
                source: await this.platformAdapters.getClaudeConfigPath(),
                name: 'Claude Desktop 配置'
            },
            {
                type: 'extension_config', 
                source: await this.platformAdapters.getExtensionConfigPath(),
                name: '扩展配置'
            }
        ];

        for (const target of backupTargets) {
            try {
                const exists = await this._fileExists(target.source);
                if (exists) {
                    const backupPath = path.join(
                        backupDir, 
                        `${target.type}_${Date.now()}.backup`
                    );
                    await fs.copyFile(target.source, backupPath);
                    this.state.backups.push({ 
                        type: target.type, 
                        original: target.source, 
                        backup: backupPath,
                        name: target.name
                    });
                    this.ui.showInfo(`✓ 已备份: ${target.name}`);
                }
            } catch (error) {
                // 备份失败不应该中断安装，但要记录
                this.ui.showWarning(`备份失败 (${target.name}): ${error.message}`);
            }
        }
    }

    /**
     * 步骤 4: 安装 MCP 服务器
     */
    async _install_server(options) {
        const projectRoot = path.resolve(__dirname, '../../gmail-mcp-extension');
        const serverDir = path.join(projectRoot, 'mcp-server');
        
        // 安装服务器依赖
        this.ui.showInfo('正在安装服务器依赖...');
        await execAsync('npm install', { cwd: serverDir });
        
        // 设置安装路径
        this.state.installPath = projectRoot;
        this.ui.showSuccess(`✓ MCP 服务器安装完成: ${serverDir}`);
    }

    /**
     * 步骤 5: 配置 Claude Desktop
     */
    async _configure_claude(options) {
        if (!this.state.installPath) {
            throw new Error('安装路径未设置');
        }

        await this.claudeConfig.updateConfig(this.state.installPath);
        this.ui.showSuccess('✓ Claude Desktop 配置已更新');
    }

    /**
     * 步骤 6: 配置浏览器扩展
     */
    async _setup_extension(options) {
        await this.extensionManager.configure(this.state.installPath);
        this.ui.showSuccess('✓ 浏览器扩展配置完成');
    }

    /**
     * 步骤 7: 验证安装
     */
    async _verify_install(options) {
        // 快速验证关键组件
        const verifications = [
            () => this.claudeConfig.verify(),
            () => this.extensionManager.verify(),
            () => this._verifyServer()
        ];

        for (const verify of verifications) {
            await verify();
        }

        this.ui.showSuccess('✓ 安装验证通过');
    }

    /**
     * 验证服务器可用性
     */
    async _verifyServer() {
        const serverScript = path.join(this.state.installPath, 'mcp-server', 'index.js');
        const exists = await this._fileExists(serverScript);
        if (!exists) {
            throw new Error('MCP 服务器脚本未找到');
        }
    }

    /**
     * 错误处理和回滚
     * "Never break userspace" - 错误时恢复用户原始状态
     */
    async _handleInstallError(error) {
        this.ui.showError(`安装失败: ${error.message}`);
        
        if (this.state.backups.length > 0) {
            const shouldRollback = await this.ui.confirm('是否恢复备份的配置文件?');
            if (shouldRollback) {
                await this._rollbackConfigs();
            }
        }

        // 提供具体的解决建议
        this._suggestSolution(error);
    }

    /**
     * 回滚配置文件
     */
    async _rollbackConfigs() {
        this.ui.showInfo('正在回滚配置...');
        
        for (const backup of this.state.backups) {
            try {
                await fs.copyFile(backup.backup, backup.original);
                this.ui.showInfo(`✓ 已恢复: ${backup.name}`);
            } catch (error) {
                this.ui.showWarning(`恢复失败 (${backup.name}): ${error.message}`);
            }
        }
    }

    /**
     * 基于错误类型提供解决建议
     */
    _suggestSolution(error) {
        // 用数据结构映射错误到解决方案，没有复杂的条件分支
        const solutions = {
            'ENOENT': '文件或目录不存在，请检查路径是否正确',
            'EACCES': '权限不足，请使用管理员权限运行',
            'ENOTDIR': '路径不是目录，请检查配置路径',
            'MODULE_NOT_FOUND': '依赖模块未找到，请运行 npm install'
        };

        const errorCode = error.code || error.step;
        const suggestion = solutions[errorCode] || '请查看详细错误信息或联系支持';
        
        this.ui.showInfo(`💡 建议: ${suggestion}`);
    }

    /**
     * 显示安装后说明
     */
    async _showPostInstallInstructions() {
        const instructions = [
            '🎯 下一步操作:',
            '1. 重启 Claude Desktop 应用',
            '2. 在 Chrome 中启用扩展 (如果尚未启用)',
            '3. 打开 Gmail，查找扩展图标',
            '4. 运行 `gmail-mcp test` 来验证一切正常工作',
            '',
            '📖 更多信息: https://github.com/your-repo/gmail-mcp'
        ];

        this.ui.showInfo(instructions.join('\n'));
    }

    /**
     * 工具函数: 检查文件是否存在
     */
    async _fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 卸载功能
     */
    async uninstall() {
        this.ui.showInfo('🗑️  开始卸载 Gmail MCP Bridge...');
        
        const confirmed = await this.ui.confirm(
            '确定要完全卸载吗？这将删除所有配置和备份。'
        );
        
        if (!confirmed) {
            this.ui.showInfo('卸载已取消');
            return;
        }

        try {
            // 卸载 Claude 配置
            await this.claudeConfig.removeConfig();
            
            // 移除扩展配置
            await this.extensionManager.removeConfig();
            
            // 清理备份目录
            const backupDir = await this.platformAdapters.getBackupDir();
            await fs.rm(backupDir, { recursive: true, force: true });
            
            this.ui.showSuccess('✅ 卸载完成');
            
        } catch (error) {
            this.ui.showError(`卸载过程中出错: ${error.message}`);
            throw error;
        }
    }
}

// CLI 入口点
if (import.meta.url === `file://${process.argv[1]}`) {
    const installer = new InstallationManager();
    
    const command = process.argv[2] || 'install';
    
    try {
        switch (command) {
            case 'install':
                await installer.install();
                break;
            case 'uninstall':
                await installer.uninstall();
                break;
            default:
                console.log('Usage: node installer.js [install|uninstall]');
                process.exit(1);
        }
    } catch (error) {
        console.error('安装失败:', error.message);
        process.exit(1);
    }
}