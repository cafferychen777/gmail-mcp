/**
 * Standard Plugin Interface
 * 
 * 基于 Linus "好品味" 设计原则：
 * 1. 消除特殊情况 - 所有插件都实现同一套标准接口
 * 2. 数据结构优先 - 插件生命周期和能力通过结构化定义描述
 * 3. Never break userspace - 接口向后兼容，新功能通过可选方法扩展
 * 4. 实用主义 - 解决真实的插件开发需求
 */

/**
 * 基础插件接口 - 所有插件必须继承此类
 */
export class PluginInterface {
  constructor(options = {}) {
    // 插件基础信息
    this.name = '';
    this.version = '1.0.0';
    this.description = '';
    this.author = '';
    this.license = 'MIT';
    
    // 插件依赖和能力声明
    this.dependencies = [];
    this.interfaces = [];
    this.hooks = [];
    this.permissions = [];
    
    // 插件系统引用
    this.pluginSystem = options.pluginSystem;
    this.config = options.config || {};
    this.sandbox = options.sandbox;
    
    // 插件状态
    this.isInitialized = false;
    this.isActive = false;
    this.error = null;
    
    // 插件资源管理
    this.resources = new Map();
    this.eventHandlers = new Map();
    this.timers = new Set();
    
    // 绑定方法上下文
    this.handleEmailAction = this.handleEmailAction.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  /**
   * 插件初始化 - 生命周期方法
   * 所有插件都应该实现此方法进行初始化
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log(`Initializing plugin: ${this.name}`);
    
    try {
      // 验证运行环境
      await this.validateEnvironment();
      
      // 初始化插件资源
      await this.initializeResources();
      
      // 注册事件处理器
      this.registerEventHandlers();
      
      // 执行插件特定初始化
      await this.onInitialize();
      
      this.isInitialized = true;
      console.log(`Plugin initialized successfully: ${this.name}`);
      
    } catch (error) {
      this.error = error.message;
      console.error(`Plugin initialization failed: ${this.name}:`, error.message);
      throw error;
    }
  }

  /**
   * 插件激活 - 生命周期方法
   */
  async activate() {
    if (!this.isInitialized) {
      throw new Error(`Plugin not initialized: ${this.name}`);
    }
    
    if (this.isActive) return;
    
    console.log(`Activating plugin: ${this.name}`);
    
    try {
      // 执行插件特定激活逻辑
      await this.onActivate();
      
      this.isActive = true;
      console.log(`Plugin activated successfully: ${this.name}`);
      
    } catch (error) {
      this.error = error.message;
      console.error(`Plugin activation failed: ${this.name}:`, error.message);
      throw error;
    }
  }

  /**
   * 插件停用 - 生命周期方法
   */
  async deactivate() {
    if (!this.isActive) return;
    
    console.log(`Deactivating plugin: ${this.name}`);
    
    try {
      // 执行插件特定停用逻辑
      await this.onDeactivate();
      
      this.isActive = false;
      console.log(`Plugin deactivated successfully: ${this.name}`);
      
    } catch (error) {
      console.error(`Plugin deactivation failed: ${this.name}:`, error.message);
      // 即使出错也要标记为非活跃状态
      this.isActive = false;
    }
  }

  /**
   * 插件清理 - 生命周期方法
   */
  async cleanup() {
    console.log(`Cleaning up plugin: ${this.name}`);
    
    try {
      // 停用插件
      if (this.isActive) {
        await this.deactivate();
      }
      
      // 清理定时器
      for (const timer of this.timers) {
        clearTimeout(timer);
        clearInterval(timer);
      }
      this.timers.clear();
      
      // 清理事件处理器
      this.eventHandlers.clear();
      
      // 清理资源
      for (const [name, resource] of this.resources.entries()) {
        if (resource.cleanup && typeof resource.cleanup === 'function') {
          try {
            await resource.cleanup();
          } catch (error) {
            console.warn(`Failed to cleanup resource ${name}:`, error.message);
          }
        }
      }
      this.resources.clear();
      
      // 执行插件特定清理
      await this.onCleanup();
      
      this.isInitialized = false;
      console.log(`Plugin cleaned up successfully: ${this.name}`);
      
    } catch (error) {
      console.error(`Plugin cleanup failed: ${this.name}:`, error.message);
    }
  }

  /**
   * 邮件操作处理 - 核心接口方法
   * 所有邮件相关插件都应该实现此方法
   */
  async handleEmailAction(action, params) {
    if (!this.isActive) {
      throw new Error(`Plugin not active: ${this.name}`);
    }
    
    // 权限检查
    if (!this.checkPermission('email-access')) {
      throw new Error(`Permission denied for email access: ${this.name}`);
    }
    
    try {
      return await this.onEmailAction(action, params);
    } catch (error) {
      console.error(`Email action handling failed in plugin ${this.name}:`, error.message);
      throw error;
    }
  }

  /**
   * 配置更新处理 - 可选接口方法
   */
  async updateConfig(newConfig) {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    try {
      await this.onConfigUpdate(newConfig, oldConfig);
      console.log(`Configuration updated for plugin: ${this.name}`);
    } catch (error) {
      // 恢复旧配置
      this.config = oldConfig;
      console.error(`Configuration update failed for plugin ${this.name}:`, error.message);
      throw error;
    }
  }

  // === 钩子相关方法 ===

  /**
   * 注册钩子处理器
   */
  registerHook(hookName, handler, priority = 100) {
    if (!this.pluginSystem) {
      throw new Error('Plugin system not available');
    }
    
    this.pluginSystem.registerHook(hookName, handler, {
      plugin: this,
      priority
    });
    
    this.hooks.push(hookName);
  }

  /**
   * 触发钩子
   */
  async triggerHook(hookName, context, options) {
    if (!this.pluginSystem) {
      throw new Error('Plugin system not available');
    }
    
    return await this.pluginSystem.triggerHook(hookName, context, options);
  }

  // === 工具方法 ===

  /**
   * 权限检查
   */
  checkPermission(permission) {
    if (this.sandbox) {
      return this.sandbox.checkPermission(permission);
    }
    return this.permissions.includes(permission);
  }

  /**
   * 安全的定时器创建
   */
  setTimeout(callback, delay) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    
    this.timers.add(timer);
    return timer;
  }

