import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Chrome 扩展管理器
 * 
 * Linus 原则:
 * 1. 实用主义: 解决真实的扩展配置问题
 * 2. 消除特殊情况: 统一的扩展检测和配置流程
 * 3. 向后兼容: 不破坏用户现有扩展设置
 */
export class ExtensionManager {
    constructor() {
        // 平台相关的 Chrome 路径配置
        this.PLATFORM_CHROME_CONFIG = {
            darwin: {
                profileDir: '~/Library/Application Support/Google/Chrome',
                executable: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            },
            win32: {
                profileDir: '%LOCALAPPDATA%\\Google\\Chrome\\User Data',
                executable: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            },
            linux: {
                profileDir: '~/.config/google-chrome',
                executable: '/usr/bin/google-chrome'
            }
        };
        
        // 扩展相关配置
        this.EXTENSION_CONFIG = {
            name: 'Gmail MCP Bridge',
            // 这里应该是真实的扩展 ID，安装后从 Chrome 获取
            expectedId: null,
            manifestVersion: 3
        };
        
        this.platform = os.platform();
        this.chromeConfig = this.PLATFORM_CHROME_CONFIG[this.platform];
    }

    /**
     * 配置扩展
     * 主要是设置 Native Messaging 的通信
     */
    async configure(installPath) {
        if (!installPath) {
            throw new Error('安装路径不能为空');
        }

        const results = {
            extensionDetected: false,
            extensionId: null,
            nativeMessagingConfigured: false,
            chromeProfilesFound: []
        };

        // 1. 检测 Chrome 安装和配置文件
        const chromeInfo = await this._detectChromeInstallation();
        results.chromeInstalled = chromeInfo.installed;
        results.chromeProfiles = chromeInfo.profiles;

        if (!chromeInfo.installed) {
            throw new Error('Chrome 浏览器未安装或未找到');
        }

        // 2. 查找扩展（如果已安装）
        const extensionInfo = await this._findExtensionInProfiles(chromeInfo.profiles);
        results.extensionDetected = extensionInfo.found;
        results.extensionId = extensionInfo.id;
        results.extensionProfile = extensionInfo.profile;

        // 3. 配置 Native Messaging（不管扩展是否已安装）
        await this._configureNativeMessaging(installPath);
        results.nativeMessagingConfigured = true;

        // 4. 如果扩展未检测到，提供安装指导
        if (!extensionInfo.found) {
            results.installInstructions = this._getExtensionInstallInstructions(installPath);
        }

        return results;
    }

    /**
     * 检测 Chrome 安装情况
     */
    async _detectChromeInstallation() {
        const profileDir = this._resolvePath(this.chromeConfig.profileDir);
        
        try {
            // 检查 Chrome 可执行文件
            await fs.access(this.chromeConfig.executable);
            
            // 查找用户配置文件
            const profiles = await this._findChromeProfiles(profileDir);
            
            return {
                installed: true,
                executable: this.chromeConfig.executable,
                profileDir: profileDir,
                profiles: profiles
            };
        } catch (error) {
            return {
                installed: false,
                error: error.message,
                profiles: []
            };
        }
    }

    /**
     * 查找 Chrome 用户配置文件
     */
    async _findChromeProfiles(chromeDir) {
        const profiles = [];
        
        try {
            const entries = await fs.readdir(chromeDir);
            
            for (const entry of entries) {
                // Chrome 配置文件通常是 "Default", "Profile 1" 等
                if (entry === 'Default' || entry.startsWith('Profile ')) {
                    const profilePath = path.join(chromeDir, entry);
                    const stat = await fs.stat(profilePath);
                    
                    if (stat.isDirectory()) {
                        // 检查是否有扩展目录
                        const extensionsDir = path.join(profilePath, 'Extensions');
                        try {
                            await fs.access(extensionsDir);
                            profiles.push({
                                name: entry,
                                path: profilePath,
                                extensionsDir: extensionsDir
                            });
                        } catch {
                            // 没有扩展目录，跳过
                        }
                    }
                }
            }
        } catch (error) {
            // Chrome 目录不存在或无法访问
        }
        
        return profiles;
    }

