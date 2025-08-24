/**
 * Gmail MCP Bridge - 边界条件和混沌测试
 * 
 * 基于 Linus 的"现实测试"哲学：
 * - "测试真实的极端情况，不是理论上的"
 * - "如果代码在边界条件下崩溃，那就不够健壮"
 * - "混沌测试比单元测试更能发现真正的问题"
 * 
 * @author Gmail MCP Bridge Team
 * @version 2.0.0
 */

const { performance } = require('perf_hooks');
const crypto = require('crypto');

/**
 * 混沌工程测试器 - 随机故障注入
 */
class ChaosEngineer {
  constructor() {
    this.chaosScenarios = new Map();
    this.activeInterventions = new Set();
    this.chaosHistory = [];
    this.systemUnderTest = null;
  }
  
  // 注册混沌场景
  registerChaosScenario(name, interventionFn, probabilityWeight = 1) {
    this.chaosScenarios.set(name, {
      name,
      intervention: interventionFn,
      weight: probabilityWeight,
      executedCount: 0,
      successCount: 0,
      failureCount: 0
    });
  }
  
  // 开始混沌测试
  async startChaos(systemUnderTest, durationMs, interventionIntervalMs = 1000) {
    this.systemUnderTest = systemUnderTest;
    const endTime = Date.now() + durationMs;
    
    console.log(`🌪️ 启动混沌测试 - 持续 ${durationMs/1000}s, 干预间隔 ${interventionIntervalMs}ms`);
    
    while (Date.now() < endTime) {
      try {
        // 随机选择一个混沌场景
        const scenario = this.selectRandomScenario();
        if (scenario) {
          await this.executeIntervention(scenario);
        }
        
        // 等待下次干预
        await new Promise(resolve => setTimeout(resolve, interventionIntervalMs));
        
      } catch (error) {
        console.log(`   ⚠️ 混沌干预失败: ${error.message}`);
      }
    }
    
    console.log('🌪️ 混沌测试结束');
    return this.getChaosReport();
  }
  
  selectRandomScenario() {
    if (this.chaosScenarios.size === 0) return null;
    
    const scenarios = Array.from(this.chaosScenarios.values());
    const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const scenario of scenarios) {
      random -= scenario.weight;
      if (random <= 0) {
        return scenario;
      }
    }
    
    return scenarios[0]; // fallback
  }
  
  async executeIntervention(scenario) {
    const interventionId = crypto.randomUUID();
    const startTime = Date.now();
    
    this.activeInterventions.add(interventionId);
    scenario.executedCount++;
    
    try {
      const result = await scenario.intervention(this.systemUnderTest, {
        interventionId,
        scenario: scenario.name
      });
      
      scenario.successCount++;
      
      this.chaosHistory.push({
        id: interventionId,
        scenario: scenario.name,
        startTime,
        endTime: Date.now(),
        success: true,
        result: result
      });
      
    } catch (error) {
      scenario.failureCount++;
      
      this.chaosHistory.push({
        id: interventionId,
        scenario: scenario.name,
        startTime,
        endTime: Date.now(),
        success: false,
        error: error.message
      });
    } finally {
      this.activeInterventions.delete(interventionId);
    }
  }
  
  getChaosReport() {
    const totalInterventions = this.chaosHistory.length;
    const successfulInterventions = this.chaosHistory.filter(h => h.success).length;
    
    return {
      totalInterventions,
      successfulInterventions,
      failureRate: totalInterventions > 0 ? 
        ((totalInterventions - successfulInterventions) / totalInterventions * 100).toFixed(1) : 0,
      scenarioStats: Object.fromEntries(
        Array.from(this.chaosScenarios.entries()).map(([name, scenario]) => [
          name,
          {
            executed: scenario.executedCount,
            succeeded: scenario.successCount,
            failed: scenario.failureCount,
            successRate: scenario.executedCount > 0 ? 
              (scenario.successCount / scenario.executedCount * 100).toFixed(1) : 0
          }
        ])
      ),
      interventionHistory: this.chaosHistory
    };
  }
}

/**
 * 边界条件测试器 - 极端输入和状态测试
 */
