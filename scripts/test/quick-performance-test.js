#!/usr/bin/env node
/**
 * 快速性能测试 - 验证系统在压力下的表现
 */

import { performance } from 'perf_hooks';

// 测试MCP服务器和HTTP桥接的性能
async function performanceTest() {
  console.log('🚀 Gmail MCP Bridge 性能测试\n');
  
  const results = {
    httpRequests: [],
    memoryUsage: [],
    errorRate: 0,
    totalRequests: 0
  };
  
  // 测试HTTP桥接服务器性能
  console.log('📊 测试HTTP桥接服务器性能...');
  const httpTestStart = performance.now();
  
  // 并发请求测试
  const concurrentRequests = 50;
  const promises = [];
  
  for (let i = 0; i < concurrentRequests; i++) {
    const requestStart = performance.now();
    const promise = fetch('http://localhost:3456/health')
      .then(response => {
        const duration = performance.now() - requestStart;
        results.httpRequests.push({
          success: response.ok,
          duration: duration,
          status: response.status
        });
        results.totalRequests++;
        return response.json();
      })
      .catch(error => {
        const duration = performance.now() - requestStart;
        results.httpRequests.push({
          success: false,
          duration: duration,
          error: error.message
        });
        results.totalRequests++;
        results.errorRate++;
      });
    
    promises.push(promise);
  }
  
  console.log(`发起 ${concurrentRequests} 个并发请求...`);
  await Promise.allSettled(promises);
  
  const httpTestDuration = performance.now() - httpTestStart;
  
  // 分析结果
  const successfulRequests = results.httpRequests.filter(r => r.success).length;
  const averageResponseTime = results.httpRequests
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.duration, 0) / successfulRequests;
  
  const maxResponseTime = Math.max(...results.httpRequests
    .filter(r => r.success)
    .map(r => r.duration));
  
  const minResponseTime = Math.min(...results.httpRequests
    .filter(r => r.success)
    .map(r => r.duration));
  
  // 内存使用情况
  const memUsage = process.memoryUsage();
  
  console.log('\n📈 性能测试结果:');
  console.log('='.repeat(50));
  console.log(`总请求数: ${results.totalRequests}`);
  console.log(`成功请求: ${successfulRequests} (${((successfulRequests/results.totalRequests)*100).toFixed(1)}%)`);
  console.log(`失败请求: ${results.errorRate} (${((results.errorRate/results.totalRequests)*100).toFixed(1)}%)`);
  console.log(`测试耗时: ${httpTestDuration.toFixed(2)}ms`);
  console.log(`请求/秒: ${(concurrentRequests / (httpTestDuration/1000)).toFixed(1)}`);
  console.log('')
  console.log('响应时间统计:');
  console.log(`- 平均: ${averageResponseTime.toFixed(2)}ms`);
  console.log(`- 最快: ${minResponseTime.toFixed(2)}ms`);
  console.log(`- 最慢: ${maxResponseTime.toFixed(2)}ms`);
  console.log('')
  console.log('内存使用情况:');
  console.log(`- RSS: ${(memUsage.rss / 1024 / 1024).toFixed(1)}MB`);
  console.log(`- Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`);
  console.log(`- Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(1)}MB`);
  
  // 性能评估
  const performanceScore = calculatePerformanceScore({
    successRate: successfulRequests / results.totalRequests,
    averageResponseTime,
    maxResponseTime,
    throughput: concurrentRequests / (httpTestDuration/1000)
  });
  
  console.log('\n🎯 性能评估:');
  console.log('='.repeat(50));
  console.log(`总体评分: ${performanceScore.overall}/100`);
  console.log(`稳定性: ${performanceScore.stability}/25`);
  console.log(`响应速度: ${performanceScore.speed}/25`);
  console.log(`吞吐量: ${performanceScore.throughput}/25`);
  console.log(`可靠性: ${performanceScore.reliability}/25`);
  
  if (performanceScore.overall >= 80) {
    console.log('✅ 性能表现优秀！');
  } else if (performanceScore.overall >= 60) {
    console.log('⚠️ 性能表现良好，有改进空间');
  } else {
    console.log('❌ 性能表现需要优化');
  }
  
  return performanceScore.overall >= 70;
}

function calculatePerformanceScore(metrics) {
  const score = {
    stability: 0,
    speed: 0,
    throughput: 0,
    reliability: 0,
    overall: 0
  };
  
  // 稳定性评分 (基于成功率)
  if (metrics.successRate >= 0.99) score.stability = 25;
  else if (metrics.successRate >= 0.95) score.stability = 20;
  else if (metrics.successRate >= 0.90) score.stability = 15;
  else if (metrics.successRate >= 0.80) score.stability = 10;
  else score.stability = 5;
  
  // 响应速度评分 (基于平均响应时间)
  if (metrics.averageResponseTime <= 50) score.speed = 25;
  else if (metrics.averageResponseTime <= 100) score.speed = 20;
  else if (metrics.averageResponseTime <= 200) score.speed = 15;
  else if (metrics.averageResponseTime <= 500) score.speed = 10;
  else score.speed = 5;
  
  // 吞吐量评分 (基于每秒处理的请求数)
  if (metrics.throughput >= 100) score.throughput = 25;
  else if (metrics.throughput >= 50) score.throughput = 20;
  else if (metrics.throughput >= 25) score.throughput = 15;
  else if (metrics.throughput >= 10) score.throughput = 10;
  else score.throughput = 5;
  
  // 可靠性评分 (基于最大响应时间的稳定性)
  const responseTimeVariability = metrics.maxResponseTime / metrics.averageResponseTime;
  if (responseTimeVariability <= 2) score.reliability = 25;
  else if (responseTimeVariability <= 3) score.reliability = 20;
  else if (responseTimeVariability <= 5) score.reliability = 15;
  else if (responseTimeVariability <= 10) score.reliability = 10;
  else score.reliability = 5;
  
  score.overall = score.stability + score.speed + score.throughput + score.reliability;
  
  return score;
}

// 运行测试
performanceTest().then(passed => {
  if (passed) {
    console.log('\n🎉 性能测试通过！');
    process.exit(0);
  } else {
    console.log('\n⚠️ 性能测试需要关注');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n❌ 性能测试失败:', error.message);
  process.exit(1);
});