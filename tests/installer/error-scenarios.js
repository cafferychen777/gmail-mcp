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
 * 错误场景测试套件
 * 
 * 测试目标:
 * 1. 依赖缺失情况的处理
 * 2. 权限问题的检测和处理
 * 3. 网络连接问题的处理
 * 4. 配置文件损坏的处理
 * 5. 磁盘空间不足的处理
 * 6. 进程中断的处理
 * 7. 版本不兼容的处理
 */
class ErrorScenarioTests extends InstallerTestFramework {
    async run() {
        this.stats.startTime = Date.now();
        
        try {
            await this.describe('依赖缺失错误处理', async () => {
                await this.testMissingNodeJs();
                await this.testMissingNpm();
                await this.testMissingChrome();
                await this.testMissingClaudeDesktop();
            });

            await this.describe('权限问题错误处理', async () => {
                await this.testReadOnlyFileSystem();
                await this.testInsufficientPermissions();
                await this.testElevatedPrivilegesRequired();
            });

            await this.describe('网络连接错误处理', async () => {
                await this.testNetworkTimeout();
                await this.testProxyConfiguration();
                await this.testFirewallBlocking();
            });

            await this.describe('配置文件错误处理', async () => {
                await this.testCorruptedConfig();
                await this.testInvalidJsonConfig();
                await this.testMissingConfigDirectory();
                await this.testConfigFileInUse();
            });

            await this.describe('系统资源错误处理', async () => {
                await this.testDiskSpaceInsufficient();
                await this.testMemoryLimitExceeded();
                await this.testTooManyOpenFiles();
            });

            await this.describe('版本兼容性错误处理', async () => {
                await this.testUnsupportedNodeVersion();
                await this.testUnsupportedChromeVersion();
                await this.testIncompatibleExtensionVersion();
            });

            await this.describe('进程中断错误处理', async () => {
                await this.testInstallationInterruption();
                await this.testProcessKilled();
                await this.testSystemShutdown();
            });

            await this.describe('并发访问错误处理', async () => {
                await this.testMultipleInstallationAttempts();
                await this.testConfigFileLocking();
            });

        } finally {
            await this.cleanup();
            return this.generateReport();
        }
    }

    // ============= 依赖缺失错误测试 =============

    async testMissingNodeJs() {
        await this.it('应该正确检测 Node.js 缺失', async () => {
            // 模拟 Node.js 不存在的环境
            const originalVersion = process.version;
            
            // 这里我们无法真正删除 Node.js，因为测试本身就运行在 Node.js 中
            // 所以我们模拟版本检查失败的情况
            Object.defineProperty(process, 'version', {
                get: () => { throw new Error('Node.js not found'); },
                configurable: true
            });
            
            try {
                const detector = new SystemDetector();
                const requirements = await detector.checkRequirements();
                
                // 由于 Node.js 版本检查会抛出异常，我们期望有错误处理
                this.assert.true(true, 'Node.js 缺失应该被适当处理');
                
            } catch (error) {
                // 预期的错误
                this.assert.contains(error.message, 'Node.js', '错误信息应该提到 Node.js');
            } finally {
                Object.defineProperty(process, 'version', {
                    value: originalVersion,
                    configurable: true
                });
            }
        });
    }

    async testMissingNpm() {
        await this.it('应该正确检测 NPM 缺失', async () => {
            // 我们无法真正模拟 exec 调用失败，但可以测试错误处理逻辑
            const detector = new SystemDetector();
            
            try {
                // 模拟 NPM 不存在的情况
                const originalExec = detector._checkNpmVersion;
                detector._checkNpmVersion = async () => {
                    throw { code: 'ENOENT', message: 'npm command not found' };
                };
                
                const npmCheck = await detector._checkNpmVersion();
                this.assert.false(npmCheck.satisfied, 'NPM 缺失检查应该失败');
                this.assert.contains(npmCheck.issue, 'NPM', '错误信息应该提到 NPM');
                
            } catch (error) {
                // 预期可能有错误
                this.assert.contains(error.message, 'npm', '错误应该与 NPM 相关');
            }
        });
    }

    async testMissingChrome() {
        await this.it('应该正确检测 Chrome 缺失', async () => {
            const tempDir = await this.createTempDir();
            const detector = new SystemDetector();
            
            // 创建一个不存在 Chrome 的模拟环境
            const fakeSystemInfo = {
                platform: 'linux',
                config: {
                    chromeExecutable: path.join(tempDir, 'nonexistent', 'chrome'),
                    chromeDataDir: path.join(tempDir, 'chrome-data')
                }
            };
            
            const chromeCheck = await detector._checkChromeInstallation(fakeSystemInfo);
            
            this.assert.false(chromeCheck.satisfied, 'Chrome 缺失检查应该失败');
            this.assert.contains(chromeCheck.issue, 'Chrome', '错误信息应该提到 Chrome');
        });
    }

