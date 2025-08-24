import { exec, execSync } from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import os from 'os';
import path from 'path';

const execAsync = promisify(exec);

/**
 * 系统环境检测器
 * 
 * Linus 风格设计:
 * 1. 数据结构优先 - 用配置描述所有检测项
 * 2. 消除特殊情况 - 所有平台使用相同的检测逻辑
 * 3. 实用主义 - 只检测真正需要的依赖
 */
export class SystemDetector {
    constructor() {
        // 核心理念: 用配置数据消除所有 if/else 分支
        this.PLATFORM_CONFIG = {
            darwin: {
                name: 'macOS',
                claudePath: '~/Library/Application Support/Claude/',
                chromeDataDir: '~/Library/Application Support/Google/Chrome',
                chromeExecutable: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                requiredCommands: ['node', 'npm'],
                homeDir: os.homedir()
            },
            win32: {
                name: 'Windows',
                claudePath: '%APPDATA%\\Claude\\',
                chromeDataDir: '%LOCALAPPDATA%\\Google\\Chrome',
                chromeExecutable: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                requiredCommands: ['node', 'npm'],
                homeDir: os.homedir()
            },
            linux: {
                name: 'Linux',
                claudePath: '~/.config/Claude/',
                chromeDataDir: '~/.config/google-chrome',
                chromeExecutable: '/usr/bin/google-chrome',
                requiredCommands: ['node', 'npm'],
                homeDir: os.homedir()
            }
        };

        // 版本要求 - 用数据而非代码逻辑
        this.VERSION_REQUIREMENTS = {
            node: { min: '16.0.0', recommended: '18.0.0' },
            npm: { min: '8.0.0', recommended: '9.0.0' }
        };
    }

    /**
     * 检测系统信息
     * 消除平台特殊情况 - 所有数据从配置获取
     */
    async detect() {
        const platform = os.platform();
        const arch = os.arch();
        
        const platformConfig = this.PLATFORM_CONFIG[platform];
        if (!platformConfig) {
            throw new Error(`不支持的平台: ${platform}`);
        }

        return {
            platform,
            arch,
            platformName: platformConfig.name,
            nodeVersion: process.version,
            homeDir: platformConfig.homeDir,
            config: platformConfig
        };
    }

    /**
     * 检查所有系统要求
     * 统一的检查模式，没有特殊分支
     */
    async checkRequirements() {
        const systemInfo = await this.detect();
        const checks = [];

        // Node.js 版本检查
        checks.push(await this._checkNodeVersion());
        
        // NPM 版本检查
        checks.push(await this._checkNpmVersion());
        
        // Chrome 浏览器检查
        checks.push(await this._checkChromeInstallation(systemInfo));
        
        // Claude Desktop 检查
        checks.push(await this._checkClaudeDesktop(systemInfo));
        
        // 网络连接检查
        checks.push(await this._checkNetworkConnectivity());

        // 文件系统权限检查
        checks.push(await this._checkFileSystemPermissions(systemInfo));

        return checks;
    }

    /**
     * Node.js 版本检查
     */
    async _checkNodeVersion() {
        const requirement = this.VERSION_REQUIREMENTS.node;
        const currentVersion = process.version.substring(1); // 移除 'v' 前缀
        
        return {
            name: 'Node.js',
            required: `>= ${requirement.min}`,
            current: currentVersion,
            satisfied: this._compareVersions(currentVersion, requirement.min) >= 0,
            isRecommended: this._compareVersions(currentVersion, requirement.recommended) >= 0,
            issue: this._compareVersions(currentVersion, requirement.min) < 0 
                ? `需要 Node.js ${requirement.min} 或更高版本，当前版本: ${currentVersion}`
                : null
        };
    }

