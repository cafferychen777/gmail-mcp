#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { InstallerTestFramework } from './test-framework.js';

// 导入要测试的模块
import { SystemDetector } from '../../tools/installer/system-detector.js';
import { PlatformAdapters } from '../../tools/installer/platform-adapters.js';
import { ClaudeConfigManager } from '../../tools/installer/claude-config.js';
import { ExtensionManager } from '../../tools/installer/extension-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 跨平台兼容性测试套件
 * 
 * 测试目标:
 * 1. macOS、Windows、Linux 三大平台的路径处理
 * 2. 不同Node.js版本的兼容性 
 * 3. 不同Chrome版本的支持
 * 4. 环境变量处理的平台差异
 * 5. 文件权限的跨平台处理
 */
class PlatformCompatibilityTests extends InstallerTestFramework {
    constructor() {
        super();
        this.supportedPlatforms = ['darwin', 'win32', 'linux'];
        this.testEnvironments = this.generateTestEnvironments();
    }

    /**
     * 生成测试环境配置
     */
    generateTestEnvironments() {
        return [
            // macOS 环境
            {
                platform: 'darwin',
                arch: 'x64',
                nodeVersion: '18.17.0',
                env: {
                    HOME: '/Users/testuser',
                    USER: 'testuser',
                    PATH: '/usr/local/bin:/usr/bin:/bin'
                },
                expectedPaths: {
                    claude: '/Users/testuser/Library/Application Support/Claude',
                    chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
                }
            },
            {
                platform: 'darwin',
                arch: 'arm64',  // M1/M2 Mac
                nodeVersion: '20.5.0',
                env: {
                    HOME: '/Users/m1user',
                    USER: 'm1user'
                },
                expectedPaths: {
                    claude: '/Users/m1user/Library/Application Support/Claude'
                }
            },
            
            // Windows 环境
            {
                platform: 'win32',
                arch: 'x64',
                nodeVersion: '16.20.0',
                env: {
                    USERPROFILE: 'C:\\Users\\testuser',
                    USERNAME: 'testuser',
                    APPDATA: 'C:\\Users\\testuser\\AppData\\Roaming',
                    LOCALAPPDATA: 'C:\\Users\\testuser\\AppData\\Local',
                    PATH: 'C:\\Program Files\\nodejs;C:\\Windows\\System32'
                },
                expectedPaths: {
                    claude: 'C:\\Users\\testuser\\AppData\\Roaming\\Claude',
                    chrome: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
                }
            },
            {
                platform: 'win32',
                arch: 'x64',
                nodeVersion: '18.16.0',
                env: {
                    USERPROFILE: 'C:\\Users\\企业用户',  // 测试中文路径
                    USERNAME: '企业用户',
                    APPDATA: 'C:\\Users\\企业用户\\AppData\\Roaming',
                    LOCALAPPDATA: 'C:\\Users\\企业用户\\AppData\\Local'
                },
                expectedPaths: {
                    claude: 'C:\\Users\\企业用户\\AppData\\Roaming\\Claude'
                }
            },
            
            // Linux 环境
            {
                platform: 'linux',
                arch: 'x64',
                nodeVersion: '18.17.0',
                env: {
                    HOME: '/home/testuser',
                    USER: 'testuser',
                    PATH: '/usr/local/bin:/usr/bin:/bin'
                },
                expectedPaths: {
                    claude: '/home/testuser/.config/Claude',
                    chrome: '/usr/bin/google-chrome'
                }
            },
            {
                platform: 'linux',
                arch: 'arm64',  // ARM Linux (如树莓派)
                nodeVersion: '16.20.0',
                env: {
                    HOME: '/home/pi',
                    USER: 'pi'
                },
                expectedPaths: {
                    claude: '/home/pi/.config/Claude'
                }
            }
        ];
    }

    async run() {
        this.stats.startTime = Date.now();
        
        try {
            await this.describe('平台检测和适配', async () => {
                await this.testPlatformDetection();
                await this.testUnsupportedPlatforms();
            });

            await this.describe('路径处理跨平台测试', async () => {
                await this.testPathResolutionAcrossPlatforms();
                await this.testEnvironmentVariableExpansion();
                await this.testSpecialCharacterPaths();
            });

            await this.describe('配置文件生成跨平台测试', async () => {
                await this.testClaudeConfigGeneration();
                await this.testNativeMessagingConfigGeneration();
            });

            await this.describe('Node.js版本兼容性测试', async () => {
                await this.testNodeVersionCompatibility();
                await this.testVersionBoundaryConditions();
            });

            await this.describe('文件系统权限跨平台测试', async () => {
                await this.testFilePermissionHandling();
                await this.testDirectoryCreation();
            });

            await this.describe('命令执行跨平台测试', async () => {
                await this.testCommandGeneration();
                await this.testScriptGeneration();
            });

        } finally {
            await this.cleanup();
            return this.generateReport();
        }
    }

