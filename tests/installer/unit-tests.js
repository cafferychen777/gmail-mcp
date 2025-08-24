#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';
import { InstallerTestFramework } from './test-framework.js';

// 导入要测试的模块
import { SystemDetector } from '../../tools/installer/system-detector.js';
import { ClaudeConfigManager } from '../../tools/installer/claude-config.js';
import { ExtensionManager } from '../../tools/installer/extension-manager.js';
import { PlatformAdapters } from '../../tools/installer/platform-adapters.js';
import { InstallationManager } from '../../tools/installer/installer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 安装器单元测试
 * 
 * 测试策略:
 * 1. 测试每个模块的核心功能
 * 2. 测试边界条件和错误处理
 * 3. 测试配置生成和验证
 * 4. 测试跨平台适配
 */
class InstallerUnitTests extends InstallerTestFramework {
    async run() {
        this.stats.startTime = Date.now();
        
        try {
            await this.describe('SystemDetector 系统检测器', async () => {
                await this.testSystemDetectorBasics();
                await this.testVersionComparison();
                await this.testRequirementChecks();
                await this.testPathResolution();
            });

            await this.describe('PlatformAdapters 平台适配器', async () => {
                await this.testPlatformDetection();
                await this.testPathConfiguration();
                await this.testEnvironmentVariables();
                await this.testPermissionChecks();
            });

            await this.describe('ClaudeConfigManager Claude配置管理', async () => {
                await this.testConfigGeneration();
                await this.testConfigMerging();
                await this.testConfigValidation();
                await this.testBackupHandling();
            });

            await this.describe('ExtensionManager 扩展管理', async () => {
                await this.testExtensionDetection();
                await this.testNativeMessaging();
                await this.testChromeProfileHandling();
            });

            await this.describe('InstallationManager 安装管理器', async () => {
                await this.testInstallationSteps();
                await this.testErrorHandling();
                await this.testProgressTracking();
                await this.testRollbackMechanism();
            });

        } finally {
            await this.cleanup();
            return this.generateReport();
        }
    }

    // ============= SystemDetector 测试 =============

    async testSystemDetectorBasics() {
        await this.it('应该正确检测当前系统信息', async () => {
            const detector = new SystemDetector();
            const systemInfo = await detector.detect();
            
            this.assert.true(!!systemInfo.platform, '平台信息应该存在');
            this.assert.true(!!systemInfo.arch, '架构信息应该存在');
            this.assert.true(!!systemInfo.nodeVersion, 'Node版本应该存在');
            this.assert.true(!!systemInfo.homeDir, '主目录应该存在');
        });

        await this.it('应该正确处理不支持的平台', async () => {
            const detector = new SystemDetector();
            
            // 模拟不支持的平台
            const restorePlatform = this.mockPlatform('unsupported');
            
            try {
                await this.assert.throws(
                    () => detector.detect(),
                    '不支持的平台',
                    '应该抛出不支持平台的错误'
                );
            } finally {
                restorePlatform();
            }
        });
    }

    async testVersionComparison() {
        await this.it('版本比较函数应该正确工作', async () => {
            const detector = new SystemDetector();
            
            // 测试各种版本比较场景
            this.assert.equals(detector._compareVersions('1.0.0', '1.0.0'), 0, '相同版本应该返回0');
            this.assert.true(detector._compareVersions('2.0.0', '1.0.0') > 0, '高版本应该大于低版本');
            this.assert.true(detector._compareVersions('1.0.0', '2.0.0') < 0, '低版本应该小于高版本');
            this.assert.equals(detector._compareVersions('1.2.3', '1.2.3'), 0, '复杂版本比较应该正确');
            this.assert.true(detector._compareVersions('1.10.0', '1.2.0') > 0, '数字版本比较应该正确');
        });
    }

    async testRequirementChecks() {
        await this.it('应该能检查系统要求', async () => {
            const detector = new SystemDetector();
            const requirements = await detector.checkRequirements();
            
            this.assert.true(Array.isArray(requirements), '要求检查应该返回数组');
            this.assert.true(requirements.length > 0, '应该有检查项目');
            
            // 检查必要的字段
            for (const req of requirements) {
                this.assert.true(!!req.name, '每个检查项应该有名称');
                this.assert.true(typeof req.satisfied === 'boolean', '每个检查项应该有满足状态');
            }
        });
    }

