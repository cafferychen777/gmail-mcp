/**
 * Integration Example
 * 
 * 展示如何集成和使用模块 F 的所有组件
 * 这个文件演示了整个健壮性增强和插件化架构的使用方法
 */

import { ServiceDiscovery } from './core/service-discovery.js';
import { InstanceManager } from './core/instance-manager.js';
import { ConfigurationManager } from './core/config-manager.js';
import { PluginSystem } from './core/plugin-system.js';
import { PluginRegistry } from './plugins/registry.js';

/**
 * Gmail MCP Bridge 增强版主类
 */
class GmailMCPBridgeV2 {
  constructor(options = {}) {
    this.options = options;
    
    // 初始化核心组件
    this.serviceDiscovery = new ServiceDiscovery({
      healthCheckInterval: 5000,
      serviceTimeout: 10000
    });
    
    this.instanceManager = new InstanceManager({
      maxInstances: 10,
      conflictResolution: 'collaborative'
    });
    
    this.configManager = new ConfigurationManager({
      environment: options.environment || 'production',
      hotReload: true,
      autoMigration: true
    });
    
    this.pluginSystem = new PluginSystem({
      pluginDirectory: './plugins',
      autoLoad: true,
      sandboxMode: true
    });
    
    this.pluginRegistry = new PluginRegistry({
      officialRegistry: 'https://registry.gmail-mcp.com',
      autoUpdate: true
    });
    
    this.isInitialized = false;
    this.isRunning = false;
  }

  /**
   * 初始化整个系统
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('Initializing Gmail MCP Bridge v2...');
    
    try {
      // 1. 配置管理器初始化（最先初始化）
      await this.configManager.initialize();
      
      // 2. 实例管理器初始化
      await this.instanceManager.start();
      
      // 3. 服务发现初始化
      await this.serviceDiscovery.startMonitoring();
      
      // 4. 插件注册表初始化
      await this.pluginRegistry.initialize();
      
      // 5. 插件系统初始化
      await this.pluginSystem.initialize();
      
      // 6. 注册核心服务
      await this.registerCoreServices();
      
      // 7. 自动发现现有服务
      await this.serviceDiscovery.discoverServices();
      
      this.isInitialized = true;
      console.log('Gmail MCP Bridge v2 initialized successfully');
      
    } catch (error) {
      console.error('Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * 启动系统
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.isRunning) return;
    
    console.log('Starting Gmail MCP Bridge v2...');
    
    try {
      // 激活核心插件
      await this.activateCorePlugins();
      
      // 启动健康监控
      this.startHealthMonitoring();
      
      this.isRunning = true;
      console.log('Gmail MCP Bridge v2 started successfully');
      
      // 打印系统状态
      this.printSystemStatus();
      
    } catch (error) {
      console.error('Startup failed:', error.message);
      throw error;
    }
  }

  /**
   * 停止系统
   */
  async stop() {
    if (!this.isRunning) return;
    
    console.log('Stopping Gmail MCP Bridge v2...');
    
    try {
      // 停止插件系统
      const activePlugins = this.pluginSystem.getActivePlugins();
      for (const plugin of activePlugins) {
        await this.pluginSystem.deactivatePlugin(plugin.id);
      }
      
      // 停止服务发现
      this.serviceDiscovery.stopMonitoring();
      
      // 停止实例管理
      await this.instanceManager.stop();
      
      this.isRunning = false;
      console.log('Gmail MCP Bridge v2 stopped successfully');
      
    } catch (error) {
      console.error('Shutdown failed:', error.message);
      throw error;
    }
  }

  // === 配置管理示例 ===

  /**
   * 演示配置管理功能
   */
  async demonstrateConfigManagement() {
    console.log('\n=== Configuration Management Demo ===');
    
    // 生成 Claude Desktop 配置
    const claudeConfig = await this.configManager.generateConfig(
      'claude-config.json',
      'claude-desktop',
      {
        serverPath: './mcp-server/index.js',
        environment: 'production',
        bridgePort: 3456
      }
    );
    
    console.log('Generated Claude Desktop config:', claudeConfig);
    
    // 更新配置
    await this.configManager.updateConfig('claude-config.json', (config) => ({
      ...config,
      mcpServers: {
        ...config.mcpServers,
        'gmail-mcp-v2': {
          command: 'node',
          args: ['./src/mcp-server-v2.js'],
          env: {
            NODE_ENV: 'production',
            PLUGIN_MODE: 'enabled'
          }
        }
      }
    }));
    
    // 切换环境
    await this.configManager.switchEnvironment('development');
    
    console.log('Configuration management demo completed');
  }

