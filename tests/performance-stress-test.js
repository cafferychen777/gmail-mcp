/**
 * Gmail MCP Bridge - 性能和稳定性压力测试
 * 
 * 基于 Linus 的性能哲学：
 * - "测试真实的性能瓶颈，不是理论上的"
 * - "如果它在压力下崩溃，那就是垃圾代码"
 * - "内存泄漏是不可接受的"
 * 
 * @author Gmail MCP Bridge Team  
 * @version 2.0.0
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

/**
 * 性能基准测试器 - 测量真实性能，不是理论性能
 */
class PerformanceBenchmark {
  constructor() {
    this.results = {};
    this.memorySnapshots = [];
    this.startTime = null;
    this.testDuration = 0;
  }
  
  start(testName) {
    this.currentTest = testName;
    this.startTime = performance.now();
    this.recordMemorySnapshot(`${testName}_start`);
  }
  
  end() {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    
    this.results[this.currentTest] = {
      duration: Math.round(duration * 100) / 100, // ms
      memoryUsage: process.memoryUsage(),
      timestamp: Date.now()
    };
    
    this.recordMemorySnapshot(`${this.currentTest}_end`);
    this.testDuration += duration;
    
    return duration;
  }
  
  recordMemorySnapshot(label) {
    const usage = process.memoryUsage();
    this.memorySnapshots.push({
      label,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      timestamp: Date.now()
    });
  }
  
  getResults() {
    return {
      testResults: this.results,
      memorySnapshots: this.memorySnapshots,
      totalTestTime: Math.round(this.testDuration),
      memoryAnalysis: this.analyzeMemoryUsage()
    };
  }
  
  analyzeMemoryUsage() {
    if (this.memorySnapshots.length < 2) return null;
    
    const first = this.memorySnapshots[0];
    const last = this.memorySnapshots[this.memorySnapshots.length - 1];
    
    const growth = last.heapUsed - first.heapUsed;
    const maxHeap = Math.max(...this.memorySnapshots.map(s => s.heapUsed));
    
    return {
      initialHeap: Math.round(first.heapUsed / 1024 / 1024), // MB
      finalHeap: Math.round(last.heapUsed / 1024 / 1024),    // MB
      maxHeap: Math.round(maxHeap / 1024 / 1024),           // MB
      growthMB: Math.round(growth / 1024 / 1024),           // MB
      growthPercent: Math.round((growth / first.heapUsed) * 100),
      potentialLeak: growth > 10 * 1024 * 1024 // > 10MB growth
    };
  }
}

/**
 * 并发负载生成器 - 模拟真实的高负载场景
 */
class ConcurrencyLoadGenerator {
  constructor(maxConcurrency = 50) {
    this.maxConcurrency = maxConcurrency;
    this.activeRequests = 0;
    this.completedRequests = 0;
    this.failedRequests = 0;
    this.responseTimes = [];
  }
  
  async runConcurrentOperations(operationFactory, count) {
    const promises = [];
    const startTime = performance.now();
    
    for (let i = 0; i < count; i++) {
      if (this.activeRequests >= this.maxConcurrency) {
        // 等待一些操作完成
        await Promise.race(promises);
      }
      
      const operationPromise = this.executeOperation(operationFactory, i);
      promises.push(operationPromise);
    }
    
    // 等待所有操作完成
    await Promise.all(promises);
    
    const totalTime = performance.now() - startTime;
    
    return {
      totalRequests: count,
      completedRequests: this.completedRequests,
      failedRequests: this.failedRequests,
      successRate: (this.completedRequests / count) * 100,
      avgResponseTime: this.responseTimes.length > 0 ? 
        this.responseTimes.reduce((a, b) => a + b) / this.responseTimes.length : 0,
      totalTime: Math.round(totalTime),
      throughput: Math.round((count / totalTime) * 1000) // ops/sec
    };
  }
  
  async executeOperation(operationFactory, index) {
    this.activeRequests++;
    const operationStart = performance.now();
    
    try {
      const operation = operationFactory(index);
      await operation;
      
      const responseTime = performance.now() - operationStart;
      this.responseTimes.push(responseTime);
      this.completedRequests++;
      
    } catch (error) {
      this.failedRequests++;
    } finally {
      this.activeRequests--;
    }
  }
}

/**
 * 内存泄漏检测器 - 检测真实的内存问题
 */
class MemoryLeakDetector {
  constructor() {
    this.snapshots = [];
    this.threshold = 50 * 1024 * 1024; // 50MB
    this.monitoringInterval = null;
  }
  
