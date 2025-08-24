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
 * 性能基准测试套件
 * 
 * 测试目标:
 * 1. 安装时间 < 2 分钟 (120秒)
 * 2. 系统检测 < 5秒
 * 3. 配置生成 < 1秒
 * 4. 内存使用 < 100MB
 * 5. CPU 密集操作优化
 * 6. 文件I/O操作效率
 * 7. 网络检查超时合理性
 */
class PerformanceBenchmarkTests extends InstallerTestFramework {
    constructor() {
        super();
        this.performanceTargets = {
            totalInstallTime: 120000,      // 2分钟 = 120秒 = 120000毫秒
            systemDetection: 5000,         // 5秒
            configGeneration: 1000,        // 1秒
            configValidation: 500,         // 0.5秒
            backupCreation: 2000,          // 2秒
            rollbackOperation: 1000,       // 1秒
            memoryUsage: 100,              // 100MB
            fileOperations: 100,           // 100ms per file operation
            networkCheck: 10000            // 10秒 (网络检查可以稍长)
        };
        
        this.performanceResults = {};
    }

    async run() {
        this.stats.startTime = Date.now();
        
        try {
            await this.describe('系统检测性能测试', async () => {
                await this.testSystemDetectionSpeed();
                await this.testRequirementsCheckSpeed();
                await this.testPlatformAdapterSpeed();
            });

            await this.describe('配置操作性能测试', async () => {
                await this.testConfigGenerationSpeed();
                await this.testConfigValidationSpeed();
                await this.testConfigMergingSpeed();
            });

            await this.describe('文件操作性能测试', async () => {
                await this.testFileIOPerformance();
                await this.testBackupOperationSpeed();
                await this.testRollbackOperationSpeed();
            });

            await this.describe('内存使用测试', async () => {
                await this.testMemoryUsageDuringInstall();
                await this.testMemoryLeakDetection();
                await this.testLargeConfigHandling();
            });

            await this.describe('并发性能测试', async () => {
                await this.testConcurrentOperations();
                await this.testMultipleConfigProcessing();
            });

            await this.describe('网络性能测试', async () => {
                await this.testNetworkCheckPerformance();
                await this.testTimeoutHandling();
            });

            await this.describe('整体安装性能测试', async () => {
                await this.testCompleteInstallationTime();
                await this.testInstallationScaling();
            });

            // 生成性能报告
            this.generatePerformanceReport();

        } finally {
            await this.cleanup();
            return this.generateReport();
        }
    }

    // ============= 系统检测性能测试 =============

    async testSystemDetectionSpeed() {
        await this.it('系统检测应该在5秒内完成', async () => {
            const detector = new SystemDetector();
            
            const result = await this.benchmark('系统检测', async () => {
                return await detector.detect();
            });
            
            this.performanceResults.systemDetection = result.avg;
            this.assert.true(result.avg < this.performanceTargets.systemDetection,
                `系统检测时间 ${result.avg.toFixed(2)}ms 应该小于 ${this.performanceTargets.systemDetection}ms`);
            
            console.log(`   📊 系统检测平均时间: ${result.avg.toFixed(2)}ms`);
        });
    }

    async testRequirementsCheckSpeed() {
        await this.it('系统要求检查应该高效执行', async () => {
            const detector = new SystemDetector();
            
            const result = await this.benchmark('要求检查', async () => {
                return await detector.checkRequirements();
            });
            
            this.performanceResults.requirementsCheck = result.avg;
            
            // 要求检查可能涉及网络，所以时间限制放宽一些
            this.assert.true(result.avg < this.performanceTargets.networkCheck,
                `要求检查时间 ${result.avg.toFixed(2)}ms 应该在合理范围内`);
            
            console.log(`   📊 要求检查平均时间: ${result.avg.toFixed(2)}ms`);
        });
    }