  // === 插件管理示例 ===

  /**
   * 演示插件系统功能
   */
  async demonstratePluginSystem() {
    console.log('\n=== Plugin System Demo ===');
    
    // 搜索插件
    const searchResults = await this.pluginRegistry.searchPlugins('outlook', {
      category: 'email-providers'
    });
    console.log('Plugin search results:', searchResults);
    
    // 安装插件（模拟）
    if (searchResults.plugins.length > 0) {
      const pluginToInstall = searchResults.plugins[0];
      console.log(`Would install plugin: ${pluginToInstall.name}`);
      
      // 实际安装代码（这里注释掉避免实际执行）
      // await this.pluginRegistry.installPlugin(pluginToInstall.id);
      // await this.pluginSystem.loadPlugin(`./plugins/${pluginToInstall.id}`);
      // await this.pluginSystem.activatePlugin(pluginToInstall.id);
    }
    
    // 显示插件状态
    const pluginStatus = this.pluginSystem.getSystemStatus();
    console.log('Plugin system status:', pluginStatus);
    
    console.log('Plugin system demo completed');
  }

  // === 服务发现示例 ===

  /**
   * 演示服务发现功能
   */
  async demonstrateServiceDiscovery() {
    console.log('\n=== Service Discovery Demo ===');
    
    // 注册服务
    await this.serviceDiscovery.registerService('gmail-mcp-server', {
      host: 'localhost',
      port: 3456,
      protocol: 'http',
      healthCheck: {
        path: '/health',
        interval: 5000
      }
    });
    
    await this.serviceDiscovery.registerService('bridge-server', {
      host: 'localhost',
      port: 3457,
      protocol: 'http',
      weight: 2
    });
    
    // 发现服务
    const discoveredServices = await this.serviceDiscovery.discoverServices();
    console.log('Discovered services:', discoveredServices.size);
    
    // 获取健康服务
    try {
      const healthyService = await this.serviceDiscovery.getHealthyService('gmail-mcp-server');
      console.log('Selected healthy service:', healthyService);
    } catch (error) {
      console.log('No healthy service available:', error.message);
    }
    
    // 显示系统概览
    const overview = this.serviceDiscovery.getSystemOverview();
    console.log('Service discovery overview:', overview);
    
    console.log('Service discovery demo completed');
  }

  // === 实例管理示例 ===

  /**
   * 演示实例管理功能
   */
  async demonstrateInstanceManagement() {
    console.log('\n=== Instance Management Demo ===');
    
    // 显示系统概览
    const overview = this.instanceManager.getSystemOverview();
    console.log('Instance management overview:', overview);
    
    // 模拟注册实例
    const instanceId = this.instanceManager.registerInstance({
      type: 'mcp-server',
      port: 3456,
      processId: process.pid,
      metadata: {
        version: '2.0.0',
        features: ['plugin-support', 'hot-reload']
      }
    });
    
    console.log('Registered instance:', instanceId);
    
    console.log('Instance management demo completed');
  }

  // === 私有方法 ===

  /**
   * 注册核心服务
   */
  async registerCoreServices() {
    // 注册 MCP 服务器
    await this.serviceDiscovery.registerService('mcp-server', {
      host: 'localhost',
      port: 3456,
      protocol: 'http',
      healthCheck: { path: '/health' },
      loadBalance: { algorithm: 'round-robin' }
    });
    
    // 注册桥接服务器
    await this.serviceDiscovery.registerService('bridge-server', {
      host: 'localhost',
      port: 3457,
      protocol: 'http',
      healthCheck: { path: '/status' }
    });
    
    console.log('Core services registered');
  }

