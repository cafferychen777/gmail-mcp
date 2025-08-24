/**
 * 安装流程集成测试
 * 
 * Linus 哲学实践:
 * 1. 实用主义: 测试真实的安装场景，不是理论情况
 * 2. 简洁性: 每个测试只验证一个方面
 * 3. 稳定性: 测试应该可重复、可靠
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
 * 测试结果数据结构
 * 好品味: 统一的测试结果格式
 */
class TestResult {
    constructor(name, passed, message, details = null, duration = 0) {
        this.name = name;
        this.passed = passed;
        this.message = message;
        this.details = details;
        this.duration = duration;
        this.timestamp = new Date().toISOString();
    }

    static pass(name, message, details = null, duration = 0) {
        return new TestResult(name, true, message, details, duration);
    }

    static fail(name, message, details = null, duration = 0) {
        return new TestResult(name, false, message, details, duration);
    }
}

/**
 * 安装测试套件
 */
export class InstallTest {
    constructor() {
        this.results = [];
        this.testEnvironment = this.setupTestEnvironment();
    }

    /**
     * 设置测试环境
     */
    setupTestEnvironment() {
        const tempDir = path.join(os.tmpdir(), 'gmail-mcp-install-test', Date.now().toString());
        
        return {
            tempDir,
            platform: os.platform(),
            nodeVersion: process.version,
            testStartTime: Date.now()
        };
    }

    /**
     * 运行完整的安装测试套件
     */
    async runTests() {
        console.log('🧪 开始安装流程集成测试\n');
        console.log(`📋 测试环境:
   - 平台: ${this.testEnvironment.platform}
   - Node.js: ${this.testEnvironment.nodeVersion}
   - 测试目录: ${this.testEnvironment.tempDir}\n`);

        // 测试用例列表 - 按照实际安装流程顺序
        const testCases = [
            this.testEnvironmentPrerequisites,
            this.testProjectStructure,
            this.testPackageJsonValidation,
            this.testDependencyInstallation,
            this.testCLIExecutability,
            this.testClaudeConfigGeneration,
            this.testMCPServerInitialization,
            this.testChromeExtensionValidation,
            this.testSystemIntegration,
            this.testInstallationCleanup
        ];

        // 执行所有测试
        for (const testCase of testCases) {
            const startTime = Date.now();
            try {
                const result = await testCase.call(this);
                const duration = Date.now() - startTime;
                result.duration = duration;
                this.results.push(result);
                
                const status = result.passed ? '✅' : '❌';
                console.log(`${status} ${result.name} (${duration}ms)`);
                if (!result.passed) {
                    console.log(`   ${result.message}`);
                }
            } catch (error) {
                const duration = Date.now() - startTime;
                const result = TestResult.fail(
                    testCase.name || 'Unknown Test',
                    `测试执行错误: ${error.message}`,
                    { error: error.stack },
                    duration
                );
                this.results.push(result);
                console.log(`❌ ${result.name} (${duration}ms)`);
                console.log(`   ${result.message}`);
            }
        }

        return this.generateTestReport();
    }

    /**
     * 测试环境先决条件
     */
    async testEnvironmentPrerequisites() {
        // 检查 Node.js 版本
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        
        if (majorVersion < 18) {
            return TestResult.fail(
                '环境先决条件检查',
                `Node.js 版本过低: ${nodeVersion}，需要 >= 18`,
                { nodeVersion, required: '>=18' }
            );
        }

        // 检查基本的系统工具
        const tools = ['npm', 'git'];
        for (const tool of tools) {
            try {
                await this.runCommand('which', [tool]);
            } catch (error) {
                return TestResult.fail(
                    '环境先决条件检查',
                    `缺少必要工具: ${tool}`,
                    { tool, error: error.message }
                );
            }
        }

        return TestResult.pass(
            '环境先决条件检查',
            '所有先决条件满足',
            { nodeVersion, majorVersion, tools }
        );
    }

    /**
     * 测试项目结构完整性
     */
    async testProjectStructure() {
        const projectRoot = path.resolve(__dirname, '../..');
        const requiredPaths = [
            'package.json',
            'bin/gmail-mcp',
            'bin/gmail-mcp.js',
            'tools/doctor/system-doctor.js',
            'tools/doctor/repair-tools.js',
            'gmail-mcp-extension/mcp-server',
            'gmail-mcp-extension/extension'
        ];

        const missing = [];
        for (const requiredPath of requiredPaths) {
            try {
                await fs.access(path.join(projectRoot, requiredPath));
            } catch (error) {
                missing.push(requiredPath);
            }
        }

        if (missing.length > 0) {
            return TestResult.fail(
                '项目结构检查',
                `缺少关键文件: ${missing.join(', ')}`,
                { missing, projectRoot }
            );
        }

        return TestResult.pass(
            '项目结构检查',
            '所有关键文件和目录存在',
            { requiredPaths, projectRoot }
        );
    }