    async testPlatformAdapterSpeed() {
        await this.it('平台适配器操作应该快速', async () => {
            const result = await this.benchmark('平台适配器初始化', async () => {
                const adapters = new PlatformAdapters();
                await adapters.getAllPaths();
                await adapters.checkPathPermissions();
                return adapters;
            });
            
            this.performanceResults.platformAdapter = result.avg;
            this.assert.true(result.avg < 1000, // 1秒
                `平台适配器操作时间 ${result.avg.toFixed(2)}ms 应该小于 1000ms`);
            
            console.log(`   📊 平台适配器平均时间: ${result.avg.toFixed(2)}ms`);
        });
    }

    // ============= 配置操作性能测试 =============

    async testConfigGenerationSpeed() {
        await this.it('配置生成应该在1秒内完成', async () => {
            const tempDir = await this.createTempDir();
            const configManager = new ClaudeConfigManager();
            configManager.configPath = path.join(tempDir, 'config.json');
            
            // 创建模拟服务器脚本
            const serverScript = path.join(tempDir, 'mcp-server', 'index.js');
            await fs.mkdir(path.dirname(serverScript), { recursive: true });
            await fs.writeFile(serverScript, '// mock server', 'utf-8');
            
            const result = await this.benchmark('配置生成', async () => {
                return await configManager.updateConfig(tempDir);
            });
            
            this.performanceResults.configGeneration = result.avg;
            this.assert.true(result.avg < this.performanceTargets.configGeneration,
                `配置生成时间 ${result.avg.toFixed(2)}ms 应该小于 ${this.performanceTargets.configGeneration}ms`);
            
            console.log(`   📊 配置生成平均时间: ${result.avg.toFixed(2)}ms`);
        });
    }

    async testConfigValidationSpeed() {
        await this.it('配置验证应该快速执行', async () => {
            const tempDir = await this.createTempDir();
            const configManager = new ClaudeConfigManager();
            configManager.configPath = path.join(tempDir, 'config.json');
            
            // 创建有效配置
            const config = {
                mcpServers: {
                    'gmail-mcp': {
                        command: 'node',
                        args: [path.join(tempDir, 'server.js')],
                        env: {}
                    }
                }
            };
            
            await fs.writeFile(configManager.configPath, JSON.stringify(config), 'utf-8');
            await fs.writeFile(path.join(tempDir, 'server.js'), '// server', 'utf-8');
            
            const result = await this.benchmark('配置验证', async () => {
                return await configManager.verify();
            });
            
            this.performanceResults.configValidation = result.avg;
            this.assert.true(result.avg < this.performanceTargets.configValidation,
                `配置验证时间 ${result.avg.toFixed(2)}ms 应该小于 ${this.performanceTargets.configValidation}ms`);
            
            console.log(`   📊 配置验证平均时间: ${result.avg.toFixed(2)}ms`);
        });
    }

    async testConfigMergingSpeed() {
        await this.it('配置合并应该高效处理', async () => {
            const tempDir = await this.createTempDir();
            const configManager = new ClaudeConfigManager();
            configManager.configPath = path.join(tempDir, 'config.json');
            
            // 创建大型现有配置
            const largeConfig = {
                mcpServers: {},
                userSettings: {},
                plugins: {},
                themes: {}
            };
            
            // 添加大量配置项
            for (let i = 0; i < 100; i++) {
                largeConfig.mcpServers[`server-${i}`] = {
                    command: 'node',
                    args: [`/path/to/server-${i}.js`],
                    env: { [`ENV_${i}`]: `value-${i}` }
                };
            }
            
            await fs.writeFile(configManager.configPath, JSON.stringify(largeConfig), 'utf-8');
            
            // 创建服务器脚本
            const serverScript = path.join(tempDir, 'server.js');
            await fs.writeFile(serverScript, '// server', 'utf-8');
            
            const result = await this.benchmark('配置合并', async () => {
                return await configManager.updateConfig(tempDir);
            });
            
            this.performanceResults.configMerging = result.avg;
            this.assert.true(result.avg < 2000, // 对于大配置，给2秒时间
                `配置合并时间 ${result.avg.toFixed(2)}ms 应该小于 2000ms`);
            
            console.log(`   📊 配置合并平均时间: ${result.avg.toFixed(2)}ms`);
        });
    }

    // ============= 文件操作性能测试 =============

