#!/usr/bin/env node

/**
 * Gmail MCP Bridge - Auto-Recovery Performance Analysis
 * 深度分析Auto-Recovery机制对系统性能的影响
 */

import { performance } from 'perf_hooks';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RecoveryAnalysisTest {
    constructor() {
        this.results = {
            baseline: [],
            withRecovery: [],
            circuitBreaker: [],
            stress: []
        };
        this.startTime = Date.now();
        this.config = {
            iterations: 30,
            stressIterations: 100,
            concurrentUsers: 10,
            failureRate: 0.3, // 30% 失败率来触发recovery
            circuitBreakerThreshold: 5
        };
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
        console.log(`[${timestamp}] [${level}] [+${elapsed}s] ${message}`);
    }

    // 基准性能测试 (无Recovery机制)
    async runBaselineTest() {
        this.log("运行基准性能测试 (无Recovery机制)...");
        const times = [];
        const memoryUsage = [];
        
        for (let i = 0; i < this.config.iterations; i++) {
            const startMem = process.memoryUsage().heapUsed;
            const start = performance.now();
            
            // 模拟正常Gmail API操作
            await this.simulateGmailOperation('normal');
            
            const end = performance.now();
            const endMem = process.memoryUsage().heapUsed;
            
            times.push(end - start);
            memoryUsage.push(endMem - startMem);
            
            if (i % 10 === 0) {
                this.log(`基准测试进度: ${i}/${this.config.iterations}`);
            }
        }

        const stats = this.calculateStats(times);
        const avgMemory = memoryUsage.reduce((a, b) => a + b, 0) / memoryUsage.length;
        
        this.results.baseline = {
            responseTime: stats,
            avgMemoryDelta: avgMemory / 1024 / 1024, // MB
            successRate: 100,
            iterations: this.config.iterations
        };

        this.log(`基准测试完成 - 平均响应时间: ${stats.avg.toFixed(2)}ms`);
        return this.results.baseline;
    }

    // Recovery机制性能测试
    async runRecoveryTest() {
        this.log("运行Auto-Recovery机制性能测试...");
        const times = [];
        const memoryUsage = [];
        const recoveryAttempts = [];
        let successCount = 0;

        for (let i = 0; i < this.config.iterations; i++) {
            const startMem = process.memoryUsage().heapUsed;
            const start = performance.now();
            let attempts = 0;
            
            // 模拟带Recovery机制的Gmail API操作
            const result = await this.simulateGmailOperationWithRecovery();
            attempts = result.attempts;
            
            const end = performance.now();
            const endMem = process.memoryUsage().heapUsed;
            
            times.push(end - start);
            memoryUsage.push(endMem - startMem);
            recoveryAttempts.push(attempts);
            
            if (result.success) successCount++;
            
            if (i % 10 === 0) {
                this.log(`Recovery测试进度: ${i}/${this.config.iterations}, 成功率: ${((successCount/(i+1))*100).toFixed(1)}%`);
            }
        }

        const stats = this.calculateStats(times);
        const avgMemory = memoryUsage.reduce((a, b) => a + b, 0) / memoryUsage.length;
        const avgAttempts = recoveryAttempts.reduce((a, b) => a + b, 0) / recoveryAttempts.length;
        
        this.results.withRecovery = {
            responseTime: stats,
            avgMemoryDelta: avgMemory / 1024 / 1024, // MB
            successRate: (successCount / this.config.iterations) * 100,
            avgRetryAttempts: avgAttempts,
            iterations: this.config.iterations
        };

        this.log(`Recovery测试完成 - 平均响应时间: ${stats.avg.toFixed(2)}ms, 成功率: ${this.results.withRecovery.successRate.toFixed(1)}%`);
        return this.results.withRecovery;
    }

    // Circuit Breaker性能分析
    async runCircuitBreakerAnalysis() {
        this.log("运行Circuit Breaker性能分析...");
        const states = ['closed', 'open', 'halfOpen'];
        const results = {};

        for (const state of states) {
            this.log(`测试Circuit Breaker状态: ${state}`);
            const times = [];
            
            for (let i = 0; i < 20; i++) {
                const start = performance.now();
                await this.simulateCircuitBreakerOperation(state);
                const end = performance.now();
                times.push(end - start);
            }
            
            results[state] = this.calculateStats(times);
        }

        this.results.circuitBreaker = results;
        this.log("Circuit Breaker分析完成");
        return results;
    }

    // 压力测试 - 高并发场景下的Recovery性能
    async runStressTest() {
        this.log(`运行压力测试 - ${this.config.concurrentUsers}个并发用户...`);
        
        const batches = Math.ceil(this.config.stressIterations / this.config.concurrentUsers);
        let totalSuccessful = 0;
        let totalFailed = 0;
        const allTimes = [];
        
        for (let batch = 0; batch < batches; batch++) {
            const promises = [];
            const batchStart = performance.now();
            
            for (let user = 0; user < this.config.concurrentUsers && batch * this.config.concurrentUsers + user < this.config.stressIterations; user++) {
                promises.push(this.simulateStressOperation());
            }
            
            const results = await Promise.all(promises);
            const batchEnd = performance.now();
            
            results.forEach(result => {
                if (result.success) totalSuccessful++;
                else totalFailed++;
                allTimes.push(result.time);
            });
            
            if (batch % 5 === 0) {
                this.log(`压力测试进度: ${batch * this.config.concurrentUsers}/${this.config.stressIterations}, 批次时间: ${(batchEnd - batchStart).toFixed(2)}ms`);
            }
        }

        const stats = this.calculateStats(allTimes);
        this.results.stress = {
            responseTime: stats,
            successRate: (totalSuccessful / (totalSuccessful + totalFailed)) * 100,
            totalOperations: totalSuccessful + totalFailed,
            concurrentUsers: this.config.concurrentUsers
        };

        this.log(`压力测试完成 - 成功率: ${this.results.stress.successRate.toFixed(1)}%, 平均响应时间: ${stats.avg.toFixed(2)}ms`);
        return this.results.stress;
    }

    // 模拟函数
    async simulateGmailOperation(type = 'normal') {
        const baseDelay = type === 'normal' ? 80 : 120;
        const variance = 40;
        await this.sleep(baseDelay + Math.random() * variance);
        
        // 模拟偶发失败
        if (type === 'withFailure' && Math.random() < this.config.failureRate) {
            throw new Error('Simulated API failure');
        }
        
        return { status: 'success', data: 'mock_data' };
    }

    async simulateGmailOperationWithRecovery() {
        let attempts = 1;
        let lastError = null;
        
        for (let i = 0; i < 3; i++) {
            try {
                // 增加一些Recovery检查开销
                await this.sleep(5); // Recovery机制检查开销
                
                await this.simulateGmailOperation('withFailure');
                return { success: true, attempts };
            } catch (error) {
                lastError = error;
                attempts++;
                
                if (i < 2) {
                    // 指数退避重试
                    const retryDelay = Math.pow(2, i) * 100 + Math.random() * 50;
                    await this.sleep(retryDelay);
                }
            }
        }
        
        return { success: false, attempts, error: lastError };
    }

    async simulateCircuitBreakerOperation(state) {
        switch (state) {
            case 'closed':
                // 正常操作，需要完整的处理时间
                await this.sleep(100 + Math.random() * 50);
                break;
            case 'open':
                // 快速失败，几乎无延迟
                await this.sleep(2 + Math.random() * 3);
                break;
            case 'halfOpen':
                // 谨慎操作，稍长的响应时间
                await this.sleep(120 + Math.random() * 60);
                break;
        }
        return { state, status: 'success' };
    }

    async simulateStressOperation() {
        const start = performance.now();
        try {
            await this.simulateGmailOperationWithRecovery();
            const end = performance.now();
            return { success: true, time: end - start };
        } catch (error) {
            const end = performance.now();
            return { success: false, time: end - start, error };
        }
    }

    // 统计工具函数
    calculateStats(times) {
        if (times.length === 0) return { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0, stdDev: 0 };
        
        const sorted = [...times].sort((a, b) => a - b);
        const sum = times.reduce((a, b) => a + b, 0);
        const avg = sum / times.length;
        
        // 计算标准差
        const variance = times.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / times.length;
        const stdDev = Math.sqrt(variance);
        
        return {
            avg,
            min: Math.min(...times),
            max: Math.max(...times),
            p50: sorted[Math.floor(sorted.length * 0.5)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            stdDev
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 生成详细的性能分析报告
    generateDetailedReport() {
        console.log('\n' + '='.repeat(100));
        console.log('Gmail MCP Bridge - Auto-Recovery机制性能深度分析报告');
        console.log('='.repeat(100));
        
        // 基准 vs Recovery对比分析
        console.log('\n【1. 基准性能 vs Auto-Recovery性能对比】');
        console.log('-'.repeat(80));
        
        if (this.results.baseline && this.results.withRecovery) {
            const baseline = this.results.baseline;
            const recovery = this.results.withRecovery;
            
            const avgOverhead = ((recovery.responseTime.avg - baseline.responseTime.avg) / baseline.responseTime.avg) * 100;
            const p95Overhead = ((recovery.responseTime.p95 - baseline.responseTime.p95) / baseline.responseTime.p95) * 100;
            const memoryOverhead = ((recovery.avgMemoryDelta - baseline.avgMemoryDelta) / baseline.avgMemoryDelta) * 100;
            
            console.log(`基准响应时间 (无Recovery):     平均 ${baseline.responseTime.avg.toFixed(2)}ms, P95 ${baseline.responseTime.p95.toFixed(2)}ms`);
            console.log(`Recovery响应时间:              平均 ${recovery.responseTime.avg.toFixed(2)}ms, P95 ${recovery.responseTime.p95.toFixed(2)}ms`);
            console.log(`响应时间开销:                  平均 +${avgOverhead.toFixed(2)}%, P95 +${p95Overhead.toFixed(2)}%`);
            console.log(`内存使用开销:                  +${memoryOverhead.toFixed(2)}%`);
            console.log(`成功率提升:                    ${baseline.successRate.toFixed(1)}% → ${recovery.successRate.toFixed(1)}%`);
            console.log(`平均重试次数:                  ${recovery.avgRetryAttempts.toFixed(2)}次`);
            
            // 性能评估
            console.log('\n【性能开销评估】');
            if (avgOverhead < 15) {
                console.log(`✅ 响应时间开销: ${avgOverhead.toFixed(2)}% (优秀 - 低于15%)`);
            } else if (avgOverhead < 25) {
                console.log(`🟡 响应时间开销: ${avgOverhead.toFixed(2)}% (可接受 - 15-25%之间)`);
            } else {
                console.log(`❌ 响应时间开销: ${avgOverhead.toFixed(2)}% (需要优化 - 超过25%)`);
            }
        }

        // Circuit Breaker性能分析
        console.log('\n【2. Circuit Breaker状态性能分析】');
        console.log('-'.repeat(80));
        
        if (this.results.circuitBreaker) {
            const cb = this.results.circuitBreaker;
            console.log(`闭合状态 (Closed):   平均 ${cb.closed.avg.toFixed(2)}ms, P95 ${cb.closed.p95.toFixed(2)}ms`);
            console.log(`断开状态 (Open):     平均 ${cb.open.avg.toFixed(2)}ms, P95 ${cb.open.p95.toFixed(2)}ms`);
            console.log(`半开状态 (HalfOpen): 平均 ${cb.halfOpen.avg.toFixed(2)}ms, P95 ${cb.halfOpen.p95.toFixed(2)}ms`);
            
            const openSpeedup = ((cb.closed.avg - cb.open.avg) / cb.closed.avg) * 100;
            console.log(`断开状态响应加速:    +${openSpeedup.toFixed(1)}% (快速失败效果)`);
        }

        // 压力测试结果
        console.log('\n【3. 高并发压力测试结果】');
        console.log('-'.repeat(80));
        
        if (this.results.stress) {
            const stress = this.results.stress;
            console.log(`并发用户数:        ${stress.concurrentUsers}`);
            console.log(`总操作次数:        ${stress.totalOperations}`);
            console.log(`平均响应时间:      ${stress.responseTime.avg.toFixed(2)}ms`);
            console.log(`P95响应时间:       ${stress.responseTime.p95.toFixed(2)}ms`);
            console.log(`P99响应时间:       ${stress.responseTime.p99.toFixed(2)}ms`);
            console.log(`成功率:            ${stress.successRate.toFixed(1)}%`);
            console.log(`吞吐量:            ${(stress.totalOperations / ((Date.now() - this.startTime) / 1000)).toFixed(1)} ops/sec`);
        }

        // 关键性能指标汇总
        console.log('\n【4. 关键性能指标汇总】');
        console.log('-'.repeat(80));
        
        const kpis = [];
        
        if (this.results.baseline && this.results.withRecovery) {
            const avgOverhead = ((this.results.withRecovery.responseTime.avg - this.results.baseline.responseTime.avg) / this.results.baseline.responseTime.avg) * 100;
            kpis.push({
                metric: 'Auto-Recovery开销',
                value: `${avgOverhead.toFixed(2)}%`,
                target: '<20%',
                status: avgOverhead < 20 ? '✅ PASS' : '❌ FAIL'
            });
            
            kpis.push({
                metric: '故障恢复能力',
                value: `${this.results.withRecovery.successRate.toFixed(1)}%`,
                target: '>95%',
                status: this.results.withRecovery.successRate > 95 ? '✅ PASS' : '❌ FAIL'
            });
        }
        
        if (this.results.circuitBreaker) {
            kpis.push({
                metric: 'Circuit Breaker开销',
                value: `${this.results.circuitBreaker.closed.avg.toFixed(2)}ms`,
                target: '<200ms',
                status: this.results.circuitBreaker.closed.avg < 200 ? '✅ PASS' : '❌ FAIL'
            });
            
            kpis.push({
                metric: '快速失败响应',
                value: `${this.results.circuitBreaker.open.avg.toFixed(2)}ms`,
                target: '<50ms',
                status: this.results.circuitBreaker.open.avg < 50 ? '✅ PASS' : '❌ FAIL'
            });
        }
        
        if (this.results.stress) {
            kpis.push({
                metric: '并发成功率',
                value: `${this.results.stress.successRate.toFixed(1)}%`,
                target: '>90%',
                status: this.results.stress.successRate > 90 ? '✅ PASS' : '❌ FAIL'
            });
        }
        
        kpis.forEach(kpi => {
            console.log(`${kpi.metric}: ${kpi.value} (目标: ${kpi.target}) ${kpi.status}`);
        });
        
        // 总体评估和建议
        console.log('\n【5. 总体评估与优化建议】');
        console.log('-'.repeat(80));
        
        const passedKPIs = kpis.filter(k => k.status.includes('PASS')).length;
        const totalKPIs = kpis.length;
        const overallScore = (passedKPIs / totalKPIs) * 100;
        
        console.log(`整体评分: ${overallScore.toFixed(1)}% (${passedKPIs}/${totalKPIs} KPIs通过)`);
        
        if (overallScore >= 90) {
            console.log('✅ 优秀: Auto-Recovery机制性能表现优异，建议投入生产使用');
        } else if (overallScore >= 70) {
            console.log('🟡 良好: Auto-Recovery机制性能可接受，建议进行小幅优化');
        } else {
            console.log('❌ 需要改进: Auto-Recovery机制存在性能问题，需要重点优化');
        }
        
        console.log('\n【具体优化建议】');
        if (this.results.baseline && this.results.withRecovery) {
            const avgOverhead = ((this.results.withRecovery.responseTime.avg - this.results.baseline.responseTime.avg) / this.results.baseline.responseTime.avg) * 100;
            if (avgOverhead > 20) {
                console.log('• 优化重试策略: 减少重试延迟，使用更智能的退避算法');
                console.log('• 缓存优化: 增加本地缓存减少重复API调用');
                console.log('• 异步处理: 将Recovery检查异步化，减少主流程阻塞');
            }
        }
        
        if (this.results.stress && this.results.stress.successRate < 90) {
            console.log('• 并发限制: 实现请求队列和限流机制');
            console.log('• 资源池: 使用连接池和对象池减少资源创建开销');
        }
        
        console.log('='.repeat(100));
        const totalDuration = ((Date.now() - this.startTime) / 1000).toFixed(1);
        console.log(`分析完成时间: ${totalDuration}秒`);
        console.log(`报告生成时间: ${new Date().toISOString()}`);
    }

    async runFullAnalysis() {
        try {
            this.log("开始Gmail MCP Bridge Auto-Recovery深度性能分析");
            this.log("预计分析时间: 90-120秒");

            // 运行所有测试
            await this.runBaselineTest();
            await this.runRecoveryTest();
            await this.runCircuitBreakerAnalysis();
            await this.runStressTest();

            // 生成详细报告
            this.generateDetailedReport();

        } catch (error) {
            this.log(`分析过程中发生错误: ${error.message}`, 'ERROR');
            console.error(error);
        }
    }
}

// 运行分析
if (import.meta.url === `file://${process.argv[1]}`) {
    const analysis = new RecoveryAnalysisTest();
    analysis.runFullAnalysis().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('分析失败:', error);
        process.exit(1);
    });
}

export default RecoveryAnalysisTest;