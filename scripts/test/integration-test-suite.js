#!/usr/bin/env node

/**
 * Gmail MCP Bridge 综合集成测试套件
 * 
 * 作为集成测试和端到端验证专家，这个测试套件涵盖：
 * 1. 完整用户流程测试
 * 2. 模块间集成测试  
 * 3. 真实场景模拟测试
 * 4. 异常情况集成测试
 * 5. 性能集成测试
 * 6. 兼容性集成测试
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

/**
 * 集成测试结果类
 */
class IntegrationTestResult {
    constructor(category, name, passed, duration, details = {}) {
        this.category = category;
        this.name = name;
        this.passed = passed;
        this.duration = duration;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * 综合集成测试套件
 */
export class ComprehensiveIntegrationTestSuite {
    constructor() {
        this.results = [];
        this.environment = this.detectEnvironment();
        this.testStartTime = Date.now();
        this.projectRoot = path.resolve(__dirname);
        
        // 测试配置
        this.config = {
            timeout: {
                short: 10000,      // 10秒
                medium: 30000,     // 30秒  
                long: 60000,       // 1分钟
                veryLong: 120000   // 2分钟
            },
            performance: {
                maxResponseTime: 5000,      // 5秒最大响应时间
                maxMemoryUsage: 100 * 1024 * 1024, // 100MB最大内存使用
                maxInstallTime: 120000      // 2分钟最大安装时间
            }
        };
    }

    /**
     * 检测测试环境
     */
    detectEnvironment() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            cpuCount: os.cpus().length,
            osType: os.type(),
            osRelease: os.release(),
            homeDir: os.homedir(),
            tempDir: os.tmpdir()
        };
    }

    /**
     * 运行完整的集成测试套件
     */
    async runFullSuite() {
        console.log('🎯 Gmail MCP Bridge 综合集成测试');
        console.log('=' .repeat(60));
        
        this.showEnvironmentInfo();
        
        // 测试类别
        const testCategories = [
            { name: '环境兼容性测试', handler: this.runCompatibilityTests },
            { name: '用户流程测试', handler: this.runUserFlowTests },
            { name: 'CLI功能集成测试', handler: this.runCLIIntegrationTests },
            { name: 'MCP服务器通信测试', handler: this.runMCPServerTests },
            { name: '系统诊断集成测试', handler: this.runDiagnosticTests },
            { name: '错误处理和恢复测试', handler: this.runErrorHandlingTests },
            { name: '性能基准测试', handler: this.runPerformanceTests },
            { name: '安全性验证测试', handler: this.runSecurityTests }
        ];

        // 运行所有测试类别
        for (const category of testCategories) {
            console.log(`\n🔄 开始 ${category.name}...`);
            try {
                const categoryResults = await category.handler.call(this);
                this.results.push(...categoryResults);
                
                const passed = categoryResults.filter(r => r.passed).length;
                const failed = categoryResults.filter(r => !r.passed).length;
                
                if (failed === 0) {
                    console.log(`✅ ${category.name} 完成 (${passed}/${categoryResults.length} 通过)`);
                } else {
                    console.log(`❌ ${category.name} 完成 (${passed}/${categoryResults.length} 通过, ${failed} 失败)`);
                }
            } catch (error) {
                console.log(`❌ ${category.name} 执行失败: ${error.message}`);
                this.results.push(new IntegrationTestResult(
                    category.name, 
                    '测试执行', 
                    false, 
                    0, 
                    { error: error.message }
                ));
            }
        }

        // 生成并显示最终报告
        const report = this.generateComprehensiveReport();
        this.displayFinalReport(report);
        
        return report;
    }

    /**
     * 显示环境信息
     */
    showEnvironmentInfo() {
        console.log('\n📊 测试环境信息:');
        console.log(`   平台: ${this.environment.platform} ${this.environment.arch}`);
        console.log(`   操作系统: ${this.environment.osType} ${this.environment.osRelease}`);
        console.log(`   Node.js: ${this.environment.nodeVersion}`);
        console.log(`   CPU: ${this.environment.cpuCount} 核心`);
        console.log(`   内存: ${Math.round(this.environment.totalMemory / 1024 / 1024 / 1024)}GB 总计, ${Math.round(this.environment.freeMemory / 1024 / 1024 / 1024)}GB 可用`);
    }

