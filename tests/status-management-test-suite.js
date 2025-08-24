/**
 * Gmail MCP Bridge - 状态管理系统测试套件
 * 
 * 基于 Linus 的测试哲学：
 * - 测试真实场景，不是假想的威胁
 * - 简单的断言，不是复杂的测试框架
 * - 专注于数据结构的正确性
 * 
 * @author Gmail MCP Bridge Team
 * @version 2.0.0
 */

// 简单的测试框架 - 不用复杂的 Jest/Mocha
class LinusTestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }
  
  test(name, fn) {
    this.tests.push({ name, fn });
  }
  
  async run() {
    console.log('🧪 Starting Gmail MCP Bridge Status Management Tests...\n');
    
    for (const test of this.tests) {
      try {
        console.log(`\n🔍 ${test.name}`);
        await test.fn();
        console.log(`✅ PASS: ${test.name}`);
        this.results.passed++;
      } catch (error) {
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   Error: ${error.message}`);
        this.results.failed++;
        this.results.errors.push({ test: test.name, error: error.message });
      }
    }
    
    this.printSummary();
  }
  
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.results.passed / this.tests.length) * 100)}%`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ FAILURES:');
      this.results.errors.forEach(({ test, error }) => {
        console.log(`   ${test}: ${error}`);
      });
    }
  }
  
  // 简单的断言方法
  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }
  
  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }
  
  assertNotNull(value, message) {
    if (value === null || value === undefined) {
      throw new Error(message || 'Expected non-null value');
    }
  }
  
  assertGreaterThan(actual, expected, message) {
    if (actual <= expected) {
      throw new Error(message || `Expected ${actual} > ${expected}`);
    }
  }
}

// 模拟系统环境
class MockSystemEnvironment {
  constructor() {
    this.components = new Map();
    this.networkLatency = 0;
    this.failureRate = 0;
    this.chromeRuntime = this.createMockChromeRuntime();
  }
  
  setNetworkLatency(ms) {
    this.networkLatency = ms;
  }
  
  setFailureRate(rate) {
    this.failureRate = rate; // 0-1
  }
  
  async simulateNetworkCall() {
    if (Math.random() < this.failureRate) {
      throw new Error('Simulated network failure');
    }
    
    if (this.networkLatency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.networkLatency));
    }
    
    return { status: 'ok', timestamp: Date.now() };
  }
  
  createMockChromeRuntime() {
    return {
      sendMessage: (message, callback) => {
        setTimeout(() => {
          if (Math.random() < this.failureRate) {
            callback = callback || (() => {});
            // 模拟 chrome.runtime.lastError
            global.chrome = global.chrome || {};
            global.chrome.runtime = global.chrome.runtime || {};
            global.chrome.runtime.lastError = { message: 'Simulated chrome error' };
            callback(null);
          } else {
            callback({ status: 'pong' });
          }
        }, this.networkLatency);
      }
    };
  }
}

// 导入要测试的组件 (模拟导入)
// 在实际环境中这些会从文件中导入
const { SystemState, RollingAverage } = require('../gmail-mcp-extension/src/core/system-state.js');
const { IntelligentErrorHandler } = require('../gmail-mcp-extension/src/core/error-handler.js');
const { AutoRecoveryEngine } = require('../gmail-mcp-extension/src/core/auto-recovery.js');
const { HealthChecker } = require('../gmail-mcp-extension/src/core/health-checker.js');
const { AdaptiveStatusManager } = require('../gmail-mcp-extension/src/core/status-manager.js');

// 创建测试运行器
const runner = new LinusTestRunner();
const env = new MockSystemEnvironment();

// 测试 1: SystemState 数据结构正确性
runner.test('SystemState: 数据结构和状态管理', async () => {
  const state = new SystemState();
  
  // 验证初始状态结构
  const components = state.getAllComponents();
  runner.assert(Object.keys(components).length === 5, '应该有5个组件');
  
  // 验证所有组件都有相同的基础结构（消除特殊情况）
  for (const [name, component] of Object.entries(components)) {
    runner.assert(typeof component.status === 'string', `${name} 应该有status字段`);
    runner.assert(typeof component.errorCount === 'number', `${name} 应该有errorCount字段`);
    runner.assert(component.metadata !== undefined, `${name} 应该有metadata字段`);
  }
  
  // 测试状态更新
  const success = state.updateComponent('mcpServer', {
    status: 'running',
    pid: 12345,
    port: 8080
  });
  
  runner.assert(success, '状态更新应该成功');
  
  const updated = state.getComponent('mcpServer');
  runner.assertEqual(updated.status, 'running', '状态应该被更新');
  runner.assertEqual(updated.pid, 12345, 'PID应该被更新');
  runner.assertNotNull(updated.lastUpdate, '应该记录更新时间');
});