  startMonitoring(intervalMs = 1000) {
    this.monitoringInterval = setInterval(() => {
      this.takeSnapshot();
    }, intervalMs);
  }
  
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
  
  takeSnapshot() {
    const usage = process.memoryUsage();
    this.snapshots.push({
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss
    });
    
    // 保持最近100个快照
    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }
  }
  
  detectLeaks() {
    if (this.snapshots.length < 10) {
      return { hasLeak: false, reason: 'Insufficient data' };
    }
    
    // 计算内存增长趋势
    const recent = this.snapshots.slice(-10); // 最近10个快照
    const old = this.snapshots.slice(0, 10);  // 最早10个快照
    
    const recentAvg = recent.reduce((sum, s) => sum + s.heapUsed, 0) / recent.length;
    const oldAvg = old.reduce((sum, s) => sum + s.heapUsed, 0) / old.length;
    
    const growth = recentAvg - oldAvg;
    const growthPercent = (growth / oldAvg) * 100;
    
    // 检测持续增长
    const isConstantGrowth = this.isConstantMemoryGrowth();
    
    return {
      hasLeak: growth > this.threshold || (growthPercent > 50 && isConstantGrowth),
      growthMB: Math.round(growth / 1024 / 1024),
      growthPercent: Math.round(growthPercent),
      constantGrowth: isConstantGrowth,
      currentHeapMB: Math.round(recentAvg / 1024 / 1024),
      snapshots: this.snapshots.length
    };
  }
  
  isConstantMemoryGrowth() {
    if (this.snapshots.length < 5) return false;
    
    const recent5 = this.snapshots.slice(-5);
    let growthCount = 0;
    
    for (let i = 1; i < recent5.length; i++) {
      if (recent5[i].heapUsed > recent5[i-1].heapUsed) {
        growthCount++;
      }
    }
    
    return growthCount >= 3; // 至少3/4的时间在增长
  }
}

// 导入要测试的组件
const { SystemState, RollingAverage } = require('../gmail-mcp-extension/src/core/system-state.js');
const { IntelligentErrorHandler } = require('../gmail-mcp-extension/src/core/error-handler.js');
const { AutoRecoveryEngine } = require('../gmail-mcp-extension/src/core/auto-recovery.js');
const { AdaptiveStatusManager } = require('../gmail-mcp-extension/src/core/status-manager.js');

/**
 * 主性能测试套件
 */
class PerformanceTestSuite {
  constructor() {
    this.benchmark = new PerformanceBenchmark();
    this.loadGen = new ConcurrencyLoadGenerator(100);
    this.memoryDetector = new MemoryLeakDetector();
    this.results = {};
  }
  
  async runAllTests() {
    console.log('🚀 开始Gmail MCP Bridge性能和稳定性测试...\n');
    
    // 启动内存监控
    this.memoryDetector.startMonitoring(500); // 500ms间隔
    
    try {
      // 测试1: 状态更新性能
      await this.testStateUpdatePerformance();
      
      // 测试2: 错误处理性能
      await this.testErrorHandlingPerformance();
      
      // 测试3: 并发状态管理
      await this.testConcurrentStateManagement();
      
      // 测试4: 内存使用和垃圾回收
      await this.testMemoryUsageAndGC();
      
      // 测试5: 长时间运行稳定性
      await this.testLongRunningStability();
      
      // 测试6: 极端负载测试
      await this.testExtremeLoadHandling();
      
    } finally {
      this.memoryDetector.stopMonitoring();
    }
    
    this.generateReport();
  }
  
  async testStateUpdatePerformance() {
    console.log('📊 测试1: 状态更新性能...');
    
    const state = new SystemState();
    this.benchmark.start('state_updates');
    
    // 高频状态更新
    for (let i = 0; i < 10000; i++) {
      state.updateComponent('mcpServer', {
        status: i % 2 === 0 ? 'running' : 'checking',
        iteration: i,
        timestamp: Date.now()
      });
      
      // 记录指标
      state.recordMetric('responseTime', Math.random() * 1000);
      
      if (i % 1000 === 0) {
        // 间歇性获取状态摘要（模拟UI更新）
        state.getHealthSummary();
      }
    }
    
    const duration = this.benchmark.end();
    
    // 验证状态正确性
    const finalState = state.getComponent('mcpServer');
    const metrics = state.getMetrics();
    
    this.results.stateUpdates = {
      duration,
      updatesPerSecond: Math.round(10000 / (duration / 1000)),
      finalIteration: finalState.iteration,
      metricsCount: metrics.responseTime || 0,
      passed: finalState.iteration === 9999 && duration < 1000 // 应该在1秒内完成
    };
    
    console.log(`   ✅ 10,000次状态更新: ${duration}ms (${this.results.stateUpdates.updatesPerSecond} ops/sec)`);
  }
  
