/**
 * Custom Theme Plugin
 * 
 * 演示如何通过插件系统为 Gmail MCP Bridge 添加自定义主题
 * 基于 Linus "好品味" 设计原则：
 * 1. 消除特殊情况 - 统一的主题应用机制，支持多种主题类型
 * 2. 数据结构优先 - 主题配置驱动样式生成，而非硬编码CSS
 * 3. Never break userspace - 主题系统完全可逆，不影响原有界面
 * 4. 实用主义 - 解决真实的个性化定制需求
 */

import { ThemePlugin } from '../plugin-interface.js';

export default class CustomThemePlugin extends ThemePlugin {
  constructor(options = {}) {
    super(options);
    
    // 插件元数据
    this.name = 'custom-theme';
    this.version = '1.0.0';
    this.description = 'Custom themes for Gmail MCP Bridge interface';
    this.author = 'Gmail MCP Team';
    
    // 权限声明
    this.permissions.push(
      'dom-access',
      'ui-render',
      'storage-access'
    );
    
    // 主题注册表
    this.availableThemes = new Map();
    
    // 当前主题状态
    this.currentTheme = null;
    this.appliedStyles = new Set();
    
    // 主题配置
    this.themeConfig = {
      allowUserThemes: true,
      defaultTheme: 'gmail-classic',
      themeDirectory: './themes',
      cacheThemes: true,
      ...this.config.theme
    };
    
    // 初始化内置主题
    this.initializeBuiltinThemes();
    
    // 绑定方法上下文
    this.switchTheme = this.switchTheme.bind(this);
    this.previewTheme = this.previewTheme.bind(this);
  }

  /**
   * 插件初始化
   */
  async onInitialize() {
    this.log('Initializing custom theme plugin...');
    
    // 加载保存的主题设置
    await this.loadThemeSettings();
    
    // 扫描和加载自定义主题
    await this.loadCustomThemes();
    
    // 注册主题钩子
    this.registerThemeHooks();
    
    // 初始化主题切换器界面
    await this.initializeThemeSwitcher();
    
    this.log('Custom theme plugin initialized successfully');
  }

  /**
   * 插件激活
   */
  async onActivate() {
    this.log('Activating custom theme plugin...');
    
    // 应用默认或保存的主题
    const savedTheme = await this.getSavedTheme();
    const themeToApply = savedTheme || this.themeConfig.defaultTheme;
    
    if (themeToApply && this.availableThemes.has(themeToApply)) {
      await this.switchTheme(themeToApply);
    }
    
    // 注册主题管理器
    await this.registerThemeManager();
    
    this.log('Custom theme plugin activated successfully');
  }

  /**
   * 插件停用
   */
  async onDeactivate() {
    this.log('Deactivating custom theme plugin...');
    
    // 移除当前主题
    if (this.currentTheme) {
      await this.removeCurrentTheme();
    }
    
    // 注销主题管理器
    await this.unregisterThemeManager();
    
    this.log('Custom theme plugin deactivated successfully');
  }

  // === 主题管理方法 ===

  /**
   * 切换主题
   */
  async switchTheme(themeId) {
    if (!this.availableThemes.has(themeId)) {
      throw new Error(`Theme not found: ${themeId}`);
    }
    
    this.log(`Switching to theme: ${themeId}`);
    
    // 移除当前主题
    if (this.currentTheme) {
      await this.removeCurrentTheme();
    }
    
    // 应用新主题
    const theme = this.availableThemes.get(themeId);
    await this.applyTheme(theme);
    
    // 更新状态
    this.currentTheme = themeId;
    
    // 保存主题设置
    await this.saveThemeSettings(themeId);
    
    // 触发主题切换事件
    await this.triggerHook('theme-switched', {
      previousTheme: this.currentTheme,
      currentTheme: themeId,
      theme
    });
    
    this.log(`Theme switched successfully: ${themeId}`);
    
    return { success: true, theme: themeId };
  }