    /**
     * 在配置文件中查找我们的扩展
     */
    async _findExtensionInProfiles(profiles) {
        for (const profile of profiles) {
            const extensionInfo = await this._findExtensionInProfile(profile);
            if (extensionInfo.found) {
                return {
                    found: true,
                    id: extensionInfo.id,
                    profile: profile,
                    version: extensionInfo.version,
                    enabled: extensionInfo.enabled
                };
            }
        }
        
        return { found: false };
    }

    /**
     * 在单个配置文件中查找扩展
     */
    async _findExtensionInProfile(profile) {
        try {
            const extensionsDir = profile.extensionsDir;
            const extensions = await fs.readdir(extensionsDir);
            
            for (const extensionId of extensions) {
                const extensionPath = path.join(extensionsDir, extensionId);
                
                // 查找版本目录
                const versionDirs = await fs.readdir(extensionPath);
                for (const versionDir of versionDirs) {
                    const manifestPath = path.join(extensionPath, versionDir, 'manifest.json');
                    
                    try {
                        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
                        const manifest = JSON.parse(manifestContent);
                        
                        // 检查是否是我们的扩展
                        if (this._isOurExtension(manifest)) {
                            return {
                                found: true,
                                id: extensionId,
                                version: versionDir,
                                manifest: manifest,
                                enabled: true // 简化判断，实际需要检查 Chrome 的内部状态
                            };
                        }
                    } catch {
                        // manifest 文件读取失败，继续下一个
                    }
                }
            }
        } catch {
            // 扩展目录访问失败
        }
        
        return { found: false };
    }

    /**
     * 检查 manifest 是否是我们的扩展
     */
    _isOurExtension(manifest) {
        // 通过扩展名称和特征来识别
        const indicators = [
            manifest.name?.includes('Gmail MCP'),
            manifest.name?.includes('Gmail') && manifest.description?.includes('MCP'),
            manifest.permissions?.includes('activeTab') && 
            manifest.permissions?.includes('storage') &&
            manifest.content_scripts?.some(cs => 
                cs.matches?.some(match => match.includes('mail.google.com'))
            )
        ];
        
        return indicators.some(indicator => indicator === true);
    }

    /**
     * 配置 Native Messaging
     * Chrome 扩展与本地程序通信的桥梁
     */
    async _configureNativeMessaging(installPath) {
        // Native Messaging Host 配置
        const hostConfig = {
            name: 'com.gmail_mcp.native_host',
            description: 'Gmail MCP Bridge Native Host',
            path: path.join(installPath, 'mcp-server', 'native-host-mcp.py'),
            type: 'stdio',
            allowed_origins: []
        };

        // 确保 Native Host 脚本存在
        try {
            await fs.access(hostConfig.path);
        } catch {
            throw new Error(`Native Host 脚本不存在: ${hostConfig.path}`);
        }

        // 根据平台配置 Native Messaging Registry
        await this._registerNativeHost(hostConfig);
    }

    /**
     * 注册 Native Messaging Host
     */
    async _registerNativeHost(hostConfig) {
        const registryPath = this._getNativeHostRegistryPath();
        
        // 确保注册表目录存在
        await fs.mkdir(path.dirname(registryPath), { recursive: true });
        
        // 写入 Native Host 配置
        const configContent = JSON.stringify(hostConfig, null, 2);
        await fs.writeFile(registryPath, configContent, 'utf-8');
    }

    /**
     * 获取 Native Host 注册表路径
     */
    _getNativeHostRegistryPath() {
        const hostName = 'com.gmail_mcp.native_host';
        
        switch (this.platform) {
            case 'darwin':
                return path.join(
                    os.homedir(),
                    'Library/Application Support/Google/Chrome/NativeMessagingHosts',
                    `${hostName}.json`
                );
            case 'win32':
                // Windows 需要写入注册表，这里简化为文件路径
                return path.join(
                    process.env.LOCALAPPDATA || '',
                    'Google\\Chrome\\User Data\\NativeMessagingHosts',
                    `${hostName}.json`
                );
            case 'linux':
                return path.join(
                    os.homedir(),
                    '.config/google-chrome/NativeMessagingHosts',
                    `${hostName}.json`
                );
            default:
                throw new Error(`不支持的平台: ${this.platform}`);
        }
    }