    // ============= 平台检测测试 =============

    async testPlatformDetection() {
        await this.it('应该正确检测所有支持的平台', async () => {
            for (const env of this.testEnvironments) {
                const restorePlatform = this.mockPlatform(env.platform);
                this.mockEnv(env.env);
                
                try {
                    const adapters = new PlatformAdapters();
                    adapters.configure(env.platform);
                    
                    const systemInfo = adapters.getSystemInfo();
                    
                    this.assert.equals(systemInfo.platform, env.platform, 
                        `平台检测应该正确 (${env.platform})`);
                    this.assert.true(!!systemInfo.platformName, 
                        `平台名称应该存在 (${env.platform})`);
                    
                } finally {
                    restorePlatform();
                    this.restoreEnv();
                }
            }
        });
    }

    async testUnsupportedPlatforms() {
        await this.it('应该正确处理不支持的平台', async () => {
            const unsupportedPlatforms = ['freebsd', 'openbsd', 'sunos', 'aix'];
            
            for (const platform of unsupportedPlatforms) {
                const restorePlatform = this.mockPlatform(platform);
                
                try {
                    await this.assert.throws(
                        () => new PlatformAdapters(),
                        '不支持的操作系统',
                        `不支持的平台应该抛出错误 (${platform})`
                    );
                } finally {
                    restorePlatform();
                }
            }
        });
    }

    // ============= 路径处理测试 =============

    async testPathResolutionAcrossPlatforms() {
        await this.it('所有平台的路径解析应该正确工作', async () => {
            for (const env of this.testEnvironments) {
                const restorePlatform = this.mockPlatform(env.platform);
                this.mockEnv(env.env);
                
                try {
                    const adapters = new PlatformAdapters();
                    adapters.configure(env.platform);
                    
                    // 测试Claude配置路径
                    const claudeConfigPath = await adapters.getClaudeConfigPath();
                    this.assert.true(claudeConfigPath.includes(env.expectedPaths.claude),
                        `Claude配置路径应该正确 (${env.platform}): ${claudeConfigPath}`);
                    
                    // 测试路径解析
                    if (env.platform === 'win32') {
                        const appDataPath = adapters.resolvePath('%APPDATA%/test');
                        this.assert.true(appDataPath.includes(env.env.APPDATA),
                            `Windows环境变量应该正确展开 (${env.platform})`);
                    } else {
                        const homePath = adapters.resolvePath('~/test');
                        this.assert.true(homePath.includes(env.env.HOME),
                            `Unix波浪号应该正确展开 (${env.platform})`);
                    }
                    
                } finally {
                    restorePlatform();
                    this.restoreEnv();
                }
            }
        });
    }

    async testEnvironmentVariableExpansion() {
        await this.it('环境变量展开应该在所有平台正确工作', async () => {
            const testCases = [
                // Unix 风格
                { input: '$HOME/test', platforms: ['darwin', 'linux'] },
                { input: '${USER}_config', platforms: ['darwin', 'linux'] },
                
                // Windows 风格  
                { input: '%USERPROFILE%\\test', platforms: ['win32'] },
                { input: '%APPDATA%\\config', platforms: ['win32'] },
                
                // 混合情况
                { input: '~/Documents/$USER', platforms: ['darwin', 'linux'] },
                { input: '%USERPROFILE%\\Documents\\%USERNAME%', platforms: ['win32'] }
            ];
            
            for (const testCase of testCases) {
                for (const platformName of testCase.platforms) {
                    const env = this.testEnvironments.find(e => e.platform === platformName);
                    if (!env) continue;
                    
                    const restorePlatform = this.mockPlatform(env.platform);
                    this.mockEnv(env.env);
                    
                    try {
                        const adapters = new PlatformAdapters();
                        adapters.configure(env.platform);
                        
                        const resolved = adapters.resolvePath(testCase.input);
                        
                        // 确保没有剩余的未解析变量
                        this.assert.false(resolved.includes('$'), 
                            `Unix变量应该被解析: ${testCase.input} -> ${resolved}`);
                        this.assert.false(resolved.includes('%'), 
                            `Windows变量应该被解析: ${testCase.input} -> ${resolved}`);
                        
                    } finally {
                        restorePlatform();
                        this.restoreEnv();
                    }
                }
            }
        });
    }