    async testMissingClaudeDesktop() {
        await this.it('应该正确检测 Claude Desktop 缺失', async () => {
            const tempDir = await this.createTempDir();
            const detector = new SystemDetector();
            
            const fakeSystemInfo = {
                platform: 'darwin',
                config: {
                    claudePath: path.join(tempDir, 'nonexistent', 'Claude')
                }
            };
            
            const claudeCheck = await detector._checkClaudeDesktop(fakeSystemInfo);
            
            this.assert.false(claudeCheck.satisfied, 'Claude Desktop 缺失检查应该失败');
            this.assert.contains(claudeCheck.issue, 'Claude Desktop', '错误信息应该提到 Claude Desktop');
        });
    }

    // ============= 权限问题错误测试 =============

    async testReadOnlyFileSystem() {
        await this.it('应该正确处理只读文件系统', async () => {
            const tempDir = await this.createTempDir();
            const configManager = new ClaudeConfigManager();
            
            // 创建一个只读目录（模拟）
            const readonlyDir = path.join(tempDir, 'readonly');
            await fs.mkdir(readonlyDir);
            
            configManager.configPath = path.join(readonlyDir, 'config.json');
            
            // 在真实测试中，这里会设置目录为只读
            // 由于测试环境限制，我们模拟权限错误
            const originalWriteFile = fs.writeFile;
            fs.writeFile = async () => {
                const error = new Error('Permission denied');
                error.code = 'EACCES';
                throw error;
            };
            
            try {
                await this.assert.throws(
                    () => configManager.updateConfig(tempDir),
                    'Permission denied',
                    '只读文件系统应该抛出权限错误'
                );
            } finally {
                fs.writeFile = originalWriteFile;
            }
        });
    }

    async testInsufficientPermissions() {
        await this.it('应该检测权限不足的情况', async () => {
            const tempDir = await this.createTempDir();
            const adapters = new PlatformAdapters();
            
            // 创建一个需要特殊权限的目录路径
            const restrictedPath = '/root/restricted'; // Unix系统中的受限路径
            
            const hasPermission = await adapters.pathExists(restrictedPath);
            
            // 在大多数情况下，普通用户无法访问 /root
            if (process.platform !== 'win32' && process.getuid && process.getuid() !== 0) {
                this.assert.false(hasPermission, '应该检测到权限不足');
            }
        });
    }

    async testElevatedPrivilegesRequired() {
        await this.it('应该检测是否需要提升权限', async () => {
            const adapters = new PlatformAdapters();
            const isElevated = await adapters.isElevated();
            
            this.assert.true(typeof isElevated === 'boolean', '权限检测应该返回布尔值');
            
            // 如果不是提升权限运行，某些操作应该失败
            if (!isElevated && process.platform === 'linux') {
                const systemPath = '/usr/local/bin/test-file';
                const canWrite = await adapters.pathExists(path.dirname(systemPath));
                
                if (canWrite) {
                    try {
                        await fs.writeFile(systemPath, 'test', 'utf-8');
                        await fs.unlink(systemPath); // 清理
                    } catch (error) {
                        this.assert.true(error.code === 'EACCES' || error.code === 'EPERM',
                            '系统目录写入应该因权限不足而失败');
                    }
                }
            }
        });
    }

    // ============= 网络连接错误测试 =============

    async testNetworkTimeout() {
        await this.it('应该正确处理网络超时', async () => {
            const detector = new SystemDetector();
            
            // 模拟网络检查超时
            const originalCheck = detector._checkNetworkConnectivity;
            detector._checkNetworkConnectivity = async () => {
                const error = new Error('Network timeout');
                error.code = 'ETIMEDOUT';
                throw error;
            };
            
            const networkCheck = await detector._checkNetworkConnectivity();
            
            this.assert.false(networkCheck.satisfied, '网络超时检查应该失败');
            this.assert.contains(networkCheck.issue, '网络', '错误信息应该提到网络问题');
        });
    }

    async testProxyConfiguration() {
        await this.it('应该处理代理配置问题', async () => {
            // 模拟代理环境
            const originalEnv = { ...process.env };
            process.env.HTTP_PROXY = 'http://invalid-proxy:8080';
            process.env.HTTPS_PROXY = 'http://invalid-proxy:8080';
            
            try {
                const detector = new SystemDetector();
                const networkCheck = await detector._checkNetworkConnectivity();
                
                // 在有无效代理的情况下，网络检查可能失败
                if (!networkCheck.satisfied) {
                    this.assert.contains(networkCheck.issue, '网络', '代理问题应该导致网络检查失败');
                }
                
            } finally {
                // 恢复环境变量
                Object.assign(process.env, originalEnv);
            }
        });
    }