class EdgeCaseTester {
  constructor() {
    this.testCases = [];
    this.results = [];
  }
  
  // 测试极端数值输入
  testExtremeValues(testFunction, valueSets) {
    const extremeValues = [
      // 数值边界
      0, -1, 1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER,
      Number.MAX_VALUE, Number.MIN_VALUE, Infinity, -Infinity, NaN,
      
      // 字符串边界
      '', ' ', '\n', '\t', '\r\n', 
      'a'.repeat(1000000), // 1MB字符串
      String.fromCharCode(0), // null字符
      '🌪️💀🔥⚡️', // emoji
      
      // 特殊值
      null, undefined, false, true,
      [], {}, new Date(), new Error(),
      
      // 自定义边界值
      ...(valueSets || [])
    ];
    
    const testResults = [];
    
    for (const value of extremeValues) {
      try {
        const startTime = performance.now();
        const result = testFunction(value);
        const endTime = performance.now();
        
        testResults.push({
          input: this.serializeValue(value),
          success: true,
          result: this.serializeValue(result),
          executionTime: Math.round((endTime - startTime) * 100) / 100
        });
        
      } catch (error) {
        testResults.push({
          input: this.serializeValue(value),
          success: false,
          error: error.message,
          errorType: error.constructor.name
        });
      }
    }
    
    return testResults;
  }
  
  // 测试资源耗尽场景
  async testResourceExhaustion(testFunction, resourceType = 'memory') {
    const results = [];
    
    switch (resourceType) {
      case 'memory':
        // 内存耗尽测试
        const largeSizes = [1024, 10240, 102400, 1024000]; // bytes
        
        for (const size of largeSizes) {
          try {
            const largeData = Buffer.alloc(size);
            largeData.fill(0xFF); // 填满数据
            
            const startMemory = process.memoryUsage().heapUsed;
            const result = await testFunction(largeData);
            const endMemory = process.memoryUsage().heapUsed;
            
            results.push({
              size: size,
              success: true,
              memoryGrowth: endMemory - startMemory,
              result: this.serializeValue(result)
            });
            
          } catch (error) {
            results.push({
              size: size,
              success: false,
              error: error.message
            });
          }
        }
        break;
        
      case 'time':
        // 时间耗尽测试（超时）
        const timeouts = [100, 1000, 5000, 30000]; // ms
        
        for (const timeout of timeouts) {
          try {
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), timeout)
            );
            
            const result = await Promise.race([
              testFunction(),
              timeoutPromise
            ]);
            
            results.push({
              timeout: timeout,
              success: true,
              result: this.serializeValue(result)
            });
            
          } catch (error) {
            results.push({
              timeout: timeout,
              success: false,
              error: error.message
            });
          }
        }
        break;
    }
    
    return results;
  }
  
  serializeValue(value) {
    try {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (typeof value === 'function') return '[Function]';
      if (value instanceof Error) return `[Error: ${value.message}]`;
      if (value instanceof Date) return `[Date: ${value.toISOString()}]`;
      if (Buffer.isBuffer(value)) return `[Buffer: ${value.length} bytes]`;
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 0).substring(0, 100) + '...';
      }
      
      return String(value).substring(0, 100);
    } catch (error) {
      return `[Unserializable: ${typeof value}]`;
    }
  }
}

// 导入要测试的组件
const { SystemState, RollingAverage } = require('../gmail-mcp-extension/src/core/system-state.js');
const { IntelligentErrorHandler } = require('../gmail-mcp-extension/src/core/error-handler.js');
const { AutoRecoveryEngine } = require('../gmail-mcp-extension/src/core/auto-recovery.js');
const { AdaptiveStatusManager } = require('../gmail-mcp-extension/src/core/status-manager.js');

/**
 * 边界条件和混沌测试套件
 */
class EdgeCasesChaosTestSuite {
  constructor() {
    this.chaosEngineer = new ChaosEngineer();
    this.edgeTester = new EdgeCaseTester();
    this.testResults = {
      edgeCaseTests: [],
      chaosTests: [],
      overallStability: null
    };
    
    this.setupChaosScenarios();
  }
  