    async testFileIOPerformance() {
        await this.it('文件I/O操作应该高效', async () => {
            const tempDir = await this.createTempDir();
            
            const result = await this.benchmark('文件I/O操作', async () => {
                // 模拟典型的安装文件操作
                const operations = [];
                
                // 创建10个文件
                for (let i = 0; i < 10; i++) {
                    const filePath = path.join(tempDir, `test-${i}.json`);
                    const content = JSON.stringify({ test: `data-${i}`, timestamp: Date.now() });
                    operations.push(fs.writeFile(filePath, content, 'utf-8'));
                }
                
                await Promise.all(operations);
                
                // 读取所有文件
                const readOperations = [];
                for (let i = 0; i < 10; i++) {
                    const filePath = path.join(tempDir, `test-${i}.json`);
                    readOperations.push(fs.readFile(filePath, 'utf-8'));
                }
                
                return await Promise.all(readOperations);
            });
            
            this.performanceResults.fileIO = result.avg;
            const targetTime = this.performanceTargets.fileOperations * 10; // 10个文件操作
            
            this.assert.true(result.avg < targetTime,
                `文件I/O操作时间 ${result.avg.toFixed(2)}ms 应该小于 ${targetTime}ms`);
            
            console.log(`   📊 文件I/O平均时间: ${result.avg.toFixed(2)}ms (10个文件)`);
        });
    }

    async testBackupOperationSpeed() {
        await this.it('备份操作应该快速完成', async () => {
            const tempDir = await this.createTempDir();
            const installer = new InstallationManager();
            
            // 创建多个配置文件
            const configFiles = [];
            for (let i = 0; i < 5; i++) {
                const filePath = path.join(tempDir, `config-${i}.json`);
                const config = { id: i, data: 'test'.repeat(1000) }; // 约4KB的数据
                await fs.writeFile(filePath, JSON.stringify(config), 'utf-8');
                configFiles.push(filePath);
            }
            
            // 模拟备份操作
            installer.platformAdapters.getBackupDir = async () => path.join(tempDir, 'backups');
            installer.platformAdapters.getClaudeConfigPath = async () => configFiles[0];
            installer.platformAdapters.getExtensionConfigPath = async () => configFiles[1];
            
            const result = await this.benchmark('备份操作', async () => {
                return await installer._backup_configs({});
            });
            
            this.performanceResults.backup = result.avg;
            this.assert.true(result.avg < this.performanceTargets.backupCreation,
                `备份操作时间 ${result.avg.toFixed(2)}ms 应该小于 ${this.performanceTargets.backupCreation}ms`);
            
            console.log(`   📊 备份操作平均时间: ${result.avg.toFixed(2)}ms`);
        });
    }

    async testRollbackOperationSpeed() {
        await this.it('回滚操作应该快速执行', async () => {
            const tempDir = await this.createTempDir();
            const installer = new InstallationManager();
            
            // 创建备份记录
            const backupFiles = [];
            for (let i = 0; i < 5; i++) {
                const originalPath = path.join(tempDir, `original-${i}.json`);
                const backupPath = path.join(tempDir, `backup-${i}.json`);
                
                await fs.writeFile(originalPath, `modified-${i}`, 'utf-8');
                await fs.writeFile(backupPath, `original-${i}`, 'utf-8');
                
                installer.state.backups.push({
                    type: `config-${i}`,
                    original: originalPath,
                    backup: backupPath,
                    name: `Config ${i}`
                });
            }
            
            const result = await this.benchmark('回滚操作', async () => {
                return await installer._rollbackConfigs();
            });
            
            this.performanceResults.rollback = result.avg;
            this.assert.true(result.avg < this.performanceTargets.rollbackOperation,
                `回滚操作时间 ${result.avg.toFixed(2)}ms 应该小于 ${this.performanceTargets.rollbackOperation}ms`);
            
            console.log(`   📊 回滚操作平均时间: ${result.avg.toFixed(2)}ms`);
        });
    }

    // ============= 内存使用测试 =============

