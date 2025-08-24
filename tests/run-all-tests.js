#!/usr/bin/env node

/**
 * Gmail MCP Bridge - 测试执行器
 * 
 * 一键运行所有状态管理系统测试
 * 
 * 基于 Linus 的测试哲学：
 * - "测试应该简单运行，不需要复杂的配置"
 * - "快速反馈比完美的测试框架更重要"
 * - "如果测试很难运行，开发者就不会运行它们"
 * 
 * @author Gmail MCP Bridge Team
 * @version 2.0.0
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * 测试执行器 - 协调所有测试套件的运行
 */
class TestRunner {
  constructor() {
    this.testSuites = [
      {
        name: '基础功能测试',
        file: 'status-management-test-suite.js',
        description: '测试状态管理、错误处理、恢复机制的核心功能',
        timeout: 30000, // 30秒
        critical: true
      },
      {
        name: '性能和稳定性测试', 
        file: 'performance-stress-test.js',
        description: '测试系统在高负载下的性能和内存稳定性',
        timeout: 60000, // 60秒
        critical: true
      },
      {
        name: '自动恢复验证测试',
        file: 'auto-recovery-validation.js', 
        description: '验证95%自动恢复率目标达成情况',
        timeout: 45000, // 45秒
        critical: true
      },
      {
        name: '边界条件和混沌测试',
        file: 'edge-cases-chaos-test.js',
        description: '测试极端条件和混沌场景下的系统稳定性',
        timeout: 30000, // 30秒  
        critical: false
      }
    ];
    
    this.results = {
      totalSuites: this.testSuites.length,
      passedSuites: 0,
      failedSuites: 0,
      skippedSuites: 0,
      suiteResults: [],
      startTime: null,
      endTime: null
    };
    
    this.options = {
      verbose: false,
      stopOnFailure: false,
      skipNonCritical: false,
      generateReport: true
    };
  }
  