    async testSpecialCharacterPaths() {
        await this.it('应该正确处理包含特殊字符的路径', async () => {
            const specialPaths = [
                'path with spaces',
                'path-with-dashes',
                'path_with_underscore',
                'path.with.dots',
                '路径包含中文',
                'пуць с кірыліцай',  // 西里尔字母
                'путь с пробелами'
            ];
            
            for (const env of this.testEnvironments) {
                const restorePlatform = this.mockPlatform(env.platform);
                this.mockEnv(env.env);
                
                try {
                    const adapters = new PlatformAdapters();
                    adapters.configure(env.platform);
                    
                    for (const specialPath of specialPaths) {
                        const testPath = env.platform === 'win32' 
                            ? `C:\\Users\\test\\${specialPath}`
                            : `/home/test/${specialPath}`;
                        
                        const resolved = adapters.resolvePath(testPath);
                        this.assert.true(resolved.includes(specialPath),
                            `特殊字符路径应该正确处理: ${specialPath} (${env.platform})`);
                    }
                    
                } finally {
                    restorePlatform();
                    this.restoreEnv();
                }
            }
        });
    }

    // ============= 配置文件生成测试 =============

    async testClaudeConfigGeneration() {
        await this.it('Claude配置文件应该在所有平台正确生成', async () => {
            for (const env of this.testEnvironments) {
                const restorePlatform = this.mockPlatform(env.platform);
                this.mockEnv(env.env);
                
                try {
                    const tempDir = await this.createTempDir(`claude-config-${env.platform}-`);
                    
                    const configManager = new ClaudeConfigManager();
                    configManager.configPath = path.join(tempDir, 'claude_desktop_config.json');
                    
                    // 创建模拟服务器脚本
                    const serverScript = path.join(tempDir, 'mcp-server', 'index.js');
                    await fs.mkdir(path.dirname(serverScript), { recursive: true });
                    await fs.writeFile(serverScript, '// mock server', 'utf-8');
                    
                    const result = await configManager.updateConfig(tempDir);
                    
                    this.assert.true(!!result.config, 
                        `配置应该生成 (${env.platform})`);
                    this.assert.true(!!result.config.mcpServers['gmail-mcp'],
                        `Gmail MCP配置应该存在 (${env.platform})`);
                    
                    // 验证路径格式
                    const serverPath = result.config.mcpServers['gmail-mcp'].args[0];
                    if (env.platform === 'win32') {
                        this.assert.true(serverPath.includes('\\') || serverPath.includes('/'),
                            `Windows路径格式应该正确 (${env.platform}): ${serverPath}`);
                    } else {
                        this.assert.true(serverPath.includes('/'),
                            `Unix路径格式应该正确 (${env.platform}): ${serverPath}`);
                    }
                    
                } finally {
                    restorePlatform();
                    this.restoreEnv();
                }
            }
        });
    }

    async testNativeMessagingConfigGeneration() {
        await this.it('Native Messaging配置应该在所有平台正确生成', async () => {
            for (const env of this.testEnvironments) {
                const restorePlatform = this.mockPlatform(env.platform);
                this.mockEnv(env.env);
                
                try {
                    const tempDir = await this.createTempDir(`native-messaging-${env.platform}-`);
                    
                    const extensionManager = new ExtensionManager();
                    extensionManager.chromeConfig = {
                        profileDir: tempDir,
                        executable: env.expectedPaths.chrome || '/mock/chrome'
                    };
                    
                    // 创建模拟Native Host脚本
                    const hostScript = path.join(tempDir, 'mcp-server', 'native-host-mcp.py');
                    await fs.mkdir(path.dirname(hostScript), { recursive: true });
                    await fs.writeFile(hostScript, '#!/usr/bin/env python3', 'utf-8');
                    
                    // 模拟注册表路径
                    const registryPath = path.join(tempDir, 'native-messaging-config.json');
                    extensionManager._getNativeHostRegistryPath = () => registryPath;
                    
                    await extensionManager._configureNativeMessaging(tempDir);
                    
                    this.assert.exists(registryPath,
                        `Native Messaging配置应该创建 (${env.platform})`);
                    
                    const configContent = await fs.readFile(registryPath, 'utf-8');
                    const config = JSON.parse(configContent);
                    
                    this.assert.true(!!config.path,
                        `配置应该包含路径 (${env.platform})`);
                    this.assert.equals(config.type, 'stdio',
                        `配置类型应该正确 (${env.platform})`);
                    
                } finally {
                    restorePlatform();
                    this.restoreEnv();
                }
            }
        });
    }