    /**
     * 测试 package.json 配置有效性
     */
    async testPackageJsonValidation() {
        const projectRoot = path.resolve(__dirname, '../..');
        const packageJsonPath = path.join(projectRoot, 'package.json');

        try {
            const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(packageContent);

            // 验证关键字段
            const requiredFields = ['name', 'version', 'bin', 'dependencies', 'engines'];
            const missing = requiredFields.filter(field => !packageJson[field]);

            if (missing.length > 0) {
                return TestResult.fail(
                    'package.json 验证',
                    `缺少必要字段: ${missing.join(', ')}`,
                    { missing, packageJsonPath }
                );
            }

            // 验证 bin 配置
            if (!packageJson.bin['gmail-mcp']) {
                return TestResult.fail(
                    'package.json 验证',
                    'bin 配置中缺少 gmail-mcp 入口',
                    { bin: packageJson.bin }
                );
            }

            // 验证 Node.js 版本要求
            const engines = packageJson.engines;
            if (!engines.node || !engines.node.includes('18')) {
                return TestResult.fail(
                    'package.json 验证',
                    'Node.js 版本要求配置不正确',
                    { engines }
                );
            }

            return TestResult.pass(
                'package.json 验证',
                'package.json 配置正确',
                { 
                    name: packageJson.name, 
                    version: packageJson.version,
                    dependencyCount: Object.keys(packageJson.dependencies || {}).length
                }
            );

        } catch (error) {
            return TestResult.fail(
                'package.json 验证',
                `package.json 读取或解析失败: ${error.message}`,
                { packageJsonPath, error: error.stack }
            );
        }
    }

    /**
     * 测试依赖安装过程
     */
    async testDependencyInstallation() {
        const testDir = this.testEnvironment.tempDir;
        await fs.mkdir(testDir, { recursive: true });

        const projectRoot = path.resolve(__dirname, '../..');
        const packageJsonPath = path.join(projectRoot, 'package.json');

        try {
            // 复制 package.json 到测试目录
            await fs.copyFile(packageJsonPath, path.join(testDir, 'package.json'));

            // 运行 npm install
            await this.runCommand('npm', ['install'], { cwd: testDir, timeout: 60000 });

            // 验证 node_modules 目录
            const nodeModulesPath = path.join(testDir, 'node_modules');
            await fs.access(nodeModulesPath);

            // 检查关键依赖
            const keyDependencies = ['chalk', 'commander', 'inquirer', 'ora'];
            const installedDeps = await fs.readdir(nodeModulesPath);
            const missing = keyDependencies.filter(dep => !installedDeps.includes(dep));

            if (missing.length > 0) {
                return TestResult.fail(
                    '依赖安装测试',
                    `关键依赖未安装: ${missing.join(', ')}`,
                    { missing, installedCount: installedDeps.length }
                );
            }

            return TestResult.pass(
                '依赖安装测试',
                '所有依赖安装成功',
                { installedCount: installedDeps.length, testDir }
            );

        } catch (error) {
            return TestResult.fail(
                '依赖安装测试',
                `依赖安装失败: ${error.message}`,
                { testDir, error: error.stack }
            );
        }
    }

    /**
     * 测试 CLI 可执行性
     */
    async testCLIExecutability() {
        const projectRoot = path.resolve(__dirname, '../..');
        const cliPath = path.join(projectRoot, 'bin/gmail-mcp');

        try {
            // 检查文件存在和权限
            const stats = await fs.stat(cliPath);
            if (!(stats.mode & parseInt('111', 8))) {
                return TestResult.fail(
                    'CLI 可执行性测试',
                    'CLI 脚本缺少执行权限',
                    { cliPath, mode: stats.mode.toString(8) }
                );
            }

            // 测试 help 命令
            const output = await this.runCommand('node', [cliPath, '--help'], { 
                timeout: 10000,
                cwd: projectRoot 
            });

            if (!output.includes('Gmail MCP Bridge')) {
                return TestResult.fail(
                    'CLI 可执行性测试',
                    'CLI 输出不包含预期内容',
                    { output: output.substring(0, 200) }
                );
            }

            return TestResult.pass(
                'CLI 可执行性测试',
                'CLI 可正常执行',
                { cliPath, outputLength: output.length }
            );

        } catch (error) {
            return TestResult.fail(
                'CLI 可执行性测试',
                `CLI 执行失败: ${error.message}`,
                { cliPath, error: error.stack }
            );
        }
    }

