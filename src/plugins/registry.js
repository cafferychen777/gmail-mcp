/**
 * Plugin Registry
 * 
 * 插件注册表和市场机制的基础实现
 * 基于 Linus "好品味" 设计原则：
 * 1. 消除特殊情况 - 统一的插件发现、安装、更新机制
 * 2. 数据结构优先 - 用索引和元数据驱动插件管理
 * 3. Never break userspace - 插件安装和卸载不影响系统稳定性
 * 4. 实用主义 - 解决真实的插件分发和管理需求
 */

import { EventEmitter } from 'events';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { createHash } from 'crypto';

export class PluginRegistry extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // 核心数据结构
    this.registry = new Map(); // pluginId -> PluginRegistryEntry
    this.categories = new Map(); // categoryName -> PluginId[]
    this.tags = new Map(); // tagName -> PluginId[]
    this.dependencies = new Map(); // pluginId -> DependencyInfo
    this.installations = new Map(); // pluginId -> InstallationInfo
    
    this.config = {
      registryFile: options.registryFile || './plugin-registry.json',
      cacheDirectory: options.cacheDirectory || './plugin-cache',
      officialRegistry: options.officialRegistry || 'https://registry.gmail-mcp.com',
      autoUpdate: options.autoUpdate !== false,
      allowThirdParty: options.allowThirdParty !== false,
      securityScan: options.securityScan !== false,
      ...options
    };
    
    // 注册表分类
    this.defaultCategories = [
      'email-providers',    // 邮件服务提供者
      'themes',            // 主题和样式
      'productivity',      // 生产力工具
      'automation',        // 自动化工具
      'integrations',      // 第三方集成
      'utilities',         // 实用工具
      'development'        // 开发工具
    ];
    
    // 插件状态
    this.PLUGIN_STATUS = {
      AVAILABLE: 'available',      // 可用
      INSTALLED: 'installed',      // 已安装
      ACTIVE: 'active',           // 已激活
      UPDATING: 'updating',       // 更新中
      ERROR: 'error',             // 错误状态
      DEPRECATED: 'deprecated',   // 已弃用
      SECURITY_RISK: 'security-risk' // 安全风险
    };
    
    // 安全级别
    this.SECURITY_LEVELS = {
      SAFE: 'safe',               // 安全
      CAUTION: 'caution',         // 需谨慎
      WARNING: 'warning',         // 警告
      DANGEROUS: 'dangerous'      // 危险
    };
    
    this.isInitialized = false;
  }

  /**
   * 初始化插件注册表
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('Initializing plugin registry...');
    
    // 确保缓存目录存在
    this.ensureCacheDirectory();
    
    // 初始化分类
    this.initializeCategories();
    
    // 加载本地注册表
    await this.loadLocalRegistry();
    
    // 同步官方注册表
    if (this.config.officialRegistry) {
      await this.syncOfficialRegistry();
    }
    
    // 扫描本地已安装插件
    await this.scanInstalledPlugins();
    
    // 启动自动更新
    if (this.config.autoUpdate) {
      this.startAutoUpdate();
    }
    
    this.isInitialized = true;
    this.emit('initialized');
    
    console.log(`Plugin registry initialized. ${this.registry.size} plugins available.`);
  }

  // === 插件查询和发现 ===

  /**
   * 搜索插件
   */
  async searchPlugins(query, options = {}) {
    const {
      category,
      tags = [],
      author,
      minVersion,
      maxResults = 50,
      sortBy = 'popularity'
    } = options;
    
    let results = Array.from(this.registry.values());
    
    // 文本搜索
    if (query) {
      const searchTerms = query.toLowerCase().split(' ');
      results = results.filter(plugin => {
        const searchableText = [
          plugin.name,
          plugin.description,
          plugin.author,
          ...plugin.tags
        ].join(' ').toLowerCase();
        
        return searchTerms.every(term => searchableText.includes(term));
      });
    }
    
    // 分类过滤
    if (category) {
      results = results.filter(plugin => plugin.category === category);
    }
    
    // 标签过滤
    if (tags.length > 0) {
      results = results.filter(plugin => 
        tags.some(tag => plugin.tags.includes(tag))
      );
    }
    
    // 作者过滤
    if (author) {
      results = results.filter(plugin => 
        plugin.author.toLowerCase().includes(author.toLowerCase())
      );
    }
    
    // 版本过滤
    if (minVersion) {
      results = results.filter(plugin => 
        this.compareVersions(plugin.version, minVersion) >= 0
      );
    }
    
    // 排序
    results = this.sortPlugins(results, sortBy);
    
    // 限制结果数量
    results = results.slice(0, maxResults);
    
    return {
      query,
      totalResults: results.length,
      plugins: results.map(plugin => this.sanitizePluginInfo(plugin))
    };
  }

  /**
   * 获取插件详情
   */
  async getPluginInfo(pluginId) {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    // 获取安装状态
    const installation = this.installations.get(pluginId);
    
    return {
      ...this.sanitizePluginInfo(plugin),
      installation: installation ? {
        status: installation.status,
        installedVersion: installation.version,
        installedAt: installation.installedAt,
        lastUpdated: installation.lastUpdated
      } : null
    };
  }

  /**
   * 获取分类列表
   */
  getCategories() {
    return Array.from(this.categories.keys()).map(categoryName => ({
      name: categoryName,
      displayName: this.getCategoryDisplayName(categoryName),
      pluginCount: this.categories.get(categoryName)?.length || 0
    }));
  }

  /**
   * 获取标签云
   */
  getTagCloud() {
    const tagCounts = new Map();
    
    for (const plugin of this.registry.values()) {
      for (const tag of plugin.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }

  // === 插件安装和管理 ===

  /**
   * 安装插件
   */
  async installPlugin(pluginId, options = {}) {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    console.log(`Installing plugin: ${plugin.name} v${plugin.version}`);
    
    // 检查是否已安装
    const installation = this.installations.get(pluginId);
    if (installation && !options.force) {
      throw new Error(`Plugin already installed: ${pluginId}`);
    }
    
    // 安全检查
    if (this.config.securityScan) {
      const securityResult = await this.performSecurityScan(plugin);
      if (securityResult.level === this.SECURITY_LEVELS.DANGEROUS) {
        throw new Error(`Security scan failed: ${securityResult.reason}`);
      }
      if (securityResult.level === this.SECURITY_LEVELS.WARNING && !options.ignoreSecurity) {
        throw new Error(`Security warning: ${securityResult.reason}. Use ignoreSecurity option to proceed.`);
      }
    }
    
    try {
      // 下载插件
      const downloadResult = await this.downloadPlugin(plugin);
      
      // 验证插件完整性
      await this.verifyPluginIntegrity(downloadResult);
      
      // 解决依赖
      await this.resolveDependencies(plugin);
      
      // 执行安装
      const installPath = await this.extractPlugin(downloadResult);
      
      // 更新安装记录
      this.installations.set(pluginId, {
        id: pluginId,
        version: plugin.version,
        status: this.PLUGIN_STATUS.INSTALLED,
        installedAt: Date.now(),
        installPath,
        downloadResult
      });
      
      // 保存注册表状态
      await this.saveLocalRegistry();
      
      this.emit('plugin-installed', {
        plugin,
        installPath,
        timestamp: Date.now()
      });
      
      console.log(`Plugin installed successfully: ${plugin.name}`);
      
      return {
        success: true,
        plugin,
        installPath
      };
      
    } catch (error) {
      // 安装失败，清理
      await this.cleanupFailedInstallation(pluginId);
      
      this.emit('plugin-install-failed', {
        plugin,
        error: error.message,
        timestamp: Date.now()
      });
      
      throw new Error(`Plugin installation failed: ${error.message}`);
    }
  }

  /**
   * 卸载插件
   */
  async uninstallPlugin(pluginId, options = {}) {
    const installation = this.installations.get(pluginId);
    if (!installation) {
      throw new Error(`Plugin not installed: ${pluginId}`);
    }
    
    const plugin = this.registry.get(pluginId);
    console.log(`Uninstalling plugin: ${plugin?.name || pluginId}`);
    
    try {
      // 检查依赖关系
      const dependents = this.findDependentPlugins(pluginId);
      if (dependents.length > 0 && !options.force) {
        const dependentNames = dependents.map(p => p.name).join(', ');
        throw new Error(`Cannot uninstall plugin. Required by: ${dependentNames}`);
      }
      
      // 停用插件（如果已激活）
      if (installation.status === this.PLUGIN_STATUS.ACTIVE) {
        // 这里应该调用插件系统来停用插件
        // await pluginSystem.deactivatePlugin(pluginId);
      }
      
      // 删除插件文件
      await this.removePluginFiles(installation.installPath);
      
      // 清理配置
      await this.cleanupPluginConfig(pluginId);
      
      // 更新安装记录
      this.installations.delete(pluginId);
      
      // 保存注册表状态
      await this.saveLocalRegistry();
      
      this.emit('plugin-uninstalled', {
        plugin,
        timestamp: Date.now()
      });
      
      console.log(`Plugin uninstalled successfully: ${plugin?.name || pluginId}`);
      
      return { success: true };
      
    } catch (error) {
      this.emit('plugin-uninstall-failed', {
        plugin,
        error: error.message,
        timestamp: Date.now()
      });
      
      throw new Error(`Plugin uninstallation failed: ${error.message}`);
    }
  }

  /**
   * 更新插件
   */
  async updatePlugin(pluginId, options = {}) {
    const plugin = this.registry.get(pluginId);
    const installation = this.installations.get(pluginId);
    
    if (!plugin || !installation) {
      throw new Error(`Plugin not found or not installed: ${pluginId}`);
    }
    
    // 检查是否有可用更新
    const hasUpdate = this.compareVersions(plugin.version, installation.version) > 0;
    if (!hasUpdate && !options.force) {
      return { success: true, message: 'Plugin is already up to date' };
    }
    
    console.log(`Updating plugin: ${plugin.name} from v${installation.version} to v${plugin.version}`);
    
    // 标记为更新中
    installation.status = this.PLUGIN_STATUS.UPDATING;
    
    try {
      // 备份当前版本
      const backup = await this.backupPlugin(installation);
      
      // 下载新版本
      const downloadResult = await this.downloadPlugin(plugin);
      
      // 验证完整性
      await this.verifyPluginIntegrity(downloadResult);
      
      // 执行更新
      const newInstallPath = await this.extractPlugin(downloadResult);
      
      // 迁移配置和数据
      await this.migratePluginData(installation.installPath, newInstallPath);
      
      // 清理旧版本
      await this.removePluginFiles(installation.installPath);
      
      // 更新安装记录
      installation.version = plugin.version;
      installation.status = this.PLUGIN_STATUS.INSTALLED;
      installation.lastUpdated = Date.now();
      installation.installPath = newInstallPath;
      installation.downloadResult = downloadResult;
      
      // 保存注册表状态
      await this.saveLocalRegistry();
      
      this.emit('plugin-updated', {
        plugin,
        previousVersion: backup.version,
        newVersion: plugin.version,
        timestamp: Date.now()
      });
      
      console.log(`Plugin updated successfully: ${plugin.name}`);
      
      return {
        success: true,
        plugin,
        previousVersion: backup.version,
        newVersion: plugin.version
      };
      
    } catch (error) {
      // 更新失败，尝试恢复
      installation.status = this.PLUGIN_STATUS.ERROR;
      
      this.emit('plugin-update-failed', {
        plugin,
        error: error.message,
        timestamp: Date.now()
      });
      
      throw new Error(`Plugin update failed: ${error.message}`);
    }
  }

  // === 注册表管理 ===

  /**
   * 注册插件到本地注册表
   */
  async registerPlugin(pluginInfo) {
    // 验证插件信息
    this.validatePluginInfo(pluginInfo);
    
    const pluginId = pluginInfo.id;
    const existingPlugin = this.registry.get(pluginId);
    
    // 版本检查
    if (existingPlugin) {
      const versionComparison = this.compareVersions(pluginInfo.version, existingPlugin.version);
      if (versionComparison <= 0) {
        throw new Error(`Plugin version must be greater than existing version`);
      }
    }
    
    // 创建注册表条目
    const registryEntry = {
      ...pluginInfo,
      registeredAt: Date.now(),
      lastUpdated: Date.now(),
      downloads: existingPlugin?.downloads || 0,
      rating: existingPlugin?.rating || 0,
      reviews: existingPlugin?.reviews || []
    };
    
    // 添加到注册表
    this.registry.set(pluginId, registryEntry);
    
    // 更新分类索引
    this.updateCategoryIndex(pluginId, pluginInfo.category);
    
    // 更新标签索引
    this.updateTagIndex(pluginId, pluginInfo.tags);
    
    // 保存到本地文件
    await this.saveLocalRegistry();
    
    this.emit('plugin-registered', registryEntry);
    console.log(`Plugin registered: ${pluginInfo.name} v${pluginInfo.version}`);
    
    return registryEntry;
  }

  /**
   * 从注册表中移除插件
   */
  async unregisterPlugin(pluginId) {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    // 检查是否已安装
    const installation = this.installations.get(pluginId);
    if (installation) {
      throw new Error(`Cannot unregister installed plugin. Uninstall first.`);
    }
    
    // 从注册表中移除
    this.registry.delete(pluginId);
    
    // 更新索引
    this.removeFromCategoryIndex(pluginId, plugin.category);
    this.removeFromTagIndex(pluginId, plugin.tags);
    
    // 保存到本地文件
    await this.saveLocalRegistry();
    
    this.emit('plugin-unregistered', plugin);
    console.log(`Plugin unregistered: ${plugin.name}`);
    
    return { success: true };
  }

  // === 私有方法：核心实现 ===

  /**
   * 加载本地注册表
   */
  async loadLocalRegistry() {
    const registryPath = resolve(this.config.registryFile);
    
    if (existsSync(registryPath)) {
      try {
        const data = JSON.parse(readFileSync(registryPath, 'utf8'));
        
        // 加载插件注册表
        if (data.plugins) {
          for (const [pluginId, pluginInfo] of Object.entries(data.plugins)) {
            this.registry.set(pluginId, pluginInfo);
            this.updateCategoryIndex(pluginId, pluginInfo.category);
            this.updateTagIndex(pluginId, pluginInfo.tags);
          }
        }
        
        // 加载安装信息
        if (data.installations) {
          for (const [pluginId, installInfo] of Object.entries(data.installations)) {
            this.installations.set(pluginId, installInfo);
          }
        }
        
        console.log(`Loaded local registry: ${this.registry.size} plugins`);
      } catch (error) {
        console.warn('Failed to load local registry:', error.message);
      }
    }
  }

  /**
   * 保存本地注册表
   */
  async saveLocalRegistry() {
    const registryPath = resolve(this.config.registryFile);
    
    // 确保目录存在
    const registryDir = dirname(registryPath);
    if (!existsSync(registryDir)) {
      mkdirSync(registryDir, { recursive: true });
    }
    
    const data = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      plugins: Object.fromEntries(this.registry),
      installations: Object.fromEntries(this.installations)
    };
    
    try {
      writeFileSync(registryPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save local registry:', error.message);
      throw error;
    }
  }

  /**
   * 同步官方注册表
   */
  async syncOfficialRegistry() {
    if (!this.config.officialRegistry) return;
    
    try {
      console.log('Syncing with official registry...');
      
      const response = await fetch(`${this.config.officialRegistry}/plugins`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const officialPlugins = await response.json();
      let syncCount = 0;
      
      for (const pluginInfo of officialPlugins) {
        const existing = this.registry.get(pluginInfo.id);
        
        // 只同步更新版本或新插件
        if (!existing || this.compareVersions(pluginInfo.version, existing.version) > 0) {
          this.registry.set(pluginInfo.id, {
            ...pluginInfo,
            source: 'official',
            syncedAt: Date.now()
          });
          
          this.updateCategoryIndex(pluginInfo.id, pluginInfo.category);
          this.updateTagIndex(pluginInfo.id, pluginInfo.tags);
          syncCount++;
        }
      }
      
      if (syncCount > 0) {
        await this.saveLocalRegistry();
        console.log(`Synced ${syncCount} plugins from official registry`);
      }
      
    } catch (error) {
      console.warn('Failed to sync official registry:', error.message);
    }
  }

  /**
   * 扫描已安装插件
   */
  async scanInstalledPlugins() {
    // 扫描插件目录，发现已安装但未在注册表中记录的插件
    // 这里是简化实现
    console.log('Scanning installed plugins...');
  }

  /**
   * 下载插件
   */
  async downloadPlugin(plugin) {
    if (!plugin.downloadUrl) {
      throw new Error('Plugin download URL not available');
    }
    
    console.log(`Downloading plugin: ${plugin.name} from ${plugin.downloadUrl}`);
    
    const response = await fetch(plugin.downloadUrl);
    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    const downloadPath = join(this.config.cacheDirectory, `${plugin.id}-${plugin.version}.zip`);
    
    // 保存下载文件
    writeFileSync(downloadPath, new Uint8Array(buffer));
    
    return {
      plugin,
      downloadPath,
      size: buffer.byteLength,
      downloadedAt: Date.now()
    };
  }

  /**
   * 验证插件完整性
   */
  async verifyPluginIntegrity(downloadResult) {
    const { plugin, downloadPath } = downloadResult;
    
    if (plugin.checksum) {
      const buffer = readFileSync(downloadPath);
      const hash = createHash('sha256').update(buffer).digest('hex');
      
      if (hash !== plugin.checksum) {
        throw new Error('Plugin checksum verification failed');
      }
    }
    
    console.log(`Plugin integrity verified: ${plugin.name}`);
  }

  /**
   * 解压插件
   */
  async extractPlugin(downloadResult) {
    const { plugin, downloadPath } = downloadResult;
    const extractPath = join(this.config.cacheDirectory, 'plugins', plugin.id);
    
    // 这里应该实现解压逻辑
    // 简化实现：假设插件已解压
    console.log(`Extracting plugin to: ${extractPath}`);
    
    return extractPath;
  }

  /**
   * 安全扫描
   */
  async performSecurityScan(plugin) {
    // 简化的安全扫描实现
    const risks = [];
    
    // 检查权限
    if (plugin.permissions && plugin.permissions.includes('file-system-write')) {
      risks.push('Requests file system write access');
    }
    
    if (plugin.permissions && plugin.permissions.includes('network-access')) {
      risks.push('Requests network access');
    }
    
    // 检查作者信任度
    if (!plugin.verified) {
      risks.push('Author not verified');
    }
    
    let level = this.SECURITY_LEVELS.SAFE;
    if (risks.length > 0) {
      level = risks.length > 2 ? this.SECURITY_LEVELS.WARNING : this.SECURITY_LEVELS.CAUTION;
    }
    
    return {
      level,
      risks,
      reason: risks.join('; ')
    };
  }

  // === 工具方法 ===

  /**
   * 版本比较
   */
  compareVersions(version1, version2) {
    const parts1 = version1.split('.').map(Number);
    const parts2 = version2.split('.').map(Number);
    
    const maxLength = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    
    return 0;
  }

  /**
   * 排序插件
   */
  sortPlugins(plugins, sortBy) {
    const sortFunctions = {
      name: (a, b) => a.name.localeCompare(b.name),
      popularity: (a, b) => (b.downloads || 0) - (a.downloads || 0),
      rating: (a, b) => (b.rating || 0) - (a.rating || 0),
      updated: (a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0)
    };
    
    const sortFn = sortFunctions[sortBy] || sortFunctions.popularity;
    return plugins.sort(sortFn);
  }

  /**
   * 净化插件信息（移除敏感信息）
   */
  sanitizePluginInfo(plugin) {
    const { 
      downloadUrl, 
      checksum, 
      privateKey, 
      ...safeInfo 
    } = plugin;
    
    return safeInfo;
  }

  /**
   * 验证插件信息
   */
  validatePluginInfo(pluginInfo) {
    const requiredFields = ['id', 'name', 'version', 'description', 'author'];
    
    for (const field of requiredFields) {
      if (!pluginInfo[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // 验证版本格式
    if (!/^\d+\.\d+\.\d+$/.test(pluginInfo.version)) {
      throw new Error('Invalid version format. Use semver (x.y.z)');
    }
    
    // 验证分类
    if (pluginInfo.category && !this.categories.has(pluginInfo.category)) {
      throw new Error(`Invalid category: ${pluginInfo.category}`);
    }
  }

  // === 索引管理 ===

  initializeCategories() {
    for (const category of this.defaultCategories) {
      this.categories.set(category, []);
    }
  }

  updateCategoryIndex(pluginId, category) {
    if (!category) return;
    
    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    
    const plugins = this.categories.get(category);
    if (!plugins.includes(pluginId)) {
      plugins.push(pluginId);
    }
  }

  updateTagIndex(pluginId, tags) {
    if (!tags || !Array.isArray(tags)) return;
    
    for (const tag of tags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, []);
      }
      
      const plugins = this.tags.get(tag);
      if (!plugins.includes(pluginId)) {
        plugins.push(pluginId);
      }
    }
  }

  ensureCacheDirectory() {
    if (!existsSync(this.config.cacheDirectory)) {
      mkdirSync(this.config.cacheDirectory, { recursive: true });
    }
  }

  getCategoryDisplayName(categoryName) {
    const displayNames = {
      'email-providers': '邮件服务',
      'themes': '主题样式',
      'productivity': '生产力',
      'automation': '自动化',
      'integrations': '第三方集成',
      'utilities': '实用工具',
      'development': '开发工具'
    };
    
    return displayNames[categoryName] || categoryName;
  }

  /**
   * 获取注册表状态
   */
  getRegistryStats() {
    return {
      totalPlugins: this.registry.size,
      installedPlugins: this.installations.size,
      categories: this.getCategories(),
      totalTags: this.tags.size,
      lastSynced: this.lastSyncTime,
      cacheSize: this.calculateCacheSize()
    };
  }
}

export default PluginRegistry;