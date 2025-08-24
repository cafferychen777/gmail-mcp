/**
 * Configuration Manager
 * 
 * 基于 Linus "好品味" 设计原则：
 * 1. 消除特殊情况 - 统一的配置管理接口，支持所有环境
 * 2. 数据结构优先 - 用 Map 和结构化对象管理配置，而非文件操作
 * 3. Never break userspace - 配置变更向后兼容，自动迁移
 * 4. 实用主义 - 解决真实的多环境、多用户配置问题
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { homedir } from 'os';
import { EventEmitter } from 'events';

export class ConfigurationManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // 核心数据结构：配置状态的唯一真实来源
    this.configs = new Map(); // configPath -> ConfigFile
    this.templates = new Map(); // templateName -> ConfigTemplate
    this.backups = new Map(); // configPath -> BackupInfo[]
    this.watchers = new Map(); // configPath -> FileWatcher
    this.migrations = new Map(); // version -> MigrationFunction
    
    // 环境配置
    this.environments = new Map([
      ['development', { priority: 1, suffix: '.dev' }],
      ['testing', { priority: 2, suffix: '.test' }],
      ['production', { priority: 3, suffix: '.prod' }],
      ['local', { priority: 0, suffix: '.local' }]
    ]);
    
    this.config = {
      currentEnvironment: options.environment || 'production',
      configDir: options.configDir || this.getDefaultConfigDir(),
      maxBackups: options.maxBackups || 10,
      hotReload: options.hotReload !== false,
      autoMigration: options.autoMigration !== false,
      ...options
    };
    
    // 配置模板
    this.initializeTemplates();
    
    // 迁移规则
    this.initializeMigrations();
    
    this.isInitialized = false;
  }

  /**
   * 初始化配置管理器 - 好品味：统一初始化流程
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log(`Initializing configuration manager for ${this.config.currentEnvironment} environment`);
    
    // 确保配置目录存在
    this.ensureConfigDirectory();
    
    // 加载现有配置
    await this.loadExistingConfigs();
    
    // 执行必要的迁移
    if (this.config.autoMigration) {
      await this.performAutoMigrations();
    }
    
    // 启动文件监控
    if (this.config.hotReload) {
      this.startFileWatching();
    }
    
    this.isInitialized = true;
    this.emit('initialized');
    
    console.log(`Configuration manager initialized. Loaded ${this.configs.size} configs.`);
  }

  /**
   * 获取配置 - 消除特殊情况：所有配置用同一个接口获取
   */
  async getConfig(configName, options = {}) {
    const configPath = this.resolveConfigPath(configName, options.environment);
    
    // 检查缓存
    if (this.configs.has(configPath)) {
      const cachedConfig = this.configs.get(configPath);
      if (!this.isConfigStale(cachedConfig)) {
        return this.deepClone(cachedConfig.data);
      }
    }
    
    // 加载配置
    const config = await this.loadConfig(configPath, configName);
    return this.deepClone(config.data);
  }

  /**
   * 更新配置 - Never break userspace：安全的配置更新
   */
  async updateConfig(configName, transformer, options = {}) {
    const configPath = this.resolveConfigPath(configName, options.environment);
    
    // 创建备份
    const backup = await this.createBackup(configPath);
    
    try {
      // 获取当前配置
      const current = await this.getConfig(configName, options);
      
      // 应用转换
      const updated = typeof transformer === 'function' ? 
        transformer(current) : 
        { ...current, ...transformer };
      
      // 验证配置
      await this.validateConfig(configName, updated);
      
      // 写入配置
      await this.writeConfig(configPath, updated, configName);
      
      // 触发变更事件
      this.emit('config-updated', {
        name: configName,
        path: configPath,
        previous: current,
        current: updated
      });
      
      console.log(`Configuration updated: ${configName}`);
      return updated;
      
    } catch (error) {
      // 恢复备份
      if (backup) {
        await this.restoreBackup(configPath, backup);
      }
      throw new Error(`Failed to update configuration ${configName}: ${error.message}`);
    }
  }

  /**
   * 生成配置 - 基于模板的配置生成
   */
  async generateConfig(configName, templateName, templateData = {}, options = {}) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }
    
    const configPath = this.resolveConfigPath(configName, options.environment);
    
    // 检查是否已存在
    if (existsSync(configPath) && !options.overwrite) {
      throw new Error(`Configuration already exists: ${configPath}`);
    }
    
    // 生成配置数据
    const configData = await this.renderTemplate(template, templateData);
    
    // 验证生成的配置
    await this.validateConfig(configName, configData);
    
    // 写入配置文件
    await this.writeConfig(configPath, configData, configName);
    
    console.log(`Configuration generated: ${configName} from template ${templateName}`);
    return configData;
  }

  /**
   * 环境切换 - 无缝环境配置切换
   */
  async switchEnvironment(newEnvironment) {
    if (!this.environments.has(newEnvironment)) {
      throw new Error(`Unknown environment: ${newEnvironment}`);
    }
    
    const oldEnvironment = this.config.currentEnvironment;
    this.config.currentEnvironment = newEnvironment;
    
    // 重新加载配置
    this.configs.clear();
    await this.loadExistingConfigs();
    
    this.emit('environment-switched', {
      from: oldEnvironment,
      to: newEnvironment
    });
    
    console.log(`Environment switched from ${oldEnvironment} to ${newEnvironment}`);
  }

  /**
   * 配置迁移 - 自动版本迁移
   */
  async migrateConfig(configName, targetVersion, options = {}) {
    const config = await this.getConfig(configName);
    const currentVersion = config.version || '1.0.0';
    
    if (currentVersion === targetVersion) {
      return config;
    }
    
    console.log(`Migrating ${configName} from ${currentVersion} to ${targetVersion}`);
    
    // 创建迁移备份
    const configPath = this.resolveConfigPath(configName);
    const backup = await this.createBackup(configPath, 'migration');
    
    try {
      const migrationPath = this.getMigrationPath(currentVersion, targetVersion);
      let migratedConfig = { ...config };
      
      for (const version of migrationPath) {
        const migration = this.migrations.get(version);
        if (migration) {
          migratedConfig = await migration(migratedConfig);
          migratedConfig.version = version;
        }
      }
      
      // 验证迁移结果
      await this.validateConfig(configName, migratedConfig);
      
      // 保存迁移后的配置
      await this.writeConfig(configPath, migratedConfig, configName);
      
      console.log(`Configuration migrated successfully: ${configName}`);
      return migratedConfig;
      
    } catch (error) {
      // 恢复备份
      if (backup) {
        await this.restoreBackup(configPath, backup);
      }
      throw new Error(`Migration failed for ${configName}: ${error.message}`);
    }
  }

  // === 私有方法：核心实现 ===

  /**
   * 解析配置路径 - 消除特殊情况的路径解析
   */
  resolveConfigPath(configName, environment) {
    const env = environment || this.config.currentEnvironment;
    const envInfo = this.environments.get(env);
    
    let fileName = configName;
    
    // 添加环境后缀
    if (envInfo?.suffix && env !== 'production') {
      const parts = configName.split('.');
      const extension = parts.pop();
      const baseName = parts.join('.');
      fileName = `${baseName}${envInfo.suffix}.${extension}`;
    }
    
    return resolve(this.config.configDir, fileName);
  }

  /**
   * 加载配置文件
   */
  async loadConfig(configPath, configName) {
    try {
      if (!existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }
      
      const content = readFileSync(configPath, 'utf8');
      const data = this.parseConfigContent(content, configPath);
      
      const config = {
        name: configName,
        path: configPath,
        data,
        lastModified: statSync(configPath).mtime,
        loadedAt: Date.now()
      };
      
      this.configs.set(configPath, config);
      return config;
      
    } catch (error) {
      throw new Error(`Failed to load configuration ${configPath}: ${error.message}`);
    }
  }

  /**
   * 解析配置内容 - 支持多种格式
   */
  parseConfigContent(content, configPath) {
    const ext = configPath.split('.').pop().toLowerCase();
    
    switch (ext) {
      case 'json':
        return JSON.parse(content);
      case 'js':
      case 'mjs':
        // 动态导入 JavaScript 配置
        return this.loadJavaScriptConfig(configPath);
      case 'yaml':
      case 'yml':
        // 如果需要 YAML 支持，这里可以添加解析器
        throw new Error('YAML configuration not supported yet');
      default:
        // 尝试 JSON 解析
        return JSON.parse(content);
    }
  }

  /**
   * 写入配置文件
   */
  async writeConfig(configPath, data, configName) {
    try {
      // 确保目录存在
      const dir = dirname(configPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      // 格式化配置数据
      const formattedData = {
        ...data,
        _metadata: {
          name: configName,
          updatedAt: new Date().toISOString(),
          environment: this.config.currentEnvironment,
          version: data.version || '1.0.0'
        }
      };
      
      // 写入文件
      const content = JSON.stringify(formattedData, null, 2);
      writeFileSync(configPath, content, 'utf8');
      
      // 更新缓存
      const config = {
        name: configName,
        path: configPath,
        data: formattedData,
        lastModified: statSync(configPath).mtime,
        loadedAt: Date.now()
      };
      
      this.configs.set(configPath, config);
      
    } catch (error) {
      throw new Error(`Failed to write configuration ${configPath}: ${error.message}`);
    }
  }

  /**
   * 创建配置备份
   */
  async createBackup(configPath, type = 'auto') {
    if (!existsSync(configPath)) {
      return null;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${configPath}.backup.${timestamp}`;
    
    try {
      const content = readFileSync(configPath, 'utf8');
      writeFileSync(backupPath, content, 'utf8');
      
      const backup = {
        originalPath: configPath,
        backupPath,
        type,
        createdAt: Date.now(),
        size: content.length
      };
      
      // 添加到备份记录
      if (!this.backups.has(configPath)) {
        this.backups.set(configPath, []);
      }
      
      const backupList = this.backups.get(configPath);
      backupList.push(backup);
      
      // 限制备份数量
      if (backupList.length > this.config.maxBackups) {
        const oldBackup = backupList.shift();
        try {
          if (existsSync(oldBackup.backupPath)) {
            require('fs').unlinkSync(oldBackup.backupPath);
          }
        } catch (error) {
          console.warn(`Failed to remove old backup: ${error.message}`);
        }
      }
      
      return backup;
      
    } catch (error) {
      console.warn(`Failed to create backup for ${configPath}: ${error.message}`);
      return null;
    }
  }

  /**
   * 恢复配置备份
   */
  async restoreBackup(configPath, backup) {
    try {
      if (existsSync(backup.backupPath)) {
        const content = readFileSync(backup.backupPath, 'utf8');
        writeFileSync(configPath, content, 'utf8');
        
        // 从缓存中移除
        this.configs.delete(configPath);
        
        console.log(`Configuration restored from backup: ${configPath}`);
      }
    } catch (error) {
      throw new Error(`Failed to restore backup: ${error.message}`);
    }
  }

  /**
   * 验证配置 - 根据配置类型进行验证
   */
  async validateConfig(configName, data) {
    const validators = {
      'claude-config': this.validateClaudeConfig.bind(this),
      'mcp-config': this.validateMcpConfig.bind(this),
      'extension-config': this.validateExtensionConfig.bind(this)
    };
    
    const validator = validators[configName];
    if (validator) {
      const validation = await validator(data);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }
    }
    
    return true;
  }

  /**
   * 初始化配置模板
   */
  initializeTemplates() {
    // Claude Desktop 配置模板
    this.templates.set('claude-desktop', {
      name: 'Claude Desktop Configuration',
      description: 'Standard Claude Desktop MCP configuration',
      schema: {
        mcpServers: 'object',
        globalShortcut: 'string',
        proxy: 'object'
      },
      template: {
        mcpServers: {
          'gmail-mcp': {
            command: 'node',
            args: ['{{serverPath}}'],
            env: {
              NODE_ENV: '{{environment}}'
            }
          }
        },
        globalShortcut: 'CmdOrCtrl+Shift+Space',
        proxy: null
      }
    });
    
    // MCP 服务器配置模板
    this.templates.set('mcp-server', {
      name: 'MCP Server Configuration',
      description: 'Gmail MCP Server configuration',
      schema: {
        server: 'object',
        bridge: 'object',
        gmail: 'object'
      },
      template: {
        server: {
          name: 'gmail-mcp-server',
          version: '1.0.0',
          port: 3456,
          host: 'localhost'
        },
        bridge: {
          enabled: true,
          port: 3456,
          cors: true
        },
        gmail: {
          maxTabs: 10,
          timeout: 30000,
          retries: 3
        }
      }
    });
    
    // Chrome 扩展配置模板
    this.templates.set('chrome-extension', {
      name: 'Chrome Extension Configuration',
      description: 'Gmail MCP Chrome Extension configuration',
      schema: {
        permissions: 'array',
        bridge: 'object',
        ui: 'object'
      },
      template: {
        permissions: ['activeTab', 'storage'],
        bridge: {
          url: 'http://localhost:{{bridgePort}}',
          timeout: 10000
        },
        ui: {
          theme: 'auto',
          position: 'bottom-right',
          showMetrics: false
        }
      }
    });
  }

  /**
   * 初始化迁移规则
   */
  initializeMigrations() {
    // 从 1.0.0 到 1.1.0 的迁移
    this.migrations.set('1.1.0', async (config) => {
      // 添加新的默认配置项
      if (!config.bridge) {
        config.bridge = {
          enabled: true,
          port: 3456
        };
      }
      
      // 更新服务器配置格式
      if (config.server && typeof config.server.timeout === 'undefined') {
        config.server.timeout = 30000;
      }
      
      return config;
    });
    
    // 从 1.1.0 到 2.0.0 的迁移
    this.migrations.set('2.0.0', async (config) => {
      // 重构配置结构
      if (config.gmail && !config.gmail.maxTabs) {
        config.gmail.maxTabs = 10;
      }
      
      // 添加插件系统配置
      if (!config.plugins) {
        config.plugins = {
          enabled: true,
          directory: './plugins',
          autoLoad: true
        };
      }
      
      return config;
    });
  }

  /**
   * 渲染配置模板
   */
  async renderTemplate(template, data) {
    const result = JSON.parse(JSON.stringify(template.template));
    return this.interpolateTemplate(result, data);
  }

  /**
   * 模板插值
   */
  interpolateTemplate(obj, data) {
    if (typeof obj === 'string') {
      return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] !== undefined ? data[key] : match;
      });
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.interpolateTemplate(item, data));
    } else if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateTemplate(value, data);
      }
      return result;
    }
    return obj;
  }

  // === 配置验证器 ===

  async validateClaudeConfig(data) {
    const errors = [];
    
    if (!data.mcpServers || typeof data.mcpServers !== 'object') {
      errors.push('mcpServers must be an object');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async validateMcpConfig(data) {
    const errors = [];
    
    if (!data.server || typeof data.server !== 'object') {
      errors.push('server configuration is required');
    }
    
    if (data.server && (!data.server.port || typeof data.server.port !== 'number')) {
      errors.push('server.port must be a number');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async validateExtensionConfig(data) {
    const errors = [];
    
    if (!data.permissions || !Array.isArray(data.permissions)) {
      errors.push('permissions must be an array');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // === 辅助方法 ===

  getDefaultConfigDir() {
    const platform = process.platform;
    
    switch (platform) {
      case 'darwin':
        return join(homedir(), 'Library', 'Application Support', 'GmailMCP');
      case 'win32':
        return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'GmailMCP');
      case 'linux':
        return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'gmail-mcp');
      default:
        return join(homedir(), '.gmail-mcp');
    }
  }

  ensureConfigDirectory() {
    if (!existsSync(this.config.configDir)) {
      mkdirSync(this.config.configDir, { recursive: true });
      console.log(`Created config directory: ${this.config.configDir}`);
    }
  }

  async loadExistingConfigs() {
    // 实现现有配置文件的自动加载
    try {
      const { readdirSync } = require('fs');
      const files = readdirSync(this.config.configDir);
      
      for (const file of files) {
        if (file.endsWith('.json') && !file.includes('.backup.')) {
          const configName = file.replace(/\.(dev|test|prod|local)\.json$/, '.json');
          try {
            await this.loadConfig(join(this.config.configDir, file), configName);
          } catch (error) {
            console.warn(`Failed to load config ${file}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      // 目录可能不存在，忽略错误
    }
  }

  getMigrationPath(fromVersion, toVersion) {
    // 简化的版本排序和路径计算
    const versions = Array.from(this.migrations.keys()).sort();
    const fromIndex = versions.indexOf(fromVersion);
    const toIndex = versions.indexOf(toVersion);
    
    if (fromIndex >= 0 && toIndex >= 0 && toIndex > fromIndex) {
      return versions.slice(fromIndex + 1, toIndex + 1);
    }
    
    return [];
  }

  isConfigStale(config) {
    try {
      const currentMtime = statSync(config.path).mtime;
      return currentMtime > config.lastModified;
    } catch (error) {
      return true; // 文件不存在，视为过期
    }
  }

  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * 获取配置统计信息
   */
  getConfigStats() {
    const stats = {
      totalConfigs: this.configs.size,
      totalBackups: Array.from(this.backups.values())
        .reduce((sum, backupList) => sum + backupList.length, 0),
      currentEnvironment: this.config.currentEnvironment,
      configDirectory: this.config.configDir,
      templateCount: this.templates.size,
      migrationCount: this.migrations.size
    };

    return stats;
  }
}

export default ConfigurationManager;