  setupChaosScenarios() {
    // 场景1: 随机系统状态破坏
    this.chaosEngineer.registerChaosScenario('random_state_corruption', async (system) => {
      if (system.systemState) {
        const components = ['mcpServer', 'bridgeServer', 'chromeExtension'];
        const randomComponent = components[Math.floor(Math.random() * components.length)];
        
        // 注入随机错误状态
        system.systemState.updateComponent(randomComponent, {
          status: ['error', 'disconnected', 'crashed'][Math.floor(Math.random() * 3)],
          randomCorruption: true,
          corruptedAt: Date.now(),
          errorCount: Math.floor(Math.random() * 100)
        });
        
        return { corruptedComponent: randomComponent };
      }
    }, 3);
    
    // 场景2: 内存压力
    this.chaosEngineer.registerChaosScenario('memory_pressure', async (system) => {
      // 创建内存压力
      const memoryEaters = [];
      for (let i = 0; i < 10; i++) {
        memoryEaters.push(new Array(100000).fill(Math.random()));
      }
      
      // 在内存压力下执行操作
      if (system.systemState) {
        for (let i = 0; i < 100; i++) {
          system.systemState.recordMetric('responseTime', Math.random() * 1000);
        }
      }
      
      // 释放内存
      memoryEaters.length = 0;
      
      return { memoryPressureApplied: true };
    }, 2);
    
    // 场景3: 高频率状态更新
    this.chaosEngineer.registerChaosScenario('high_frequency_updates', async (system) => {
      if (system.systemState) {
        // 超高频更新
        for (let i = 0; i < 1000; i++) {
          system.systemState.updateComponent('mcpServer', {
            status: 'running',
            highFreqTest: i,
            timestamp: Date.now() + i
          });
        }
        
        return { updatesPerformed: 1000 };
      }
    }, 2);
    
    // 场景4: 错误风暴
    this.chaosEngineer.registerChaosScenario('error_storm', async (system) => {
      if (system.errorHandler) {
        const errors = [];
        
        // 同时生成大量错误
        for (let i = 0; i < 50; i++) {
          const error = new Error(`Chaos error ${i}: ${Math.random()}`);
          errors.push(system.errorHandler.handleError(error, {
            component: 'chaosTest',
            storm: true,
            index: i
          }));
        }
        
        await Promise.all(errors);
        return { errorsGenerated: 50 };
      }
    }, 2);
    
    // 场景5: 竞态条件
    this.chaosEngineer.registerChaosScenario('race_conditions', async (system) => {
      if (system.systemState) {
        // 并发状态修改
        const promises = [];
        
        for (let i = 0; i < 20; i++) {
          promises.push(new Promise(async (resolve) => {
            for (let j = 0; j < 10; j++) {
              system.systemState.updateComponent('bridgeServer', {
                status: `race_${i}_${j}`,
                raceCondition: true,
                thread: i,
                iteration: j
              });
            }
            resolve();
          }));
        }
        
        await Promise.all(promises);
        return { racingThreads: 20 };
      }
    }, 1);
    
    // 场景6: 网络抖动模拟
    this.chaosEngineer.registerChaosScenario('network_jitter', async (system) => {
      // 模拟网络延迟和丢包
      const jitterDelays = [0, 50, 100, 200, 500, 1000];
      
      for (const delay of jitterDelays) {
        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (system.systemState) {
          system.systemState.recordMetric('responseTime', delay + Math.random() * 100);
        }
      }
      
      return { networkJitterApplied: jitterDelays };
    }, 1);
  }
  
  async runAllTests() {
    console.log('🔬 开始边界条件和混沌测试...\n');
    
    // 边界条件测试
    await this.testEdgeCases();
    
    // 混沌工程测试
    await this.testChaosScenarios();
    
    // 稳定性分析
    this.analyzeStability();
    
    // 生成报告
    this.generateReport();
    
    return this.testResults;
  }
  