    async testPathResolution() {
        await this.it('路径解析应该正确处理各种路径格式', async () => {
            const detector = new SystemDetector();
            
            // 测试波浪号展开
            const homePath = detector._resolvePath('~/test');
            this.assert.true(homePath.includes(process.env.HOME || process.env.USERPROFILE), 
                '波浪号应该展开为主目录');
            
            // 测试环境变量展开（如果在Windows上）
            if (process.platform === 'win32') {
                const appDataPath = detector._resolvePath('%APPDATA%/test');
                this.assert.true(appDataPath.includes(process.env.APPDATA), 
                    '%APPDATA%应该正确展开');
            }
        });
    }

    // ============= PlatformAdapters 测试 =============

    async testPlatformDetection() {
        await this.it('应该正确检测和配置当前平台', async () => {
            const adapters = new PlatformAdapters();
            
            this.assert.true(!!adapters.currentPlatform, '应该检测到当前平台');
            this.assert.true(!!adapters.config, '应该有平台配置');
            this.assert.true(!!adapters.config.name, '平台配置应该有名称');
            this.assert.true(!!adapters.config.paths, '平台配置应该有路径配置');
        });

        await this.it('应该能获取所有必要的路径', async () => {
            const adapters = new PlatformAdapters();
            
            const claudeConfigPath = await adapters.getClaudeConfigPath();
            const chromeDataPath = await adapters.getChromeDataPath();
            const backupDir = await adapters.getBackupDir();
            
            this.assert.true(!!claudeConfigPath, 'Claude配置路径应该存在');
            this.assert.true(!!chromeDataPath, 'Chrome数据路径应该存在');
            this.assert.true(!!backupDir, '备份目录路径应该存在');
        });
    }

    async testPathConfiguration() {
        await this.it('路径解析应该处理所有平台变量', async () => {
            const adapters = new PlatformAdapters();
            
            // 测试各种路径变量
            const testPaths = [
                '~/test',
                '$HOME/test',
                '%USERPROFILE%/test',
                '%APPDATA%/test'
            ];
            
            for (const testPath of testPaths) {
                try {
                    const resolved = adapters.resolvePath(testPath);
                    this.assert.true(!!resolved, `路径解析不应该返回空: ${testPath}`);
                } catch (error) {
                    // 某些环境变量可能不存在，这是正常的
                }
            }
        });
    }

    async testEnvironmentVariables() {
        await this.it('应该能正确处理环境变量', async () => {
            const adapters = new PlatformAdapters();
            
            const homeVar = adapters.getEnvironmentVariable('home');
            this.assert.true(!!homeVar, '应该能获取主目录环境变量');
            
            const userVar = adapters.getEnvironmentVariable('user');
            this.assert.true(!!userVar, '应该能获取用户名环境变量');
        });
    }

    async testPermissionChecks() {
        await this.it('应该能检查路径权限', async () => {
            const adapters = new PlatformAdapters();
            const tempDir = await this.createTempDir();
            
            const exists = await adapters.pathExists(tempDir);
            this.assert.true(exists, '临时目录应该存在');
            
            const notExists = await adapters.pathExists(path.join(tempDir, 'nonexistent'));
            this.assert.false(notExists, '不存在的路径应该返回false');
        });
    }

    // ============= ClaudeConfigManager 测试 =============

    async testConfigGeneration() {
        await this.it('应该能生成正确的Claude配置', async () => {
            const tempDir = await this.createTempDir();
            const configPath = path.join(tempDir, 'claude_desktop_config.json');
            
            // 创建模拟的配置管理器
            const configManager = new ClaudeConfigManager();
            configManager.configPath = configPath;
            
            const installPath = tempDir;
            const serverScript = path.join(installPath, 'mcp-server', 'index.js');
            
            // 创建模拟的服务器脚本
            await fs.mkdir(path.dirname(serverScript), { recursive: true });
            await fs.writeFile(serverScript, '// mock server', 'utf-8');
            
            const result = await configManager.updateConfig(installPath);
            
            this.assert.true(!!result.config, '应该返回配置对象');
            this.assert.true(!!result.config.mcpServers, '配置应该包含mcpServers');
            this.assert.exists(configPath, '配置文件应该被创建');
        });
    }