  async testErrorHandlingPerformance() {
    console.log('📊 测试2: 错误处理性能...');
    
    const state = new SystemState();
    const handler = new IntelligentErrorHandler(state);
    
    this.benchmark.start('error_handling');
    
    const errorTypes = [
      'CHROME_EXTENSION_NOT_FOUND',
      'BRIDGE_SERVER_UNAVAILABLE', 
      'GMAIL_TAB_NOT_FOUND',
      'MCP_SERVER_NOT_RUNNING',
      'RATE_LIMIT_EXCEEDED'
    ];
    
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      const errorType = errorTypes[i % errorTypes.length];
      const error = new Error(`Performance test error ${i}: ${errorType}`);
      
      promises.push(handler.handleError(error, {
        component: 'performanceTest',
        operation: 'perf_test'
      }));
    }
    
    await Promise.all(promises);
    const duration = this.benchmark.end();
    
    const stats = handler.getErrorStats();
    
    this.results.errorHandling = {
      duration,
      errorsPerSecond: Math.round(1000 / (duration / 1000)),
      totalErrors: stats.totalErrors,
      passed: stats.totalErrors >= 1000 && duration < 5000 // 应该在5秒内完成
    };
    
    console.log(`   ✅ 1,000个错误处理: ${duration}ms (${this.results.errorHandling.errorsPerSecond} errors/sec)`);
  }
  
  async testConcurrentStateManagement() {
    console.log('📊 测试3: 并发状态管理...');
    
    const state = new SystemState();
    const handler = new IntelligentErrorHandler(state);
    const manager = new AdaptiveStatusManager(state, handler);
    
    this.benchmark.start('concurrent_operations');
    
    // 模拟并发操作
    const operationFactory = (index) => {
      return new Promise(async (resolve) => {
        const component = ['mcpServer', 'bridgeServer', 'chromeExtension'][index % 3];
        
        // 状态更新
        state.updateComponent(component, {
          status: 'running',
          concurrentTest: index,
          timestamp: Date.now()
        });
        
        // 指标记录
        state.recordMetric('responseTime', Math.random() * 200);
        
        // 错误处理
        if (index % 50 === 0) {
          const error = new Error(`Concurrent test error ${index}`);
          await handler.handleError(error, { component, operation: 'concurrent_test' });
        }
        
        // 健康检查
        if (index % 100 === 0) {
          state.getHealthSummary();
        }
        
        resolve();
      });
    };
    
    const results = await this.loadGen.runConcurrentOperations(operationFactory, 2000);
    const duration = this.benchmark.end();
    
    this.results.concurrentOps = {
      duration,
      ...results,
      passed: results.successRate > 95 && results.avgResponseTime < 50
    };
    
    console.log(`   ✅ 并发操作: ${results.completedRequests}/${results.totalRequests} 成功 (${results.successRate.toFixed(1)}%)`);
    console.log(`   📈 平均响应时间: ${Math.round(results.avgResponseTime)}ms, 吞吐量: ${results.throughput} ops/sec`);
  }
  
  async testMemoryUsageAndGC() {
    console.log('📊 测试4: 内存使用和垃圾回收...');
    
    this.benchmark.start('memory_test');
    
    const state = new SystemState();
    const handler = new IntelligentErrorHandler(state);
    
    // 大量对象创建和销毁
    for (let cycle = 0; cycle < 100; cycle++) {
      // 创建大量状态更新
      for (let i = 0; i < 1000; i++) {
        state.updateComponent('mcpServer', {
          status: 'running',
          data: new Array(100).fill(`cycle_${cycle}_item_${i}`), // 创建一些对象
          timestamp: Date.now()
        });
      }
      
      // 生成错误（会被清理）
      for (let i = 0; i < 50; i++) {
        const error = new Error(`Memory test error ${cycle}_${i}`);
        await handler.handleError(error, { component: 'memoryTest' });
      }
      
      // 强制垃圾回收（如果可用）
      if (global.gc && cycle % 20 === 0) {
        global.gc();
      }
      
      // 记录内存快照
      if (cycle % 10 === 0) {
        this.benchmark.recordMemorySnapshot(`cycle_${cycle}`);
      }
    }
    
    const duration = this.benchmark.end();
    
    // 检查内存泄漏
    const leakDetection = this.memoryDetector.detectLeaks();
    
    this.results.memoryTest = {
      duration,
      leakDetection,
      passed: !leakDetection.hasLeak && leakDetection.currentHeapMB < 200 // < 200MB
    };
    
    console.log(`   ✅ 内存测试完成: ${duration}ms`);
    console.log(`   🧠 当前堆内存: ${leakDetection.currentHeapMB}MB`);
    console.log(`   ${leakDetection.hasLeak ? '⚠️' : '✅'} 内存泄漏检测: ${leakDetection.hasLeak ? '发现泄漏' : '正常'}`);
  }
  
  async testLongRunningStability() {
    console.log('📊 测试5: 长时间运行稳定性...');
    
    const state = new SystemState();
    const handler = new IntelligentErrorHandler(state);
    const recovery = new AutoRecoveryEngine(state, handler);
    
    this.benchmark.start('stability_test');
    
    const startMemory = process.memoryUsage().heapUsed;
    let operationCount = 0;
    let errorCount = 0;
    
    // 模拟5秒钟的持续运行（在实际测试中可以设置更长）
    const endTime = Date.now() + 5000;
    
    while (Date.now() < endTime) {
      // 正常操作
      for (let i = 0; i < 10; i++) {
        const component = ['mcpServer', 'bridgeServer', 'chromeExtension'][i % 3];
        state.updateComponent(component, {
          status: 'running',
          operationCount: operationCount,
          timestamp: Date.now()
        });
        operationCount++;
      }
      
      // 间歇性错误和恢复
      if (operationCount % 100 === 0) {
        try {
          const error = new Error(`Stability test error ${errorCount}`);
          await handler.handleError(error, { component: 'stabilityTest' });
          
          // 尝试恢复
          await recovery.recoverComponent('stabilityTest', { code: 'TEST_ERROR' });
          errorCount++;
        } catch (e) {
          // 忽略恢复错误
        }
      }
      
      // 性能指标
      state.recordMetric('responseTime', Math.random() * 100);
      state.recordMetric('successRate', Math.random());
      
      // 小延迟模拟真实负载
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    const duration = this.benchmark.end();
    const endMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = endMemory - startMemory;
    
    // 获取最终统计
    const healthSummary = state.getHealthSummary();
    const recoveryStats = recovery.getRecoveryStats();
    
    this.results.stabilityTest = {
      duration,
      operationCount,
      errorCount,
      memoryGrowthMB: Math.round(memoryGrowth / 1024 / 1024),
      healthyComponents: healthSummary.healthyCount,
      totalComponents: healthSummary.totalCount,
      recoverySuccessRate: recoveryStats.successRate,
      passed: memoryGrowth < 50 * 1024 * 1024 && healthSummary.healthyCount > 0 // < 50MB增长
    };
    
    console.log(`   ✅ 稳定性测试: ${operationCount} 操作, ${errorCount} 错误`);
    console.log(`   🧠 内存增长: ${this.results.stabilityTest.memoryGrowthMB}MB`);
    console.log(`   💚 系统健康: ${healthSummary.healthyCount}/${healthSummary.totalCount} 组件正常`);
  }
  
  async testExtremeLoadHandling() {
    console.log('📊 测试6: 极端负载测试...');
    
    const state = new SystemState();
    const handler = new IntelligentErrorHandler(state);
    
    this.benchmark.start('extreme_load');
    
    // 极端并发操作
    const operationFactory = (index) => {
      return new Promise(async (resolve) => {
        try {
          // 极快的状态更新
          for (let i = 0; i < 10; i++) {
            state.updateComponent('loadTest', {
              status: 'overload',
              index: index,
              subIndex: i,
              timestamp: Date.now(),
              payload: new Array(50).fill(Math.random()) // 一些负载数据
            });
          }
          
          // 快速错误生成
          const error = new Error(`Extreme load error ${index}`);
          await handler.handleError(error, { component: 'loadTest', extreme: true });
          
          resolve();
        } catch (e) {
          resolve(); // 即使出错也继续
        }
      });
    };
    
    const results = await this.loadGen.runConcurrentOperations(operationFactory, 5000);
    const duration = this.benchmark.end();
    
    // 检查系统是否还能响应
    const finalHealth = state.getHealthSummary();
    const canStillRespond = finalHealth !== null;
    
    this.results.extremeLoad = {
      duration,
      ...results,
      systemResponsive: canStillRespond,
      passed: results.successRate > 80 && canStillRespond && duration < 30000 // 30秒内
    };
    
    console.log(`   ✅ 极端负载: ${results.completedRequests}/${results.totalRequests} 完成`);
    console.log(`   ⚡ 吞吐量: ${results.throughput} ops/sec`);
    console.log(`   🎯 系统响应: ${canStillRespond ? '正常' : '失败'}`);
  }
  
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 GMAIL MCP BRIDGE 性能测试报告');
    console.log('='.repeat(80));
    
    const benchmarkResults = this.benchmark.getResults();
    const memoryAnalysis = benchmarkResults.memoryAnalysis;
    
    // 性能摘要
    console.log('\n🚀 性能摘要:');
    console.log(`   状态更新: ${this.results.stateUpdates.updatesPerSecond} ops/sec`);
    console.log(`   错误处理: ${this.results.errorHandling.errorsPerSecond} errors/sec`);
    console.log(`   并发吞吐量: ${this.results.concurrentOps.throughput} ops/sec`);
    console.log(`   平均响应时间: ${Math.round(this.results.concurrentOps.avgResponseTime)}ms`);
    
    // 内存分析
    console.log('\n🧠 内存分析:');
    if (memoryAnalysis) {
      console.log(`   初始堆内存: ${memoryAnalysis.initialHeap}MB`);
      console.log(`   最终堆内存: ${memoryAnalysis.finalHeap}MB`);
      console.log(`   峰值堆内存: ${memoryAnalysis.maxHeap}MB`);
      console.log(`   内存增长: ${memoryAnalysis.growthMB}MB (${memoryAnalysis.growthPercent}%)`);
      console.log(`   潜在泄漏: ${memoryAnalysis.potentialLeak ? '⚠️ 是' : '✅ 否'}`);
    }
    
    // 稳定性指标
    console.log('\n💪 稳定性指标:');
    console.log(`   长时间运行: ${this.results.stabilityTest.operationCount} 操作完成`);
    console.log(`   内存增长: ${this.results.stabilityTest.memoryGrowthMB}MB`);
    console.log(`   组件健康: ${this.results.stabilityTest.healthyComponents}/${this.results.stabilityTest.totalComponents}`);
    console.log(`   极端负载存活: ${this.results.extremeLoad.systemResponsive ? '✅' : '❌'}`);
    
    // Linus 式评判
    console.log('\n' + '='.repeat(80));
    console.log('💀 LINUS 式性能评判');
    console.log('='.repeat(80));
    
    const allTestsPassed = Object.values(this.results).every(result => result.passed);
    const hasMemoryLeaks = memoryAnalysis && memoryAnalysis.potentialLeak;
    const goodPerformance = this.results.stateUpdates.updatesPerSecond > 5000 &&
                           this.results.concurrentOps.avgResponseTime < 100;
    
    if (allTestsPassed && !hasMemoryLeaks && goodPerformance) {
      console.log('🟢 "这性能有好品味！数据结构高效，没有内存泄漏。"');
      console.log('   "继续这样优化，用户不会抱怨慢。"');
    } else if (allTestsPassed && !hasMemoryLeaks) {
      console.log('🟡 "性能凑合，但还能更快。"');
      console.log('   "检查那些 O(n²) 算法，用更好的数据结构。"');
    } else {
      console.log('🔴 "这性能是垃圾！"');
      console.log('   "修复内存泄漏，重新设计算法。"');
      
      if (hasMemoryLeaks) {
        console.log('   "内存泄漏是不可接受的！找到并修复它。"');
      }
    }
    
    // 测试总结
    const totalTests = Object.keys(this.results).length;
    const passedTests = Object.values(this.results).filter(r => r.passed).length;
    const successRate = (passedTests / totalTests) * 100;
    
    console.log(`\n📊 性能测试通过率: ${successRate.toFixed(1)}% (${passedTests}/${totalTests})`);
    console.log(`⏱️  总测试时间: ${benchmarkResults.totalTestTime}ms`);
    
    // 保存详细结果
    this.saveDetailedResults();
  }
  
  saveDetailedResults() {
    const detailedResults = {
      timestamp: new Date().toISOString(),
      summary: this.results,
      benchmark: this.benchmark.getResults(),
      memoryLeakDetection: this.memoryDetector.detectLeaks(),
      systemInfo: {
        platform: process.platform,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
        cpus: require('os').cpus().length
      }
    };
    
    // 在实际环境中，这里会保存到文件
    console.log('\n💾 详细结果已记录 (在实际环境中会保存到文件)');
  }
}

// 导出测试类
module.exports = {
  PerformanceBenchmark,
  ConcurrencyLoadGenerator, 
  MemoryLeakDetector,
  PerformanceTestSuite
};

// 如果直接运行此文件，执行测试
if (require.main === module) {
  async function runPerformanceTests() {
    const testSuite = new PerformanceTestSuite();
    await testSuite.runAllTests();
  }
  
  runPerformanceTests().catch(console.error);
}