    /**
     * 验证扩展配置
     */
    async verify() {
        try {
            // 检查 Native Messaging Host 配置
            const registryPath = this._getNativeHostRegistryPath();
            const hostConfig = JSON.parse(await fs.readFile(registryPath, 'utf-8'));
            
            // 检查 Native Host 脚本
            await fs.access(hostConfig.path);
            
            // 检查 Chrome 中的扩展（简化版）
            const chromeInfo = await this._detectChromeInstallation();
            const extensionInfo = await this._findExtensionInProfiles(chromeInfo.profiles);
            
            return {
                valid: true,
                nativeHostConfigured: true,
                nativeHostPath: hostConfig.path,
                extensionDetected: extensionInfo.found,
                extensionId: extensionInfo.id || null
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * 移除配置
     */
    async removeConfig() {
        try {
            // 移除 Native Host 注册
            const registryPath = this._getNativeHostRegistryPath();
            await fs.unlink(registryPath);
            
            return true;
        } catch (error) {
            // 如果文件不存在，也算成功
            if (error.code === 'ENOENT') {
                return true;
            }
            throw new Error(`移除扩展配置失败: ${error.message}`);
        }
    }

    /**
     * 获取扩展安装指导
     */
    _getExtensionInstallInstructions(installPath) {
        const extensionPath = path.join(installPath, 'extension');
        
        return {
            method: 'developer_mode',
            steps: [
                '1. 打开 Chrome 浏览器',
                '2. 访问 chrome://extensions/',
                '3. 开启"开发者模式"（右上角开关）',
                '4. 点击"加载已解压的扩展程序"',
                `5. 选择文件夹: ${extensionPath}`,
                '6. 确认安装扩展',
                '7. 重新运行安装程序进行验证'
            ],
            extensionPath: extensionPath,
            troubleshooting: [
                '如果加载失败，请检查扩展文件是否完整',
                '确保 Chrome 版本支持 Manifest V3',
                '检查 Chrome 扩展权限设置'
            ]
        };
    }

    /**
     * 获取状态信息
     */
    async getStatus() {
        const verification = await this.verify();
        
        if (verification.valid) {
            return {
                status: verification.extensionDetected ? 'configured' : 'partial',
                message: verification.extensionDetected 
                    ? '扩展已安装并配置完成'
                    : 'Native Host 已配置，扩展待安装',
                details: {
                    nativeHost: verification.nativeHostConfigured,
                    extension: verification.extensionDetected,
                    extensionId: verification.extensionId
                }
            };
        } else {
            return {
                status: 'error',
                message: `扩展配置问题: ${verification.error}`,
                details: {}
            };
        }
    }

    /**
     * 路径解析
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
     * 尝试自动启动 Chrome 并打开扩展页面
     */
    async openExtensionPage() {
        try {
            const chromeCmd = `"${this.chromeConfig.executable}" chrome://extensions/`;
            await execAsync(chromeCmd);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 检查扩展是否在运行
     * 通过检查是否有活跃的 Native Messaging 连接
     */
    async checkExtensionRunning() {
        // 这是一个简化的检查，实际可能需要更复杂的逻辑
        try {
            const registryPath = this._getNativeHostRegistryPath();
            await fs.access(registryPath);
            
            // TODO: 实际检查 Native Host 是否被调用
            // 可以通过创建临时文件、检查进程等方式
            
            return {
                configured: true,
                running: 'unknown', // 需要更复杂的检测
                lastActivity: null
            };
        } catch {
            return {
                configured: false,
                running: false,
                lastActivity: null
            };
        }
    }
}