  /**
   * 安全的定时器创建
   */
  setInterval(callback, interval) {
    const timer = setInterval(callback, interval);
    this.timers.add(timer);
    return timer;
  }

  /**
   * 清理定时器
   */
  clearTimer(timer) {
    this.timers.delete(timer);
    clearTimeout(timer);
    clearInterval(timer);
  }

  /**
   * 资源注册
   */
  registerResource(name, resource) {
    this.resources.set(name, resource);
  }

  /**
   * 资源获取
   */
  getResource(name) {
    return this.resources.get(name);
  }

  /**
   * 日志记录（沙箱安全）
   */
  log(...args) {
    if (this.sandbox && !this.sandbox.checkAPI('console.log')) {
      return;
    }
    console.log(`[${this.name}]`, ...args);
  }

  warn(...args) {
    if (this.sandbox && !this.sandbox.checkAPI('console.warn')) {
      return;
    }
    console.warn(`[${this.name}]`, ...args);
  }

  error(...args) {
    if (this.sandbox && !this.sandbox.checkAPI('console.error')) {
      return;
    }
    console.error(`[${this.name}]`, ...args);
  }

  // === 子类需要重写的方法 ===

  /**
   * 插件特定初始化逻辑
   * 子类应该重写此方法
   */
  async onInitialize() {
    // 默认实现：空操作
  }

  /**
   * 插件特定激活逻辑
   */
  async onActivate() {
    // 默认实现：空操作
  }

  /**
   * 插件特定停用逻辑
   */
  async onDeactivate() {
    // 默认实现：空操作
  }

  /**
   * 插件特定清理逻辑
   */
  async onCleanup() {
    // 默认实现：空操作
  }

  /**
   * 邮件操作处理逻辑
   * 邮件插件必须重写此方法
   */
  async onEmailAction(action, params) {
    throw new Error(`Email action handler not implemented: ${action}`);
  }

  /**
   * 配置更新处理逻辑
   */
  async onConfigUpdate(newConfig, oldConfig) {
    // 默认实现：空操作
  }

  /**
   * 验证运行环境
   */
  async validateEnvironment() {
    // 检查依赖
    for (const dependency of this.dependencies) {
      if (!this.isDependencyAvailable(dependency)) {
        throw new Error(`Dependency not available: ${dependency}`);
      }
    }
    
    // 检查权限
    for (const permission of this.permissions) {
      if (!this.checkPermission(permission)) {
        throw new Error(`Permission not granted: ${permission}`);
      }
    }
  }

  /**
   * 初始化插件资源
   */
  async initializeResources() {
    // 默认实现：空操作
    // 子类可以重写此方法来初始化特定资源
  }

  /**
   * 注册事件处理器
   */
  registerEventHandlers() {
    // 默认实现：空操作
    // 子类可以重写此方法来注册事件处理器
  }

  /**
   * 检查依赖是否可用
   */
  isDependencyAvailable(dependency) {
    if (!this.pluginSystem) return false;
    
    const depPlugin = this.pluginSystem.findPluginByName(dependency);
    return depPlugin && depPlugin.state === 'active';
  }