    // ============= Node.js版本兼容性测试 =============

    async testNodeVersionCompatibility() {
        await this.it('应该正确检测Node.js版本兼容性', async () => {
            const versionTestCases = [
                { version: '14.21.0', shouldPass: false, reason: '低于最低要求' },
                { version: '16.0.0', shouldPass: true, reason: '刚好满足要求' },
                { version: '16.20.0', shouldPass: true, reason: '满足要求' },
                { version: '18.17.0', shouldPass: true, reason: '推荐版本' },
                { version: '20.5.0', shouldPass: true, reason: '新版本' },
                { version: '21.0.0', shouldPass: true, reason: '最新版本' }
            ];
            
            for (const testCase of versionTestCases) {
                // 模拟Node.js版本
                const originalVersion = process.version;
                Object.defineProperty(process, 'version', {
                    value: `v${testCase.version}`,
                    configurable: true
                });
                
                try {
                    const detector = new SystemDetector();
                    const nodeCheck = await detector._checkNodeVersion();
                    
                    this.assert.equals(nodeCheck.satisfied, testCase.shouldPass,
                        `Node.js ${testCase.version} 兼容性检测应该${testCase.shouldPass ? '通过' : '失败'}: ${testCase.reason}`);
                    
                    if (testCase.shouldPass && parseFloat(testCase.version) >= 18.0) {
                        this.assert.true(nodeCheck.isRecommended,
                            `Node.js ${testCase.version} 应该被标记为推荐版本`);
                    }
                    
                } finally {
                    Object.defineProperty(process, 'version', {
                        value: originalVersion,
                        configurable: true
                    });
                }
            }
        });
    }

    async testVersionBoundaryConditions() {
        await this.it('版本比较边界条件应该正确处理', async () => {
            const detector = new SystemDetector();
            
            const boundaryTests = [
                // 精确匹配
                { v1: '16.0.0', v2: '16.0.0', expected: 0 },
                
                // 主版本差异
                { v1: '17.0.0', v2: '16.0.0', expected: 1 },
                { v1: '15.0.0', v2: '16.0.0', expected: -1 },
                
                // 次版本差异
                { v1: '16.1.0', v2: '16.0.0', expected: 1 },
                { v1: '16.0.0', v2: '16.1.0', expected: -1 },
                
                // 补丁版本差异
                { v1: '16.0.1', v2: '16.0.0', expected: 1 },
                { v1: '16.0.0', v2: '16.0.1', expected: -1 },
                
                // 复杂版本比较
                { v1: '16.10.0', v2: '16.2.0', expected: 1 },  // 10 > 2
                { v1: '16.2.10', v2: '16.2.2', expected: 1 },  // 10 > 2
                
                // 不同长度版本
                { v1: '16.1', v2: '16.1.0', expected: 0 },
                { v1: '16', v2: '16.0.0', expected: 0 }
            ];
            
            for (const test of boundaryTests) {
                const result = detector._compareVersions(test.v1, test.v2);
                const resultSign = result > 0 ? 1 : result < 0 ? -1 : 0;
                
                this.assert.equals(resultSign, test.expected,
                    `版本比较 ${test.v1} vs ${test.v2} 应该返回 ${test.expected}, 实际: ${result}`);
            }
        });
    }

    // ============= 文件系统权限测试 =============

    async testFilePermissionHandling() {
        await this.it('文件权限设置应该在支持的平台正确工作', async () => {
            for (const env of this.testEnvironments) {
                const restorePlatform = this.mockPlatform(env.platform);
                
                try {
                    const adapters = new PlatformAdapters();
                    adapters.configure(env.platform);
                    
                    const tempFile = await this.createTempFile('test content', '.json');
                    
                    // 设置配置文件权限
                    await adapters.setFilePermissions(tempFile, 'configFile');
                    
                    if (env.platform !== 'win32') {
                        // Unix系统检查权限
                        const stats = await fs.stat(tempFile);
                        const mode = stats.mode & parseInt('777', 8);
                        this.assert.true(mode === parseInt('644', 8) || mode === parseInt('755', 8),
                            `Unix权限应该正确设置 (${env.platform}): ${mode.toString(8)}`);
                    }
                    
                    // Windows系统权限设置不应该抛出错误
                    this.assert.true(true, `权限设置应该不抛出错误 (${env.platform})`);
                    
                } finally {
                    restorePlatform();
                }
            }
        });
    }