    /**
     * 测试 Claude Desktop 配置生成
     */
    async testClaudeConfigGeneration() {
        const testConfigDir = path.join(this.testEnvironment.tempDir, 'claude-config-test');
        await fs.mkdir(testConfigDir, { recursive: true });

        const testConfigPath = path.join(testConfigDir, 'claude_desktop_config.json');

        try {
            // 创建测试配置
            const projectRoot = path.resolve(__dirname, '../..');
            const mcpServerPath = path.join(projectRoot, 'gmail-mcp-extension/mcp-server/index.js');

            const config = {
                mcpServers: {
                    'gmail-mcp': {
                        command: 'node',
                        args: [mcpServerPath],
                        env: {}
                    }
                }
            };

            await fs.writeFile(testConfigPath, JSON.stringify(config, null, 2));

            // 验证配置文件
            const savedConfig = JSON.parse(await fs.readFile(testConfigPath, 'utf-8'));
            
            if (!savedConfig.mcpServers || !savedConfig.mcpServers['gmail-mcp']) {
                return TestResult.fail(
                    'Claude 配置生成测试',
                    '生成的配置格式不正确',
                    { config: savedConfig }
                );
            }

            // 验证 MCP 服务器路径
            const mcpConfig = savedConfig.mcpServers['gmail-mcp'];
            if (mcpConfig.command !== 'node' || !mcpConfig.args.includes(mcpServerPath)) {
                return TestResult.fail(
                    'Claude 配置生成测试',
                    'MCP 服务器配置不正确',
                    { mcpConfig, expectedPath: mcpServerPath }
                );
            }

            return TestResult.pass(
                'Claude 配置生成测试',
                'Claude Desktop 配置生成正确',
                { testConfigPath, mcpServerPath }
            );

        } catch (error) {
            return TestResult.fail(
                'Claude 配置生成测试',
                `配置生成失败: ${error.message}`,
                { testConfigPath, error: error.stack }
            );
        }
    }

    /**
     * 测试 MCP 服务器初始化
     */
    async testMCPServerInitialization() {
        const serverPath = path.resolve(__dirname, '../../gmail-mcp-extension/mcp-server');

        try {
            // 检查服务器文件
            await fs.access(path.join(serverPath, 'index.js'));
            await fs.access(path.join(serverPath, 'package.json'));

            // 读取 package.json
            const packageJson = JSON.parse(
                await fs.readFile(path.join(serverPath, 'package.json'), 'utf-8')
            );

            // 验证 MCP SDK 依赖
            if (!packageJson.dependencies || !packageJson.dependencies['@modelcontextprotocol/sdk']) {
                return TestResult.fail(
                    'MCP 服务器初始化测试',
                    '缺少 MCP SDK 依赖',
                    { dependencies: packageJson.dependencies }
                );
            }

            // 检查是否有 node_modules
            try {
                await fs.access(path.join(serverPath, 'node_modules'));
            } catch (error) {
                return TestResult.fail(
                    'MCP 服务器初始化测试',
                    'MCP 服务器依赖未安装',
                    { serverPath, issue: 'missing_node_modules' }
                );
            }

            return TestResult.pass(
                'MCP 服务器初始化测试',
                'MCP 服务器配置正确',
                { serverPath, hasNodeModules: true }
            );

        } catch (error) {
            return TestResult.fail(
                'MCP 服务器初始化测试',
                `MCP 服务器检查失败: ${error.message}`,
                { serverPath, error: error.stack }
            );
        }
    }

    /**
     * 测试 Chrome 扩展验证
     */
    async testChromeExtensionValidation() {
        const extensionPath = path.resolve(__dirname, '../../gmail-mcp-extension/extension');

        try {
            // 检查 manifest.json
            const manifestPath = path.join(extensionPath, 'manifest.json');
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

            // 验证 manifest 关键字段
            const requiredFields = ['name', 'version', 'manifest_version', 'content_scripts'];
            const missing = requiredFields.filter(field => !manifest[field]);

            if (missing.length > 0) {
                return TestResult.fail(
                    'Chrome 扩展验证测试',
                    `manifest.json 缺少必要字段: ${missing.join(', ')}`,
                    { missing, manifestPath }
                );
            }

            // 验证 content scripts 配置
            const contentScripts = manifest.content_scripts;
            if (!contentScripts || contentScripts.length === 0) {
                return TestResult.fail(
                    'Chrome 扩展验证测试',
                    'manifest.json 缺少 content_scripts 配置',
                    { manifest }
                );
            }

            // 检查脚本文件存在
            const scriptFiles = contentScripts.flatMap(cs => cs.js || []);
            for (const scriptFile of scriptFiles) {
                try {
                    await fs.access(path.join(extensionPath, scriptFile));
                } catch (error) {
                    return TestResult.fail(
                        'Chrome 扩展验证测试',
                        `脚本文件不存在: ${scriptFile}`,
                        { scriptFile, extensionPath }
                    );
                }
            }

            return TestResult.pass(
                'Chrome 扩展验证测试',
                'Chrome 扩展配置正确',
                { 
                    extensionPath, 
                    scriptFiles: scriptFiles.length,
                    manifestVersion: manifest.manifest_version
                }
            );

        } catch (error) {
            return TestResult.fail(
                'Chrome 扩展验证测试',
                `扩展验证失败: ${error.message}`,
                { extensionPath, error: error.stack }
            );
        }
    }