  /**
   * 获取插件元数据
   */
  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      author: this.author,
      license: this.license,
      dependencies: this.dependencies,
      interfaces: this.interfaces,
      hooks: this.hooks,
      permissions: this.permissions,
      isInitialized: this.isInitialized,
      isActive: this.isActive,
      error: this.error
    };
  }

  /**
   * 获取插件状态
   */
  getStatus() {
    return {
      name: this.name,
      isInitialized: this.isInitialized,
      isActive: this.isActive,
      error: this.error,
      resourceCount: this.resources.size,
      timerCount: this.timers.size,
      eventHandlerCount: this.eventHandlers.size
    };
  }
}

/**
 * 邮件处理插件接口 - 专门处理邮件相关操作的插件
 */
export class EmailHandlerPlugin extends PluginInterface {
  constructor(options = {}) {
    super(options);
    
    // 邮件插件必需的接口
    this.interfaces.push('email-handler');
    
    // 邮件插件常用权限
    this.permissions.push('email-read', 'email-write');
    
    // 支持的邮件操作
    this.supportedActions = [
      'read', 'send', 'delete', 'archive',
      'star', 'unstar', 'mark-read', 'mark-unread'
    ];
  }

  /**
   * 检查是否支持指定操作
   */
  supportsAction(action) {
    return this.supportedActions.includes(action);
  }

  /**
   * 邮件操作处理的默认实现
   */
  async onEmailAction(action, params) {
    if (!this.supportsAction(action)) {
      throw new Error(`Unsupported email action: ${action}`);
    }
    
    // 调用具体的操作处理方法
    const methodName = `handle${action.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('')}`;
    
    if (typeof this[methodName] === 'function') {
      return await this[methodName](params);
    } else {
      throw new Error(`Handler not implemented: ${methodName}`);
    }
  }
}

/**
 * UI 扩展插件接口 - 扩展用户界面的插件
 */
export class UIExtensionPlugin extends PluginInterface {
  constructor(options = {}) {
    super(options);
    
    // UI 插件必需的接口
    this.interfaces.push('ui-extension');
    
    // UI 插件常用权限
    this.permissions.push('ui-render', 'dom-access');
    
    // UI 组件管理
    this.components = new Map();
    this.styles = new Set();
  }

  /**
   * 渲染 UI 组件
   */
  async renderUI(context) {
    throw new Error('renderUI method must be implemented by UI plugins');
  }

  /**
   * 处理 UI 事件
   */
  async handleUIEvent(event, data) {
    // 默认实现：空操作
  }

  /**
   * 注册 UI 组件
   */
  registerComponent(name, component) {
    this.components.set(name, component);
  }

  /**
   * 获取 UI 组件
   */
  getComponent(name) {
    return this.components.get(name);
  }

  /**
   * 注入样式
   */
  injectStyle(css) {
    if (!this.checkPermission('dom-access')) {
      throw new Error('Permission denied for DOM access');
    }
    
    const styleId = `plugin-style-${this.name}-${this.styles.size}`;
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = css;
    
    document.head.appendChild(styleElement);
    this.styles.add(styleId);
    
    return styleId;
  }

  /**
   * 清理插件时也清理 UI 资源
   */
  async onCleanup() {
    // 清理注入的样式
    for (const styleId of this.styles) {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        styleElement.remove();
      }
    }
    this.styles.clear();
    
    // 清理组件
    this.components.clear();
  }
}

/**
 * 主题插件接口 - 自定义主题和样式
 */
export class ThemePlugin extends UIExtensionPlugin {
  constructor(options = {}) {
    super(options);
    
    // 主题插件特有属性
    this.themeName = '';
    this.themeColors = {};
    this.themeFonts = {};
    this.customCSS = '';
  }

  /**
   * 应用主题
   */
  async applyTheme() {
    if (!this.checkPermission('dom-access')) {
      throw new Error('Permission denied for DOM access');
    }
    
    // 应用主题颜色
    this.applyColors();
    
    // 应用主题字体
    this.applyFonts();
    
    // 应用自定义 CSS
    if (this.customCSS) {
      this.injectStyle(this.customCSS);
    }
    
    this.log(`Theme applied: ${this.themeName}`);
  }

  /**
   * 移除主题
   */
  async removeTheme() {
    // 通过清理样式来移除主题
    await this.onCleanup();
    this.log(`Theme removed: ${this.themeName}`);
  }

  /**
   * 应用主题颜色
   */
  applyColors() {
    const colorVars = Object.entries(this.themeColors)
      .map(([name, value]) => `--theme-${name}: ${value}`)
      .join(';\n');
    
    if (colorVars) {
      this.injectStyle(`:root {\n${colorVars}\n}`);
    }
  }

  /**
   * 应用主题字体
   */
  applyFonts() {
    const fontVars = Object.entries(this.themeFonts)
      .map(([name, value]) => `--theme-font-${name}: ${value}`)
      .join(';\n');
    
    if (fontVars) {
      this.injectStyle(`:root {\n${fontVars}\n}`);
    }
  }
}

export default PluginInterface;