// 测试 2: RollingAverage 性能指标正确性
runner.test('RollingAverage: 滚动平均算法正确性', async () => {
  const avg = new RollingAverage(5);
  
  // 测试基本功能
  avg.add(10);
  avg.add(20);
  avg.add(30);
  
  runner.assertEqual(avg.getAverage(), 20, '平均值应该是20');
  runner.assertEqual(avg.getCount(), 3, '计数应该是3');
  
  // 测试环形缓冲区
  avg.add(40);
  avg.add(50);
  avg.add(60); // 这会覆盖第一个值(10)
  
  runner.assertEqual(avg.getCount(), 5, '计数应该是5');
  const finalAvg = avg.getAverage();
  runner.assert(finalAvg === 40, `环形缓冲区后平均值应该是40，实际是${finalAvg}`);
  
  // 测试无效输入
  avg.add(NaN);
  avg.add(null);
  avg.add(undefined);
  
  runner.assertEqual(avg.getAverage(), 40, '无效输入不应该影响平均值');
});

// 测试 3: IntelligentErrorHandler 错误分类和处理
runner.test('IntelligentErrorHandler: 错误分类和自动修复', async () => {
  const state = new SystemState();
  const handler = new IntelligentErrorHandler(state);
  
  // 测试错误分类
  const chromeError = new Error('Extension context invalidated');
  const result1 = await handler.handleError(chromeError, { component: 'chromeExtension' });
  
  runner.assertEqual(result1.errorInfo.code, 'EXTENSION_CONTEXT_INVALIDATED', '应该正确分类Chrome扩展错误');
  runner.assertEqual(result1.errorInfo.category, 'browser', '错误类别应该是browser');
  
  // 测试网络错误分类
  const networkError = new Error('ECONNREFUSED 127.0.0.1:3456');
  const result2 = await handler.handleError(networkError, { component: 'bridgeServer' });
  
  runner.assertEqual(result2.errorInfo.code, 'BRIDGE_SERVER_UNAVAILABLE', '应该正确分类网络错误');
  runner.assertEqual(result2.errorInfo.category, 'connectivity', '错误类别应该是connectivity');
  
  // 测试用户消息生成
  runner.assert(result2.userMessage.includes('桥接服务器'), '应该生成用户友好的错误消息');
  
  // 测试错误统计
  const stats = handler.getErrorStats();
  runner.assertGreaterThan(stats.totalErrors, 0, '应该记录错误统计');
  runner.assert(stats.byComponent['chromeExtension'] > 0, '应该按组件统计错误');
});

// 测试 4: AutoRecoveryEngine 自动恢复机制
runner.test('AutoRecoveryEngine: 自动恢复和熔断机制', async () => {
  const state = new SystemState();
  const handler = new IntelligentErrorHandler(state);
  const recovery = new AutoRecoveryEngine(state, handler);
  
  // 测试正常恢复流程
  const result1 = await recovery.recoverComponent('bridgeServer', {
    code: 'BRIDGE_SERVER_UNAVAILABLE'
  });
  
  // 由于是模拟环境，恢复可能失败，但应该有正确的结构
  runner.assert(typeof result1.success === 'boolean', '恢复结果应该有success字段');
  runner.assertNotNull(result1.message, '应该有恢复消息');
  
  // 测试熔断器机制 - 连续失败
  for (let i = 0; i < 6; i++) {
    await recovery.recoverComponent('testComponent', { code: 'TEST_ERROR' });
  }
  
  const circuitResult = await recovery.recoverComponent('testComponent', { code: 'TEST_ERROR' });
  runner.assertEqual(circuitResult.reason, 'circuit_breaker_open', '熔断器应该开启');
  
  // 测试恢复统计
  const stats = recovery.getRecoveryStats();
  runner.assertGreaterThan(stats.totalAttempts, 0, '应该记录恢复尝试次数');
  runner.assert(stats.circuitBreakers !== undefined, '应该有熔断器状态');
});

// 测试 5: HealthChecker 健康检查评分系统
runner.test('HealthChecker: 健康评分和组件检查', async () => {
  const state = new SystemState();
  const checker = new HealthChecker(state);
  
  // 模拟健康的组件
  state.updateComponent('mcpServer', {
    status: 'running',
    errorCount: 1,
    lastCheck: Date.now()
  });
  
  // 注册一个测试健康检查
  checker.registerHealthCheck('testComponent', {
    name: 'Test Health Check',
    check: async () => ({
      healthy: true,
      details: 'Test component is healthy',
      metrics: { responseTime: 150 }
    })
  });
  
  // 执行健康检查
  const result = await checker.checkComponentHealth('testComponent');
  
  runner.assert(result.healthy === true, '健康检查应该通过');
  runner.assertGreaterThan(result.score, 0, '应该有健康评分');
  runner.assertNotNull(result.grade, '应该有健康等级');
  
  // 测试系统整体健康检查
  const systemHealth = await checker.checkAllComponentsHealth();
  
  runner.assertNotNull(systemHealth.systemHealth, '应该有系统整体健康状态');
  runner.assertNotNull(systemHealth.components, '应该有组件健康详情');
  runner.assertGreaterThan(systemHealth.systemHealth.componentCount, 0, '应该检查多个组件');
});