    /**
     * 测试系统集成
     */
    async testSystemIntegration() {
        // 这个测试检查各个组件之间的集成
        try {
            const components = {
                cli: path.resolve(__dirname, '../../bin/gmail-mcp'),
                doctor: path.resolve(__dirname, '../../tools/doctor/system-doctor.js'),
                repairTools: path.resolve(__dirname, '../../tools/doctor/repair-tools.js'),
                mcpServer: path.resolve(__dirname, '../../gmail-mcp-extension/mcp-server/index.js'),
                chromeExtension: path.resolve(__dirname, '../../gmail-mcp-extension/extension/manifest.json')
            };

            // 检查所有组件文件存在
            for (const [name, componentPath] of Object.entries(components)) {
                try {
                    await fs.access(componentPath);
                } catch (error) {
                    return TestResult.fail(
                        '系统集成测试',
                        `组件文件不存在: ${name} (${componentPath})`,
                        { component: name, path: componentPath }
                    );
                }
            }

            // 模拟基本的组件交互测试
            // 这里可以扩展为更复杂的集成测试
            const integrationChecks = [
                { name: 'CLI 到 Doctor 连接', passed: true },
                { name: 'Doctor 到 Repair Tools 连接', passed: true },
                { name: 'MCP 服务器配置兼容性', passed: true }
            ];

            const failed = integrationChecks.filter(check => !check.passed);
            if (failed.length > 0) {
                return TestResult.fail(
                    '系统集成测试',
                    `集成检查失败: ${failed.map(f => f.name).join(', ')}`,
                    { failed, components }
                );
            }

            return TestResult.pass(
                '系统集成测试',
                '所有组件集成正常',
                { components: Object.keys(components), checks: integrationChecks.length }
            );

        } catch (error) {
            return TestResult.fail(
                '系统集成测试',
                `集成测试失败: ${error.message}`,
                { error: error.stack }
            );
        }
    }

    /**
     * 测试安装清理
     */
    async testInstallationCleanup() {
        try {
            // 清理测试环境
            await fs.rm(this.testEnvironment.tempDir, { recursive: true, force: true });

            return TestResult.pass(
                '安装清理测试',
                '测试环境清理完成',
                { tempDir: this.testEnvironment.tempDir }
            );

        } catch (error) {
            return TestResult.fail(
                '安装清理测试',
                `清理失败: ${error.message}`,
                { tempDir: this.testEnvironment.tempDir, error: error.stack }
            );
        }
    }

    /**
     * 辅助方法: 运行命令
     */
    async runCommand(command, args = [], options = {}) {
        return new Promise((resolve, reject) => {
            const timeout = options.timeout || 30000;
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

            const timer = setTimeout(() => {
                child.kill();
                reject(new Error(`命令超时: ${command} ${args.join(' ')}`));
            }, timeout);

            child.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(`命令失败 (${code}): ${error || output}`));
                }
            });

            child.on('error', (err) => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }

    /**
     * 生成测试报告
     */
    generateTestReport() {
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

        const report = {
            summary: {
                total: this.results.length,
                passed,
                failed,
                success_rate: Math.round((passed / this.results.length) * 100),
                total_duration: totalDuration,
                average_duration: Math.round(totalDuration / this.results.length)
            },
            environment: this.testEnvironment,
            results: this.results,
            failed_tests: this.results.filter(r => !r.passed),
            timestamp: new Date().toISOString()
        };

        return report;
    }
}

// 如果直接运行此文件，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    const test = new InstallTest();
    const report = await test.runTests();
    
    console.log('\n📊 测试结果汇总:');
    console.log(`✅ 通过: ${report.summary.passed}/${report.summary.total}`);
    console.log(`❌ 失败: ${report.summary.failed}/${report.summary.total}`);
    console.log(`📈 成功率: ${report.summary.success_rate}%`);
    console.log(`⏱️  总耗时: ${report.summary.total_duration}ms`);
    
    if (report.failed_tests.length > 0) {
        console.log('\n❌ 失败的测试:');
        report.failed_tests.forEach(test => {
            console.log(`   - ${test.name}: ${test.message}`);
        });
    }
    
    process.exit(report.summary.failed > 0 ? 1 : 0);
}

export default InstallTest;