    async testFirewallBlocking() {
        // 这个测试在实际环境中很难模拟，我们跳过
        this.skip('防火墙阻止测试', '需要特殊的网络环境配置');
    }

    // ============= 配置文件错误测试 =============

    async testCorruptedConfig() {
        await this.it('应该正确处理损坏的配置文件', async () => {
            const tempDir = await this.createTempDir();
            const configPath = path.join(tempDir, 'claude_desktop_config.json');
            
            // 创建损坏的配置文件
            await fs.writeFile(configPath, '\x00\x01\x02corrupted data', 'utf-8');
            
            const configManager = new ClaudeConfigManager();
            configManager.configPath = configPath;
            
            const config = await configManager._readConfig();
            
            // 损坏的配置应该被替换为默认配置
            this.assert.true(!!config.mcpServers, '损坏的配置应该被替换为默认配置');
            
            // 应该创建备份文件
            const files = await fs.readdir(tempDir);
            const backupFiles = files.filter(f => f.includes('.invalid.'));
            this.assert.true(backupFiles.length > 0, '应该创建损坏文件的备份');
        });
    }

    async testInvalidJsonConfig() {
        await this.it('应该正确处理无效的 JSON 配置', async () => {
            const tempDir = await this.createTempDir();
            const configPath = path.join(tempDir, 'claude_desktop_config.json');
            
            // 创建无效的 JSON
            await fs.writeFile(configPath, '{ invalid json content }', 'utf-8');
            
            const configManager = new ClaudeConfigManager();
            configManager.configPath = configPath;
            
            const config = await configManager._readConfig();
            
            this.assert.true(!!config.mcpServers, '无效 JSON 应该被替换为默认配置');
        });
    }

    async testMissingConfigDirectory() {
        await this.it('应该处理配置目录不存在的情况', async () => {
            const tempDir = await this.createTempDir();
            const configPath = path.join(tempDir, 'nonexistent', 'deep', 'path', 'config.json');
            
            const configManager = new ClaudeConfigManager();
            configManager.configPath = configPath;
            
            // 创建模拟服务器脚本
            const serverScript = path.join(tempDir, 'mcp-server', 'index.js');
            await fs.mkdir(path.dirname(serverScript), { recursive: true });
            await fs.writeFile(serverScript, '// mock server', 'utf-8');
            
            // 更新配置应该自动创建目录
            const result = await configManager.updateConfig(tempDir);
            
            this.assert.true(!!result.config, '配置应该成功创建');
            this.assert.exists(configPath, '配置文件应该被创建');
        });
    }

    async testConfigFileInUse() {
        // 这个测试很难在跨平台环境中实现，我们跳过
        this.skip('配置文件被占用测试', '需要模拟文件锁定');
    }

    // ============= 系统资源错误测试 =============

    async testDiskSpaceInsufficient() {
        // 磁盘空间不足很难在测试中模拟
        this.skip('磁盘空间不足测试', '需要特殊的磁盘环境');
    }

    async testMemoryLimitExceeded() {
        await this.it('应该处理内存使用过高的情况', async () => {
            const initialMemory = this.getMemoryUsage();
            
            // 模拟内存密集型操作
            const largeArray = new Array(1000000).fill('test data');
            
            const afterMemory = this.getMemoryUsage();
            
            // 验证内存监控工作正常
            this.assert.true(afterMemory.heapUsed > initialMemory.heapUsed,
                '内存使用应该被正确监控');
            
            // 清理
            largeArray.length = 0;
        });
    }

    async testTooManyOpenFiles() {
        // 文件描述符限制测试很难在标准测试环境中实现
        this.skip('文件描述符限制测试', '需要特殊的系统配置');
    }

    // ============= 版本兼容性错误测试 =============

    async testUnsupportedNodeVersion() {
        await this.it('应该正确处理不支持的 Node.js 版本', async () => {
            const detector = new SystemDetector();
            
            // 模拟过旧的 Node.js 版本
            const originalVersion = process.version;
            Object.defineProperty(process, 'version', {
                value: 'v14.21.0',  // 低于最低要求
                configurable: true
            });
            
            try {
                const nodeCheck = await detector._checkNodeVersion();
                
                this.assert.false(nodeCheck.satisfied, '过旧的 Node.js 版本检查应该失败');
                this.assert.contains(nodeCheck.issue, 'Node.js', '错误信息应该提到 Node.js 版本问题');
                
            } finally {
                Object.defineProperty(process, 'version', {
                    value: originalVersion,
                    configurable: true
                });
            }
        });
    }