  /**
   * 预览主题（临时应用，不保存）
   */
  async previewTheme(themeId, duration = 10000) {
    if (!this.availableThemes.has(themeId)) {
      throw new Error(`Theme not found: ${themeId}`);
    }
    
    const originalTheme = this.currentTheme;
    
    // 临时应用主题
    await this.switchTheme(themeId);
    
    // 设置自动恢复定时器
    this.setTimeout(async () => {
      if (originalTheme) {
        await this.switchTheme(originalTheme);
      } else {
        await this.removeCurrentTheme();
      }
    }, duration);
    
    return { 
      success: true, 
      previewTheme: themeId,
      originalTheme,
      duration 
    };
  }

  /**
   * 应用主题
   */
  async applyTheme(theme) {
    if (!this.checkPermission('dom-access')) {
      throw new Error('Permission denied for DOM access');
    }
    
    // 应用主题颜色
    if (theme.colors) {
      this.applyThemeColors(theme.colors);
    }
    
    // 应用主题字体
    if (theme.fonts) {
      this.applyThemeFonts(theme.fonts);
    }
    
    // 应用主题布局
    if (theme.layout) {
      this.applyThemeLayout(theme.layout);
    }
    
    // 应用自定义 CSS
    if (theme.customCSS) {
      this.applyCustomCSS(theme.customCSS, `theme-${theme.id}`);
    }
    
    // 应用组件样式
    if (theme.components) {
      this.applyComponentStyles(theme.components);
    }
    
    this.log(`Theme applied: ${theme.name}`);
  }

  /**
   * 移除当前主题
   */
  async removeCurrentTheme() {
    if (!this.currentTheme) return;
    
    // 移除所有应用的样式
    for (const styleId of this.appliedStyles) {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        styleElement.remove();
      }
    }
    
    this.appliedStyles.clear();
    this.currentTheme = null;
    