    /**
     * 兼容性测试
     */
    async runCompatibilityTests() {
        const tests = [];
        
        // Node.js版本兼容性
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        tests.push(new IntegrationTestResult(
            '兼容性',
            'Node.js版本检查',
            majorVersion >= 16,
            0,
            { nodeVersion, required: '>=16', actual: majorVersion }
        ));

        // 平台兼容性
        const supportedPlatforms = ['darwin', 'linux', 'win32'];
        tests.push(new IntegrationTestResult(
            '兼容性',
            '操作系统支持',
            supportedPlatforms.includes(this.environment.platform),
            0,
            { platform: this.environment.platform, supported: supportedPlatforms }
        ));

        // 系统资源检查
        const minMemoryGB = 2;
        const actualMemoryGB = this.environment.totalMemory / 1024 / 1024 / 1024;
        tests.push(new IntegrationTestResult(
            '兼容性',
            '系统内存充足性',
            actualMemoryGB >= minMemoryGB,
            0,
            { required: `${minMemoryGB}GB`, actual: `${actualMemoryGB.toFixed(1)}GB` }
        ));

        return tests;
    }

    /**
     * 用户流程测试
     */
    async runUserFlowTests() {
        const tests = [];

        // 测试1: 新用户安装体验（模拟）
        const installFlowStart = Date.now();
        try {
            // 检查项目结构
            await fs.access(path.join(this.projectRoot, 'package.json'));
            await fs.access(path.join(this.projectRoot, 'bin/gmail-mcp'));
            
            const installFlowDuration = Date.now() - installFlowStart;
            tests.push(new IntegrationTestResult(
                '用户流程',
                '新用户安装检查',
                true,
                installFlowDuration,
                { projectStructureValid: true }
            ));
        } catch (error) {
            tests.push(new IntegrationTestResult(
                '用户流程',
                '新用户安装检查',
                false,
                Date.now() - installFlowStart,
                { error: error.message }
            ));
        }

        // 测试2: 首次使用流程
        const firstUseStart = Date.now();
        try {
            // 模拟运行help命令
            const { stdout } = await execAsync('node bin/gmail-mcp help', { 
                cwd: this.projectRoot,
                timeout: this.config.timeout.short
            });
            
            const hasExpectedOutput = stdout.includes('Gmail MCP Bridge') && 
                                    stdout.includes('install') && 
                                    stdout.includes('status');
            
            const firstUseDuration = Date.now() - firstUseStart;
            tests.push(new IntegrationTestResult(
                '用户流程',
                '首次使用帮助',
                hasExpectedOutput,
                firstUseDuration,
                { outputLength: stdout.length }
            ));
        } catch (error) {
            tests.push(new IntegrationTestResult(
                '用户流程',
                '首次使用帮助',
                false,
                Date.now() - firstUseStart,
                { error: error.message }
            ));
        }

        return tests;
    }

    /**
     * CLI功能集成测试
     */
    async runCLIIntegrationTests() {
        const tests = [];
        const cliCommands = [
            { cmd: 'help', expectedContains: ['Gmail MCP Bridge', 'install'], timeout: 'short' },
            { cmd: 'doctor', expectedContains: ['系统诊断', '✅'], timeout: 'medium' },
            { cmd: 'test', expectedContains: ['功能测试', '系统要求'], timeout: 'medium' },
            { cmd: 'fix', expectedContains: ['修复'], timeout: 'medium' }
        ];

        for (const command of cliCommands) {
            const testStart = Date.now();
            try {
                const { stdout, stderr } = await execAsync(`node bin/gmail-mcp ${command.cmd}`, {
                    cwd: this.projectRoot,
                    timeout: this.config.timeout[command.timeout]
                });

                const output = stdout + stderr;
                const hasExpectedContent = command.expectedContains.every(
                    content => output.includes(content)
                );

                const testDuration = Date.now() - testStart;
                tests.push(new IntegrationTestResult(
                    'CLI集成',
                    `命令: ${command.cmd}`,
                    hasExpectedContent,
                    testDuration,
                    { 
                        outputLength: output.length,
                        expectedContent: command.expectedContains
                    }
                ));

            } catch (error) {
                tests.push(new IntegrationTestResult(
                    'CLI集成',
                    `命令: ${command.cmd}`,
                    false,
                    Date.now() - testStart,
                    { error: error.message }
                ));
            }
        }

        return tests;
    }