  async testEdgeCases() {
    console.log('🎯 测试1: 边界条件测试...');
    
    const state = new SystemState();
    const handler = new IntelligentErrorHandler(state);
    
    // 1. SystemState 边界测试
    console.log('   📊 测试 SystemState 边界条件...');
    
    const stateEdgeResults = this.edgeTester.testExtremeValues(
      (value) => {
        // 测试状态更新的边界输入
        return state.updateComponent('mcpServer', { status: value });
      },
      ['', null, undefined, {}, [], 'a'.repeat(1000)]
    );
    
    this.testResults.edgeCaseTests.push({
      component: 'SystemState',
      test: 'extreme_values',
      results: stateEdgeResults,
      passed: stateEdgeResults.filter(r => r.success).length,
      total: stateEdgeResults.length
    });
    
    // 2. RollingAverage 边界测试
    console.log('   📈 测试 RollingAverage 边界条件...');
    
    const avgEdgeResults = [];
    const extremeSizes = [0, 1, -1, 1000000]; // 包括无效大小
    
    for (const size of extremeSizes) {
      try {
        const avg = new RollingAverage(size);
        
        // 测试极端值添加
        const testValues = [0, -1, 1, NaN, Infinity, null, undefined];
        for (const value of testValues) {
          avg.add(value);
        }
        
        const result = avg.getAverage();
        avgEdgeResults.push({
          size: size,
          success: true,
          finalAverage: result,
          isValid: !isNaN(result) && isFinite(result)
        });
        
      } catch (error) {
        avgEdgeResults.push({
          size: size,
          success: false,
          error: error.message
        });
      }
    }
    
    this.testResults.edgeCaseTests.push({
      component: 'RollingAverage',
      test: 'extreme_sizes',
      results: avgEdgeResults,
      passed: avgEdgeResults.filter(r => r.success).length,
      total: avgEdgeResults.length
    });
    
    // 3. ErrorHandler 边界测试
    console.log('   🚨 测试 ErrorHandler 边界条件...');
    
    const errorEdgeResults = [];
    const extremeErrors = [
      null,
      undefined,
      '',
      new Error(''),
      new Error('a'.repeat(10000)), // 超长错误消息
      { message: 'fake error object' },
      'string error',
      123,
      { stack: 'a'.repeat(100000) } // 超长堆栈
    ];
    
    for (const errorInput of extremeErrors) {
      try {
        const result = await handler.handleError(errorInput, {
          component: 'edgeTest',
          extremeInput: true
        });
        
        errorEdgeResults.push({
          input: this.edgeTester.serializeValue(errorInput),
          success: true,
          hasErrorId: !!result.errorId,
          hasUserMessage: !!result.userMessage
        });
        
      } catch (error) {
        errorEdgeResults.push({
          input: this.edgeTester.serializeValue(errorInput),
          success: false,
          error: error.message
        });
      }
    }
    
    this.testResults.edgeCaseTests.push({
      component: 'ErrorHandler',
      test: 'extreme_errors',
      results: errorEdgeResults,
      passed: errorEdgeResults.filter(r => r.success).length,
      total: errorEdgeResults.length
    });
    
    // 4. 资源耗尽测试
    console.log('   💾 测试资源耗尽场景...');
    
    const memoryResults = await this.edgeTester.testResourceExhaustion(
      async (largeData) => {
        // 使用大数据进行状态操作
        state.updateComponent('mcpServer', {
          status: 'running',
          largeData: largeData.toString('hex').substring(0, 1000),
          timestamp: Date.now()
        });
        
        return state.getComponent('mcpServer');
      },
      'memory'
    );
    
    this.testResults.edgeCaseTests.push({
      component: 'SystemState',
      test: 'memory_exhaustion',
      results: memoryResults,
      passed: memoryResults.filter(r => r.success).length,
      total: memoryResults.length
    });
    
    console.log('   ✅ 边界条件测试完成');
  }
  