    async testDirectoryCreation() {
        await this.it('目录创建应该在所有平台正确工作', async () => {
            for (const env of this.testEnvironments) {
                const restorePlatform = this.mockPlatform(env.platform);
                this.mockEnv(env.env);
                
                try {
                    const adapters = new PlatformAdapters();
                    adapters.configure(env.platform);
                    
                    const tempDir = await this.createTempDir(`dir-test-${env.platform}-`);
                    const nestedDir = path.join(tempDir, 'nested', 'deep', 'directory');
                    
                    await adapters.createDirectory(nestedDir);
                    
                    this.assert.exists(nestedDir,
                        `嵌套目录应该创建成功 (${env.platform})`);
                    
                    const stats = await fs.stat(nestedDir);
                    this.assert.true(stats.isDirectory(),
                        `应该是目录 (${env.platform})`);
                    
                } finally {
                    restorePlatform();
                    this.restoreEnv();
                }
            }
        });
    }

    // ============= 命令执行测试 =============

    async testCommandGeneration() {
        await this.it('命令生成应该适配不同平台', async () => {
            for (const env of this.testEnvironments) {
                const restorePlatform = this.mockPlatform(env.platform);
                
                try {
                    const adapters = new PlatformAdapters();
                    adapters.configure(env.platform);
                    
                    const nodeCommand = adapters.getCommand('node');
                    const npmCommand = adapters.getCommand('npm');
                    
                    if (env.platform === 'win32') {
                        this.assert.true(nodeCommand.includes('.exe') || nodeCommand === 'node.exe',
                            `Windows Node命令应该正确 (${env.platform}): ${nodeCommand}`);
                        this.assert.true(npmCommand.includes('.cmd') || npmCommand === 'npm.cmd',
                            `Windows NPM命令应该正确 (${env.platform}): ${npmCommand}`);
                    } else {
                        this.assert.equals(nodeCommand, 'node',
                            `Unix Node命令应该正确 (${env.platform}): ${nodeCommand}`);
                        this.assert.equals(npmCommand, 'npm',
                            `Unix NPM命令应该正确 (${env.platform}): ${npmCommand}`);
                    }
                    
                } finally {
                    restorePlatform();
                }
            }
        });
    }

    async testScriptGeneration() {
        await this.it('启动脚本生成应该适配不同平台', async () => {
            for (const env of this.testEnvironments) {
                const restorePlatform = this.mockPlatform(env.platform);
                
                try {
                    const adapters = new PlatformAdapters();
                    adapters.configure(env.platform);
                    
                    const scriptPath = await adapters.createLaunchScript(
                        'test-script',
                        'node',
                        ['/path/to/script.js', '--option']
                    );
                    
                    this.assert.exists(scriptPath, 
                        `脚本文件应该创建 (${env.platform})`);
                    
                    const scriptContent = await fs.readFile(scriptPath, 'utf-8');
                    
                    if (env.platform === 'win32') {
                        this.assert.true(scriptPath.endsWith('.bat'),
                            `Windows脚本应该是.bat文件 (${env.platform})`);
                        this.assert.contains(scriptContent, '@echo off',
                            `Windows脚本应该包含正确头部 (${env.platform})`);
                    } else {
                        this.assert.true(scriptPath.endsWith('.sh'),
                            `Unix脚本应该是.sh文件 (${env.platform})`);
                        this.assert.contains(scriptContent, '#!/bin/bash',
                            `Unix脚本应该包含shebang (${env.platform})`);
                    }
                    
                    this.assert.contains(scriptContent, 'node',
                        `脚本应该包含命令 (${env.platform})`);
                    
                } finally {
                    restorePlatform();
                }
            }
        });
    }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    const tests = new PlatformCompatibilityTests();
    const report = await tests.run();
    
    console.log(`\n📊 跨平台测试完成:`);
    console.log(`测试环境数: ${tests.testEnvironments.length}`);
    console.log(`支持平台: ${tests.supportedPlatforms.join(', ')}`);
    
    process.exit(report.failed > 0 ? 1 : 0);
}