    /**
     * MCP服务器测试
     */
    async runMCPServerTests() {
        const tests = [];

        // 测试1: 服务器文件完整性
        const serverPath = path.join(this.projectRoot, 'gmail-mcp-extension/mcp-server');
        const serverFileStart = Date.now();
        
        try {
            await fs.access(path.join(serverPath, 'index.js'));
            await fs.access(path.join(serverPath, 'package.json'));
            
            const packageJson = JSON.parse(
                await fs.readFile(path.join(serverPath, 'package.json'), 'utf-8')
            );
            
            const hasMCPDependency = packageJson.dependencies && 
                                   packageJson.dependencies['@modelcontextprotocol/sdk'];
            
            tests.push(new IntegrationTestResult(
                'MCP服务器',
                '服务器文件完整性',
                hasMCPDependency,
                Date.now() - serverFileStart,
                { 
                    serverPath,
                    hasMCPDependency,
                    dependencyCount: Object.keys(packageJson.dependencies || {}).length
                }
            ));
        } catch (error) {
            tests.push(new IntegrationTestResult(
                'MCP服务器',
                '服务器文件完整性',
                false,
                Date.now() - serverFileStart,
                { error: error.message }
            ));
        }

        // 测试2: 服务器依赖安装状态
        const depsCheckStart = Date.now();
        try {
            await fs.access(path.join(serverPath, 'node_modules'));
            
            tests.push(new IntegrationTestResult(
                'MCP服务器',
                '依赖安装状态',
                true,
                Date.now() - depsCheckStart,
                { nodeModulesExists: true }
            ));
        } catch (error) {
            tests.push(new IntegrationTestResult(
                'MCP服务器',
                '依赖安装状态',
                false,
                Date.now() - depsCheckStart,
                { error: 'node_modules不存在，需要运行npm install' }
            ));
        }

        return tests;
    }

    /**
     * 系统诊断测试
     */
    async runDiagnosticTests() {
        const tests = [];

        // 测试完整诊断流程
        const diagnosisStart = Date.now();
        try {
            const { stdout } = await execAsync('node bin/gmail-mcp doctor', {
                cwd: this.projectRoot,
                timeout: this.config.timeout.medium
            });

            const hasStatusIndicators = stdout.includes('✅') || stdout.includes('❌') || stdout.includes('⚠️');
            const hasSystemInfo = stdout.includes('Node.js') && stdout.includes('Chrome');
            
            tests.push(new IntegrationTestResult(
                '系统诊断',
                '诊断功能完整性',
                hasStatusIndicators && hasSystemInfo,
                Date.now() - diagnosisStart,
                { 
                    hasStatusIndicators,
                    hasSystemInfo,
                    outputLength: stdout.length
                }
            ));
        } catch (error) {
            tests.push(new IntegrationTestResult(
                '系统诊断',
                '诊断功能完整性',
                false,
                Date.now() - diagnosisStart,
                { error: error.message }
            ));
        }

        return tests;
    }

    /**
     * 错误处理和恢复测试
     */
    async runErrorHandlingTests() {
        const tests = [];

        // 测试1: 无效命令处理
        const invalidCmdStart = Date.now();
        try {
            const { stdout, stderr } = await execAsync('node bin/gmail-mcp invalid-command-xyz', {
                cwd: this.projectRoot,
                timeout: this.config.timeout.short
            });

            // 应该优雅地处理无效命令，显示错误信息
            const output = stdout + stderr;
            const handlesInvalidCommand = output.includes('未知命令') || output.includes('help');
            
            tests.push(new IntegrationTestResult(
                '错误处理',
                '无效命令处理',
                handlesInvalidCommand,
                Date.now() - invalidCmdStart,
                { gracefulHandling: handlesInvalidCommand }
            ));
        } catch (error) {
            // 如果命令失败但有错误输出，这也是正确的行为
            const handlesGracefully = error.message.includes('未知命令') || 
                                    error.stdout?.includes('help');
            
            tests.push(new IntegrationTestResult(
                '错误处理',
                '无效命令处理',
                handlesGracefully,
                Date.now() - invalidCmdStart,
                { errorMessage: error.message }
            ));
        }

        // 测试2: 自动修复功能
        const autoFixStart = Date.now();
        try {
            const { stdout } = await execAsync('node bin/gmail-mcp fix', {
                cwd: this.projectRoot,
                timeout: this.config.timeout.medium
            });

            const hasFixOutput = stdout.includes('修复') || stdout.includes('完成');
            
            tests.push(new IntegrationTestResult(
                '错误处理',
                '自动修复功能',
                hasFixOutput,
                Date.now() - autoFixStart,
                { hasFixOutput, outputLength: stdout.length }
            ));
        } catch (error) {
            tests.push(new IntegrationTestResult(
                '错误处理',
                '自动修复功能',
                false,
                Date.now() - autoFixStart,
                { error: error.message }
            ));
        }

        return tests;
    }