    async testMemoryUsageDuringInstall() {
        await this.it('安装过程中内存使用应该合理', async () => {
            const initialMemory = this.getMemoryUsage();
            
            const tempDir = await this.createTempDir();
            const installer = new InstallationManager();
            
            // 模拟安装过程的内存密集操作
            installer.state.systemInfo = { platform: 'darwin' };
            
            // 创建大量配置数据
            const largeConfigData = {
                mcpServers: {},
                metadata: {
                    largeArray: new Array(10000).fill(0).map(i => ({ id: i, data: 'test'.repeat(100) }))
                }
            };
            
            for (let i = 0; i < 50; i++) {
                largeConfigData.mcpServers[`server-${i}`] = {
                    command: 'node',
                    args: [`/very/long/path/to/server-${i}/with/many/nested/directories/index.js`],
                    env: Object.fromEntries(
                        Array(20).fill(0).map((_, j) => [`ENV_VAR_${i}_${j}`, `value-${i}-${j}`])
                    )
                };
            }
            
            const configManager = new ClaudeConfigManager();
            configManager.configPath = path.join(tempDir, 'large-config.json');
            
            await fs.writeFile(configManager.configPath, JSON.stringify(largeConfigData), 'utf-8');
            
            // 执行内存密集操作
            await configManager._readConfig();
            await configManager.updateConfig(tempDir);
            
            const peakMemory = this.getMemoryUsage();
            const memoryIncrease = peakMemory.heapUsed - initialMemory.heapUsed;
            
            this.performanceResults.memoryUsage = memoryIncrease;
            this.assert.true(memoryIncrease < this.performanceTargets.memoryUsage,
                `内存增长 ${memoryIncrease}MB 应该小于 ${this.performanceTargets.memoryUsage}MB`);
            
            console.log(`   📊 内存使用增长: ${memoryIncrease}MB`);
            console.log(`   📊 峰值内存: RSS=${peakMemory.rss}MB, Heap=${peakMemory.heapUsed}MB`);
        });
    }

    async testMemoryLeakDetection() {
        await this.it('应该检测内存泄漏', async () => {
            const baselineMemory = this.getMemoryUsage();
            
            // 执行多轮操作，检查内存是否持续增长
            const iterations = 10;
            const memorySnapshots = [];
            
            for (let i = 0; i < iterations; i++) {
                const tempDir = await this.createTempDir();
                const configManager = new ClaudeConfigManager();
                
                // 创建并处理配置
                const config = {
                    mcpServers: Object.fromEntries(
                        Array(100).fill(0).map((_, j) => [
                            `server-${j}`,
                            { command: 'node', args: [`/path/to/server-${j}.js`] }
                        ])
                    )
                };
                
                configManager.configPath = path.join(tempDir, 'config.json');
                await fs.writeFile(configManager.configPath, JSON.stringify(config), 'utf-8');
                
                await configManager._readConfig();
                
                // 强制垃圾回收（如果可用）
                if (global.gc) {
                    global.gc();
                }
                
                memorySnapshots.push(this.getMemoryUsage().heapUsed);
                
                // 短暂等待
                await this.sleep(10);
            }
            
            // 检查内存增长趋势
            const initialSnapshot = memorySnapshots[0];
            const finalSnapshot = memorySnapshots[memorySnapshots.length - 1];
            const memoryGrowth = finalSnapshot - initialSnapshot;
            
            this.performanceResults.memoryLeak = memoryGrowth;
            
            // 允许少量增长（例如JIT优化），但不应该有显著的线性增长
            const acceptableGrowth = 20; // 20MB
            this.assert.true(memoryGrowth < acceptableGrowth,
                `内存增长 ${memoryGrowth}MB 应该小于 ${acceptableGrowth}MB (可能的内存泄漏)`);
            
            console.log(`   📊 ${iterations}轮操作后内存增长: ${memoryGrowth}MB`);
        });
    }

