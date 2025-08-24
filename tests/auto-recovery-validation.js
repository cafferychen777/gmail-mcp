/**
 * Gmail MCP Bridge - 自动恢复系统验证测试
 * 
 * 专门验证 95% 错误自动恢复率目标
 * 
 * 基于 Linus 的可靠性哲学：
 * - "系统必须在故障时优雅降级"
 * - "恢复机制要简单可靠，不能比原始问题更复杂"
 * - "测试真实的故障场景，不是理论上的"
 * 
 * @author Gmail MCP Bridge Team
 * @version 2.0.0
 */

const { EventEmitter } = require('events');

/**
 * 故障注入器 - 模拟真实世界的各种故障
 */
class FaultInjector {
  constructor() {
    this.faults = new Map();
    this.activeNodes = new Set();
    this.faultHistory = [];
  }
  
  // 注册故障类型和对应的注入方法
  registerFaultType(faultCode, injectionMethod) {
    this.faults.set(faultCode, {
      code: faultCode,
      inject: injectionMethod,
      count: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0
    });
  }
  
  // 注入特定故障
  async injectFault(faultCode, target, context = {}) {
    const faultConfig = this.faults.get(faultCode);
    if (!faultConfig) {
      throw new Error(`Unknown fault type: ${faultCode}`);
    }
    
    const faultInstance = {
      id: `${faultCode}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      code: faultCode,
      target: target,
      context: context,
      injectedAt: Date.now(),
      resolved: false,
      recoveryAttempts: 0
    };
    
    this.faultHistory.push(faultInstance);
    faultConfig.count++;
    
    try {
      await faultConfig.inject(target, context);
      return faultInstance;
    } catch (error) {
      faultInstance.injectionError = error.message;
      throw error;
    }
  }
  
  // 标记故障已恢复
  markFaultRecovered(faultId, successful = true) {
    const fault = this.faultHistory.find(f => f.id === faultId);
    if (fault) {
      fault.resolved = true;
      fault.recoveredAt = Date.now();
      fault.recoveryTime = fault.recoveredAt - fault.injectedAt;
      
      const faultConfig = this.faults.get(fault.code);
      if (faultConfig) {
        if (successful) {
          faultConfig.successfulRecoveries++;
        } else {
          faultConfig.failedRecoveries++;
        }
      }
    }
  }
  
  // 获取恢复统计
  getRecoveryStats() {
    const stats = {
      totalFaults: this.faultHistory.length,
      resolvedFaults: this.faultHistory.filter(f => f.resolved).length,
      averageRecoveryTime: 0,
      byFaultType: {}
    };
    
    // 计算平均恢复时间
    const resolvedFaults = this.faultHistory.filter(f => f.resolved && f.recoveryTime);
    if (resolvedFaults.length > 0) {
      stats.averageRecoveryTime = Math.round(
        resolvedFaults.reduce((sum, f) => sum + f.recoveryTime, 0) / resolvedFaults.length
      );
    }
    
    // 按故障类型统计
    for (const [code, config] of this.faults) {
      const total = config.count;
      const successful = config.successfulRecoveries;
      const failed = config.failedRecoveries;
      
      stats.byFaultType[code] = {
        total: total,
        successfulRecoveries: successful,
        failedRecoveries: failed,
        recoveryRate: total > 0 ? ((successful / total) * 100).toFixed(1) : 0,
        pending: total - successful - failed
      };
    }
    
    stats.overallRecoveryRate = stats.totalFaults > 0 ? 
      ((stats.resolvedFaults / stats.totalFaults) * 100).toFixed(1) : 0;
    
    return stats;
  }
}

/**
 * 恢复验证器 - 验证自动恢复的有效性
 */
class RecoveryValidator {
  constructor() {
    this.validationRules = new Map();
    this.validationResults = [];
  }
  
  // 注册验证规则
  registerValidationRule(faultCode, validator) {
    this.validationRules.set(faultCode, validator);
  }
  
  // 验证恢复是否真正有效
  async validateRecovery(faultCode, target, context = {}) {
    const validator = this.validationRules.get(faultCode);
    if (!validator) {
      return { valid: false, reason: 'No validator defined' };
    }
    
    try {
      const result = await validator(target, context);
      
      this.validationResults.push({
        faultCode,
        target,
        valid: result.valid,
        reason: result.reason,
        timestamp: Date.now(),
        context
      });
      
      return result;
    } catch (error) {
      const result = { valid: false, reason: `Validation error: ${error.message}` };
      
      this.validationResults.push({
        faultCode,
        target,
        valid: false,
        reason: result.reason,
        timestamp: Date.now(),
        context
      });
      
      return result;
    }
  }
  
  // 获取验证统计
  getValidationStats() {
    const total = this.validationResults.length;
    const valid = this.validationResults.filter(r => r.valid).length;
    
    return {
      totalValidations: total,
      validRecoveries: valid,
      invalidRecoveries: total - valid,
      validationRate: total > 0 ? ((valid / total) * 100).toFixed(1) : 0,
      byFaultType: this._groupValidationsByFaultType()
    };
  }
  
  _groupValidationsByFaultType() {
    const grouped = {};
    
    for (const result of this.validationResults) {
      if (!grouped[result.faultCode]) {
        grouped[result.faultCode] = { total: 0, valid: 0 };
      }
      
      grouped[result.faultCode].total++;
      if (result.valid) {
        grouped[result.faultCode].valid++;
      }
    }
    
    // 计算各类型的验证率
    for (const faultCode in grouped) {
      const stats = grouped[faultCode];
      stats.validationRate = ((stats.valid / stats.total) * 100).toFixed(1);
    }
    
    return grouped;
  }
}

// 导入要测试的组件
const { SystemState } = require('../gmail-mcp-extension/src/core/system-state.js');
const { IntelligentErrorHandler } = require('../gmail-mcp-extension/src/core/error-handler.js');
const { AutoRecoveryEngine } = require('../gmail-mcp-extension/src/core/auto-recovery.js');

/**
 * 自动恢复验证测试套件
 */
class AutoRecoveryValidationSuite {
  constructor() {
    this.faultInjector = new FaultInjector();
    this.recoveryValidator = new RecoveryValidator();
    this.testResults = {
      scenarios: [],
      overallStats: null,
      targetMet: false
    };
    
    this.setupFaultTypes();
    this.setupValidationRules();
  }
  
  setupFaultTypes() {
    // Chrome Extension 故障
    this.faultInjector.registerFaultType('CHROME_EXTENSION_NOT_FOUND', async (target, context) => {
      // 模拟扩展连接丢失
      if (context.mockChromeRuntime) {
        context.mockChromeRuntime.connected = false;
        context.mockChromeRuntime.lastError = 'Extension context invalidated';
      }
      
      target.updateComponent('chromeExtension', {
        status: 'disconnected',
        isConnected: false,
        lastError: 'Extension not found'
      });
    });
    
    // Bridge Server 故障
    this.faultInjector.registerFaultType('BRIDGE_SERVER_UNAVAILABLE', async (target, context) => {
      // 模拟服务器无法访问
      if (context.mockServer) {
        context.mockServer.running = false;
        context.mockServer.responseCode = 'ECONNREFUSED';
      }
      
      target.updateComponent('bridgeServer', {
        status: 'error',
        lastHeartbeat: null,
        error: 'Connection refused'
      });
    });
    
    // MCP Server 故障
    this.faultInjector.registerFaultType('MCP_SERVER_NOT_RUNNING', async (target, context) => {
      // 模拟MCP服务器进程停止
      target.updateComponent('mcpServer', {
        status: 'stopped',
        pid: null,
        lastCheck: Date.now(),
        error: 'Process not found'
      });
    });
    
    // Gmail Tab 故障
    this.faultInjector.registerFaultType('GMAIL_TAB_NOT_FOUND', async (target, context) => {
      // 模拟Gmail标签页丢失
      target.updateComponent('gmailTabs', {
        status: 'inactive',
        activeTab: null,
        registeredTabs: [],
        error: 'No Gmail tabs found'
      });
    });
    
    // 网络故障
    this.faultInjector.registerFaultType('NETWORK_CONNECTIVITY_LOST', async (target, context) => {
      // 模拟网络连接丢失
      if (context.networkSimulator) {
        context.networkSimulator.connected = false;
        context.networkSimulator.latency = Infinity;
      }
      
      // 影响多个组件
      target.updateComponent('bridgeServer', { status: 'disconnected', networkError: true });
      target.updateComponent('mcpServer', { status: 'unreachable', networkError: true });
    });
    
    // 资源耗尽
    this.faultInjector.registerFaultType('RESOURCE_EXHAUSTION', async (target, context) => {
      // 模拟系统资源耗尽
      target.updateComponent('mcpServer', {
        status: 'overloaded',
        memoryUsage: 95, // 95%
        error: 'Out of memory'
      });
    });
  }
  
  setupValidationRules() {
    // Chrome Extension 恢复验证
    this.recoveryValidator.registerValidationRule('CHROME_EXTENSION_NOT_FOUND', async (target, context) => {
      const component = target.getComponent('chromeExtension');
      
      if (!component) {
        return { valid: false, reason: 'Component not found' };
      }
      
      // 验证扩展是否重新连接
      const isRecovered = component.status === 'connected' && 
                         component.isConnected === true &&
                         !component.error;
      
      return {
        valid: isRecovered,
        reason: isRecovered ? 'Extension reconnected successfully' : 
                `Status: ${component.status}, Connected: ${component.isConnected}`
      };
    });
    
    // Bridge Server 恢复验证
    this.recoveryValidator.registerValidationRule('BRIDGE_SERVER_UNAVAILABLE', async (target, context) => {
      const component = target.getComponent('bridgeServer');
      
      if (!component) {
        return { valid: false, reason: 'Component not found' };
      }
      
      // 验证服务器是否恢复运行
      const isRecovered = component.status === 'running' && 
                         component.lastHeartbeat !== null &&
                         !component.error;
      
      return {
        valid: isRecovered,
        reason: isRecovered ? 'Bridge server restored' : 
                `Status: ${component.status}, Heartbeat: ${component.lastHeartbeat}`
      };
    });
    
    // MCP Server 恢复验证
    this.recoveryValidator.registerValidationRule('MCP_SERVER_NOT_RUNNING', async (target, context) => {
      const component = target.getComponent('mcpServer');
      
      if (!component) {
        return { valid: false, reason: 'Component not found' };
      }
      
      // 验证MCP服务器是否重新启动
      const isRecovered = component.status === 'running' && 
                         component.pid !== null &&
                         !component.error;
      
      return {
        valid: isRecovered,
        reason: isRecovered ? 'MCP server restarted' : 
                `Status: ${component.status}, PID: ${component.pid}`
      };
    });
    
    // Gmail Tab 恢复验证
    this.recoveryValidator.registerValidationRule('GMAIL_TAB_NOT_FOUND', async (target, context) => {
      const component = target.getComponent('gmailTabs');
      
      if (!component) {
        return { valid: false, reason: 'Component not found' };
      }
      
      // Gmail标签页问题通常需要用户手动操作，自动恢复成功率较低
      const isRecovered = component.status === 'active' && 
                         (component.activeTab !== null || component.registeredTabs.length > 0);
      
      return {
        valid: isRecovered,
        reason: isRecovered ? 'Gmail tabs restored' : 
                `Status: ${component.status}, Active tab: ${component.activeTab}`
      };
    });
    
    // 网络连接恢复验证
    this.recoveryValidator.registerValidationRule('NETWORK_CONNECTIVITY_LOST', async (target, context) => {
      const bridgeServer = target.getComponent('bridgeServer');
      const mcpServer = target.getComponent('mcpServer');
      
      // 网络恢复后，相关组件应该重新连接
      const bridgeRecovered = bridgeServer && !bridgeServer.networkError;
      const mcpRecovered = mcpServer && !mcpServer.networkError;
      
      return {
        valid: bridgeRecovered && mcpRecovered,
        reason: bridgeRecovered && mcpRecovered ? 'Network connectivity restored' : 
                `Bridge: ${bridgeRecovered}, MCP: ${mcpRecovered}`
      };
    });
    
    // 资源恢复验证
    this.recoveryValidator.registerValidationRule('RESOURCE_EXHAUSTION', async (target, context) => {
      const component = target.getComponent('mcpServer');
      
      if (!component) {
        return { valid: false, reason: 'Component not found' };
      }
      
      // 验证资源使用是否恢复正常
      const isRecovered = component.status === 'running' && 
                         (component.memoryUsage === undefined || component.memoryUsage < 80) &&
                         !component.error;
      
      return {
        valid: isRecovered,
        reason: isRecovered ? 'Resources recovered' : 
                `Status: ${component.status}, Memory: ${component.memoryUsage}%`
      };
    });
  }
  
  async runValidationSuite() {
    console.log('🎯 开始自动恢复系统验证 - 目标: 95% 恢复率\n');
    
    // 场景1: 单一故障恢复测试
    await this.testSingleFaultRecovery();
    
    // 场景2: 多重故障恢复测试
    await this.testMultipleFaultRecovery();
    
    // 场景3: 连续故障恢复测试
    await this.testContinuousFaultRecovery();
    
    // 场景4: 并发故障恢复测试
    await this.testConcurrentFaultRecovery();
    
    // 场景5: 恢复失败重试测试
    await this.testRecoveryRetryLogic();
    
    // 场景6: 熔断器恢复测试
    await this.testCircuitBreakerRecovery();
    
    // 生成最终报告
    this.generateRecoveryReport();
    
    return this.testResults;
  }
  
  async testSingleFaultRecovery() {
    console.log('📋 场景1: 单一故障恢复测试...');
    
    const state = new SystemState();
    const handler = new IntelligentErrorHandler(state);
    const recovery = new AutoRecoveryEngine(state, handler);
    
    const faultTypes = [
      'CHROME_EXTENSION_NOT_FOUND',
      'BRIDGE_SERVER_UNAVAILABLE', 
      'MCP_SERVER_NOT_RUNNING',
      'GMAIL_TAB_NOT_FOUND',
      'RESOURCE_EXHAUSTION'
    ];
    
    const scenarioResults = {
      name: 'Single Fault Recovery',
      totalTests: 0,
      successfulRecoveries: 0,
      validatedRecoveries: 0,
      faults: []
    };
    
    for (const faultType of faultTypes) {
      for (let attempt = 0; attempt < 10; attempt++) { // 每种故障测试10次
        scenarioResults.totalTests++;
        
        try {
          // 注入故障
          const fault = await this.faultInjector.injectFault(faultType, state, {
            attempt: attempt,
            mockChromeRuntime: { connected: true },
            mockServer: { running: true }
          });
          
          // 等待一小段时间让故障生效
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 尝试自动恢复
          const recoveryResult = await recovery.recoverComponent(
            this.getComponentForFault(faultType), 
            { code: faultType, attempt: attempt }
          );
          
          // 记录恢复结果
          if (recoveryResult.success) {
            scenarioResults.successfulRecoveries++;
            this.faultInjector.markFaultRecovered(fault.id, true);
            
            // 验证恢复有效性
            const validation = await this.recoveryValidator.validateRecovery(faultType, state);
            if (validation.valid) {
              scenarioResults.validatedRecoveries++;
            }
          } else {
            this.faultInjector.markFaultRecovered(fault.id, false);
          }
          
          scenarioResults.faults.push({
            type: faultType,
            attempt: attempt,
            recovered: recoveryResult.success,
            validated: recoveryResult.success ? 
              (await this.recoveryValidator.validateRecovery(faultType, state)).valid : false
          });
          
        } catch (error) {
          console.log(`   ⚠️ 故障注入/恢复失败: ${faultType} (尝试 ${attempt}): ${error.message}`);
        }
        
        // 重置状态为正常
        this.resetSystemState(state);
      }
    }
    
    this.testResults.scenarios.push(scenarioResults);
    
    const recoveryRate = (scenarioResults.successfulRecoveries / scenarioResults.totalTests * 100).toFixed(1);
    const validationRate = (scenarioResults.validatedRecoveries / scenarioResults.totalTests * 100).toFixed(1);
    
    console.log(`   ✅ 恢复率: ${recoveryRate}% (${scenarioResults.successfulRecoveries}/${scenarioResults.totalTests})`);
    console.log(`   🔍 验证率: ${validationRate}% (${scenarioResults.validatedRecoveries}/${scenarioResults.totalTests})`);
  }
  
  async testMultipleFaultRecovery() {
    console.log('📋 场景2: 多重故障恢复测试...');
    
    const state = new SystemState();
    const handler = new IntelligentErrorHandler(state);
    const recovery = new AutoRecoveryEngine(state, handler);
    
    const scenarioResults = {
      name: 'Multiple Fault Recovery',
      totalTests: 0,
      successfulRecoveries: 0,
      validatedRecoveries: 0,
      faultCombinations: []
    };
    
    // 测试故障组合
    const faultCombinations = [
      ['CHROME_EXTENSION_NOT_FOUND', 'BRIDGE_SERVER_UNAVAILABLE'],
      ['MCP_SERVER_NOT_RUNNING', 'GMAIL_TAB_NOT_FOUND'],
      ['BRIDGE_SERVER_UNAVAILABLE', 'RESOURCE_EXHAUSTION'],
      ['CHROME_EXTENSION_NOT_FOUND', 'MCP_SERVER_NOT_RUNNING', 'BRIDGE_SERVER_UNAVAILABLE']
    ];
    
    for (const combination of faultCombinations) {
      for (let test = 0; test < 5; test++) { // 每种组合测试5次
        scenarioResults.totalTests++;
        
        const faultInstances = [];
        let allRecovered = true;
        let allValidated = true;
        
        try {
          // 同时注入多个故障
          for (const faultType of combination) {
            const fault = await this.faultInjector.injectFault(faultType, state, {
              test: test,
              combination: combination.join('+')
            });
            faultInstances.push({ fault, type: faultType });
          }
          
          // 等待故障生效
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // 尝试恢复所有故障
          for (const { fault, type } of faultInstances) {
            const recoveryResult = await recovery.recoverComponent(
              this.getComponentForFault(type),
              { code: type, test: test }
            );
            
            if (recoveryResult.success) {
              this.faultInjector.markFaultRecovered(fault.id, true);
              
              // 验证恢复
              const validation = await this.recoveryValidator.validateRecovery(type, state);
              if (!validation.valid) {
                allValidated = false;
              }
            } else {
              allRecovered = false;
              this.faultInjector.markFaultRecovered(fault.id, false);
            }
          }
          
          if (allRecovered) {
            scenarioResults.successfulRecoveries++;
            if (allValidated) {
              scenarioResults.validatedRecoveries++;
            }
          }
          
          scenarioResults.faultCombinations.push({
            combination: combination.join('+'),
            test: test,
            allRecovered: allRecovered,
            allValidated: allValidated
          });
          
        } catch (error) {
          console.log(`   ⚠️ 多重故障测试失败: ${combination.join('+')} (测试 ${test}): ${error.message}`);
        }
        
        // 重置状态
        this.resetSystemState(state);
      }
    }
    
    this.testResults.scenarios.push(scenarioResults);
    
    const recoveryRate = (scenarioResults.successfulRecoveries / scenarioResults.totalTests * 100).toFixed(1);
    const validationRate = (scenarioResults.validatedRecoveries / scenarioResults.totalTests * 100).toFixed(1);
    
    console.log(`   ✅ 多重故障恢复率: ${recoveryRate}% (${scenarioResults.successfulRecoveries}/${scenarioResults.totalTests})`);
    console.log(`   🔍 多重故障验证率: ${validationRate}% (${scenarioResults.validatedRecoveries}/${scenarioResults.totalTests})`);
  }
  
  async testContinuousFaultRecovery() {
    console.log('📋 场景3: 连续故障恢复测试...');
    
    const state = new SystemState();
    const handler = new IntelligentErrorHandler(state);
    const recovery = new AutoRecoveryEngine(state, handler);
    
    const scenarioResults = {
      name: 'Continuous Fault Recovery',
      totalTests: 100, // 连续100个故障
      successfulRecoveries: 0,
      validatedRecoveries: 0,
      faultSequence: []
    };
    
    const faultTypes = [
      'CHROME_EXTENSION_NOT_FOUND',
      'BRIDGE_SERVER_UNAVAILABLE',
      'MCP_SERVER_NOT_RUNNING',
      'RESOURCE_EXHAUSTION'
    ];
    
    // 连续故障测试
    for (let i = 0; i < scenarioResults.totalTests; i++) {
      const faultType = faultTypes[i % faultTypes.length];
      
      try {
        // 注入故障
        const fault = await this.faultInjector.injectFault(faultType, state, {
          sequence: i,
          continuous: true
        });
        
        // 短暂延迟
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 尝试恢复
        const recoveryResult = await recovery.recoverComponent(
          this.getComponentForFault(faultType),
          { code: faultType, sequence: i }
        );
        
        let validated = false;
        if (recoveryResult.success) {
          scenarioResults.successfulRecoveries++;
          this.faultInjector.markFaultRecovered(fault.id, true);
          
          // 验证恢复
          const validation = await this.recoveryValidator.validateRecovery(faultType, state);
          if (validation.valid) {
            scenarioResults.validatedRecoveries++;
            validated = true;
          }
        } else {
          this.faultInjector.markFaultRecovered(fault.id, false);
        }
        
        scenarioResults.faultSequence.push({
          index: i,
          type: faultType,
          recovered: recoveryResult.success,
          validated: validated
        });
        
        // 每10个故障后稍作停顿，模拟真实场景
        if (i % 10 === 9) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
      } catch (error) {
        console.log(`   ⚠️ 连续故障 ${i} 失败: ${faultType}: ${error.message}`);
      }
    }
    
    this.testResults.scenarios.push(scenarioResults);
    
    const recoveryRate = (scenarioResults.successfulRecoveries / scenarioResults.totalTests * 100).toFixed(1);
    const validationRate = (scenarioResults.validatedRecoveries / scenarioResults.totalTests * 100).toFixed(1);
    
    console.log(`   ✅ 连续故障恢复率: ${recoveryRate}% (${scenarioResults.successfulRecoveries}/${scenarioResults.totalTests})`);
    console.log(`   🔍 连续故障验证率: ${validationRate}% (${scenarioResults.validatedRecoveries}/${scenarioResults.totalTests})`);
  }
  
  async testConcurrentFaultRecovery() {
    console.log('📋 场景4: 并发故障恢复测试...');
    
    const state = new SystemState();
    const handler = new IntelligentErrorHandler(state);
    const recovery = new AutoRecoveryEngine(state, handler);
    
    const scenarioResults = {
      name: 'Concurrent Fault Recovery',
      totalTests: 50,
      successfulRecoveries: 0,
      validatedRecoveries: 0,
      concurrentFaults: []
    };
    
    // 并发故障测试
    const concurrentPromises = [];
    
    for (let i = 0; i < scenarioResults.totalTests; i++) {
      const faultType = ['CHROME_EXTENSION_NOT_FOUND', 'BRIDGE_SERVER_UNAVAILABLE'][i % 2];
      
      const concurrentTest = async (index, type) => {
        try {
          // 注入故障
          const fault = await this.faultInjector.injectFault(type, state, {
            concurrent: true,
            index: index
          });
          
          // 立即尝试恢复（无延迟，测试并发处理）
          const recoveryResult = await recovery.recoverComponent(
            this.getComponentForFault(type),
            { code: type, concurrent: true, index: index }
          );
          
          let validated = false;
          if (recoveryResult.success) {
            this.faultInjector.markFaultRecovered(fault.id, true);
            
            // 验证恢复
            const validation = await this.recoveryValidator.validateRecovery(type, state);
            validated = validation.valid;
          } else {
            this.faultInjector.markFaultRecovered(fault.id, false);
          }
          
          return { index, type, recovered: recoveryResult.success, validated };
          
        } catch (error) {
          console.log(`   ⚠️ 并发故障 ${index} 失败: ${type}: ${error.message}`);
          return { index, type, recovered: false, validated: false };
        }
      };
      
      concurrentPromises.push(concurrentTest(i, faultType));
    }
    
    // 等待所有并发测试完成
    const results = await Promise.all(concurrentPromises);
    
    // 统计结果
    for (const result of results) {
      if (result.recovered) {
        scenarioResults.successfulRecoveries++;
      }
      if (result.validated) {
        scenarioResults.validatedRecoveries++;
      }
      scenarioResults.concurrentFaults.push(result);
    }
    
    this.testResults.scenarios.push(scenarioResults);
    
    const recoveryRate = (scenarioResults.successfulRecoveries / scenarioResults.totalTests * 100).toFixed(1);
    const validationRate = (scenarioResults.validatedRecoveries / scenarioResults.totalTests * 100).toFixed(1);
    
    console.log(`   ✅ 并发故障恢复率: ${recoveryRate}% (${scenarioResults.successfulRecoveries}/${scenarioResults.totalTests})`);
    console.log(`   🔍 并发故障验证率: ${validationRate}% (${scenarioResults.validatedRecoveries}/${scenarioResults.totalTests})`);
  }
  
  async testRecoveryRetryLogic() {
    console.log('📋 场景5: 恢复失败重试测试...');
    
    const state = new SystemState();
    const handler = new IntelligentErrorHandler(state);
    const recovery = new AutoRecoveryEngine(state, handler);
    
    // 测试重试机制 - 模拟间歇性故障
    const scenarioResults = {
      name: 'Recovery Retry Logic',
      totalTests: 20,
      successfulRecoveries: 0,
      retriedRecoveries: 0,
      retryStats: []
    };
    
    for (let i = 0; i < scenarioResults.totalTests; i++) {
      const faultType = 'BRIDGE_SERVER_UNAVAILABLE';
      
      try {
        // 注入间歇性故障
        const fault = await this.faultInjector.injectFault(faultType, state, {
          intermittent: true,
          failureProbability: 0.7 // 70% 概率失败
        });
        
        let retryCount = 0;
        let recovered = false;
        const maxRetries = 3;
        
        // 重试恢复
        while (!recovered && retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1))); // 递增延迟
          
          const recoveryResult = await recovery.recoverComponent(
            'bridgeServer',
            { code: faultType, retry: retryCount }
          );
          
          retryCount++;
          
          if (recoveryResult.success) {
            recovered = true;
            scenarioResults.successfulRecoveries++;
            if (retryCount > 1) {
              scenarioResults.retriedRecoveries++;
            }
            this.faultInjector.markFaultRecovered(fault.id, true);
          }
        }
        
        scenarioResults.retryStats.push({
          test: i,
          recovered: recovered,
          retryCount: retryCount - (recovered ? 1 : 0)
        });
        
      } catch (error) {
        console.log(`   ⚠️ 重试测试 ${i} 失败: ${error.message}`);
      }
    }
    
    this.testResults.scenarios.push(scenarioResults);
    
    const recoveryRate = (scenarioResults.successfulRecoveries / scenarioResults.totalTests * 100).toFixed(1);
    const retrySuccessRate = scenarioResults.retriedRecoveries > 0 ? 
      ((scenarioResults.retriedRecoveries / scenarioResults.successfulRecoveries) * 100).toFixed(1) : 0;
    
    console.log(`   ✅ 重试恢复率: ${recoveryRate}% (${scenarioResults.successfulRecoveries}/${scenarioResults.totalTests})`);
    console.log(`   🔄 重试成功率: ${retrySuccessRate}% (${scenarioResults.retriedRecoveries} 通过重试恢复)`);
  }
  
  async testCircuitBreakerRecovery() {
    console.log('📋 场景6: 熔断器恢复测试...');
    
    const state = new SystemState();
    const handler = new IntelligentErrorHandler(state);
    const recovery = new AutoRecoveryEngine(state, handler);
    
    const scenarioResults = {
      name: 'Circuit Breaker Recovery',
      totalTests: 30,
      circuitOpenEvents: 0,
      recoveryAfterCircuitOpen: 0,
      circuitTests: []
    };
    
    const faultType = 'CHROME_EXTENSION_NOT_FOUND';
    
    // 触发熔断器
    for (let i = 0; i < scenarioResults.totalTests; i++) {
      try {
        await this.faultInjector.injectFault(faultType, state, { circuitTest: i });
        
        const recoveryResult = await recovery.recoverComponent('chromeExtension', { 
          code: faultType, 
          circuitTest: i 
        });
        
        scenarioResults.circuitTests.push({
          test: i,
          recovered: recoveryResult.success,
          reason: recoveryResult.reason || 'normal',
          circuitOpen: recoveryResult.reason === 'circuit_breaker_open'
        });
        
        if (recoveryResult.reason === 'circuit_breaker_open') {
          scenarioResults.circuitOpenEvents++;
          
          // 等待熔断器重置时间
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // 尝试恢复
          const retryResult = await recovery.recoverComponent('chromeExtension', {
            code: faultType,
            afterCircuitOpen: true
          });
          
          if (retryResult.success) {
            scenarioResults.recoveryAfterCircuitOpen++;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        console.log(`   ⚠️ 熔断器测试 ${i} 失败: ${error.message}`);
      }
    }
    
    this.testResults.scenarios.push(scenarioResults);
    
    const circuitEffectivenessRate = scenarioResults.circuitOpenEvents > 0 ?
      ((scenarioResults.recoveryAfterCircuitOpen / scenarioResults.circuitOpenEvents) * 100).toFixed(1) : 0;
    
    console.log(`   🔄 熔断器触发: ${scenarioResults.circuitOpenEvents} 次`);
    console.log(`   ✅ 熔断后恢复: ${circuitEffectivenessRate}% (${scenarioResults.recoveryAfterCircuitOpen}/${scenarioResults.circuitOpenEvents})`);
  }
  
  generateRecoveryReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 自动恢复系统验证报告');
    console.log('='.repeat(80));
    
    // 计算总体统计
    let totalTests = 0;
    let totalRecoveries = 0;
    let totalValidated = 0;
    
    for (const scenario of this.testResults.scenarios) {
      totalTests += scenario.totalTests || 0;
      totalRecoveries += scenario.successfulRecoveries || 0;
      totalValidated += scenario.validatedRecoveries || 0;
    }
    
    const overallRecoveryRate = totalTests > 0 ? ((totalRecoveries / totalTests) * 100).toFixed(1) : 0;
    const overallValidationRate = totalTests > 0 ? ((totalValidated / totalTests) * 100).toFixed(1) : 0;
    
    console.log('\n📊 总体统计:');
    console.log(`   总测试数: ${totalTests}`);
    console.log(`   成功恢复: ${totalRecoveries}`);
    console.log(`   验证通过: ${totalValidated}`);
    console.log(`   恢复率: ${overallRecoveryRate}%`);
    console.log(`   验证率: ${overallValidationRate}%`);
    
    // 按场景统计
    console.log('\n📋 场景统计:');
    for (const scenario of this.testResults.scenarios) {
      const rate = scenario.totalTests > 0 ? 
        ((scenario.successfulRecoveries / scenario.totalTests) * 100).toFixed(1) : 0;
      console.log(`   ${scenario.name}: ${rate}% (${scenario.successfulRecoveries}/${scenario.totalTests})`);
    }
    
    // 故障类型统计
    const faultStats = this.faultInjector.getRecoveryStats();
    console.log('\n🔧 故障类型统计:');
    for (const [faultCode, stats] of Object.entries(faultStats.byFaultType)) {
      console.log(`   ${faultCode}: ${stats.recoveryRate}% (${stats.successfulRecoveries}/${stats.total})`);
    }
    
    // 验证统计
    const validationStats = this.recoveryValidator.getValidationStats();
    console.log('\n🔍 验证统计:');
    console.log(`   总验证: ${validationStats.totalValidations}`);
    console.log(`   验证通过: ${validationStats.validRecoveries}`);
    console.log(`   验证率: ${validationStats.validationRate}%`);
    
    // 目标达成判断
    const targetMet = parseFloat(overallRecoveryRate) >= 95.0;
    this.testResults.targetMet = targetMet;
    this.testResults.overallStats = {
      totalTests,
      totalRecoveries,
      totalValidated,
      overallRecoveryRate: parseFloat(overallRecoveryRate),
      overallValidationRate: parseFloat(overallValidationRate)
    };
    
    console.log('\n' + '='.repeat(80));
    console.log('💀 LINUS 式最终判断');
    console.log('='.repeat(80));
    
    if (targetMet) {
      console.log('🟢 "这恢复系统有好品味！95% 目标达成。"');
      console.log('   "用户不会因为故障而抱怨，系统会自己修复。"');
    } else if (parseFloat(overallRecoveryRate) >= 85) {
      console.log('🟡 "恢复率凑合，但还没达到 95% 目标。"'); 
      console.log('   "优化那些失败的恢复策略，用更简单的方法。"');
    } else {
      console.log('🔴 "这恢复系统是垃圾！连 85% 都达不到。"');
      console.log('   "重新设计恢复算法，用户空间不能被破坏。"');
    }
    
    console.log(`\n🎯 目标达成: ${targetMet ? '✅ 是' : '❌ 否'} (目标: 95%, 实际: ${overallRecoveryRate}%)`);
    
    return this.testResults;
  }
  
  // 辅助方法
  getComponentForFault(faultType) {
    const mapping = {
      'CHROME_EXTENSION_NOT_FOUND': 'chromeExtension',
      'BRIDGE_SERVER_UNAVAILABLE': 'bridgeServer',
      'MCP_SERVER_NOT_RUNNING': 'mcpServer',
      'GMAIL_TAB_NOT_FOUND': 'gmailTabs',
      'NETWORK_CONNECTIVITY_LOST': 'bridgeServer',
      'RESOURCE_EXHAUSTION': 'mcpServer'
    };
    
    return mapping[faultType] || 'unknown';
  }
  
  resetSystemState(state) {
    // 重置所有组件为正常状态
    const components = ['mcpServer', 'bridgeServer', 'chromeExtension', 'gmailTabs', 'claudeDesktop'];
    
    for (const component of components) {
      state.updateComponent(component, {
        status: 'running',
        healthy: true,
        error: null,
        networkError: false,
        lastCheck: Date.now()
      });
    }
  }
}

// 导出测试类
module.exports = {
  FaultInjector,
  RecoveryValidator,
  AutoRecoveryValidationSuite
};

// 如果直接运行此文件，执行测试
if (require.main === module) {
  async function runRecoveryValidation() {
    const validationSuite = new AutoRecoveryValidationSuite();
    await validationSuite.runValidationSuite();
  }
  
  runRecoveryValidation().catch(console.error);
}