    /**
     * 性能基准测试
     */
    async runPerformanceTests() {
        const tests = [];

        // 测试1: 命令响应时间
        const commands = ['help', 'doctor', 'test'];
        
        for (const command of commands) {
            const perfStart = Date.now();
            try {
                await execAsync(`node bin/gmail-mcp ${command}`, {
                    cwd: this.projectRoot,
                    timeout: this.config.timeout.medium
                });

                const responseTime = Date.now() - perfStart;
                const isWithinLimits = responseTime < this.config.performance.maxResponseTime;

                tests.push(new IntegrationTestResult(
                    '性能基准',
                    `${command}命令响应时间`,
                    isWithinLimits,
                    responseTime,
                    { 
                        responseTime,
                        limit: this.config.performance.maxResponseTime,
                        withinLimits: isWithinLimits
                    }
                ));
            } catch (error) {
                tests.push(new IntegrationTestResult(
                    '性能基准',
                    `${command}命令响应时间`,
                    false,
                    Date.now() - perfStart,
                    { error: error.message }
                ));
            }
        }

        // 测试2: 内存使用
        const memoryStart = Date.now();
        const initialMemory = process.memoryUsage();
        
        try {
            // 运行一系列命令检查内存使用
            await execAsync('node bin/gmail-mcp help', { cwd: this.projectRoot });
            await execAsync('node bin/gmail-mcp doctor', { cwd: this.projectRoot });
            
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            const memoryWithinLimits = memoryIncrease < this.config.performance.maxMemoryUsage;

            tests.push(new IntegrationTestResult(
                '性能基准',
                '内存使用测试',
                memoryWithinLimits,
                Date.now() - memoryStart,
                {
                    memoryIncrease,
                    limit: this.config.performance.maxMemoryUsage,
                    withinLimits: memoryWithinLimits
                }
            ));
        } catch (error) {
            tests.push(new IntegrationTestResult(
                '性能基准',
                '内存使用测试',
                false,
                Date.now() - memoryStart,
                { error: error.message }
            ));
        }

        return tests;
    }

    /**
     * 安全性验证测试
     */
    async runSecurityTests() {
        const tests = [];

        // 测试1: 文件权限检查
        const permissionStart = Date.now();
        try {
            const cliPath = path.join(this.projectRoot, 'bin/gmail-mcp');
            const stats = await fs.stat(cliPath);
            
            // 检查文件是否可执行
            const isExecutable = !!(stats.mode & parseInt('111', 8));
            
            tests.push(new IntegrationTestResult(
                '安全验证',
                'CLI文件权限',
                isExecutable,
                Date.now() - permissionStart,
                { 
                    mode: stats.mode.toString(8),
                    isExecutable
                }
            ));
        } catch (error) {
            tests.push(new IntegrationTestResult(
                '安全验证',
                'CLI文件权限',
                false,
                Date.now() - permissionStart,
                { error: error.message }
            ));
        }

        // 测试2: 配置文件安全性
        const configSecStart = Date.now();
        try {
            const extensionManifest = path.join(this.projectRoot, 'gmail-mcp-extension/extension/manifest.json');
            const manifest = JSON.parse(await fs.readFile(extensionManifest, 'utf-8'));
            
            // 检查manifest权限
            const permissions = manifest.permissions || [];
            const hasActiveTab = permissions.includes('activeTab');
            const hasStorage = permissions.includes('storage');
            
            // 确保没有过多权限
            const dangerousPermissions = ['tabs', '<all_urls>', 'webRequest'];
            const hasDangerousPermissions = permissions.some(p => dangerousPermissions.includes(p));
            
            const securityCheck = hasActiveTab && hasStorage && !hasDangerousPermissions;
            
            tests.push(new IntegrationTestResult(
                '安全验证',
                '扩展权限安全性',
                securityCheck,
                Date.now() - configSecStart,
                {
                    permissions,
                    hasDangerousPermissions,
                    securityCheck
                }
            ));
        } catch (error) {
            tests.push(new IntegrationTestResult(
                '安全验证',
                '扩展权限安全性',
                false,
                Date.now() - configSecStart,
                { error: error.message }
            ));
        }

        return tests;
    }