    /**
     * NPM 版本检查
     */
    async _checkNpmVersion() {
        try {
            const { stdout } = await execAsync('npm --version');
            const currentVersion = stdout.trim();
            const requirement = this.VERSION_REQUIREMENTS.npm;
            
            return {
                name: 'NPM',
                required: `>= ${requirement.min}`,
                current: currentVersion,
                satisfied: this._compareVersions(currentVersion, requirement.min) >= 0,
                isRecommended: this._compareVersions(currentVersion, requirement.recommended) >= 0,
                issue: this._compareVersions(currentVersion, requirement.min) < 0
                    ? `需要 NPM ${requirement.min} 或更高版本，当前版本: ${currentVersion}`
                    : null
            };
        } catch (error) {
            return {
                name: 'NPM',
                required: `>= ${this.VERSION_REQUIREMENTS.npm.min}`,
                current: null,
                satisfied: false,
                issue: 'NPM 未安装或不在 PATH 中'
            };
        }
    }

    /**
     * Chrome 浏览器检查
     */
    async _checkChromeInstallation(systemInfo) {
        const chromeExecutable = this._resolvePath(systemInfo.config.chromeExecutable);
        
        try {
            // 检查 Chrome 可执行文件
            await fs.access(chromeExecutable);
            
            // 尝试获取 Chrome 版本
            let chromeVersion = null;
            try {
                const versionCommand = systemInfo.platform === 'darwin' 
                    ? `"${chromeExecutable}" --version`
                    : systemInfo.platform === 'win32'
                        ? `"${chromeExecutable}" --version`
                        : 'google-chrome --version';
                        
                const { stdout } = await execAsync(versionCommand);
                chromeVersion = stdout.trim().match(/[\d.]+/)?.[0] || 'Unknown';
            } catch {
                chromeVersion = 'Unknown';
            }

            return {
                name: 'Google Chrome',
                required: '任意版本',
                current: chromeVersion,
                satisfied: true,
                path: chromeExecutable,
                issue: null
            };
        } catch (error) {
            return {
                name: 'Google Chrome',
                required: '任意版本',
                current: null,
                satisfied: false,
                issue: `Chrome 浏览器未找到，请安装 Google Chrome`
            };
        }
    }

    /**
     * Claude Desktop 检查
     */
    async _checkClaudeDesktop(systemInfo) {
        const claudePath = this._resolvePath(systemInfo.config.claudePath);
        
        try {
            await fs.access(claudePath);
            
            // 检查配置文件
            const configFile = path.join(claudePath, 'claude_desktop_config.json');
            let hasConfig = false;
            let configValid = false;
            
            try {
                await fs.access(configFile);
                hasConfig = true;
                
                // 验证配置文件格式
                const configContent = await fs.readFile(configFile, 'utf-8');
                JSON.parse(configContent); // 验证是否是有效的 JSON
                configValid = true;
            } catch {
                hasConfig = false;
                configValid = false;
            }

            return {
                name: 'Claude Desktop',
                required: '已安装',
                current: hasConfig ? (configValid ? '已配置' : '配置无效') : '未配置',
                satisfied: true, // Claude Desktop 存在就行，配置我们来处理
                path: claudePath,
                hasConfig,
                configValid,
                issue: null
            };
        } catch (error) {
            return {
                name: 'Claude Desktop',
                required: '已安装',
                current: null,
                satisfied: false,
                issue: 'Claude Desktop 未安装，请先安装 Claude Desktop 应用'
            };
        }
    }

    /**
     * 网络连接检查
     */
    async _checkNetworkConnectivity() {
        try {
            // 简单的网络检查 - 能访问 NPM registry 就行
            await execAsync('npm ping');
            
            return {
                name: '网络连接',
                required: '可访问 NPM registry',
                current: '正常',
                satisfied: true,
                issue: null
            };
        } catch (error) {
            return {
                name: '网络连接',
                required: '可访问 NPM registry',
                current: '异常',
                satisfied: false,
                issue: '无法连接到 NPM registry，请检查网络连接'
            };
        }
    }

