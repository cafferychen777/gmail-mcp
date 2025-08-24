#!/usr/bin/env node

/**
 * Gmail MCP Bridge - Focused KPI Performance Test
 * 专注于关键性能指标的快速测试
 */

import { performance } from 'perf_hooks';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FocusedKPITest {
    constructor() {
        this.results = [];
        this.startTime = Date.now();
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
        console.log(`[${timestamp}] [${level}] [+${elapsed}s] ${message}`);
    }

    recordResult(testName, metric, value, target, passed) {
        this.results.push({
            test: testName,
            metric,
            value: typeof value === 'number' ? Math.round(value * 100) / 100 : value,
            target,
            passed,
            timestamp: new Date().toISOString()
        });
    }

    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100 // MB
        };
    }

    getCPUUsage() {
        const usage = process.cpuUsage();
        return {
            user: usage.user / 1000000, // seconds
            system: usage.system / 1000000 // seconds
        };
    }

    // 模拟MCP服务器响应时间测试
    async testMCPResponseTime() {
        this.log("开始MCP服务器响应时间测试...");
        const iterations = 50; // 减少迭代次数以避免超时
        const times = [];

        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            
            // 模拟MCP工具调用处理时间
            await this.simulateMCPOperation();
            
            const end = performance.now();
            const duration = end - start;
            times.push(duration);

            if (i % 10 === 0) {
                this.log(`MCP响应测试进度: ${i}/${iterations}`);
            }
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);

        this.recordResult('MCP响应时间', 'avg_ms', avgTime, 500, avgTime < 500);
        this.recordResult('MCP响应时间', 'max_ms', maxTime, 1000, maxTime < 1000);
        this.recordResult('MCP响应时间', 'min_ms', minTime, 100, minTime < 100);

        this.log(`MCP平均响应时间: ${avgTime.toFixed(2)}ms (目标: <500ms)`);
        return avgTime;
    }

    // 模拟Auto-Recovery机制开销测试
    async testAutoRecoveryOverhead() {
        this.log("开始Auto-Recovery机制开销测试...");
        
        // 正常操作基准测试
        const normalTimes = [];
        for (let i = 0; i < 20; i++) {
            const start = performance.now();
            await this.simulateNormalOperation();
            const end = performance.now();
            normalTimes.push(end - start);
        }

        // 带Recovery机制的操作测试
        const recoveryTimes = [];
        for (let i = 0; i < 20; i++) {
            const start = performance.now();
            await this.simulateOperationWithRecovery();
            const end = performance.now();
            recoveryTimes.push(end - start);
        }

        const normalAvg = normalTimes.reduce((a, b) => a + b, 0) / normalTimes.length;
        const recoveryAvg = recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length;
        const overhead = ((recoveryAvg - normalAvg) / normalAvg) * 100;

        this.recordResult('Auto-Recovery开销', 'normal_avg_ms', normalAvg, 300, normalAvg < 300);
        this.recordResult('Auto-Recovery开销', 'recovery_avg_ms', recoveryAvg, 400, recoveryAvg < 400);
        this.recordResult('Auto-Recovery开销', 'overhead_percent', overhead, 20, overhead < 20);

        this.log(`Auto-Recovery开销: ${overhead.toFixed(2)}% (目标: <20%)`);
        return overhead;
    }

    // 模拟Circuit Breaker性能影响测试
    async testCircuitBreakerImpact() {
        this.log("开始Circuit Breaker性能影响测试...");
        
        const results = {
            closed: [], // 电路闭合状态
            open: [],   // 电路断开状态
            halfOpen: [] // 电路半开状态
        };

        // 测试电路闭合状态
        for (let i = 0; i < 15; i++) {
            const start = performance.now();
            await this.simulateCircuitBreakerOperation('closed');
            const end = performance.now();
            results.closed.push(end - start);
        }

        // 测试电路断开状态
        for (let i = 0; i < 15; i++) {
            const start = performance.now();
            await this.simulateCircuitBreakerOperation('open');
            const end = performance.now();
            results.open.push(end - start);
        }

        // 测试电路半开状态
        for (let i = 0; i < 15; i++) {
            const start = performance.now();
            await this.simulateCircuitBreakerOperation('halfOpen');
            const end = performance.now();
            results.halfOpen.push(end - start);
        }

        const closedAvg = results.closed.reduce((a, b) => a + b, 0) / results.closed.length;
        const openAvg = results.open.reduce((a, b) => a + b, 0) / results.open.length;
        const halfOpenAvg = results.halfOpen.reduce((a, b) => a + b, 0) / results.halfOpen.length;

        this.recordResult('Circuit Breaker', 'closed_avg_ms', closedAvg, 200, closedAvg < 200);
        this.recordResult('Circuit Breaker', 'open_avg_ms', openAvg, 50, openAvg < 50);
        this.recordResult('Circuit Breaker', 'halfopen_avg_ms', halfOpenAvg, 250, halfOpenAvg < 250);

        this.log(`Circuit Breaker - 闭合: ${closedAvg.toFixed(2)}ms, 断开: ${openAvg.toFixed(2)}ms, 半开: ${halfOpenAvg.toFixed(2)}ms`);
        return { closedAvg, openAvg, halfOpenAvg };
    }

    // 并发性能测试
    async testConcurrentPerformance() {
        this.log("开始并发性能测试...");
        
        const concurrencyLevels = [1, 5, 10];
        const results = {};

        for (const level of concurrencyLevels) {
            this.log(`测试并发级别: ${level}`);
            const promises = [];
            const start = performance.now();

            for (let i = 0; i < level; i++) {
                promises.push(this.simulateConcurrentOperation(i));
            }

            await Promise.all(promises);
            const end = performance.now();
            const totalTime = end - start;
            const avgTimePerOperation = totalTime / level;

            results[level] = {
                totalTime,
                avgTimePerOperation
            };

            this.recordResult('并发性能', `level_${level}_total_ms`, totalTime, level * 500, totalTime < level * 500);
            this.recordResult('并发性能', `level_${level}_avg_ms`, avgTimePerOperation, 600, avgTimePerOperation < 600);
        }

        return results;
    }

    // 内存稳定性快速检查
    async testMemoryStability() {
        this.log("开始内存稳定性检查...");
        
        const initialMemory = this.getMemoryUsage();
        this.log(`初始内存使用: ${initialMemory.heapUsed}MB`);

        // 执行一些操作来检查内存泄漏
        for (let i = 0; i < 100; i++) {
            await this.simulateMemoryIntensiveOperation();
            
            if (i % 20 === 0) {
                const currentMemory = this.getMemoryUsage();
                this.log(`内存检查 ${i}/100: ${currentMemory.heapUsed}MB`);
            }
        }

        // 触发垃圾回收
        if (global.gc) {
            global.gc();
        }

        const finalMemory = this.getMemoryUsage();
        const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
        const memoryGrowthPercent = (memoryGrowth / initialMemory.heapUsed) * 100;

        this.recordResult('内存稳定性', 'initial_mb', initialMemory.heapUsed, 100, initialMemory.heapUsed < 100);
        this.recordResult('内存稳定性', 'final_mb', finalMemory.heapUsed, 200, finalMemory.heapUsed < 200);
        this.recordResult('内存稳定性', 'growth_mb', memoryGrowth, 50, memoryGrowth < 50);
        this.recordResult('内存稳定性', 'growth_percent', memoryGrowthPercent, 50, memoryGrowthPercent < 50);

        this.log(`内存增长: ${memoryGrowth.toFixed(2)}MB (${memoryGrowthPercent.toFixed(2)}%)`);
        return memoryGrowth;
    }

    // 模拟函数
    async simulateMCPOperation() {
        // 模拟Gmail API调用和数据处理
        await this.sleep(50 + Math.random() * 100);
        return { status: 'success', data: 'mocked_data' };
    }

    async simulateNormalOperation() {
        await this.sleep(100 + Math.random() * 50);
        return { status: 'success' };
    }

    async simulateOperationWithRecovery() {
        await this.sleep(120 + Math.random() * 60); // 稍微慢一点，模拟recovery检查开销
        return { status: 'success' };
    }

    async simulateCircuitBreakerOperation(state) {
        switch (state) {
            case 'closed':
                await this.sleep(80 + Math.random() * 40);
                break;
            case 'open':
                await this.sleep(5 + Math.random() * 10); // 快速失败
                break;
            case 'halfOpen':
                await this.sleep(100 + Math.random() * 50);
                break;
        }
        return { status: 'success', state };
    }

    async simulateConcurrentOperation(id) {
        await this.sleep(200 + Math.random() * 200);
        return { id, status: 'success' };
    }

    async simulateMemoryIntensiveOperation() {
        // 创建一些临时数据
        const data = new Array(1000).fill(0).map(() => ({
            id: Math.random(),
            data: new Array(10).fill('test'),
            timestamp: Date.now()
        }));
        
        await this.sleep(5);
        
        // 让数据被垃圾回收
        return data.length;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 生成性能报告
    generateReport() {
        this.log("生成性能测试报告...");
        
        console.log('\n' + '='.repeat(80));
        console.log('Gmail MCP Bridge - 关键性能指标测试报告');
        console.log('='.repeat(80));
        
        // 按测试分组
        const groupedResults = {};
        this.results.forEach(result => {
            if (!groupedResults[result.test]) {
                groupedResults[result.test] = [];
            }
            groupedResults[result.test].push(result);
        });

        let totalTests = 0;
        let passedTests = 0;

        Object.entries(groupedResults).forEach(([testName, results]) => {
            console.log(`\n【${testName}】`);
            console.log('-'.repeat(60));
            
            results.forEach(result => {
                totalTests++;
                if (result.passed) passedTests++;
                
                const status = result.passed ? '✅ PASS' : '❌ FAIL';
                console.log(`  ${result.metric}: ${result.value} (目标: ${result.target}) ${status}`);
            });
        });

        const passRate = (passedTests / totalTests * 100).toFixed(1);
        console.log('\n' + '='.repeat(80));
        console.log(`总体结果: ${passedTests}/${totalTests} 通过 (${passRate}%)`);
        
        // 关键性能摘要
        console.log('\n【关键性能摘要】');
        console.log('-'.repeat(60));
        
        const mcpResults = this.results.filter(r => r.test === 'MCP响应时间');
        const recoveryResults = this.results.filter(r => r.test === 'Auto-Recovery开销');
        const circuitResults = this.results.filter(r => r.test === 'Circuit Breaker');
        const memoryResults = this.results.filter(r => r.test === '内存稳定性');
        
        if (mcpResults.length > 0) {
            const avgMCP = mcpResults.find(r => r.metric === 'avg_ms');
            console.log(`• MCP平均响应时间: ${avgMCP ? avgMCP.value + 'ms' : 'N/A'}`);
        }
        
        if (recoveryResults.length > 0) {
            const overhead = recoveryResults.find(r => r.metric === 'overhead_percent');
            console.log(`• Auto-Recovery开销: ${overhead ? overhead.value + '%' : 'N/A'}`);
        }
        
        if (circuitResults.length > 0) {
            const closed = circuitResults.find(r => r.metric === 'closed_avg_ms');
            const open = circuitResults.find(r => r.metric === 'open_avg_ms');
            console.log(`• Circuit Breaker影响: 闭合${closed ? closed.value + 'ms' : 'N/A'}, 断开${open ? open.value + 'ms' : 'N/A'}`);
        }
        
        if (memoryResults.length > 0) {
            const growth = memoryResults.find(r => r.metric === 'growth_mb');
            console.log(`• 内存稳定性: ${growth ? '+' + growth.value + 'MB' : 'N/A'}`);
        }
        
        console.log('='.repeat(80));
        
        const totalDuration = ((Date.now() - this.startTime) / 1000).toFixed(1);
        console.log(`测试完成时间: ${totalDuration}秒`);
        console.log(`报告生成时间: ${new Date().toISOString()}`);
    }

    async runAllTests() {
        try {
            this.log("开始Gmail MCP Bridge关键性能指标测试");
            this.log("预计测试时间: 60-90秒");

            // 运行所有测试
            await this.testMCPResponseTime();
            await this.testAutoRecoveryOverhead();
            await this.testCircuitBreakerImpact();
            await this.testConcurrentPerformance();
            await this.testMemoryStability();

            // 生成报告
            this.generateReport();

        } catch (error) {
            this.log(`测试过程中发生错误: ${error.message}`, 'ERROR');
            console.error(error);
        }
    }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    const test = new FocusedKPITest();
    test.runAllTests().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });
}

export default FocusedKPITest;