    /**
     * 生成综合报告
     */
    generateComprehensiveReport() {
        const totalDuration = Date.now() - this.testStartTime;
        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.passed).length;
        const failedTests = this.results.filter(r => !r.passed).length;
        
        // 按类别分组
        const categorizedResults = {};
        this.results.forEach(result => {
            if (!categorizedResults[result.category]) {
                categorizedResults[result.category] = [];
            }
            categorizedResults[result.category].push(result);
        });

        // 计算每个类别的统计信息
        const categoryStats = {};
        Object.keys(categorizedResults).forEach(category => {
            const categoryTests = categorizedResults[category];
            categoryStats[category] = {
                total: categoryTests.length,
                passed: categoryTests.filter(t => t.passed).length,
                failed: categoryTests.filter(t => !t.passed).length,
                avgDuration: Math.round(categoryTests.reduce((sum, t) => sum + t.duration, 0) / categoryTests.length),
                successRate: Math.round((categoryTests.filter(t => t.passed).length / categoryTests.length) * 100)
            };
        });

        // 性能分析
        const performanceTests = this.results.filter(r => r.category === '性能基准');
        const performanceMetrics = {
            avgResponseTime: performanceTests.length > 0 ? 
                Math.round(performanceTests.reduce((sum, t) => sum + t.duration, 0) / performanceTests.length) : 0,
            maxResponseTime: performanceTests.length > 0 ?
                Math.max(...performanceTests.map(t => t.duration)) : 0,
            minResponseTime: performanceTests.length > 0 ?
                Math.min(...performanceTests.map(t => t.duration)) : 0
        };

        // 系统就绪性评估
        const criticalCategories = ['用户流程', 'CLI集成', 'MCP服务器'];
        const criticalTestsPassed = criticalCategories.every(category => {
            const stats = categoryStats[category];
            return stats && (stats.successRate >= 90); // 90%及以上为合格
        });

        const overallSuccessRate = Math.round((passedTests / totalTests) * 100);
        const readinessLevel = this.assessReadinessLevel(overallSuccessRate, criticalTestsPassed, categoryStats);