    /**
     * 文件系统权限检查
     */
    async _checkFileSystemPermissions(systemInfo) {
        const testPaths = [
            systemInfo.config.claudePath,
            systemInfo.config.chromeDataDir
        ].map(p => this._resolvePath(p));

        const permissionChecks = [];
        
        for (const testPath of testPaths) {
            try {
                // 检查父目录是否可写
                const parentDir = path.dirname(testPath);
                await fs.access(parentDir, fs.constants.W_OK);
                permissionChecks.push({ path: testPath, writable: true });
            } catch {
                permissionChecks.push({ path: testPath, writable: false });
            }
        }

        const allWritable = permissionChecks.every(check => check.writable);
        const issues = permissionChecks
            .filter(check => !check.writable)
            .map(check => `无写入权限: ${check.path}`);

        return {
            name: '文件系统权限',
            required: '配置目录可写',
            current: allWritable ? '正常' : '部分受限',
            satisfied: allWritable,
            details: permissionChecks,
            issue: issues.length > 0 ? issues.join('; ') : null
        };
    }

    /**
     * 版本比较工具
     * 简单有效，没有复杂的边界情况处理
     */
    _compareVersions(version1, version2) {
        const v1Parts = version1.split('.').map(n => parseInt(n, 10));
        const v2Parts = version2.split('.').map(n => parseInt(n, 10));
        
        const maxLength = Math.max(v1Parts.length, v2Parts.length);
        
        for (let i = 0; i < maxLength; i++) {
            const v1Part = v1Parts[i] || 0;
            const v2Part = v2Parts[i] || 0;
            
            if (v1Part > v2Part) return 1;
            if (v1Part < v2Part) return -1;
        }
        
        return 0;
    }

    /**
     * 路径解析工具
     * 处理 ~, %APPDATA% 等环境变量
     */
    _resolvePath(pathStr) {
        if (!pathStr) return pathStr;
        
        // 用数据映射而非条件分支处理路径变量
        const pathVariables = {
            '~': os.homedir(),
            '%APPDATA%': process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
            '%LOCALAPPDATA%': process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
            '$HOME': os.homedir()
        };

        let resolvedPath = pathStr;
        for (const [variable, replacement] of Object.entries(pathVariables)) {
            if (replacement) {
                resolvedPath = resolvedPath.replace(variable, replacement);
            }
        }

        return path.resolve(resolvedPath);
    }

    /**
     * 快速系统诊断
     * 给用户简单明了的系统状态报告
     */
    async quickDiagnosis() {
        const requirements = await this.checkRequirements();
        
        const summary = {
            overall: requirements.every(req => req.satisfied) ? 'ready' : 'issues',
            ready: requirements.filter(req => req.satisfied).length,
            issues: requirements.filter(req => !req.satisfied).length,
            total: requirements.length,
            details: requirements
        };

        return summary;
    }
    
    /**
     * 智能修复系统问题 - 提升安装成功率的关键
     * Linus风格: "让计算机替用户解决问题，不是让用户成为专家"
     */
    async autoFixIssues() {
        const diagnosis = await this.quickDiagnosis();
        const fixes = [];
        
        if (diagnosis.overall === 'ready') {
            return { success: true, fixes: [], message: '系统已准备就绪' };
        }
        
        // 自动修复策略映射
        const fixStrategies = new Map([
            ['node_old', () => this._suggestNodeUpgrade()],
            ['npm_missing', () => this._fixNpmInstallation()],
            ['chrome_missing', () => this._suggestChromeInstall()],
            ['claude_missing', () => this._suggestClaudeInstall()],
            ['network_issue', () => this._fixNetworkIssues()],
            ['permission_denied', () => this._fixPermissions()]
        ]);
        
        // 分析问题并应用修复
        for (const req of diagnosis.details) {
            if (!req.satisfied && req.issue) {
                const fixType = this._categorizeIssue(req);
                const fixStrategy = fixStrategies.get(fixType);
                
                if (fixStrategy) {
                    try {
                        const result = await fixStrategy();
                        if (result.success) {
                            fixes.push(`${req.name}: ${result.action}`);
                        }
                    } catch (error) {
                        fixes.push(`${req.name}: 自动修复失败 - ${error.message}`);
                    }
                }
            }
        }
        
        return {
            success: fixes.length > 0,
            fixes,
            message: fixes.length > 0 ? '部分问题已自动修复' : '无法自动修复问题'
        };
    }
    