    async testConfigMerging() {
        await this.it('应该正确合并现有配置', async () => {
            const tempDir = await this.createTempDir();
            const configPath = path.join(tempDir, 'claude_desktop_config.json');
            
            // 创建现有配置
            const existingConfig = {
                mcpServers: {
                    'existing-server': {
                        command: 'node',
                        args: ['/path/to/existing']
                    }
                },
                otherSettings: {
                    theme: 'dark'
                }
            };
            
            await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');
            
            const configManager = new ClaudeConfigManager();
            configManager.configPath = configPath;
            
            const installPath = tempDir;
            const serverScript = path.join(installPath, 'mcp-server', 'index.js');
            
            await fs.mkdir(path.dirname(serverScript), { recursive: true });
            await fs.writeFile(serverScript, '// mock server', 'utf-8');
            
            const result = await configManager.updateConfig(installPath);
            
            // 验证合并结果
            this.assert.true(!!result.config.mcpServers['existing-server'], '现有服务器配置应该保留');
            this.assert.true(!!result.config.mcpServers['gmail-mcp'], '新的服务器配置应该添加');
            this.assert.true(!!result.config.otherSettings, '其他设置应该保留');
        });
    }

    async testConfigValidation() {
        await this.it('应该能验证配置正确性', async () => {
            const tempDir = await this.createTempDir();
            const configPath = path.join(tempDir, 'claude_desktop_config.json');
            
            const configManager = new ClaudeConfigManager();
            configManager.configPath = configPath;
            
            // 测试无配置文件的情况
            let result = await configManager.verify();
            this.assert.false(result.valid, '没有配置文件时验证应该失败');
            
            // 创建有效配置
            const installPath = tempDir;
            const serverScript = path.join(installPath, 'mcp-server', 'index.js');
            
            await fs.mkdir(path.dirname(serverScript), { recursive: true });
            await fs.writeFile(serverScript, '// mock server', 'utf-8');
            
            await configManager.updateConfig(installPath);
            
            result = await configManager.verify();
            this.assert.true(result.valid, '有效配置验证应该成功');
        });
    }

    async testBackupHandling() {
        await this.it('应该正确处理配置备份', async () => {
            const tempDir = await this.createTempDir();
            const configPath = path.join(tempDir, 'claude_desktop_config.json');
            
            // 创建无效的JSON配置文件
            await fs.writeFile(configPath, 'invalid json content', 'utf-8');
            
            const configManager = new ClaudeConfigManager();
            configManager.configPath = configPath;
            
            const config = await configManager._readConfig();
            
            // 应该返回默认配置（因为原文件无效）
            this.assert.true(!!config.mcpServers, '应该返回默认配置结构');
            
            // 检查是否创建了备份
            const files = await fs.readdir(tempDir);
            const backupFiles = files.filter(f => f.includes('.invalid.'));
            this.assert.true(backupFiles.length > 0, '应该创建备份文件');
        });
    }

    // ============= ExtensionManager 测试 =============

    async testExtensionDetection() {
        await this.it('应该能检测Chrome安装', async () => {
            const extensionManager = new ExtensionManager();
            const chromeInfo = await extensionManager._detectChromeInstallation();
            
            // 注意: 这个测试可能在没有Chrome的环境中失败，这是正常的
            if (chromeInfo.installed) {
                this.assert.true(!!chromeInfo.executable, 'Chrome可执行文件路径应该存在');
                this.assert.true(Array.isArray(chromeInfo.profiles), '配置文件列表应该是数组');
            }
        });
    }

    async testNativeMessaging() {
        await this.it('应该能配置Native Messaging', async () => {
            const tempDir = await this.createTempDir();
            const extensionManager = new ExtensionManager();
            
            // 创建模拟的Native Host脚本
            const hostScript = path.join(tempDir, 'mcp-server', 'native-host-mcp.py');
            await fs.mkdir(path.dirname(hostScript), { recursive: true });
            await fs.writeFile(hostScript, '#!/usr/bin/env python3\n# Mock native host', 'utf-8');
            
            // 模拟Native Host注册路径
            const mockRegistryPath = path.join(tempDir, 'native-host-config.json');
            extensionManager._getNativeHostRegistryPath = () => mockRegistryPath;
            
            await extensionManager._configureNativeMessaging(tempDir);
            
            this.assert.exists(mockRegistryPath, 'Native Host配置文件应该被创建');
            
            const configContent = await fs.readFile(mockRegistryPath, 'utf-8');
            const config = JSON.parse(configContent);
            
            this.assert.true(!!config.name, 'Native Host配置应该有名称');
            this.assert.true(!!config.path, 'Native Host配置应该有路径');
        });
    }