  async testChaosScenarios() {
    console.log('🌪️ 测试2: 混沌工程测试...');
    
    const systemUnderTest = {
      systemState: new SystemState(),
      errorHandler: new IntelligentErrorHandler(new SystemState()),
      recovery: null
    };
    
    systemUnderTest.recovery = new AutoRecoveryEngine(
      systemUnderTest.systemState,
      systemUnderTest.errorHandler
    );
    
    // 启动混沌测试 - 10秒钟的随机干预
    const chaosReport = await this.chaosEngineer.startChaos(
      systemUnderTest,
      10000, // 10秒
      500    // 每500ms一次干预
    );
    
    // 验证系统在混沌后是否还能正常工作
    const postChaosValidation = await this.validateSystemAfterChaos(systemUnderTest);
    
    this.testResults.chaosTests.push({
      name: 'Chaos Engineering Test',
      report: chaosReport,
      postChaosValidation: postChaosValidation,
      systemSurvived: postChaosValidation.systemResponsive
    });
    
    console.log(`   🌪️ 混沌干预: ${chaosReport.totalInterventions} 次`);
    console.log(`   💪 系统存活: ${postChaosValidation.systemResponsive ? '✅' : '❌'}`);
    console.log(`   📊 干预成功率: ${100 - parseFloat(chaosReport.failureRate)}%`);
  }
  
  async validateSystemAfterChaos(system) {
    const validation = {
      systemResponsive: false,
      stateAccessible: false,
      errorHandlerWorking: false,
      recoveryEngineWorking: false,
      details: {}
    };
    
    try {
      // 测试状态系统
      const healthSummary = system.systemState.getHealthSummary();
      validation.stateAccessible = healthSummary !== null;
      validation.details.healthSummary = healthSummary;
      
      // 测试错误处理
      const testError = new Error('Post-chaos validation error');
      const errorResult = await system.errorHandler.handleError(testError, {
        component: 'postChaosTest'
      });
      validation.errorHandlerWorking = errorResult && errorResult.errorId;
      validation.details.errorHandling = errorResult;
      
      // 测试恢复引擎
      const recoveryResult = await system.recovery.recoverComponent('mcpServer', {
        code: 'CHAOS_RECOVERY_TEST'
      });
      validation.recoveryEngineWorking = recoveryResult !== null;
      validation.details.recovery = recoveryResult;
      
      validation.systemResponsive = 
        validation.stateAccessible && 
        validation.errorHandlerWorking && 
        validation.recoveryEngineWorking;
      
    } catch (error) {
      validation.details.validationError = error.message;
    }
    
    return validation;
  }
  
  analyzeStability() {
    console.log('📊 分析系统稳定性...');
    
    const stability = {
      edgeCaseStability: 0,
      chaosResilience: 0,
      overallStability: 0,
      riskFactors: [],
      recommendations: []
    };
    
    // 边界条件稳定性
    let totalEdgeTests = 0;
    let passedEdgeTests = 0;
    
    for (const test of this.testResults.edgeCaseTests) {
      totalEdgeTests += test.total;
      passedEdgeTests += test.passed;
      
      const passRate = test.total > 0 ? (test.passed / test.total) * 100 : 0;
      if (passRate < 90) {
        stability.riskFactors.push(`${test.component} 边界条件通过率低: ${passRate.toFixed(1)}%`);
      }
    }
    
    stability.edgeCaseStability = totalEdgeTests > 0 ? (passedEdgeTests / totalEdgeTests) * 100 : 0;
    
    // 混沌测试韧性
    let chaosSystemsSurvived = 0;
    let totalChaosTests = this.testResults.chaosTests.length;
    
    for (const chaosTest of this.testResults.chaosTests) {
      if (chaosTest.systemSurvived) {
        chaosSystemsSurvived++;
      } else {
        stability.riskFactors.push(`${chaosTest.name} 后系统无法正常工作`);
      }
    }
    
    stability.chaosResilience = totalChaosTests > 0 ? (chaosSystemsSurvived / totalChaosTests) * 100 : 0;
    
    // 综合稳定性
    stability.overallStability = (stability.edgeCaseStability + stability.chaosResilience) / 2;
    
    // 生成建议
    if (stability.edgeCaseStability < 95) {
      stability.recommendations.push('加强输入验证和边界条件处理');
    }
    
    if (stability.chaosResilience < 90) {
      stability.recommendations.push('提高系统在异常情况下的恢复能力');
    }
    
    if (stability.overallStability < 90) {
      stability.recommendations.push('整体系统稳定性需要改进');
    }
    
    this.testResults.overallStability = stability;
    
    console.log(`   🎯 边界条件稳定性: ${stability.edgeCaseStability.toFixed(1)}%`);
    console.log(`   🌪️ 混沌测试韧性: ${stability.chaosResilience.toFixed(1)}%`);
    console.log(`   📊 综合稳定性: ${stability.overallStability.toFixed(1)}%`);
  }
  
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🔬 边界条件和混沌测试报告');
    console.log('='.repeat(80));
    