    /**
     * 问题分类 - 用简单的字符串匹配代替复杂的条件分支
     */
    _categorizeIssue(requirement) {
        const issue = requirement.issue.toLowerCase();
        
        // 用数据驱动的问题分类
        const patterns = [
            { keywords: ['node', '版本'], type: 'node_old' },
            { keywords: ['npm', '未安装', 'path'], type: 'npm_missing' },
            { keywords: ['chrome', '未找到'], type: 'chrome_missing' },
            { keywords: ['claude', '未安装'], type: 'claude_missing' },
            { keywords: ['网络', 'registry'], type: 'network_issue' },
            { keywords: ['权限', '写入'], type: 'permission_denied' }
        ];
        
        for (const pattern of patterns) {
            if (pattern.keywords.some(keyword => issue.includes(keyword))) {
                return pattern.type;
            }
        }
        
        return 'unknown';
    }
    
    /**
     * 网络问题修复 - 国内用户的关键优化
     */
    async _fixNetworkIssues() {
        try {
            // 尝试设置淘宝 NPM 镜像（国内用户）
            await execAsync('npm config set registry https://registry.npmmirror.com');
            
            // 测试连接
            await execAsync('npm ping');
            
            return {
                success: true,
                action: '已切换到国内 NPM 镜像源'
            };
        } catch (error) {
            return {
                success: false,
                action: '网络连接问题',
                details: [
                    '请检查网络连接',
                    '如果在国内，尝试: npm config set registry https://registry.npmmirror.com',
                    '或使用 VPN 连接'
                ]
            };
        }
    }
    
    /**
     * 权限问题修复
     */
    async _fixPermissions() {
        const systemInfo = await this.detect();
        
        try {
            // 尝试创建必要的目录
            const claudePath = this._resolvePath(systemInfo.config.claudePath);
            await fs.mkdir(claudePath, { recursive: true });
            
            return {
                success: true,
                action: '已创建必要的配置目录'
            };
        } catch (error) {
            return {
                success: false,
                action: '权限不足',
                details: [
                    '请确保有足够的文件系统权限',
                    '或者尝试以管理员权限运行'
                ]
            };
        }
    }
    
    /**
     * 生成安装前检查报告 - 全面的系统状态评估
     */
    async generatePreInstallReport() {
        const diagnosis = await this.quickDiagnosis();
        const autoFix = await this.autoFixIssues();
        
        return {
            readyToInstall: diagnosis.overall === 'ready',
            systemInfo: await this.detect(),
            requirements: diagnosis,
            autoFixes: autoFix,
            recommendations: this._generateSmartRecommendations(diagnosis)
        };
    }
    
    /**
     * 生成智能建议 - 根据问题优先级排序
     */
    _generateSmartRecommendations(diagnosis) {
        const recommendations = [];
        
        // 优先级映射
        const priorityOrder = {
            'Node.js': 1,    // 最重要
            'NPM': 1,
            'Claude Desktop': 2,
            'Google Chrome': 3,
            '网络连接': 4,
            '文件系统权限': 5
        };
        
        // 收集所有问题并按优先级排序
        const issues = diagnosis.details
            .filter(req => !req.satisfied)
            .map(req => ({
                name: req.name,
                issue: req.issue,
                priority: priorityOrder[req.name] || 99,
                solution: this._getQuickSolution(req.name)
            }))
            .sort((a, b) => a.priority - b.priority);
        
        return issues;
    }
    
    /**
     * 获取快速解决方案
     */
    _getQuickSolution(componentName) {
        const solutions = {
            'Node.js': {
                action: '下载并安装 Node.js LTS 版本',
                url: 'https://nodejs.org/en/download/',
                automated: false
            },
            'NPM': {
                action: '升级 npm: npm install -g npm@latest',
                command: 'npm install -g npm@latest',
                automated: true
            },
            'Google Chrome': {
                action: '下载并安装 Chrome 浏览器',
                url: 'https://www.google.com/chrome/',
                automated: false
            },
            'Claude Desktop': {
                action: '下载并安装 Claude Desktop',
                url: 'https://claude.ai/download',
                automated: false
            }
        };
        
        return solutions[componentName] || { action: '请手动解决此问题', automated: false };
    }
}