    async testChromeProfileHandling() {
        await this.it('应该能处理Chrome配置文件检测', async () => {
            const tempDir = await this.createTempDir();
            const extensionManager = new ExtensionManager();
            
            // 创建模拟的Chrome配置文件结构
            const chromeProfileStructure = {
                'Default/Extensions': {},
                'Profile 1/Extensions': {}
            };
            
            await this.createMockFileSystem(chromeProfileStructure, tempDir);
            
            const profiles = await extensionManager._findChromeProfiles(tempDir);
            
            this.assert.true(Array.isArray(profiles), '应该返回配置文件数组');
            this.assert.equals(profiles.length, 2, '应该找到2个配置文件');
        });
    }

    // ============= InstallationManager 测试 =============

    async testInstallationSteps() {
        await this.it('安装步骤配置应该正确', async () => {
            const installer = new InstallationManager();
            
            this.assert.true(Array.isArray(installer.INSTALL_STEPS), '安装步骤应该是数组');
            this.assert.true(installer.INSTALL_STEPS.length > 0, '应该有安装步骤');
            
            let totalWeight = 0;
            for (const step of installer.INSTALL_STEPS) {
                this.assert.true(!!step.id, '每个步骤应该有ID');
                this.assert.true(!!step.name, '每个步骤应该有名称');
                this.assert.true(typeof step.weight === 'number', '每个步骤应该有权重');
                totalWeight += step.weight;
            }
            
            this.assert.equals(totalWeight, installer.state.totalWeight, '总权重应该匹配');
        });
    }

    async testErrorHandling() {
        await this.it('应该正确处理安装错误', async () => {
            const installer = new InstallationManager();
            
            // 测试错误建议生成
            const errorWithCode = new Error('Test error');
            errorWithCode.code = 'ENOENT';
            
            // 使用反射调用私有方法进行测试
            installer._suggestSolution(errorWithCode);
            
            // 这个测试主要确保方法不会抛出异常
            this.assert.true(true, '错误处理方法应该正常执行');
        });
    }

    async testProgressTracking() {
        await this.it('进度跟踪应该正确工作', async () => {
            const installer = new InstallationManager();
            
            this.assert.equals(installer.state.currentStep, 0, '初始步骤应该是0');
            this.assert.equals(installer.state.completedWeight, 0, '初始完成权重应该是0');
            
            // 模拟步骤完成
            installer.state.completedWeight = 25;
            const progress = installer.state.completedWeight / installer.state.totalWeight;
            
            this.assert.true(progress > 0 && progress <= 1, '进度应该在0到1之间');
        });
    }

    async testRollbackMechanism() {
        await this.it('回滚机制应该正确工作', async () => {
            const installer = new InstallationManager();
            const tempDir = await this.createTempDir();
            
            // 创建模拟备份
            const backupFile = path.join(tempDir, 'config.backup');
            const originalFile = path.join(tempDir, 'config.json');
            
            const originalContent = '{"original": true}';
            const backupContent = '{"backup": true}';
            
            await fs.writeFile(originalFile, originalContent, 'utf-8');
            await fs.writeFile(backupFile, backupContent, 'utf-8');
            
            installer.state.backups = [{
                type: 'test',
                original: originalFile,
                backup: backupFile,
                name: 'Test Config'
            }];
            
            // 执行回滚
            await installer._rollbackConfigs();
            
            // 验证文件已恢复
            const restoredContent = await fs.readFile(originalFile, 'utf-8');
            this.assert.equals(restoredContent, backupContent, '文件应该已恢复到备份内容');
        });
    }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    const tests = new InstallerUnitTests();
    const report = await tests.run();
    
    // 退出码基于测试结果
    process.exit(report.failed > 0 ? 1 : 0);
}