    this.log('Current theme removed');
  }

  // === 主题样式应用方法 ===

  /**
   * 应用主题颜色
   */
  applyThemeColors(colors) {
    const colorVariables = Object.entries(colors)
      .map(([name, value]) => `--theme-color-${name}: ${value}`)
      .join(';\n  ');
    
    const colorCSS = `:root {\n  ${colorVariables}\n}`;
    
    this.applyCustomCSS(colorCSS, 'theme-colors');
  }

  /**
   * 应用主题字体
   */
  applyThemeFonts(fonts) {
    const fontVariables = Object.entries(fonts)
      .map(([name, value]) => `--theme-font-${name}: ${value}`)
      .join(';\n  ');
    
    const fontCSS = `:root {\n  ${fontVariables}\n}`;
    
    this.applyCustomCSS(fontCSS, 'theme-fonts');
  }

  /**
   * 应用主题布局
   */
  applyThemeLayout(layout) {
    const layoutRules = [];
    
    // 容器布局
    if (layout.container) {
      layoutRules.push(`
        .mcp-container {
          max-width: ${layout.container.maxWidth || '1200px'};
          margin: ${layout.container.margin || '0 auto'};
          padding: ${layout.container.padding || '20px'};
        }
      `);
    }
    
    // 状态面板布局
    if (layout.statusPanel) {
      layoutRules.push(`
        .status-panel {
          position: ${layout.statusPanel.position || 'fixed'};
          ${layout.statusPanel.position === 'fixed' ? `
            ${layout.statusPanel.anchor || 'bottom'}: ${layout.statusPanel.offset || '20px'};
            ${layout.statusPanel.align || 'right'}: ${layout.statusPanel.offset || '20px'};
          ` : ''}
          width: ${layout.statusPanel.width || 'auto'};
          max-height: ${layout.statusPanel.maxHeight || '400px'};
        }
      `);
    }
    
    // 邮件列表布局
    if (layout.emailList) {
      layoutRules.push(`
        .email-list {
          grid-template-columns: ${layout.emailList.columns || '1fr'};
          gap: ${layout.emailList.gap || '10px'};
          padding: ${layout.emailList.padding || '10px'};
        }
      `);
    }
    
    const layoutCSS = layoutRules.join('\n\n');
    this.applyCustomCSS(layoutCSS, 'theme-layout');
  }

  /**
   * 应用组件样式
   */
  applyComponentStyles(components) {
    const componentRules = [];
    
    for (const [componentName, styles] of Object.entries(components)) {
      const selector = `.mcp-${componentName}`;
      const rules = Object.entries(styles)
        .map(([property, value]) => `${this.camelToKebab(property)}: ${value}`)
        .join(';\n    ');
      
      componentRules.push(`${selector} {\n    ${rules}\n  }`);
    }
    
    const componentCSS = componentRules.join('\n\n  ');
    this.applyCustomCSS(componentCSS, 'theme-components');
  }

  /**
   * 应用自定义 CSS
   */
  applyCustomCSS(css, styleId) {
    const fullStyleId = `custom-theme-${styleId}`;
    
    // 移除已存在的样式
    const existingStyle = document.getElementById(fullStyleId);
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // 创建新样式元素
    const styleElement = document.createElement('style');
    styleElement.id = fullStyleId;
    styleElement.textContent = css;
    
    // 添加到文档头部
    document.head.appendChild(styleElement);
    
    // 记录已应用的样式
    this.appliedStyles.add(fullStyleId);
    
    this.log(`Applied custom CSS: ${styleId}`);
  }

  // === 主题定义和管理 ===

  /**
   * 初始化内置主题
   */
  initializeBuiltinThemes() {
    // Gmail 经典主题
    this.availableThemes.set('gmail-classic', {
      id: 'gmail-classic',
      name: 'Gmail 经典',
      description: '经典的 Gmail 界面风格',
      author: 'Gmail MCP',
      version: '1.0.0',
      colors: {
        primary: '#ea4335',
        secondary: '#4285f4',
        background: '#ffffff',
        surface: '#f8f9fa',
        text: '#202124',
        textSecondary: '#5f6368',
        border: '#dadce0',
        success: '#34a853',
        warning: '#fbbc05',
        error: '#ea4335'
      },
      fonts: {
        primary: '"Google Sans", Roboto, RobotoDraft, Helvetica, Arial, sans-serif',
        monospace: '"Roboto Mono", monospace',
        size: '14px',
        lineHeight: '1.4'
      },
      layout: {
        container: {
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '20px'
        },
        statusPanel: {
          position: 'fixed',
          anchor: 'bottom',
          align: 'right',
          offset: '20px',
          width: '300px'
        }
      },
      components: {
        card: {
          backgroundColor: 'var(--theme-color-surface)',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          border: '1px solid var(--theme-color-border)'
        },
        button: {
          backgroundColor: 'var(--theme-color-primary)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '8px 16px',
          fontFamily: 'var(--theme-font-primary)'
        }
      }
    });

    // 深色主题
    this.availableThemes.set('dark-mode', {
      id: 'dark-mode',
      name: '深色模式',
      description: '护眼的深色界面主题',
      author: 'Gmail MCP',
      version: '1.0.0',
      colors: {
        primary: '#8ab4f8',
        secondary: '#81c995',
        background: '#202124',
        surface: '#303134',
        text: '#e8eaed',
        textSecondary: '#9aa0a6',
        border: '#5f6368',
        success: '#81c995',
        warning: '#fdd663',
        error: '#f28b82'
      },
      fonts: {
        primary: '"Google Sans", Roboto, RobotoDraft, Helvetica, Arial, sans-serif',
        monospace: '"Roboto Mono", monospace',
        size: '14px',
        lineHeight: '1.4'
      },
      layout: {
        container: {
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '20px'
        }
      },
      components: {
        card: {
          backgroundColor: 'var(--theme-color-surface)',
          borderRadius: '8px',
          border: '1px solid var(--theme-color-border)',
          color: 'var(--theme-color-text)'
        },
        button: {
          backgroundColor: 'var(--theme-color-primary)',
          color: 'var(--theme-color-background)',
          border: 'none',
          borderRadius: '4px',
          padding: '8px 16px'
        }
      }
    });

    // 简约主题
    this.availableThemes.set('minimal', {
      id: 'minimal',
      name: '简约风格',
      description: '极简主义设计风格',
      author: 'Gmail MCP',
      version: '1.0.0',
      colors: {
        primary: '#000000',
        secondary: '#666666',
        background: '#ffffff',
        surface: '#ffffff',
        text: '#000000',
        textSecondary: '#666666',
        border: '#e0e0e0',
        success: '#4caf50',
        warning: '#ff9800',
        error: '#f44336'
      },
      fonts: {
        primary: 'system-ui, -apple-system, sans-serif',
        monospace: '"SF Mono", "Monaco", "Roboto Mono", monospace',
        size: '15px',
        lineHeight: '1.5'
      },
      layout: {
        container: {
          maxWidth: '900px',
          margin: '0 auto',
          padding: '40px 20px'
        }
      },
      components: {
        card: {
          backgroundColor: 'var(--theme-color-surface)',
          border: '1px solid var(--theme-color-border)',
          borderRadius: '0'
        },
        button: {
          backgroundColor: 'transparent',
          color: 'var(--theme-color-primary)',
          border: '1px solid var(--theme-color-primary)',
          borderRadius: '0',
          padding: '10px 20px'
        }
      }
    });

    this.log(`Initialized ${this.availableThemes.size} builtin themes`);
  }

  /**
   * 加载自定义主题
   */
  async loadCustomThemes() {
    if (!this.themeConfig.allowUserThemes) {
      return;
    }

    try {
      // 这里可以实现从文件系统或远程加载自定义主题
      // 简化版本：从配置中加载
      const customThemes = this.config.customThemes || [];
      
      for (const themeConfig of customThemes) {
        if (this.validateThemeConfig(themeConfig)) {
          this.availableThemes.set(themeConfig.id, themeConfig);
          this.log(`Loaded custom theme: ${themeConfig.name}`);
        }
      }
    } catch (error) {
      this.warn('Failed to load custom themes:', error.message);
    }
  }

  /**
   * 验证主题配置
   */
  validateThemeConfig(themeConfig) {
    const requiredFields = ['id', 'name', 'version'];
    
    for (const field of requiredFields) {
      if (!themeConfig[field]) {
        this.warn(`Invalid theme config: missing ${field}`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * 保存主题设置
   */
  async saveThemeSettings(themeId) {
    if (this.checkPermission('storage-access')) {
      try {
        localStorage.setItem('gmail-mcp-current-theme', themeId);
        this.log(`Theme setting saved: ${themeId}`);
      } catch (error) {
        this.warn('Failed to save theme settings:', error.message);
      }
    }
  }

  /**
   * 获取保存的主题
   */
  async getSavedTheme() {
    if (this.checkPermission('storage-access')) {
      try {
        return localStorage.getItem('gmail-mcp-current-theme');
      } catch (error) {
        this.warn('Failed to load theme settings:', error.message);
      }
    }
    return null;
  }

  /**
   * 加载主题设置
   */
  async loadThemeSettings() {
    const savedTheme = await this.getSavedTheme();
    if (savedTheme && this.availableThemes.has(savedTheme)) {
      this.log(`Found saved theme: ${savedTheme}`);
    }
  }

  // === UI 组件 ===

  /**
   * 初始化主题切换器界面
   */
  async initializeThemeSwitcher() {
    if (!this.checkPermission('ui-render')) return;

    const switcherHTML = this.renderThemeSwitcher();
    
    // 将主题切换器添加到页面
    const switcherElement = document.createElement('div');
    switcherElement.innerHTML = switcherHTML;
    switcherElement.className = 'mcp-theme-switcher';
    
    // 添加事件监听器
    this.attachThemeSwitcherEvents(switcherElement);
    
    // 注册为 UI 组件
    this.registerComponent('theme-switcher', switcherElement);
  }

  /**
   * 渲染主题切换器
   */
  renderThemeSwitcher() {
    const themeOptions = Array.from(this.availableThemes.values())
      .map(theme => `
        <option value="${theme.id}" ${theme.id === this.currentTheme ? 'selected' : ''}>
          ${theme.name}
        </option>
      `).join('');

    return `
      <div class="theme-switcher-panel">
        <label for="theme-selector">主题选择：</label>
        <select id="theme-selector" class="theme-selector">
          <option value="">选择主题...</option>
          ${themeOptions}
        </select>
        <button id="preview-theme" class="preview-button" disabled>预览</button>
        <button id="reset-theme" class="reset-button">重置</button>
      </div>
    `;
  }

  /**
   * 绑定主题切换器事件
   */
  attachThemeSwitcherEvents(element) {
    const selector = element.querySelector('#theme-selector');
    const previewBtn = element.querySelector('#preview-theme');
    const resetBtn = element.querySelector('#reset-theme');

    selector.addEventListener('change', (e) => {
      const selectedTheme = e.target.value;
      previewBtn.disabled = !selectedTheme;
      
      if (selectedTheme) {
        this.switchTheme(selectedTheme).catch(error => {
          this.error('Failed to switch theme:', error.message);
        });
      }
    });

    previewBtn.addEventListener('click', () => {
      const selectedTheme = selector.value;
      if (selectedTheme) {
        this.previewTheme(selectedTheme).catch(error => {
          this.error('Failed to preview theme:', error.message);
        });
      }
    });

    resetBtn.addEventListener('click', () => {
      this.removeCurrentTheme().then(() => {
        selector.value = '';
        previewBtn.disabled = true;
      }).catch(error => {
        this.error('Failed to reset theme:', error.message);
      });
    });
  }

  // === 主题钩子和管理器 ===

  /**
   * 注册主题钩子
   */
  registerThemeHooks() {
    // UI 渲染钩子
    this.registerHook('ui-render', async (context) => {
      if (this.currentTheme) {
        context.theme = this.availableThemes.get(this.currentTheme);
      }
      return context;
    });

    // 配置变更钩子
    this.registerHook('config-changed', async (context) => {
      if (context.section === 'theme') {
        await this.loadCustomThemes();
      }
      return context;
    });
  }

  /**
   * 注册主题管理器
   */
  async registerThemeManager() {
    const managerInfo = {
      name: 'theme-manager',
      plugin: this,
      
      // 提供给系统的主题管理接口
      getAvailableThemes: () => Array.from(this.availableThemes.values()),
      getCurrentTheme: () => this.currentTheme,
      switchTheme: this.switchTheme,
      previewTheme: this.previewTheme,
      resetTheme: () => this.removeCurrentTheme()
    };

    if (this.pluginSystem) {
      await this.pluginSystem.triggerHook('register-theme-manager', managerInfo);
    }
  }

  /**
   * 注销主题管理器
   */
  async unregisterThemeManager() {
    if (this.pluginSystem) {
      await this.pluginSystem.triggerHook('unregister-theme-manager', {
        name: 'theme-manager'
      });
    }
  }

  // === 工具方法 ===

  /**
   * 驼峰命名转短横线命名
   */
  camelToKebab(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * 获取主题列表
   */
  getAvailableThemes() {
    return Array.from(this.availableThemes.values()).map(theme => ({
      id: theme.id,
      name: theme.name,
      description: theme.description,
      author: theme.author,
      version: theme.version
    }));
  }

  /**
   * 获取当前主题信息
   */
  getCurrentThemeInfo() {
    if (!this.currentTheme) return null;
    
    return {
      id: this.currentTheme,
      ...this.availableThemes.get(this.currentTheme)
    };
  }

  /**
   * 创建主题配置对象
   */
  createThemeConfig(options) {
    return {
      id: options.id || 'custom-theme',
      name: options.name || 'Custom Theme',
      description: options.description || 'User created theme',
      author: options.author || 'User',
      version: options.version || '1.0.0',
      colors: options.colors || {},
      fonts: options.fonts || {},
      layout: options.layout || {},
      components: options.components || {},
      customCSS: options.customCSS || ''
    };
  }

  /**
   * 导出当前主题配置
   */
  exportCurrentTheme() {
    if (!this.currentTheme) {
      throw new Error('No theme currently applied');
    }
    
    const theme = this.availableThemes.get(this.currentTheme);
    return JSON.stringify(theme, null, 2);
  }

  /**
   * 导入主题配置
   */
  async importTheme(themeJSON) {
    try {
      const themeConfig = JSON.parse(themeJSON);
      
      if (this.validateThemeConfig(themeConfig)) {
        this.availableThemes.set(themeConfig.id, themeConfig);
        this.log(`Theme imported successfully: ${themeConfig.name}`);
        return themeConfig.id;
      } else {
        throw new Error('Invalid theme configuration');
      }
    } catch (error) {
      throw new Error(`Failed to import theme: ${error.message}`);
    }
  }
}

// 导出插件类
export { CustomThemePlugin };