  /**
   * 解析命令行参数
   */
  parseArgs() {
    const args = process.argv.slice(2);
    
    for (const arg of args) {
      switch (arg) {
        case '--verbose':
        case '-v':
          this.options.verbose = true;
          break;
        case '--stop-on-failure':
        case '-s':
          this.options.stopOnFailure = true;
          break;
        case '--critical-only':
        case '-c':
          this.options.skipNonCritical = true;
          break;
        case '--no-report':
          this.options.generateReport = false;
          break;
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
          break;
        default:
          console.log(`❓ 未知参数: ${arg}`);
          this.showHelp();
          process.exit(1);
      }
    }
  }
  
  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
Gmail MCP Bridge 测试执行器

用法: node run-all-tests.js [选项]

选项:
  -v, --verbose          显示详细输出
  -s, --stop-on-failure  遇到失败时停止
  -c, --critical-only    仅运行关键测试
      --no-report        不生成测试报告
  -h, --help            显示此帮助信息

示例:
  node run-all-tests.js                    # 运行所有测试
  node run-all-tests.js --critical-only    # 仅运行关键测试
  node run-all-tests.js --verbose          # 显示详细输出
`);
  }
  
  /**
   * 运行所有测试套件
   */
  async runAllTests() {
    console.log('🧪 Gmail MCP Bridge 状态管理系统测试');
    console.log('=' .repeat(60));
    console.log(`📊 将运行 ${this.testSuites.length} 个测试套件`);
    
    if (this.options.skipNonCritical) {
      const criticalCount = this.testSuites.filter(s => s.critical).length;
      console.log(`⚡ 仅运行关键测试 (${criticalCount} 个套件)`);
    }
    
    console.log('');
    
    this.results.startTime = Date.now();
    
    for (let i = 0; i < this.testSuites.length; i++) {
      const suite = this.testSuites[i];
      
      // 跳过非关键测试
      if (this.options.skipNonCritical && !suite.critical) {
        console.log(`⏭️  跳过: ${suite.name} (非关键测试)`);
        this.results.skippedSuites++;
        this.results.suiteResults.push({
          ...suite,
          status: 'skipped',
          reason: 'Non-critical test skipped'
        });
        continue;
      }
      
      console.log(`\n🔍 [${i + 1}/${this.testSuites.length}] ${suite.name}`);
      console.log(`📝 ${suite.description}`);
      
      try {
        const result = await this.runTestSuite(suite);
        
        if (result.success) {
          console.log(`✅ 通过: ${suite.name}`);
          this.results.passedSuites++;
          this.results.suiteResults.push({
            ...suite,
            status: 'passed',
            ...result
          });
        } else {
          console.log(`❌ 失败: ${suite.name}`);
          console.log(`   错误: ${result.error}`);
          this.results.failedSuites++;
          this.results.suiteResults.push({
            ...suite,
            status: 'failed',
            ...result
          });
          
          if (this.options.stopOnFailure && suite.critical) {
            console.log('\n🛑 遇到关键测试失败，停止执行');
            break;
          }
        }
        
      } catch (error) {
        console.log(`💥 异常: ${suite.name}`);
        console.log(`   异常信息: ${error.message}`);
        this.results.failedSuites++;
        this.results.suiteResults.push({
          ...suite,
          status: 'error',
          error: error.message
        });
        
        if (this.options.stopOnFailure) {
          console.log('\n🛑 遇到测试异常，停止执行');
          break;
        }
      }
    }
    
    this.results.endTime = Date.now();
    
    // 生成总结报告
    this.generateSummary();
    
    // 生成详细报告文件
    if (this.options.generateReport) {
      await this.generateDetailedReport();
    }
    
    // 返回适当的退出码
    const hasFailures = this.results.failedSuites > 0;
    process.exit(hasFailures ? 1 : 0);
  }
  
  /**
   * 运行单个测试套件
   */
  async runTestSuite(suite) {
    return new Promise((resolve) => {
      const testPath = path.join(__dirname, suite.file);
      
      // 检查测试文件是否存在
      if (!fs.existsSync(testPath)) {
        resolve({
          success: false,
          error: `测试文件不存在: ${suite.file}`,
          duration: 0
        });
        return;
      }
      
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      
      // 启动子进程运行测试
      const child = spawn('node', [testPath], {
        cwd: __dirname,
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      // 收集输出
      if (!this.options.verbose) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({
          success: false,
          error: `测试超时 (${suite.timeout}ms)`,
          duration: Date.now() - startTime,
          stdout,
          stderr
        });
      }, suite.timeout);
      
      // 处理子进程结束
      child.on('close', (code, signal) => {
        clearTimeout(timeoutId);
        
        const duration = Date.now() - startTime;
        
        if (signal) {
          resolve({
            success: false,
            error: `测试被信号终止: ${signal}`,
            duration,
            stdout,
            stderr
          });
        } else {
          resolve({
            success: code === 0,
            error: code !== 0 ? `进程退出码: ${code}` : null,
            duration,
            stdout,
            stderr,
            exitCode: code
          });
        }
      });
      
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: `启动测试失败: ${error.message}`,
          duration: Date.now() - startTime
        });
      });
    });
  }
  
  /**
   * 生成测试总结
   */
  generateSummary() {
    const duration = this.results.endTime - this.results.startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 测试执行总结');
    console.log('='.repeat(60));
    
    console.log(`⏱️  总执行时间: ${Math.round(duration / 1000)}秒`);
    console.log(`📊 测试套件: ${this.results.totalSuites}`);
    console.log(`✅ 通过: ${this.results.passedSuites}`);
    console.log(`❌ 失败: ${this.results.failedSuites}`);
    console.log(`⏭️  跳过: ${this.results.skippedSuites}`);
    
    const successRate = this.results.totalSuites > 0 ? 
      ((this.results.passedSuites / this.results.totalSuites) * 100).toFixed(1) : 0;
    
    console.log(`📈 成功率: ${successRate}%`);
    
    // 详细结果
    console.log('\n📝 详细结果:');
    for (const result of this.results.suiteResults) {
      const status = result.status === 'passed' ? '✅' : 
                    result.status === 'failed' ? '❌' : 
                    result.status === 'skipped' ? '⏭️' : '💥';
      
      const duration = result.duration ? `(${Math.round(result.duration / 1000)}s)` : '';
      console.log(`   ${status} ${result.name} ${duration}`);
      
      if (result.error && this.options.verbose) {
        console.log(`      错误: ${result.error}`);
      }
    }
    
    // Linus 式评判
    console.log('\n' + '='.repeat(60));
    console.log('💀 LINUS 式最终评判');
    console.log('='.repeat(60));
    
    if (this.results.failedSuites === 0) {
      console.log('🟢 "所有测试通过！这代码有好品味。"');
      console.log('   "状态管理系统稳定可靠，用户空间是安全的。"');
    } else if (this.results.passedSuites > this.results.failedSuites) {
      console.log('🟡 "大部分测试通过，但还有问题要修复。"');
      console.log('   "修复那些失败的测试，然后这就是个好系统。"');
    } else {
      console.log('🔴 "测试失败太多！这代码需要重新审视。"');
      console.log('   "修复基础问题，确保系统稳定性。"');
    }
    
    console.log(`\n🎯 目标达成情况:`);
    console.log(`   95% 自动恢复率: ${this.evaluateRecoveryRate()}`);
    console.log(`   系统稳定性: ${this.evaluateStability()}`);
    console.log(`   代码品味: ${this.evaluateCodeTaste()}`);
  }
  
  /**
   * 评估恢复率达成情况
   */
  evaluateRecoveryRate() {
    const recoveryTest = this.results.suiteResults.find(r => 
      r.file === 'auto-recovery-validation.js'
    );
    
    if (!recoveryTest) {
      return '❓ 未测试';
    }
    
    if (recoveryTest.status !== 'passed') {
      return '❌ 测试失败';
    }
    
    // 这里可以解析测试输出来获取实际恢复率
    // 简化处理，基于测试是否通过
    return recoveryTest.status === 'passed' ? '🟡 接近目标' : '❌ 未达成';
  }
  
  /**
   * 评估系统稳定性
   */
  evaluateStability() {
    const performanceTest = this.results.suiteResults.find(r => 
      r.file === 'performance-stress-test.js'
    );
    
    const chaosTest = this.results.suiteResults.find(r => 
      r.file === 'edge-cases-chaos-test.js'
    );
    
    if (!performanceTest || !chaosTest) {
      return '❓ 测试不完整';
    }
    
    const stable = performanceTest.status === 'passed' && chaosTest.status === 'passed';
    return stable ? '✅ 稳定' : '❌ 不稳定';
  }
  
  /**
   * 评估代码品味
   */
  evaluateCodeTaste() {
    const functionalTest = this.results.suiteResults.find(r => 
      r.file === 'status-management-test-suite.js'
    );
    
    if (!functionalTest) {
      return '❓ 未测试';
    }
    
    return functionalTest.status === 'passed' ? '✅ 好品味' : '❌ 需改进';
  }
  
  /**
   * 生成详细报告文件
   */
  async generateDetailedReport() {
    const reportPath = path.join(__dirname, 'test-execution-report.json');
    
    const report = {
      timestamp: new Date().toISOString(),
      command: process.argv.join(' '),
      options: this.options,
      results: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd()
      }
    };
    
    try {
      await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 详细报告已保存: ${reportPath}`);
    } catch (error) {
      console.log(`⚠️  保存报告失败: ${error.message}`);
    }
  }
}

// 主函数
async function main() {
  const runner = new TestRunner();
  
  try {
    runner.parseArgs();
    await runner.runAllTests();
  } catch (error) {
    console.error('💥 测试执行器异常:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = { TestRunner };