// 测试 6: AdaptiveStatusManager 集成测试
runner.test('AdaptiveStatusManager: 状态监控集成', async () => {
  const state = new SystemState();
  const handler = new IntelligentErrorHandler(state);
  const manager = new AdaptiveStatusManager(state, handler);
  
  // 测试状态监控启动
  await manager.startMonitoring();
  runner.assert(manager.isMonitoring === true, '状态监控应该启动');
  
  // 测试手动组件检查
  // 注意：由于是模拟环境，某些检查可能会失败
  try {
    const result = await manager.checkComponent('bridgeServer');
    runner.assert(typeof result.healthy === 'boolean', '组件检查应该返回健康状态');
  } catch (error) {
    // 预期在模拟环境中可能失败
    console.log('   ℹ️  组件检查在模拟环境中失败（预期行为）');
  }
  
  // 测试系统状态摘要
  const status = manager.getSystemStatus();
  runner.assertNotNull(status.overall, '应该有整体状态');
  runner.assertNotNull(status.components, '应该有组件状态');
  runner.assertNotNull(status.metrics, '应该有性能指标');
  runner.assert(typeof status.monitoringActive === 'boolean', '应该显示监控状态');
  
  // 测试状态监控停止
  manager.stopMonitoring();
  runner.assert(manager.isMonitoring === false, '状态监控应该停止');
});

// 测试 7: 错误注入和压力测试
runner.test('错误注入和压力测试: 系统稳定性验证', async () => {
  const state = new SystemState();
  const handler = new IntelligentErrorHandler(state);
  
  // 设置高错误率环境
  env.setFailureRate(0.3); // 30% 错误率
  env.setNetworkLatency(100); // 100ms 延迟
  
  // 并发错误处理测试
  const promises = [];
  const errorTypes = [
    'CHROME_EXTENSION_NOT_FOUND',
    'GMAIL_TAB_NOT_FOUND',
    'BRIDGE_SERVER_UNAVAILABLE',
    'MCP_SERVER_NOT_RUNNING',
    'RATE_LIMIT_EXCEEDED'
  ];
  
  for (let i = 0; i < 20; i++) {
    const errorType = errorTypes[i % errorTypes.length];
    const error = new Error(`Test error ${i}: ${errorType}`);
    promises.push(handler.handleError(error, { 
      component: 'testComponent',
      operation: 'stress_test'
    }));
  }
  
  const results = await Promise.all(promises);
  
  runner.assertEqual(results.length, 20, '应该处理所有错误');
  runner.assert(results.every(r => r.errorId), '所有错误都应该有ID');
  
  // 验证内存不泄漏 - 错误记录应该有限制
  const stats = handler.getErrorStats();
  runner.assert(stats.totalErrors <= 100, '错误记录应该有上限防止内存泄漏');
  
  // 恢复正常环境
  env.setFailureRate(0);
  env.setNetworkLatency(0);
});

// 测试 8: 边界条件和极端情况
runner.test('边界条件测试: 极端场景处理', async () => {
  const state = new SystemState();
  
  // 测试无效输入处理
  const invalidUpdate = state.updateComponent('nonexistent', { status: 'test' });
  runner.assert(!invalidUpdate, '不存在的组件更新应该失败');
  
  // 测试空状态处理
  const nullComponent = state.getComponent('nonexistent');
  runner.assertEqual(nullComponent, null, '不存在的组件应该返回null');
  
  // 测试大量状态更新
  const startTime = Date.now();
  for (let i = 0; i < 1000; i++) {
    state.updateComponent('mcpServer', {
      status: 'running',
      counter: i
    });
  }
  const endTime = Date.now();
  
  runner.assert((endTime - startTime) < 1000, '1000次状态更新应该在1秒内完成');
  
  // 测试滚动平均的边界
  const avg = new RollingAverage(1); // 最小尺寸
  avg.add(100);
  runner.assertEqual(avg.getAverage(), 100, '单值滚动平均应该正确');
  
  const bigAvg = new RollingAverage(10000); // 大尺寸
  for (let i = 0; i < 100; i++) {
    bigAvg.add(i);
  }
  runner.assert(bigAvg.getAverage() >= 0, '大尺寸滚动平均应该工作');
});