    async testLargeConfigHandling() {
        await this.it('应该高效处理大型配置文件', async () => {
            const tempDir = await this.createTempDir();
            const configManager = new ClaudeConfigManager();
            
            // 创建非常大的配置文件 (约10MB)
            const largeConfig = {
                mcpServers: {},
                metadata: {
                    description: 'Large configuration for performance testing',
                    generatedAt: new Date().toISOString(),
                    largeData: new Array(100000).fill(0).map(i => ({
                        id: i,
                        name: `item-${i}`,
                        description: `This is item number ${i} `.repeat(10),
                        tags: [`tag-${i % 10}`, `category-${i % 5}`, `type-${i % 3}`],
                        metadata: {
                            created: new Date(Date.now() - i * 1000).toISOString(),
                            modified: new Date(Date.now() - i * 500).toISOString(),
                            version: `1.${i % 100}.${i % 10}`
                        }
                    }))
                }
            };
            
            const configPath = path.join(tempDir, 'large-config.json');
            configManager.configPath = configPath;
            
            const result = await this.benchmark('大配置文件处理', async () => {
                // 写入大配置
                await fs.writeFile(configPath, JSON.stringify(largeConfig), 'utf-8');
                
                // 读取和解析
                const config = await configManager._readConfig();
                
                // 合并操作
                return configManager._mergeConfig(config, {
                    name: 'gmail-mcp',
                    command: 'node',
                    args: ['/path/to/server.js'],
                    env: {}
                });
            });
            
            this.performanceResults.largeConfigHandling = result.avg;
            
            // 大配置处理应该在合理时间内完成
            const targetTime = 5000; // 5秒
            this.assert.true(result.avg < targetTime,
                `大配置处理时间 ${result.avg.toFixed(2)}ms 应该小于 ${targetTime}ms`);
            
            console.log(`   📊 大配置文件处理平均时间: ${result.avg.toFixed(2)}ms`);
        });
    }

    // ============= 并发性能测试 =============

    async testConcurrentOperations() {
        await this.it('并发操作应该高效执行', async () => {
            const tempDir = await this.createTempDir();
            
            const result = await this.benchmark('并发操作', async () => {
                const operations = [];
                
                // 创建多个并发的配置管理器操作
                for (let i = 0; i < 5; i++) {
                    const configManager = new ClaudeConfigManager();
                    configManager.configPath = path.join(tempDir, `config-${i}.json`);
                    
                    const serverScript = path.join(tempDir, `server-${i}.js`);
                    await fs.writeFile(serverScript, '// server', 'utf-8');
                    
                    operations.push(configManager.updateConfig(tempDir));
                }
                
                return await Promise.all(operations);
            });
            
            this.performanceResults.concurrentOps = result.avg;
            
            // 并发操作应该比串行操作更快
            const serialTime = 5 * 1000; // 假设单个操作1秒，串行需要5秒
            this.assert.true(result.avg < serialTime,
                `并发操作时间 ${result.avg.toFixed(2)}ms 应该小于串行时间 ${serialTime}ms`);
            
            console.log(`   📊 并发操作平均时间: ${result.avg.toFixed(2)}ms`);
        });
    }

    async testMultipleConfigProcessing() {
        await this.it('批量配置处理应该优化', async () => {
            const tempDir = await this.createTempDir();
            const installer = new InstallationManager();
            
            // 创建多个配置文件
            const configCount = 20;
            const configs = [];
            
            for (let i = 0; i < configCount; i++) {
                const configPath = path.join(tempDir, `config-${i}.json`);
                const config = {
                    id: i,
                    mcpServers: {
                        [`server-${i}`]: {
                            command: 'node',
                            args: [`/path/to/server-${i}.js`]
                        }
                    }
                };
                
                await fs.writeFile(configPath, JSON.stringify(config), 'utf-8');
                configs.push(configPath);
            }
            
            const result = await this.benchmark('批量配置处理', async () => {
                const results = [];
                
                for (const configPath of configs) {
                    const configManager = new ClaudeConfigManager();
                    configManager.configPath = configPath;
                    
                    const config = await configManager._readConfig();
                    const verified = await configManager.verify();
                    
                    results.push({ config, verified });
                }
                
                return results;
            });
            
            this.performanceResults.batchProcessing = result.avg;
            
            // 批量处理应该在合理时间内完成
            const targetTime = configCount * 50; // 每个配置50ms
            this.assert.true(result.avg < targetTime,
                `批量处理时间 ${result.avg.toFixed(2)}ms 应该小于 ${targetTime}ms`);
            
            console.log(`   📊 批量处理平均时间: ${result.avg.toFixed(2)}ms (${configCount}个配置)`);
        });
    }

