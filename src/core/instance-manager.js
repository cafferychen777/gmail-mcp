/**
 * Multi-Instance Manager
 * 
 * 基于 Linus "好品味" 设计原则：
 * 1. 消除特殊情况 - 统一处理所有实例类型
 * 2. 数据结构优先 - 用 Map 管理实例状态，避免复杂条件分支
 * 3. Never break userspace - 实例冲突解决不影响现有用户使用
 * 4. 实用主义 - 解决真实的多窗口、多用户问题
 */

import { EventEmitter } from 'events';
import { execSync, spawn } from 'child_process';

export class InstanceManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // 核心数据结构：实例状态的唯一真实来源
    this.instances = new Map(); // instanceId -> InstanceInfo
    this.conflictResolutions = new Map(); // conflictType -> ResolutionStrategy
    this.resourceAllocations = new Map(); // resourceType -> AllocationMap
    this.communicationChannels = new Map(); // channelId -> Channel
    
    // 配置参数
    this.config = {
      maxInstances: options.maxInstances || 10,
      conflictResolution: options.conflictResolution || 'collaborative',
      resourceSharing: options.resourceSharing || true,
      heartbeatInterval: options.heartbeatInterval || 5000,
      cleanupInterval: options.cleanupInterval || 30000,
      ...options
    };
    
    // 实例类型定义
    this.instanceTypes = {
      'chrome-window': {
        detector: this.detectChromeWindows.bind(this),
        identifier: (instance) => instance.windowId,
        resources: ['gmail-tabs', 'extensions', 'cookies']
      },
      'claude-desktop': {
        detector: this.detectClaudeInstances.bind(this),
        identifier: (instance) => instance.processId,
        resources: ['mcp-configs', 'workspace', 'settings']
      },
      'mcp-server': {
        detector: this.detectMcpServers.bind(this),
        identifier: (instance) => instance.port,
        resources: ['connections', 'tools', 'cache']
      }
    };
    
    // 冲突解决策略
    this.conflictStrategies = {
      'first-wins': this.firstWinsStrategy.bind(this),
      'priority-based': this.priorityBasedStrategy.bind(this),
      'collaborative': this.collaborativeStrategy.bind(this),
      'user-choice': this.userChoiceStrategy.bind(this)
    };
    
    this.isRunning = false;
    this.cleanupTimer = null;
    this.heartbeatTimer = null;
  }

  /**
   * 启动实例管理 - 消除特殊情况的统一启动流程
   */
  async start() {
    if (this.isRunning) return;
    
    console.log('Starting instance manager...');
    
    // 初始化冲突解决策略
    this.initializeConflictResolutions();
    
    // 发现现有实例
    await this.discoverExistingInstances();
    
    // 启动监控
    this.startMonitoring();
    
    // 建立通信通道
    await this.establishCommunicationChannels();
    
    this.isRunning = true;
    this.emit('started');
    
    console.log(`Instance manager started. Found ${this.instances.size} instances.`);
  }

  /**
   * 停止实例管理
   */
  async stop() {
    if (!this.isRunning) return;
    
    console.log('Stopping instance manager...');
    
    this.stopMonitoring();
    await this.closeCommunicationChannels();
    
    this.isRunning = false;
    this.emit('stopped');
    
    console.log('Instance manager stopped.');
  }

  /**
   * 发现现有实例 - 实用主义：只检测真正需要的实例
   */
  async discoverExistingInstances() {
    const discoveryPromises = [];
    
    for (const [typeName, typeConfig] of Object.entries(this.instanceTypes)) {
      discoveryPromises.push(
        this.discoverInstancesOfType(typeName, typeConfig)
          .catch(error => {
            console.warn(`Failed to discover ${typeName} instances:`, error.message);
            return [];
          })
      );
    }
    
    const allDiscoveredInstances = await Promise.all(discoveryPromises);
    
    // 注册所有发现的实例
    for (const instances of allDiscoveredInstances) {
      for (const instance of instances) {
        this.registerInstance(instance);
      }
    }
    
    // 检测和解决冲突
    await this.detectAndResolveConflicts();
  }

  /**
   * 注册实例 - 好品味：统一的实例注册机制
   */
  registerInstance(instanceInfo) {
    const instanceId = this.generateInstanceId(instanceInfo);
    
    const instance = {
      id: instanceId,
      type: instanceInfo.type,
      status: 'active',
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      metadata: instanceInfo.metadata || {},
      resources: new Map(),
      ...instanceInfo
    };
    
    this.instances.set(instanceId, instance);
    
    // 分配资源
    this.allocateResources(instance);
    
    // 建立通信
    this.setupInstanceCommunication(instance);
    
    this.emit('instance-registered', instance);
    console.log(`Instance registered: ${instance.type}:${instanceId}`);
    
    return instanceId;
  }

  /**
   * 检测并解决冲突 - 消除特殊情况的冲突处理
   */
  async detectAndResolveConflicts() {
    const conflictGroups = this.groupConflictingInstances();
    
    for (const [conflictType, conflictingInstances] of conflictGroups.entries()) {
      if (conflictingInstances.length > 1) {
        const resolution = this.conflictResolutions.get(conflictType) || 
                          this.conflictStrategies[this.config.conflictResolution];
        
        const resolvedInstances = await resolution(conflictingInstances, conflictType);
        
        // 更新实例状态
        this.updateInstanceStatuses(conflictingInstances, resolvedInstances);
        
        this.emit('conflict-resolved', {
          type: conflictType,
          instances: conflictingInstances,
          resolution: resolvedInstances
        });
      }
    }
  }

  /**
   * 分配资源 - 实用主义的资源管理
   */
  allocateResources(instance) {
    const typeConfig = this.instanceTypes[instance.type];
    if (!typeConfig?.resources) return;
    
    for (const resourceType of typeConfig.resources) {
      if (!this.resourceAllocations.has(resourceType)) {
        this.resourceAllocations.set(resourceType, new Map());
      }
      
      const allocation = this.calculateResourceAllocation(instance, resourceType);
      this.resourceAllocations.get(resourceType).set(instance.id, allocation);
      instance.resources.set(resourceType, allocation);
    }
  }

  // === 实例检测方法 ===

  /**
   * 检测 Chrome 窗口实例
   */
  async detectChromeWindows() {
    try {
      // 使用系统命令检测 Chrome 进程
      const processes = this.getSystemProcesses();
      const chromeProcesses = processes.filter(p => 
        p.name.toLowerCase().includes('chrome') || 
        p.name.toLowerCase().includes('chromium')
      );
      
      const instances = [];
      
      for (const process of chromeProcesses) {
        // 尝试获取 Chrome 窗口信息
        const windowInfo = await this.getChromeWindowInfo(process.pid);
        
        if (windowInfo) {
          instances.push({
            type: 'chrome-window',
            processId: process.pid,
            windowId: windowInfo.id,
            title: windowInfo.title,
            url: windowInfo.url,
            metadata: {
              profile: windowInfo.profile,
              extensions: windowInfo.extensions,
              tabs: windowInfo.tabs
            }
          });
        }
      }
      
      return instances;
    } catch (error) {
      console.warn('Failed to detect Chrome windows:', error.message);
      return [];
    }
  }

  /**
   * 检测 Claude Desktop 实例
   */
  async detectClaudeInstances() {
    try {
      const processes = this.getSystemProcesses();
      const claudeProcesses = processes.filter(p => 
        p.name.toLowerCase().includes('claude')
      );
      
      const instances = [];
      
      for (const process of claudeProcesses) {
        const configPath = await this.getClaudeConfigPath(process.pid);
        
        instances.push({
          type: 'claude-desktop',
          processId: process.pid,
          configPath,
          version: await this.getClaudeVersion(process.pid),
          metadata: {
            workspaces: await this.getClaudeWorkspaces(configPath),
            mcpConfigs: await this.getMcpConfigs(configPath)
          }
        });
      }
      
      return instances;
    } catch (error) {
      console.warn('Failed to detect Claude instances:', error.message);
      return [];
    }
  }

  /**
   * 检测 MCP 服务器实例
   */
  async detectMcpServers() {
    try {
      const instances = [];
      const commonPorts = [3456, 3457, 3458, 8080, 8081];
      
      for (const port of commonPorts) {
        try {
          const response = await fetch(`http://localhost:${port}/health`, {
            timeout: 2000
          });
          
          if (response.ok) {
            const info = await response.json().catch(() => ({}));
            
            instances.push({
              type: 'mcp-server',
              port,
              host: 'localhost',
              version: info.version,
              metadata: {
                tools: info.tools || [],
                resources: info.resources || [],
                uptime: info.uptime
              }
            });
          }
        } catch (error) {
          // 端口未开放，跳过
        }
      }
      
      return instances;
    } catch (error) {
      console.warn('Failed to detect MCP servers:', error.message);
      return [];
    }
  }

  // === 冲突解决策略 ===

  /**
   * 先到先得策略
   */
  async firstWinsStrategy(conflictingInstances, conflictType) {
    const sortedByTime = conflictingInstances.sort((a, b) => 
      a.registeredAt - b.registeredAt
    );
    
    return {
      primary: sortedByTime[0],
      secondary: sortedByTime.slice(1),
      action: 'primary-only'
    };
  }

  /**
   * 优先级策略
   */
  async priorityBasedStrategy(conflictingInstances, conflictType) {
    const priorityOrder = {
      'claude-desktop': 10,
      'mcp-server': 8,
      'chrome-window': 6
    };
    
    const sorted = conflictingInstances.sort((a, b) => 
      (priorityOrder[b.type] || 0) - (priorityOrder[a.type] || 0)
    );
    
    return {
      primary: sorted[0],
      secondary: sorted.slice(1),
      action: 'cascade-priority'
    };
  }

  /**
   * 协作策略 - 多实例协同工作
   */
  async collaborativeStrategy(conflictingInstances, conflictType) {
    // 根据冲突类型决定协作方式
    if (conflictType === 'port-conflict') {
      return this.resolvePortConflict(conflictingInstances);
    } else if (conflictType === 'resource-conflict') {
      return this.resolveResourceConflict(conflictingInstances);
    }
    
    // 默认：所有实例都保持活跃，通过资源共享协作
    return {
      primary: conflictingInstances[0],
      secondary: conflictingInstances.slice(1),
      action: 'collaborative',
      sharedResources: this.calculateSharedResources(conflictingInstances)
    };
  }

  /**
   * 用户选择策略
   */
  async userChoiceStrategy(conflictingInstances, conflictType) {
    // 简化版本：选择最新的实例
    // 实际实现中应该弹出用户选择界面
    const latest = conflictingInstances.reduce((latest, current) => 
      current.registeredAt > latest.registeredAt ? current : latest
    );
    
    return {
      primary: latest,
      secondary: conflictingInstances.filter(i => i.id !== latest.id),
      action: 'user-selected'
    };
  }

  // === 辅助方法 ===

  generateInstanceId(instanceInfo) {
    const typeConfig = this.instanceTypes[instanceInfo.type];
    const identifier = typeConfig?.identifier?.(instanceInfo) || instanceInfo.id;
    return `${instanceInfo.type}-${identifier}`;
  }

  discoverInstancesOfType(typeName, typeConfig) {
    return typeConfig.detector();
  }

  groupConflictingInstances() {
    const conflictGroups = new Map();
    const instancesByType = new Map();
    
    // 按类型分组
    for (const [instanceId, instance] of this.instances.entries()) {
      if (!instancesByType.has(instance.type)) {
        instancesByType.set(instance.type, []);
      }
      instancesByType.get(instance.type).push(instance);
    }
    
    // 检测冲突
    for (const [type, instances] of instancesByType.entries()) {
      if (instances.length > 1) {
        // 检查端口冲突
        const portConflicts = this.findPortConflicts(instances);
        if (portConflicts.length > 0) {
          conflictGroups.set('port-conflict', portConflicts);
        }
        
        // 检查资源冲突
        const resourceConflicts = this.findResourceConflicts(instances);
        if (resourceConflicts.length > 0) {
          conflictGroups.set('resource-conflict', resourceConflicts);
        }
        
        // 检查配置冲突
        const configConflicts = this.findConfigConflicts(instances);
        if (configConflicts.length > 0) {
          conflictGroups.set('config-conflict', configConflicts);
        }
      }
    }
    
    return conflictGroups;
  }

  findPortConflicts(instances) {
    const portGroups = new Map();
    
    for (const instance of instances) {
      if (instance.port) {
        if (!portGroups.has(instance.port)) {
          portGroups.set(instance.port, []);
        }
        portGroups.get(instance.port).push(instance);
      }
    }
    
    // 返回有冲突的实例
    return Array.from(portGroups.values())
      .filter(group => group.length > 1)
      .flat();
  }

  findResourceConflicts(instances) {
    // 检测资源访问冲突（如同时写入同一配置文件）
    const resourceGroups = new Map();
    
    for (const instance of instances) {
      for (const [resourceType, allocation] of instance.resources.entries()) {
        if (allocation.exclusive) {
          const key = `${resourceType}-${allocation.identifier}`;
          if (!resourceGroups.has(key)) {
            resourceGroups.set(key, []);
          }
          resourceGroups.get(key).push(instance);
        }
      }
    }
    
    return Array.from(resourceGroups.values())
      .filter(group => group.length > 1)
      .flat();
  }

  findConfigConflicts(instances) {
    // 检测配置文件冲突
    return instances.filter((instance, index) => {
      return instances.slice(index + 1).some(other => 
        instance.configPath === other.configPath
      );
    });
  }

  calculateResourceAllocation(instance, resourceType) {
    // 基础资源分配算法
    const baseAllocation = {
      type: resourceType,
      identifier: `${instance.id}-${resourceType}`,
      exclusive: false,
      quota: 100,
      priority: 1
    };
    
    // 根据实例类型和资源类型调整分配
    const adjustments = {
      'mcp-server': {
        'connections': { exclusive: true, quota: 50 },
        'tools': { exclusive: false, quota: 100 },
        'cache': { exclusive: true, quota: 200 }
      },
      'chrome-window': {
        'gmail-tabs': { exclusive: false, quota: 10 },
        'extensions': { exclusive: false, quota: 20 }
      },
      'claude-desktop': {
        'mcp-configs': { exclusive: true, quota: 1 },
        'workspace': { exclusive: true, quota: 1 }
      }
    };
    
    const typeAdjustments = adjustments[instance.type]?.[resourceType] || {};
    return { ...baseAllocation, ...typeAdjustments };
  }

  startMonitoring() {
    // 定期清理死实例
    this.cleanupTimer = setInterval(() => {
      this.cleanupDeadInstances();
    }, this.config.cleanupInterval);
    
    // 定期心跳检查
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeatCheck();
    }, this.config.heartbeatInterval);
  }

  stopMonitoring() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async cleanupDeadInstances() {
    const deadInstances = [];
    
    for (const [instanceId, instance] of this.instances.entries()) {
      const isAlive = await this.checkInstanceAlive(instance);
      if (!isAlive) {
        deadInstances.push(instanceId);
      }
    }
    
    // 清理死实例
    for (const instanceId of deadInstances) {
      const instance = this.instances.get(instanceId);
      this.unregisterInstance(instanceId);
      this.emit('instance-died', instance);
      console.log(`Cleaned up dead instance: ${instanceId}`);
    }
  }

  async checkInstanceAlive(instance) {
    try {
      switch (instance.type) {
        case 'chrome-window':
          return this.checkChromeAlive(instance);
        case 'claude-desktop':
          return this.checkClaudeAlive(instance);
        case 'mcp-server':
          return this.checkMcpServerAlive(instance);
        default:
          return true;
      }
    } catch (error) {
      return false;
    }
  }

  async checkMcpServerAlive(instance) {
    try {
      const response = await fetch(`http://${instance.host}:${instance.port}/health`, {
        timeout: 3000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  unregisterInstance(instanceId) {
    const instance = this.instances.get(instanceId);
    if (instance) {
      // 释放资源
      for (const [resourceType] of instance.resources.entries()) {
        this.resourceAllocations.get(resourceType)?.delete(instanceId);
      }
      
      // 关闭通信
      const channel = this.communicationChannels.get(instanceId);
      if (channel) {
        channel.close();
        this.communicationChannels.delete(instanceId);
      }
      
      this.instances.delete(instanceId);
      this.emit('instance-unregistered', instance);
    }
  }

  // === 通信相关方法（简化版） ===

  async establishCommunicationChannels() {
    // 为每个实例建立通信通道的简化实现
    for (const [instanceId, instance] of this.instances.entries()) {
      const channel = {
        id: instanceId,
        type: instance.type,
        send: (message) => this.sendMessage(instance, message),
        close: () => this.closeChannel(instanceId)
      };
      
      this.communicationChannels.set(instanceId, channel);
    }
  }

  async closeCommunicationChannels() {
    for (const channel of this.communicationChannels.values()) {
      channel.close();
    }
    this.communicationChannels.clear();
  }

  // === 系统工具方法（平台相关） ===

  getSystemProcesses() {
    try {
      const output = process.platform === 'win32' ? 
        execSync('tasklist /fo csv', { encoding: 'utf8' }) :
        execSync('ps aux', { encoding: 'utf8' });
      
      return this.parseProcessList(output);
    } catch (error) {
      console.warn('Failed to get system processes:', error.message);
      return [];
    }
  }

  parseProcessList(output) {
    // 简化的进程解析
    const lines = output.split('\n');
    const processes = [];
    
    for (const line of lines) {
      if (line.trim()) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          processes.push({
            pid: parseInt(parts[1]) || 0,
            name: parts[0] || '',
            command: line
          });
        }
      }
    }
    
    return processes.filter(p => p.pid > 0);
  }

  /**
   * 获取系统状态概览
   */
  getSystemOverview() {
    const overview = {
      totalInstances: this.instances.size,
      instancesByType: {},
      conflictsResolved: 0,
      resourceUtilization: {},
      communicationChannels: this.communicationChannels.size
    };

    // 按类型统计实例
    for (const instance of this.instances.values()) {
      overview.instancesByType[instance.type] = 
        (overview.instancesByType[instance.type] || 0) + 1;
    }

    // 统计资源利用率
    for (const [resourceType, allocations] of this.resourceAllocations.entries()) {
      overview.resourceUtilization[resourceType] = {
        allocated: allocations.size,
        totalQuota: Array.from(allocations.values())
          .reduce((sum, allocation) => sum + allocation.quota, 0)
      };
    }

    return overview;
  }
}

export default InstanceManager;