  /**
   * 激活核心插件
   */
  async activateCorePlugins() {
    const corePlugins = [
      'gmail-provider',
      'chrome-integration',
      'error-handler',
      'status-monitor'
    ];
    
    for (const pluginName of corePlugins) {
      try {
        // 查找插件
        const plugin = this.pluginSystem.findPluginByName(pluginName);
        if (plugin && plugin.state === 'loaded') {
          await this.pluginSystem.activatePlugin(plugin.id);
          console.log(`Activated core plugin: ${pluginName}`);
        }
      } catch (error) {
        console.warn(`Failed to activate core plugin ${pluginName}:`, error.message);
      }
    }
  }

  /**
   * 启动健康监控
   */
  startHealthMonitoring() {
    // 定期检查系统健康状态
    setInterval(() => {
      this.performHealthCheck().catch(error => {
        console.error('Health check failed:', error.message);
      });
    }, 30000); // 每30秒检查一次
    
    console.log('Health monitoring started');
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck() {
    const health = {
      timestamp: new Date().toISOString(),
      services: this.serviceDiscovery.getSystemOverview(),
      instances: this.instanceManager.getSystemOverview(),
      plugins: this.pluginSystem.getSystemStatus(),
      config: this.configManager.getConfigStats()
    };
    
    // 检查关键指标
    const issues = [];
    
    if (health.services.healthyServices === 0) {
      issues.push('No healthy services available');
    }
    
    if (health.plugins.pluginsByState.error > 0) {
      issues.push(`${health.plugins.pluginsByState.error} plugins in error state`);
    }
    
    if (issues.length > 0) {
      console.warn('Health check issues detected:', issues);
      
      // 触发自动恢复
      await this.triggerAutoRecovery(issues);
    }
    
    return health;
  }

  /**
   * 触发自动恢复
   */
  async triggerAutoRecovery(issues) {
    console.log('Triggering auto-recovery for issues:', issues);
    
    // 重启失败的服务
    await this.serviceDiscovery.performHealthChecks();
    
    // 重新发现服务
    await this.serviceDiscovery.discoverServices();
    
    // 清理死实例
    // instanceManager 会自动清理死实例
    
    console.log('Auto-recovery completed');
  }

  /**
   * 打印系统状态
   */
  printSystemStatus() {
    console.log('\n=== System Status ===');
    console.log('Services:', this.serviceDiscovery.getSystemOverview());
    console.log('Instances:', this.instanceManager.getSystemOverview());
    console.log('Plugins:', this.pluginSystem.getSystemStatus());
    console.log('Registry:', this.pluginRegistry.getRegistryStats());
    console.log('====================\n');
  }

  // === 公共 API ===

  /**
   * 处理邮件操作（通过插件系统）
   */
  async handleEmailAction(action, params, provider = 'gmail') {
    // 通过插件系统路由邮件操作
    const context = await this.pluginSystem.triggerHook('email-action', {
      action,
      params,
      provider,
      timestamp: Date.now()
    });
    
    return context.result || { success: false, message: 'No handler found' };
  }

  /**
   * 获取系统状态
   */
  getSystemStatus() {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      services: this.serviceDiscovery.getSystemOverview(),
      instances: this.instanceManager.getSystemOverview(),
      plugins: this.pluginSystem.getSystemStatus(),
      registry: this.pluginRegistry.getRegistryStats()
    };
  }

  /**
   * 运行完整演示
   */
  async runFullDemo() {
    console.log('🚀 Starting Gmail MCP Bridge v2 Full Demo\n');
    
    try {
      // 初始化和启动系统
      await this.initialize();
      await this.start();
      
      // 演示各个功能模块
      await this.demonstrateConfigManagement();
      await this.demonstrateServiceDiscovery();
      await this.demonstrateInstanceManagement();
      await this.demonstratePluginSystem();
      
      // 显示最终状态
      console.log('\n=== Final System Status ===');
      console.log(JSON.stringify(this.getSystemStatus(), null, 2));
      
      console.log('\n✅ Gmail MCP Bridge v2 Demo Completed Successfully!');
      
    } catch (error) {
      console.error('\n❌ Demo failed:', error.message);
      throw error;
    }
  }
}

// 导出主类
export default GmailMCPBridgeV2;

// 如果直接运行此文件，执行演示
if (import.meta.url === `file://${process.argv[1]}`) {
  const bridge = new GmailMCPBridgeV2({
    environment: 'development'
  });
  
  bridge.runFullDemo().catch(error => {
    console.error('Demo execution failed:', error.message);
    process.exit(1);
  });
}