        return {
            summary: {
                totalTests,
                passedTests,
                failedTests,
                successRate: overallSuccessRate,
                totalDuration,
                avgTestDuration: Math.round(totalDuration / totalTests)
            },
            environment: this.environment,
            categoryStats,
            categorizedResults,
            performanceMetrics,
            readiness: {
                level: readinessLevel,
                criticalTestsPassed,
                recommendation: this.getReadinessRecommendation(readinessLevel)
            },
            failedTests: this.results.filter(r => !r.passed),
            topPerformingCategories: Object.keys(categoryStats)
                .sort((a, b) => categoryStats[b].successRate - categoryStats[a].successRate)
                .slice(0, 3),
            concerningCategories: Object.keys(categoryStats)
                .filter(cat => categoryStats[cat].successRate < 80)
                .sort((a, b) => categoryStats[a].successRate - categoryStats[b].successRate),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 评估系统就绪程度
     */
    assessReadinessLevel(overallSuccessRate, criticalTestsPassed, categoryStats) {
        if (overallSuccessRate >= 95 && criticalTestsPassed) {
            return 'PRODUCTION_READY';
        } else if (overallSuccessRate >= 85 && criticalTestsPassed) {
            return 'BETA_READY';
        } else if (overallSuccessRate >= 70) {
            return 'DEVELOPMENT_READY';
        } else {
            return 'NOT_READY';
        }
    }

    /**
     * 获取就绪性建议
     */
    getReadinessRecommendation(readinessLevel) {
        const recommendations = {
            'PRODUCTION_READY': '🚀 系统已达到生产就绪标准，可以安全发布给所有用户使用。',
            'BETA_READY': '🧪 系统适合作为Beta版本发布，建议先向有限用户群体开放。',
            'DEVELOPMENT_READY': '⚠️ 系统基本功能正常，但仍需要改进才能发布。建议继续开发。',
            'NOT_READY': '❌ 系统存在重大问题，不建议发布。需要解决关键问题后重新测试。'
        };
        
        return recommendations[readinessLevel] || recommendations['NOT_READY'];
    }

    /**
     * 显示最终报告
     */
    displayFinalReport(report) {
        console.log('\n\n🎯 Gmail MCP Bridge 综合集成测试报告');
        console.log('=' .repeat(80));
        
        // 总体统计
        console.log('\n📊 总体统计:');
        console.log(`   总测试数: ${report.summary.totalTests}`);
        console.log(`   通过测试: ${report.summary.passedTests} (${report.summary.successRate}%)`);
        console.log(`   失败测试: ${report.summary.failedTests}`);
        console.log(`   总耗时: ${report.summary.totalDuration}ms`);
        console.log(`   平均耗时: ${report.summary.avgTestDuration}ms/测试`);

        // 系统就绪性
        console.log('\n🎯 系统就绪性评估:');
        console.log(`   就绪级别: ${report.readiness.level}`);
        console.log(`   关键测试通过: ${report.readiness.criticalTestsPassed ? '是' : '否'}`);
        console.log(`   建议: ${report.readiness.recommendation}`);

        // 各类别表现
        console.log('\n📈 各类别测试结果:');
        Object.keys(report.categoryStats).forEach(category => {
            const stats = report.categoryStats[category];
            const status = stats.successRate >= 90 ? '✅' : stats.successRate >= 70 ? '⚠️' : '❌';
            console.log(`   ${status} ${category}: ${stats.passed}/${stats.total} (${stats.successRate}%) - 平均${stats.avgDuration}ms`);
        });

        // 性能指标
        if (report.performanceMetrics.avgResponseTime > 0) {
            console.log('\n⚡ 性能指标:');
            console.log(`   平均响应时间: ${report.performanceMetrics.avgResponseTime}ms`);
            console.log(`   最大响应时间: ${report.performanceMetrics.maxResponseTime}ms`);
            console.log(`   最小响应时间: ${report.performanceMetrics.minResponseTime}ms`);
        }

        // 失败测试
        if (report.failedTests.length > 0) {
            console.log('\n❌ 失败的测试:');
            report.failedTests.forEach(test => {
                console.log(`   • ${test.category} - ${test.name}: ${test.details.error || '详见测试详情'}`);
            });
        }

        // 表现优异的类别
        if (report.topPerformingCategories.length > 0) {
            console.log('\n🏆 表现优异的测试类别:');
            report.topPerformingCategories.forEach((category, index) => {
                const stats = report.categoryStats[category];
                console.log(`   ${index + 1}. ${category}: ${stats.successRate}% 成功率`);
            });
        }

        // 需要关注的类别
        if (report.concerningCategories.length > 0) {
            console.log('\n⚠️ 需要关注的测试类别:');
            report.concerningCategories.forEach(category => {
                const stats = report.categoryStats[category];
                console.log(`   • ${category}: ${stats.successRate}% 成功率 (${stats.failed}/${stats.total} 失败)`);
            });
        }

        console.log('\n' + '=' .repeat(80));
    }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    const testSuite = new ComprehensiveIntegrationTestSuite();
    
    try {
        const report = await testSuite.runFullSuite();
        
        // 根据就绪性级别设置退出码
        const exitCode = report.readiness.level === 'NOT_READY' ? 1 : 0;
        process.exit(exitCode);
        
    } catch (error) {
        console.error('\n💥 测试套件执行失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

export default ComprehensiveIntegrationTestSuite;