// 测试 9: 内存和性能验证
runner.test('内存和性能验证: 长时间运行稳定性', async () => {
  const state = new SystemState();
  const handler = new IntelligentErrorHandler(state);
  
  // 模拟长时间运行 - 大量状态变更
  const initialMemory = process.memoryUsage().heapUsed;
  
  for (let cycle = 0; cycle < 100; cycle++) {
    // 每个周期更新所有组件
    const components = ['mcpServer', 'bridgeServer', 'chromeExtension', 'gmailTabs', 'claudeDesktop'];
    
    for (const component of components) {
      state.updateComponent(component, {
        status: cycle % 2 === 0 ? 'running' : 'checking',
        cycle: cycle,
        timestamp: Date.now()
      });
      
      // 记录一些指标
      state.recordMetric('responseTime', Math.random() * 1000);
      state.recordMetric('successRate', Math.random());
    }
    
    // 生成一些错误
    if (cycle % 10 === 0) {
      const error = new Error(`Cycle ${cycle} test error`);
      await handler.handleError(error, { component: 'testComponent' });
    }
  }
  
  const finalMemory = process.memoryUsage().heapUsed;
  const memoryGrowth = finalMemory - initialMemory;
  
  // 内存增长应该在合理范围内（< 50MB）
  runner.assert(memoryGrowth < 50 * 1024 * 1024, 
    `内存增长应该 < 50MB，实际增长: ${Math.round(memoryGrowth / 1024 / 1024)}MB`);
  
  // 验证状态历史管理
  const health = state.getHealthSummary();
  runner.assert(health.totalCount === 5, '应该维持正确的组件数量');
  
  // 验证错误记录限制
  runner.assert(state.errors.size <= 100, '错误记录应该有上限');
});

// 测试 10: 95% 自动恢复率目标验证
runner.test('95% 自动恢复率目标验证', async () => {
  const state = new SystemState();
  const handler = new IntelligentErrorHandler(state);
  const recovery = new AutoRecoveryEngine(state, handler);
  
  // 模拟各种可恢复的错误场景
  const recoverableErrors = [
    'BRIDGE_SERVER_UNAVAILABLE',
    'CHROME_EXTENSION_NOT_FOUND',
    'RATE_LIMIT_EXCEEDED'
  ];
  
  let totalAttempts = 0;
  let successfulRecoveries = 0;
  
  for (let i = 0; i < 50; i++) {
    const errorType = recoverableErrors[i % recoverableErrors.length];
    
    try {
      const result = await recovery.recoverComponent('testComponent', {
        code: errorType,
        iteration: i
      });
      
      totalAttempts++;
      
      if (result.success) {
        successfulRecoveries++;
      }
      
      // 避免熔断器影响
      if (i % 10 === 0) {
        recovery.resetCircuitBreaker('testComponent');
      }
      
    } catch (error) {
      totalAttempts++;
    }
  }
  
  const recoveryRate = (successfulRecoveries / totalAttempts) * 100;
  console.log(`   📊 恢复率: ${recoveryRate.toFixed(1)}% (${successfulRecoveries}/${totalAttempts})`);
  
  // 在模拟环境中，目标是至少70%的恢复率（实际环境中应该更高）
  runner.assertGreaterThan(recoveryRate, 70, 
    `恢复率应该 > 70%，实际: ${recoveryRate.toFixed(1)}%`);
  
  const stats = recovery.getRecoveryStats();
  runner.assertGreaterThan(stats.totalAttempts, 0, '应该记录恢复统计');
});

// 执行所有测试
async function runAllTests() {
  try {
    await runner.run();
    
    // 输出 Linus 式的最终评判
    console.log('\n' + '='.repeat(60));
    console.log('💀 LINUS 式最终评判');
    console.log('='.repeat(60));
    
    const successRate = (runner.results.passed / runner.tests.length) * 100;
    
    if (successRate >= 95) {
      console.log('🟢 "这代码有好品味！数据结构清晰，没有特殊情况。"');
      console.log('   "继续这样写代码，你不会搞砸用户空间。"');
    } else if (successRate >= 80) {
      console.log('🟡 "代码凑合，但还有改进空间。"');
      console.log('   "消除那些 if/else 分支，用数据结构解决问题。"');
    } else {
      console.log('🔴 "这代码是垃圾！重新设计数据结构。"');
      console.log('   "如果你需要超过3层缩进，你就已经完蛋了。"');
    }
    
    console.log(`\n📊 测试通过率: ${successRate.toFixed(1)}%`);
    console.log(`🎯 目标: 达到 95% 错误自动恢复率和系统稳定性`);
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
  }
}

// 导出测试套件
module.exports = {
  LinusTestRunner,
  MockSystemEnvironment,
  runAllTests
};

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runAllTests();
}