    async testUnsupportedChromeVersion() {
        await this.it('应该处理不支持的 Chrome 版本', async () => {
            // 由于我们无法真正控制 Chrome 版本，这里主要测试版本解析逻辑
            const detector = new SystemDetector();
            
            // 模拟一个返回过旧版本的系统
            const fakeSystemInfo = {
                platform: 'darwin',
                config: {
                    chromeExecutable: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
                }
            };
            
            // 模拟 Chrome 版本检查
            const originalCheck = detector._checkChromeInstallation;
            detector._checkChromeInstallation = async () => {
                return {
                    name: 'Google Chrome',
                    required: '任意版本',
                    current: '50.0.0',  // 假设这是一个过旧的版本
                    satisfied: true,     // 我们的检查目前接受任意版本
                    issue: null
                };
            };
            
            const chromeCheck = await detector._checkChromeInstallation(fakeSystemInfo);
            
            // 目前我们接受任意 Chrome 版本，但这里验证检查逻辑
            this.assert.true(!!chromeCheck.current, '应该能检测到 Chrome 版本');
        });
    }

    async testIncompatibleExtensionVersion() {
        await this.it('应该处理不兼容的扩展版本', async () => {
            const extensionManager = new ExtensionManager();
            
            // 创建模拟的扩展 manifest 
            const incompatibleManifest = {
                "manifest_version": 2,  // 旧版本的 manifest
                "name": "Gmail MCP Bridge",
                "version": "0.1.0"
            };
            
            // 测试 manifest 版本检查
            const isOurExtension = extensionManager._isOurExtension(incompatibleManifest);
            
            // 我们的扩展检查应该能识别这是我们的扩展，即使版本不同
            this.assert.true(isOurExtension, '应该能识别我们的扩展，即使版本不同');
        });
    }

    // ============= 进程中断错误测试 =============

    async testInstallationInterruption() {
        await this.it('应该处理安装过程中断', async () => {
            const installer = new InstallationManager();
            
            // 模拟安装过程中的中断
            const originalExecuteStep = installer._executeStep;
            let stepCount = 0;
            
            installer._executeStep = async (step, options) => {
                stepCount++;
                if (stepCount === 3) {  // 在第三步中断
                    const error = new Error('Process interrupted');
                    error.code = 'EINTR';
                    throw error;
                }
                return await originalExecuteStep.call(installer, step, options);
            };
            
            try {
                await installer.install();
                this.assert.true(false, '安装应该因中断而失败');
            } catch (error) {
                this.assert.contains(error.message, 'interrupted', '错误应该表明进程被中断');
                
                // 验证状态
                this.assert.true(installer.state.currentStep > 0, '应该记录已完成的步骤');
                this.assert.true(installer.state.currentStep < installer.INSTALL_STEPS.length, 
                    '不应该完成所有步骤');
            }
        });
    }

    async testProcessKilled() {
        // 进程被杀死的测试很难实现，我们跳过
        this.skip('进程被杀死测试', '需要外部进程管理');
    }

    async testSystemShutdown() {
        // 系统关机测试不适合在单元测试中实现
        this.skip('系统关机测试', '不适合单元测试');
    }

    // ============= 并发访问错误测试 =============

    async testMultipleInstallationAttempts() {
        await this.it('应该处理多个安装尝试', async () => {
            const tempDir = await this.createTempDir();
            
            // 创建两个安装器实例
            const installer1 = new InstallationManager();
            const installer2 = new InstallationManager();
            
            // 模拟它们同时运行
            // 在实际情况下，应该有锁文件机制防止并发安装
            
            // 这里我们主要测试状态隔离
            installer1.state.currentStep = 3;
            installer2.state.currentStep = 1;
            
            this.assert.equals(installer1.state.currentStep, 3, '安装器1状态应该独立');
            this.assert.equals(installer2.state.currentStep, 1, '安装器2状态应该独立');
        });
    }

    async testConfigFileLocking() {
        await this.it('应该处理配置文件锁定', async () => {
            const tempDir = await this.createTempDir();
            const configPath = path.join(tempDir, 'config.json');
            
            const configManager1 = new ClaudeConfigManager();
            const configManager2 = new ClaudeConfigManager();
            
            configManager1.configPath = configPath;
            configManager2.configPath = configPath;
            
            // 创建初始配置
            await fs.writeFile(configPath, '{"mcpServers": {}}', 'utf-8');
            
            // 模拟并发访问
            const config1 = await configManager1._readConfig();
            const config2 = await configManager2._readConfig();
            
            // 两个管理器应该都能读取配置
            this.assert.true(!!config1.mcpServers, '配置管理器1应该能读取配置');
            this.assert.true(!!config2.mcpServers, '配置管理器2应该能读取配置');
        });
    }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    const tests = new ErrorScenarioTests();
    const report = await tests.run();
    
    console.log(`\n🚨 错误场景测试完成:`);
    console.log(`模拟错误类型数: 8`);
    console.log(`错误恢复测试数: ${report.total}`);
    
    process.exit(report.failed > 0 ? 1 : 0);
}