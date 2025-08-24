/**
 * Plugin System Core
 * 
 * 基于 Linus "好品味" 设计原则：
 * 1. 消除特殊情况 - 统一的插件加载、卸载、通信机制
 * 2. 数据结构优先 - 用 Map 和规范化接口管理插件生命周期
 * 3. Never break userspace - 插件系统完全向后兼容，不影响核心功能
 * 4. 实用主义 - 解决真实的扩展需求，支持热插拔
 */

import { EventEmitter } from 'events';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { createRequire } from 'module';

export class PluginSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // 核心数据结构：插件状态的唯一真实来源
    this.plugins = new Map(); // pluginId -> PluginInfo
    this.dependencies = new Map(); // pluginId -> DependencyGraph
    this.hooks = new Map(); // hookName -> Set<PluginHandler>
    this.interfaces = new Map(); // interfaceName -> InterfaceDefinition
    this.sandbox = new Map(); // pluginId -> SandboxContext
    
    this.config = {
      pluginDirectory: options.pluginDirectory || './plugins',
      autoLoad: options.autoLoad !== false,
      sandboxMode: options.sandboxMode !== false,
      maxPlugins: options.maxPlugins || 50,
      loadTimeout: options.loadTimeout || 30000,
      hotReload: options.hotReload !== false,
      ...options
    };
    
    // 插件状态枚举
    this.PLUGIN_STATES = {
      UNLOADED: 'unloaded',
      LOADING: 'loading', 
      LOADED: 'loaded',
      ACTIVE: 'active',
      ERROR: 'error',
      DISABLED: 'disabled'
    };
    
    // 核心接口定义
    this.initializeCoreInterfaces();
    
    // 系统钩子
    this.initializeCoreHooks();
    
    this.isInitialized = false;
    this.loadOrder = [];
  }

  /**
   * 初始化插件系统 - 好品味：统一初始化流程
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('Initializing plugin system...');
    
    // 确保插件目录存在
    this.ensurePluginDirectory();
    
    // 注册核心插件接口
    this.registerCoreInterfaces();
    
    // 扫描并加载插件
    if (this.config.autoLoad) {
      await this.discoverAndLoadPlugins();
    }
    
    // 启动热重载监控
    if (this.config.hotReload) {
      this.startHotReloadWatcher();
    }
    
    this.isInitialized = true;
    this.emit('initialized', {
      pluginCount: this.plugins.size,
      activePlugins: this.getActivePlugins().length
    });
    
    console.log(`Plugin system initialized. Loaded ${this.plugins.size} plugins.`);
  }

  /**
   * 加载插件 - 消除特殊情况的统一加载机制
   */
  async loadPlugin(pluginPath, options = {}) {
    const pluginId = this.generatePluginId(pluginPath);
    
    if (this.plugins.has(pluginId)) {
      if (!options.force) {
        throw new Error(`Plugin already loaded: ${pluginId}`);
      }
      await this.unloadPlugin(pluginId);
    }
    
    console.log(`Loading plugin: ${pluginId}`);
    
    const plugin = {
      id: pluginId,
      path: resolve(pluginPath),
      state: this.PLUGIN_STATES.LOADING,
      loadedAt: null,
      instance: null,
      metadata: null,
      dependencies: [],
      dependents: [],
      hooks: new Set(),
      interfaces: new Set(),
      sandbox: null,
      error: null
    };
    
    this.plugins.set(pluginId, plugin);
    
    try {
      // 读取插件元数据
      plugin.metadata = await this.loadPluginMetadata(pluginPath);
      
      // 验证插件
      await this.validatePlugin(plugin);
      
      // 检查依赖
      await this.resolveDependencies(plugin);
      
      // 创建沙箱环境
      if (this.config.sandboxMode) {
        plugin.sandbox = this.createSandbox(plugin);
      }
      
      // 加载插件实例
      plugin.instance = await this.instantiatePlugin(plugin);
      
      // 初始化插件
      if (plugin.instance.initialize) {
        await plugin.instance.initialize();
      }
      
      // 注册插件钩子和接口
      await this.registerPluginHooks(plugin);
      await this.registerPluginInterfaces(plugin);
      
      // 更新状态
      plugin.state = this.PLUGIN_STATES.LOADED;
      plugin.loadedAt = Date.now();
      
      this.emit('plugin-loaded', plugin);
      console.log(`Plugin loaded successfully: ${pluginId}`);
      
      return plugin;
      
    } catch (error) {
      plugin.state = this.PLUGIN_STATES.ERROR;
      plugin.error = error.message;
      
      this.emit('plugin-error', { plugin, error });
      console.error(`Failed to load plugin ${pluginId}:`, error.message);
      
      throw error;
    }
  }

  /**
   * 卸载插件 - Never break userspace：安全的插件卸载
   */
  async unloadPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    console.log(`Unloading plugin: ${pluginId}`);
    
    try {
      // 检查依赖关系
      if (plugin.dependents.length > 0) {
        const dependentNames = plugin.dependents.map(d => d.id).join(', ');
        throw new Error(`Cannot unload plugin ${pluginId}, required by: ${dependentNames}`);
      }
      
      // 清理插件
      if (plugin.instance && plugin.instance.cleanup) {
        await plugin.instance.cleanup();
      }
      
      // 注销钩子
      for (const hookName of plugin.hooks) {
        this.unregisterHook(hookName, plugin);
      }
      
      // 注销接口
      for (const interfaceName of plugin.interfaces) {
        this.unregisterInterface(interfaceName, plugin);
      }
      
      // 清理沙箱
      if (plugin.sandbox) {
        this.cleanupSandbox(plugin.sandbox);
      }
      
      // 更新依赖关系
      for (const dependency of plugin.dependencies) {
        const depPlugin = this.plugins.get(dependency.id);
        if (depPlugin) {
          depPlugin.dependents = depPlugin.dependents.filter(d => d.id !== pluginId);
        }
      }
      
      // 移除插件
      this.plugins.delete(pluginId);
      
      this.emit('plugin-unloaded', plugin);
      console.log(`Plugin unloaded successfully: ${pluginId}`);
      
    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error.message);
      throw error;
    }
  }

  /**
   * 激活插件 - 实用主义：按需激活
   */
  async activatePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    if (plugin.state !== this.PLUGIN_STATES.LOADED) {
      throw new Error(`Plugin not in loaded state: ${pluginId} (current: ${plugin.state})`);
    }
    
    try {
      // 激活依赖
      for (const dependency of plugin.dependencies) {
        const depPlugin = this.plugins.get(dependency.id);
        if (depPlugin && depPlugin.state !== this.PLUGIN_STATES.ACTIVE) {
          await this.activatePlugin(dependency.id);
        }
      }
      
      // 激活插件
      if (plugin.instance.activate) {
        await plugin.instance.activate();
      }
      
      plugin.state = this.PLUGIN_STATES.ACTIVE;
      
      this.emit('plugin-activated', plugin);
      console.log(`Plugin activated: ${pluginId}`);
      
    } catch (error) {
      plugin.state = this.PLUGIN_STATES.ERROR;
      plugin.error = error.message;
      
      this.emit('plugin-error', { plugin, error });
      throw error;
    }
  }

  /**
   * 停用插件
   */
  async deactivatePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    if (plugin.state !== this.PLUGIN_STATES.ACTIVE) {
      return; // 已经停用
    }
    
    try {
      // 停用依赖于此插件的其他插件
      for (const dependent of plugin.dependents) {
        const depPlugin = this.plugins.get(dependent.id);
        if (depPlugin && depPlugin.state === this.PLUGIN_STATES.ACTIVE) {
          await this.deactivatePlugin(dependent.id);
        }
      }
      
      // 停用插件
      if (plugin.instance.deactivate) {
        await plugin.instance.deactivate();
      }
      
      plugin.state = this.PLUGIN_STATES.LOADED;
      
      this.emit('plugin-deactivated', plugin);
      console.log(`Plugin deactivated: ${pluginId}`);
      
    } catch (error) {
      console.error(`Failed to deactivate plugin ${pluginId}:`, error.message);
      throw error;
    }
  }

  /**
   * 注册钩子 - 数据结构优先的钩子管理
   */
  registerHook(hookName, handler, plugin) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, new Set());
    }
    
    const hookHandler = {
      plugin: plugin.id,
      handler,
      priority: plugin.metadata?.priority || 100
    };
    
    this.hooks.get(hookName).add(hookHandler);
    plugin.hooks.add(hookName);
    
    console.log(`Hook registered: ${hookName} by ${plugin.id}`);
  }

  /**
   * 触发钩子 - 消除特殊情况的钩子执行
   */
  async triggerHook(hookName, context = {}, options = {}) {
    const handlers = this.hooks.get(hookName);
    if (!handlers || handlers.size === 0) {
      return context;
    }
    
    // 按优先级排序
    const sortedHandlers = Array.from(handlers).sort((a, b) => a.priority - b.priority);
    
    let currentContext = { ...context };
    
    for (const { handler, plugin: pluginId } of sortedHandlers) {
      try {
        const plugin = this.plugins.get(pluginId);
        if (plugin && plugin.state === this.PLUGIN_STATES.ACTIVE) {
          const result = await handler(currentContext, options);
          
          // 如果处理器返回了新的上下文，使用它
          if (result !== undefined) {
            currentContext = result;
          }
        }
      } catch (error) {
        console.error(`Hook handler error in plugin ${pluginId} for hook ${hookName}:`, error.message);
        
        if (options.stopOnError) {
          throw error;
        }
      }
    }
    
    return currentContext;
  }

  /**
   * 调用插件方法 - 统一的插件接口调用
   */
  async callPlugin(pluginId, methodName, ...args) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    if (plugin.state !== this.PLUGIN_STATES.ACTIVE) {
      throw new Error(`Plugin not active: ${pluginId}`);
    }
    
    const method = plugin.instance[methodName];
    if (typeof method !== 'function') {
      throw new Error(`Method not found: ${methodName} in plugin ${pluginId}`);
    }
    
    try {
      return await method.apply(plugin.instance, args);
    } catch (error) {
      console.error(`Plugin method call failed: ${pluginId}.${methodName}:`, error.message);
      throw error;
    }
  }

  // === 私有方法：核心实现 ===

  /**
   * 扫描并加载插件
   */
  async discoverAndLoadPlugins() {
    const pluginDirectory = resolve(this.config.pluginDirectory);
    
    if (!existsSync(pluginDirectory)) {
      console.warn(`Plugin directory not found: ${pluginDirectory}`);
      return;
    }
    
    const entries = readdirSync(pluginDirectory);
    const pluginPaths = [];
    
    // 发现插件
    for (const entry of entries) {
      const entryPath = join(pluginDirectory, entry);
      const stat = statSync(entryPath);
      
      if (stat.isDirectory()) {
        // 目录形式的插件
        const packagePath = join(entryPath, 'package.json');
        const indexPath = join(entryPath, 'index.js');
        
        if (existsSync(packagePath) || existsSync(indexPath)) {
          pluginPaths.push(entryPath);
        }
      } else if (entry.endsWith('.js') || entry.endsWith('.mjs')) {
        // 单文件插件
        pluginPaths.push(entryPath);
      }
    }
    
    // 按依赖顺序加载插件
    const loadedPlugins = [];
    const pendingPlugins = [...pluginPaths];
    
    while (pendingPlugins.length > 0) {
      const beforeLength = pendingPlugins.length;
      
      for (let i = pendingPlugins.length - 1; i >= 0; i--) {
        const pluginPath = pendingPlugins[i];
        
        try {
          const canLoad = await this.canLoadPlugin(pluginPath, loadedPlugins);
          if (canLoad) {
            const plugin = await this.loadPlugin(pluginPath);
            loadedPlugins.push(plugin);
            pendingPlugins.splice(i, 1);
          }
        } catch (error) {
          console.error(`Failed to load plugin ${pluginPath}:`, error.message);
          pendingPlugins.splice(i, 1); // 移除失败的插件
        }
      }
      
      // 如果没有插件被加载，说明存在循环依赖或无法满足的依赖
      if (pendingPlugins.length === beforeLength) {
        console.error('Cannot resolve plugin dependencies. Remaining plugins:', pendingPlugins);
        break;
      }
    }
    
    console.log(`Discovered and loaded ${loadedPlugins.length} plugins`);
  }

  /**
   * 加载插件元数据
   */
  async loadPluginMetadata(pluginPath) {
    const packageJsonPath = join(pluginPath, 'package.json');
    const pluginJsonPath = join(pluginPath, 'plugin.json');
    
    let metadata = {
      name: 'unknown',
      version: '1.0.0',
      description: '',
      main: 'index.js',
      dependencies: [],
      interfaces: [],
      hooks: [],
      permissions: []
    };
    
    // 读取 package.json
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        metadata = { ...metadata, ...packageJson };
      } catch (error) {
        console.warn(`Failed to read package.json for ${pluginPath}:`, error.message);
      }
    }
    
    // 读取 plugin.json (插件特定配置)
    if (existsSync(pluginJsonPath)) {
      try {
        const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
        metadata = { ...metadata, ...pluginJson };
      } catch (error) {
        console.warn(`Failed to read plugin.json for ${pluginPath}:`, error.message);
      }
    }
    
    return metadata;
  }

  /**
   * 实例化插件
   */
  async instantiatePlugin(plugin) {
    const mainFile = join(plugin.path, plugin.metadata.main || 'index.js');
    
    if (!existsSync(mainFile)) {
      throw new Error(`Plugin main file not found: ${mainFile}`);
    }
    
    try {
      // 动态导入插件
      const pluginModule = await import(`file://${mainFile}`);
      
      // 获取插件类
      const PluginClass = pluginModule.default || pluginModule[plugin.metadata.name];
      
      if (!PluginClass) {
        throw new Error(`Plugin class not found in ${mainFile}`);
      }
      
      // 创建插件实例
      const instance = new PluginClass({
        pluginSystem: this,
        config: plugin.metadata.config || {},
        sandbox: plugin.sandbox
      });
      
      // 验证插件接口
      await this.validatePluginInterface(instance, plugin);
      
      return instance;
      
    } catch (error) {
      throw new Error(`Failed to instantiate plugin ${plugin.id}: ${error.message}`);
    }
  }

  /**
   * 创建沙箱环境
   */
  createSandbox(plugin) {
    // 简化的沙箱实现
    const sandbox = {
      pluginId: plugin.id,
      permissions: new Set(plugin.metadata.permissions || []),
      allowedAPIs: new Set([
        'console.log',
        'console.warn', 
        'console.error',
        'setTimeout',
        'setInterval',
        'clearTimeout',
        'clearInterval'
      ]),
      resources: new Map(),
      
      // 权限检查
      checkPermission(permission) {
        return this.permissions.has(permission);
      },
      
      // API 访问控制
      checkAPI(apiName) {
        return this.allowedAPIs.has(apiName);
      }
    };
    
    return sandbox;
  }

  /**
   * 解析依赖关系
   */
  async resolveDependencies(plugin) {
    const dependencies = plugin.metadata.dependencies || [];
    
    for (const depName of dependencies) {
      // 查找依赖插件
      const depPlugin = this.findPluginByName(depName);
      
      if (!depPlugin) {
        throw new Error(`Dependency not found: ${depName} for plugin ${plugin.id}`);
      }
      
      if (depPlugin.state === this.PLUGIN_STATES.ERROR) {
        throw new Error(`Dependency in error state: ${depName} for plugin ${plugin.id}`);
      }
      
      // 添加依赖关系
      plugin.dependencies.push({ id: depPlugin.id, name: depName });
      depPlugin.dependents.push({ id: plugin.id, name: plugin.metadata.name });
    }
    
    // 检查循环依赖
    if (this.hasCircularDependency(plugin.id)) {
      throw new Error(`Circular dependency detected for plugin ${plugin.id}`);
    }
  }

  /**
   * 初始化核心接口
   */
  initializeCoreInterfaces() {
    // 邮件处理接口
    this.interfaces.set('email-handler', {
      name: 'email-handler',
      version: '1.0.0',
      methods: {
        handleEmailAction: {
          required: true,
          params: ['action', 'params'],
          returns: 'Promise<Object>'
        }
      }
    });
    
    // UI 扩展接口
    this.interfaces.set('ui-extension', {
      name: 'ui-extension',
      version: '1.0.0',
      methods: {
        renderUI: {
          required: true,
          params: ['context'],
          returns: 'String|HTMLElement'
        },
        handleUIEvent: {
          required: false,
          params: ['event', 'data'],
          returns: 'void'
        }
      }
    });
  }

  /**
   * 初始化核心钩子
   */
  initializeCoreHooks() {
    // 邮件相关钩子
    const emailHooks = [
      'email-received',
      'email-sent', 
      'email-deleted',
      'email-archived',
      'email-starred'
    ];
    
    // 系统相关钩子
    const systemHooks = [
      'system-startup',
      'system-shutdown',
      'config-changed',
      'error-occurred'
    ];
    
    [...emailHooks, ...systemHooks].forEach(hookName => {
      this.hooks.set(hookName, new Set());
    });
  }

  // === 辅助方法 ===

  generatePluginId(pluginPath) {
    return pluginPath.split(/[/\\]/).pop() || 'unknown';
  }

  findPluginByName(name) {
    for (const plugin of this.plugins.values()) {
      if (plugin.metadata.name === name) {
        return plugin;
      }
    }
    return null;
  }

  getActivePlugins() {
    return Array.from(this.plugins.values())
      .filter(plugin => plugin.state === this.PLUGIN_STATES.ACTIVE);
  }

  hasCircularDependency(pluginId, visited = new Set()) {
    if (visited.has(pluginId)) {
      return true;
    }
    
    visited.add(pluginId);
    
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      for (const dependency of plugin.dependencies) {
        if (this.hasCircularDependency(dependency.id, new Set(visited))) {
          return true;
        }
      }
    }
    
    return false;
  }

  async canLoadPlugin(pluginPath, loadedPlugins) {
    try {
      const metadata = await this.loadPluginMetadata(pluginPath);
      const dependencies = metadata.dependencies || [];
      
      // 检查所有依赖是否已加载
      return dependencies.every(depName =>
        loadedPlugins.some(plugin => plugin.metadata.name === depName)
      );
    } catch (error) {
      return false;
    }
  }

  ensurePluginDirectory() {
    const pluginDir = resolve(this.config.pluginDirectory);
    if (!existsSync(pluginDir)) {
      require('fs').mkdirSync(pluginDir, { recursive: true });
      console.log(`Created plugin directory: ${pluginDir}`);
    }
  }

  /**
   * 获取系统状态
   */
  getSystemStatus() {
    const status = {
      totalPlugins: this.plugins.size,
      pluginsByState: {},
      totalHooks: this.hooks.size,
      totalInterfaces: this.interfaces.size,
      loadOrder: this.loadOrder
    };

    // 统计各状态的插件数量
    for (const state of Object.values(this.PLUGIN_STATES)) {
      status.pluginsByState[state] = 0;
    }

    for (const plugin of this.plugins.values()) {
      status.pluginsByState[plugin.state]++;
    }

    return status;
  }

  /**
   * 获取插件详情
   */
  getPluginInfo(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return null;

    return {
      id: plugin.id,
      name: plugin.metadata.name,
      version: plugin.metadata.version,
      state: plugin.state,
      loadedAt: plugin.loadedAt,
      dependencies: plugin.dependencies.map(d => d.name),
      dependents: plugin.dependents.map(d => d.name),
      hooks: Array.from(plugin.hooks),
      interfaces: Array.from(plugin.interfaces),
      error: plugin.error
    };
  }
}

export default PluginSystem;