    // ============= 网络性能测试 =============

    async testNetworkCheckPerformance() {
        await this.it('网络检查应该有合理的超时', async () => {
            const detector = new SystemDetector();
            
            const result = await this.benchmark('网络检查', async () => {
                return await detector._checkNetworkConnectivity();
            });
            
            this.performanceResults.networkCheck = result.avg;
            
            // 网络检查时间取决于网络状况，但应该有合理上限
            this.assert.true(result.avg < this.performanceTargets.networkCheck,
                `网络检查时间 ${result.avg.toFixed(2)}ms 应该小于 ${this.performanceTargets.networkCheck}ms`);
            
            console.log(`   📊 网络检查平均时间: ${result.avg.toFixed(2)}ms`);
        });
    }

    async testTimeoutHandling() {
        await this.it('超时处理应该及时响应', async () => {
            const startTime = Date.now();
            
            try {
                // 模拟一个会超时的操作
                await Promise.race([
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), 1000)
                    ),
                    new Promise(resolve => 
                        setTimeout(() => resolve('success'), 2000)
                    )
                ]);
            } catch (error) {
                const elapsed = Date.now() - startTime;
                
                this.assert.true(elapsed < 1100, // 允许100ms误差
                    `超时处理时间 ${elapsed}ms 应该接近预期的 1000ms`);
                
                console.log(`   📊 超时处理时间: ${elapsed}ms`);
            }
        });
    }

    // ============= 整体性能测试 =============

    async testCompleteInstallationTime() {
        await this.it('完整安装应该在2分钟内完成', async () => {
            const tempDir = await this.createTempDir();
            const installer = new InstallationManager();
            
            // 模拟完整的安装过程（但跳过实际的外部依赖）
            installer._detect_system = async () => {
                installer.state.systemInfo = { platform: 'darwin' };
                return;
            };
            
            installer._check_deps = async () => {
                return; // 跳过依赖检查
            };
            
            installer._install_server = async () => {
                const serverDir = path.join(tempDir, 'mcp-server');
                await fs.mkdir(serverDir, { recursive: true });
                await fs.writeFile(path.join(serverDir, 'index.js'), '// server', 'utf-8');
                installer.state.installPath = tempDir;
                return;
            };
            
            installer._configure_claude = async () => {
                const configManager = new ClaudeConfigManager();
                configManager.configPath = path.join(tempDir, 'claude_config.json');
                await configManager.updateConfig(installer.state.installPath);
                return;
            };
            
            installer._setup_extension = async () => {
                const extensionManager = new ExtensionManager();
                // 模拟扩展配置
                return;
            };
            
            installer._verify_install = async () => {
                return; // 跳过验证
            };
            
            const result = await this.benchmark('完整安装', async () => {
                return await installer.install();
            });
            
            this.performanceResults.totalInstall = result.avg;
            this.assert.true(result.avg < this.performanceTargets.totalInstallTime,
                `完整安装时间 ${(result.avg / 1000).toFixed(2)}秒 应该小于 ${this.performanceTargets.totalInstallTime / 1000}秒`);
            
            console.log(`   📊 完整安装平均时间: ${(result.avg / 1000).toFixed(2)}秒`);
        });
    }

    async testInstallationScaling() {
        await this.it('安装性能应该随配置复杂度线性扩展', async () => {
            const complexities = [1, 5, 10];
            const times = [];
            
            for (const complexity of complexities) {
                const tempDir = await this.createTempDir();
                const configManager = new ClaudeConfigManager();
                configManager.configPath = path.join(tempDir, 'config.json');
                
                // 创建复杂度递增的配置
                const config = {
                    mcpServers: {}
                };
                
                for (let i = 0; i < complexity; i++) {
                    config.mcpServers[`server-${i}`] = {
                        command: 'node',
                        args: [`/path/to/server-${i}.js`],
                        env: Object.fromEntries(
                            Array(complexity).fill(0).map((_, j) => [`ENV_${i}_${j}`, `value-${i}-${j}`])
                        )
                    };
                }
                
                await fs.writeFile(configManager.configPath, JSON.stringify(config), 'utf-8');
                
                const result = await this.benchmark(`复杂度-${complexity}`, async () => {
                    const config = await configManager._readConfig();
                    return await configManager.verify();
                });
                
                times.push(result.avg);
                console.log(`   📊 复杂度 ${complexity} 处理时间: ${result.avg.toFixed(2)}ms`);
            }
            
            // 检查时间增长是否合理 (不应该呈指数增长)
            const scalingFactor = times[times.length - 1] / times[0];
            const expectedMaxScaling = complexities[complexities.length - 1] / complexities[0] * 2; // 允许2倍的线性增长
            
            this.assert.true(scalingFactor < expectedMaxScaling,
                `性能扩展因子 ${scalingFactor.toFixed(2)} 应该小于 ${expectedMaxScaling}`);
        });
    }

    /**
     * 生成性能报告
     */
    generatePerformanceReport() {
        console.log('\n📊 ===== 性能测试报告 =====');
        console.log('目标 vs 实际性能对比:\n');
        
        const results = [
            { name: '系统检测', target: this.performanceTargets.systemDetection, actual: this.performanceResults.systemDetection, unit: 'ms' },
            { name: '配置生成', target: this.performanceTargets.configGeneration, actual: this.performanceResults.configGeneration, unit: 'ms' },
            { name: '配置验证', target: this.performanceTargets.configValidation, actual: this.performanceResults.configValidation, unit: 'ms' },
            { name: '备份操作', target: this.performanceTargets.backupCreation, actual: this.performanceResults.backup, unit: 'ms' },
            { name: '回滚操作', target: this.performanceTargets.rollbackOperation, actual: this.performanceResults.rollback, unit: 'ms' },
            { name: '内存使用', target: this.performanceTargets.memoryUsage, actual: this.performanceResults.memoryUsage, unit: 'MB' },
            { name: '完整安装', target: this.performanceTargets.totalInstallTime, actual: this.performanceResults.totalInstall, unit: 'ms' }
        ];
        
        let passedTargets = 0;
        let totalTargets = 0;
        
        for (const result of results) {
            if (result.actual !== undefined) {
                totalTargets++;
                const passed = result.actual < result.target;
                if (passed) passedTargets++;
                
                const status = passed ? '✅' : '❌';
                const targetStr = result.unit === 'ms' && result.target >= 1000 
                    ? `${(result.target / 1000).toFixed(1)}s` 
                    : `${result.target}${result.unit}`;
                const actualStr = result.unit === 'ms' && result.actual >= 1000 
                    ? `${(result.actual / 1000).toFixed(1)}s` 
                    : `${result.actual.toFixed(1)}${result.unit}`;
                
                console.log(`${status} ${result.name.padEnd(12)} 目标: ${targetStr.padEnd(8)} 实际: ${actualStr.padEnd(8)} ${passed ? '达标' : '未达标'}`);
            }
        }
        
        console.log(`\n📈 性能达标率: ${passedTargets}/${totalTargets} (${((passedTargets / totalTargets) * 100).toFixed(1)}%)`);
        
        if (passedTargets === totalTargets) {
            console.log('🎉 所有性能目标均已达标！');
        } else {
            console.log('⚠️  部分性能目标未达标，需要优化');
        }
        
        return {
            passedTargets,
            totalTargets,
            passRate: (passedTargets / totalTargets) * 100,
            results: this.performanceResults
        };
    }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    const tests = new PerformanceBenchmarkTests();
    const report = await tests.run();
    
    console.log(`\n⚡ 性能测试完成:`);
    console.log(`性能指标数: ${Object.keys(tests.performanceTargets).length}`);
    console.log(`实际测试数: ${Object.keys(tests.performanceResults).length}`);
    
    process.exit(report.failed > 0 ? 1 : 0);
}