    const stability = this.testResults.overallStability;
    
    // 边界条件测试摘要
    console.log('\n🎯 边界条件测试摘要:');
    for (const test of this.testResults.edgeCaseTests) {
      const passRate = test.total > 0 ? ((test.passed / test.total) * 100).toFixed(1) : 0;
      console.log(`   ${test.component} (${test.test}): ${passRate}% (${test.passed}/${test.total})`);
    }
    
    // 混沌测试摘要
    console.log('\n🌪️ 混沌测试摘要:');
    for (const chaosTest of this.testResults.chaosTests) {
      console.log(`   ${chaosTest.name}: 系统存活 ${chaosTest.systemSurvived ? '✅' : '❌'}`);
      console.log(`     干预次数: ${chaosTest.report.totalInterventions}`);
      console.log(`     成功干预: ${chaosTest.report.successfulInterventions}`);
      
      // 按场景统计
      for (const [scenario, stats] of Object.entries(chaosTest.report.scenarioStats)) {
        console.log(`     ${scenario}: ${stats.successRate}% (${stats.succeeded}/${stats.executed})`);
      }
    }
    
    // 稳定性分析
    console.log('\n📊 稳定性分析:');
    console.log(`   边界条件稳定性: ${stability.edgeCaseStability.toFixed(1)}%`);
    console.log(`   混沌测试韧性: ${stability.chaosResilience.toFixed(1)}%`);
    console.log(`   综合稳定性评分: ${stability.overallStability.toFixed(1)}%`);
    
    // 风险因素
    if (stability.riskFactors.length > 0) {
      console.log('\n⚠️ 发现的风险因素:');
      for (const risk of stability.riskFactors) {
        console.log(`   • ${risk}`);
      }
    }
    
    // 改进建议
    if (stability.recommendations.length > 0) {
      console.log('\n💡 改进建议:');
      for (const recommendation of stability.recommendations) {
        console.log(`   • ${recommendation}`);
      }
    }
    
    // Linus 式评判
    console.log('\n' + '='.repeat(80));
    console.log('💀 LINUS 式稳定性评判');
    console.log('='.repeat(80));
    
    if (stability.overallStability >= 95) {
      console.log('🟢 "这系统足够健壮！能处理各种异常情况。"');
      console.log('   "边界条件处理有好品味，混沌测试表现优秀。"');
    } else if (stability.overallStability >= 85) {
      console.log('🟡 "系统稳定性凑合，但还有改进空间。"');
      console.log('   "修复那些边界条件bug，提高异常处理能力。"');
    } else {
      console.log('🔴 "这系统太脆弱！边界条件会让它崩溃。"');
      console.log('   "重新设计错误处理机制，用户空间不能被破坏。"');
      
      if (stability.chaosResilience < 80) {
        console.log('   "混沌测试失败说明系统架构有根本问题！"');
      }
    }
    
    console.log(`\n🎯 稳定性评分: ${stability.overallStability.toFixed(1)}% (目标: ≥95%)`);
    console.log(`🔬 测试覆盖: 边界条件 + 混沌工程`);
  }
}

// 导出测试类
module.exports = {
  ChaosEngineer,
  EdgeCaseTester,
  EdgeCasesChaosTestSuite
};

// 如果直接运行此文件，执行测试
if (require.main === module) {
  async function runEdgeCasesChaosTests() {
    const testSuite = new EdgeCasesChaosTestSuite();
    await testSuite.runAllTests();
  }
  
  runEdgeCasesChaosTests().catch(console.error);
}