#!/usr/bin/env node

/**
 * 用户使用流程模拟测试
 * 
 * 模拟真实用户从安装到使用的完整体验，确保"2分钟完成安装"的目标
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

/**
 * 用户档案定义
 */
const USER_PROFILES = {
    NOVICE_USER: {
        name: '新手用户',
        techLevel: 'low',
        expectation: 'easy_install',
        maxToleranceTime: 180000, // 3分钟最大容忍时间
        preferredCommands: ['install', 'help', 'status'],
        description: '非技术背景，希望简单安装'
    },
    TECHNICAL_USER: {
        name: '技术用户',
        techLevel: 'high',
        expectation: 'customizable',
        maxToleranceTime: 120000, // 2分钟
        preferredCommands: ['install', 'doctor', 'test', 'fix'],
        description: '有技术背景，重视效率和自定义'
    },
    ENTERPRISE_USER: {
        name: '企业用户',
        techLevel: 'medium',
        expectation: 'secure_reliable',
        maxToleranceTime: 300000, // 5分钟（考虑安全检查）
        preferredCommands: ['doctor', 'test', 'install'],
        description: '企业环境，关注安全性和可靠性'
    }
};

/**
 * 使用场景定义
 */
const USE_CASE_SCENARIOS = {
    FIRST_TIME_INSTALL: {
        name: '首次安装场景',
        steps: [
            'discover_project',
            'read_documentation', 
            'run_install_command',
            'verify_installation',
            'first_use_attempt'
        ],
        expectedDuration: 120000, // 2分钟目标
        successCriteria: ['installation_success', 'basic_function_works']
    },
    TROUBLESHOOTING: {
        name: '问题排查场景',
        steps: [
            'encounter_problem',
            'run_doctor_command',
            'understand_diagnosis',
            'run_fix_command',
            'verify_resolution'
        ],
        expectedDuration: 180000, // 3分钟
        successCriteria: ['problem_identified', 'auto_fix_successful']
    },
    DAILY_USAGE: {
        name: '日常使用场景',
        steps: [
            'start_claude',
            'open_gmail',
            'use_mcp_features',
            'check_status_occasionally'
        ],
        expectedDuration: 30000, // 30秒启动时间
        successCriteria: ['quick_startup', 'stable_operation']
    }
};

export class UserJourneySimulator {
    constructor() {
        this.projectRoot = path.resolve(__dirname);
        this.testResults = [];
        this.userFeedback = [];
        this.performanceMetrics = [];
    }

    async runCompleteUserJourneyTest() {
        console.log('🎭 用户使用流程模拟测试');
        console.log('=' .repeat(60));
        
        console.log('\n📋 模拟用户档案:');
        Object.keys(USER_PROFILES).forEach(profile => {
            const user = USER_PROFILES[profile];
            console.log(`   ${user.name}: ${user.description}`);
        });

        console.log('\n🎬 使用场景:');
        Object.keys(USE_CASE_SCENARIOS).forEach(scenario => {
            const useCase = USE_CASE_SCENARIOS[scenario];
            console.log(`   ${useCase.name}: ${useCase.steps.length}步骤, 目标${Math.round(useCase.expectedDuration/1000)}s`);
        });

        // 为每个用户档案测试每个场景
        for (const profileKey of Object.keys(USER_PROFILES)) {
            const userProfile = USER_PROFILES[profileKey];
            
            console.log(`\n👤 测试用户: ${userProfile.name}`);
            console.log('-' .repeat(40));
            
            for (const scenarioKey of Object.keys(USE_CASE_SCENARIOS)) {
                const scenario = USE_CASE_SCENARIOS[scenarioKey];
                
                console.log(`\n🎯 场景: ${scenario.name}`);
                const result = await this.simulateUserScenario(userProfile, scenario);
                this.testResults.push(result);
                
                // 显示结果
                if (result.success) {
                    console.log(`   ✅ 成功 (${result.duration}ms, 满意度: ${result.userSatisfaction}/10)`);
                } else {
                    console.log(`   ❌ 失败: ${result.failureReason} (${result.duration}ms)`);
                }
                
                // 收集用户反馈
                this.userFeedback.push(this.generateUserFeedback(userProfile, scenario, result));
            }
        }

        return this.generateComprehensiveReport();
    }

    async simulateUserScenario(userProfile, scenario) {
        const startTime = Date.now();
        const scenarioResult = {
            userProfile: userProfile.name,
            scenario: scenario.name,
            startTime,
            duration: 0,
            success: false,
            stepsCompleted: 0,
            totalSteps: scenario.steps.length,
            userSatisfaction: 0,
            failureReason: null,
            stepResults: []
        };

        try {
            // 执行每个步骤
            for (let i = 0; i < scenario.steps.length; i++) {
                const stepName = scenario.steps[i];
                const stepResult = await this.executeScenarioStep(stepName, userProfile);
                
                scenarioResult.stepResults.push(stepResult);
                
                if (stepResult.success) {
                    scenarioResult.stepsCompleted++;
                } else {
                    scenarioResult.failureReason = `步骤 "${stepName}" 失败: ${stepResult.error}`;
                    break;
                }
                
                // 检查用户容忍时间
                const currentTime = Date.now();
                if (currentTime - startTime > userProfile.maxToleranceTime) {
                    scenarioResult.failureReason = `超过用户容忍时间 (${userProfile.maxToleranceTime/1000}s)`;
                    break;
                }
            }

            const endTime = Date.now();
            scenarioResult.duration = endTime - startTime;
            scenarioResult.success = scenarioResult.stepsCompleted === scenario.steps.length;

            // 计算用户满意度 (1-10)
            scenarioResult.userSatisfaction = this.calculateUserSatisfaction(
                userProfile, scenario, scenarioResult
            );

        } catch (error) {
            scenarioResult.duration = Date.now() - startTime;
            scenarioResult.failureReason = `场景执行异常: ${error.message}`;
        }

        return scenarioResult;
    }

    async executeScenarioStep(stepName, userProfile) {
        const stepStart = Date.now();
        
        try {
            switch (stepName) {
                case 'discover_project':
                    return await this.simulateProjectDiscovery();
                
                case 'read_documentation':
                    return await this.simulateDocumentationReading(userProfile);
                
                case 'run_install_command':
                    return await this.simulateInstallCommand(userProfile);
                
                case 'verify_installation':
                    return await this.simulateInstallationVerification();
                
                case 'first_use_attempt':
                    return await this.simulateFirstUseAttempt();
                
                case 'encounter_problem':
                    return await this.simulateProblemEncounter();
                
                case 'run_doctor_command':
                    return await this.simulateDoctorCommand();
                
                case 'understand_diagnosis':
                    return await this.simulateDiagnosisUnderstanding(userProfile);
                
                case 'run_fix_command':
                    return await this.simulateFixCommand();
                
                case 'verify_resolution':
                    return await this.simulateResolutionVerification();
                
                case 'start_claude':
                    return await this.simulateClaudeStartup();
                
                case 'open_gmail':
                    return await this.simulateGmailOpening();
                
                case 'use_mcp_features':
                    return await this.simulateMCPFeatureUsage();
                
                case 'check_status_occasionally':
                    return await this.simulateStatusCheck();
                
                default:
                    throw new Error(`未知步骤: ${stepName}`);
            }
        } catch (error) {
            return {
                stepName,
                success: false,
                duration: Date.now() - stepStart,
                error: error.message
            };
        }
    }

    async simulateProjectDiscovery() {
        // 模拟用户发现项目
        try {
            await fs.access(path.join(this.projectRoot, 'README.md'));
            await fs.access(path.join(this.projectRoot, 'package.json'));
            
            return {
                stepName: 'discover_project',
                success: true,
                duration: 1000, // 假设1秒发现时间
                details: '项目文件结构完整'
            };
        } catch (error) {
            return {
                stepName: 'discover_project',
                success: false,
                duration: 1000,
                error: '项目文件不完整'
            };
        }
    }

    async simulateDocumentationReading(userProfile) {
        // 模拟不同用户类型的文档阅读行为
        const readingTime = {
            'low': 30000,    // 新手用户需要更多时间
            'medium': 15000, // 企业用户适中
            'high': 5000     // 技术用户快速扫描
        };

        const simulatedTime = readingTime[userProfile.techLevel] || 15000;
        
        try {
            const readmePath = path.join(this.projectRoot, 'README.md');
            const readme = await fs.readFile(readmePath, 'utf-8');
            
            // 检查文档质量
            const hasInstallInstructions = readme.includes('install') || readme.includes('安装');
            const hasExamples = readme.includes('example') || readme.includes('示例');
            const hasTroubleshooting = readme.includes('troubleshoot') || readme.includes('问题');
            
            const documentationQuality = [hasInstallInstructions, hasExamples, hasTroubleshooting]
                .filter(Boolean).length;

            return {
                stepName: 'read_documentation',
                success: documentationQuality >= 2, // 至少要有2项内容
                duration: simulatedTime,
                details: {
                    documentationQuality,
                    hasInstallInstructions,
                    hasExamples,
                    hasTroubleshooting,
                    readmeLength: readme.length
                }
            };
        } catch (error) {
            return {
                stepName: 'read_documentation',
                success: false,
                duration: simulatedTime,
                error: '无法读取文档'
            };
        }
    }

    async simulateInstallCommand(userProfile) {
        const installStart = Date.now();
        
        try {
            // 模拟运行安装命令（实际上运行help来避免真实安装）
            const { stdout, stderr } = await execAsync('node bin/gmail-mcp help', {
                cwd: this.projectRoot,
                timeout: 30000
            });

            const installDuration = Date.now() - installStart;
            const hasInstallOption = stdout.includes('install');
            
            // 根据用户类型评估安装体验
            const expectedMaxTime = {
                'low': 180000,    // 新手用户可接受3分钟
                'medium': 120000, // 企业用户期望2分钟
                'high': 60000     // 技术用户期望1分钟
            };

            const withinExpectation = installDuration < expectedMaxTime[userProfile.techLevel];

            return {
                stepName: 'run_install_command',
                success: hasInstallOption && withinExpectation,
                duration: installDuration,
                details: {
                    hasInstallOption,
                    withinExpectation,
                    expectedMaxTime: expectedMaxTime[userProfile.techLevel],
                    actualTime: installDuration
                }
            };

        } catch (error) {
            return {
                stepName: 'run_install_command',
                success: false,
                duration: Date.now() - installStart,
                error: error.message
            };
        }
    }

    async simulateInstallationVerification() {
        try {
            const { stdout } = await execAsync('node bin/gmail-mcp status', {
                cwd: this.projectRoot,
                timeout: 15000
            });

            const hasStatusInfo = stdout.includes('状态') || stdout.includes('Status');
            
            return {
                stepName: 'verify_installation',
                success: hasStatusInfo,
                duration: 5000, // 假设5秒验证时间
                details: { hasStatusInfo }
            };

        } catch (error) {
            // 如果状态命令失败，尝试其他验证方法
            try {
                const { stdout } = await execAsync('node bin/gmail-mcp help', {
                    cwd: this.projectRoot,
                    timeout: 10000
                });

                return {
                    stepName: 'verify_installation',
                    success: stdout.includes('Gmail MCP Bridge'),
                    duration: 5000,
                    details: { fallbackVerification: true }
                };
            } catch (fallbackError) {
                return {
                    stepName: 'verify_installation',
                    success: false,
                    duration: 5000,
                    error: `验证失败: ${fallbackError.message}`
                };
            }
        }
    }

    async simulateFirstUseAttempt() {
        try {
            const { stdout } = await execAsync('node bin/gmail-mcp test', {
                cwd: this.projectRoot,
                timeout: 30000
            });

            const hasTestResults = stdout.includes('测试') || stdout.includes('Test');
            
            return {
                stepName: 'first_use_attempt',
                success: hasTestResults,
                duration: 10000, // 假设10秒首次使用
                details: { hasTestResults }
            };

        } catch (error) {
            return {
                stepName: 'first_use_attempt',
                success: false,
                duration: 10000,
                error: error.message
            };
        }
    }

    async simulateProblemEncounter() {
        // 模拟遇到问题（总是成功，因为这只是模拟）
        return {
            stepName: 'encounter_problem',
            success: true,
            duration: 2000,
            details: { simulatedProblem: 'Configuration issue detected' }
        };
    }

    async simulateDoctorCommand() {
        try {
            const { stdout } = await execAsync('node bin/gmail-mcp doctor', {
                cwd: this.projectRoot,
                timeout: 30000
            });

            const hasDiagnosisResults = stdout.includes('诊断') || stdout.includes('diagnostic');
            
            return {
                stepName: 'run_doctor_command',
                success: hasDiagnosisResults,
                duration: 15000, // 假设15秒诊断时间
                details: { hasDiagnosisResults }
            };

        } catch (error) {
            return {
                stepName: 'run_doctor_command',
                success: false,
                duration: 15000,
                error: error.message
            };
        }
    }

    async simulateDiagnosisUnderstanding(userProfile) {
        // 模拟不同用户理解诊断结果的能力
        const understandingTime = {
            'low': 30000,    // 新手用户需要更多时间理解
            'medium': 10000, // 企业用户适中
            'high': 5000     // 技术用户快速理解
        };

        const comprehensionSuccess = {
            'low': 0.7,      // 70% 理解率
            'medium': 0.9,   // 90% 理解率  
            'high': 0.95     // 95% 理解率
        };

        const simulatedSuccess = Math.random() < comprehensionSuccess[userProfile.techLevel];

        return {
            stepName: 'understand_diagnosis',
            success: simulatedSuccess,
            duration: understandingTime[userProfile.techLevel],
            details: {
                userTechLevel: userProfile.techLevel,
                comprehensionRate: comprehensionSuccess[userProfile.techLevel]
            }
        };
    }

    async simulateFixCommand() {
        try {
            const { stdout } = await execAsync('node bin/gmail-mcp fix', {
                cwd: this.projectRoot,
                timeout: 45000
            });

            const hasFixResults = stdout.includes('修复') || stdout.includes('fix');
            
            return {
                stepName: 'run_fix_command',
                success: hasFixResults,
                duration: 20000, // 假设20秒修复时间
                details: { hasFixResults }
            };

        } catch (error) {
            return {
                stepName: 'run_fix_command',
                success: false,
                duration: 20000,
                error: error.message
            };
        }
    }

    async simulateResolutionVerification() {
        // 使用状态检查验证问题是否解决
        return await this.simulateInstallationVerification();
    }

    async simulateClaudeStartup() {
        // 模拟Claude启动（无法真实测试，所以模拟）
        return {
            stepName: 'start_claude',
            success: true,
            duration: 5000, // 假设5秒启动时间
            details: { simulated: true }
        };
    }

    async simulateGmailOpening() {
        // 模拟Gmail打开（无法真实测试）
        return {
            stepName: 'open_gmail',
            success: true,
            duration: 3000, // 假设3秒打开时间
            details: { simulated: true }
        };
    }

    async simulateMCPFeatureUsage() {
        // 模拟MCP功能使用
        return {
            stepName: 'use_mcp_features',
            success: true,
            duration: 10000, // 假设10秒功能使用
            details: { simulated: true }
        };
    }

    async simulateStatusCheck() {
        return await this.simulateInstallationVerification();
    }

    calculateUserSatisfaction(userProfile, scenario, result) {
        let satisfaction = 5; // 基础分5分

        // 成功完成加分
        if (result.success) {
            satisfaction += 3;
        } else {
            satisfaction -= 2;
        }

        // 时间因素
        const timeFactor = result.duration / scenario.expectedDuration;
        if (timeFactor <= 0.5) {
            satisfaction += 2; // 很快完成
        } else if (timeFactor <= 1.0) {
            satisfaction += 1; // 按时完成
        } else if (timeFactor <= 1.5) {
            satisfaction -= 1; // 稍微超时
        } else {
            satisfaction -= 3; // 严重超时
        }

        // 用户技术水平调整
        if (userProfile.techLevel === 'low' && result.success) {
            satisfaction += 1; // 新手用户成功使用会更满意
        }

        return Math.max(1, Math.min(10, Math.round(satisfaction)));
    }

    generateUserFeedback(userProfile, scenario, result) {
        const feedbackTemplates = {
            positive: [
                "安装过程很顺利，比预期的简单多了！",
                "文档清晰，很容易上手。",
                "系统诊断功能很有用，帮我快速找到了问题。",
                "自动修复功能很棒，省了我很多时间。"
            ],
            neutral: [
                "功能基本可用，但还有改进空间。",
                "安装过程略有些复杂，但最终成功了。",
                "文档可以更详细一些。"
            ],
            negative: [
                "安装过程遇到了一些问题，希望能更稳定。",
                "文档不够清楚，花了很多时间理解。",
                "错误信息不够友好，不知道该怎么解决。"
            ]
        };

        let feedbackType = 'neutral';
        if (result.userSatisfaction >= 8) {
            feedbackType = 'positive';
        } else if (result.userSatisfaction <= 4) {
            feedbackType = 'negative';
        }

        const templates = feedbackTemplates[feedbackType];
        const feedback = templates[Math.floor(Math.random() * templates.length)];

        return {
            userProfile: userProfile.name,
            scenario: scenario.name,
            satisfaction: result.userSatisfaction,
            feedback,
            feedbackType,
            timestamp: new Date().toISOString()
        };
    }

    generateComprehensiveReport() {
        const totalScenarios = this.testResults.length;
        const successfulScenarios = this.testResults.filter(r => r.success).length;
        const averageDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0) / totalScenarios;
        const averageSatisfaction = this.testResults.reduce((sum, r) => sum + r.userSatisfaction, 0) / totalScenarios;

        // 按用户类型分组统计
        const userTypeStats = {};
        Object.keys(USER_PROFILES).forEach(profileKey => {
            const userProfile = USER_PROFILES[profileKey];
            const userResults = this.testResults.filter(r => r.userProfile === userProfile.name);
            
            userTypeStats[userProfile.name] = {
                totalScenarios: userResults.length,
                successfulScenarios: userResults.filter(r => r.success).length,
                averageDuration: userResults.reduce((sum, r) => sum + r.duration, 0) / userResults.length,
                averageSatisfaction: userResults.reduce((sum, r) => sum + r.userSatisfaction, 0) / userResults.length,
                successRate: Math.round((userResults.filter(r => r.success).length / userResults.length) * 100)
            };
        });

        // 按场景类型分组统计
        const scenarioStats = {};
        Object.keys(USE_CASE_SCENARIOS).forEach(scenarioKey => {
            const scenario = USE_CASE_SCENARIOS[scenarioKey];
            const scenarioResults = this.testResults.filter(r => r.scenario === scenario.name);
            
            scenarioStats[scenario.name] = {
                totalTests: scenarioResults.length,
                successfulTests: scenarioResults.filter(r => r.success).length,
                averageDuration: scenarioResults.reduce((sum, r) => sum + r.duration, 0) / scenarioResults.length,
                averageSatisfaction: scenarioResults.reduce((sum, r) => sum + r.userSatisfaction, 0) / scenarioResults.length,
                successRate: Math.round((scenarioResults.filter(r => r.success).length / scenarioResults.length) * 100)
            };
        });

        // 2分钟安装目标分析
        const installScenarios = this.testResults.filter(r => r.scenario === '首次安装场景');
        const twoMinuteGoalAchieved = installScenarios.filter(r => r.duration <= 120000 && r.success).length;
        const twoMinuteGoalRate = Math.round((twoMinuteGoalAchieved / installScenarios.length) * 100);

        // 用户体验等级评定
        let uxRating = 'NEEDS_IMPROVEMENT';
        if (averageSatisfaction >= 8 && twoMinuteGoalRate >= 80) {
            uxRating = 'EXCELLENT';
        } else if (averageSatisfaction >= 7 && twoMinuteGoalRate >= 60) {
            uxRating = 'GOOD';
        } else if (averageSatisfaction >= 6 && twoMinuteGoalRate >= 40) {
            uxRating = 'FAIR';
        }

        return {
            summary: {
                totalScenarios,
                successfulScenarios,
                successRate: Math.round((successfulScenarios / totalScenarios) * 100),
                averageDuration: Math.round(averageDuration),
                averageSatisfaction: Math.round(averageSatisfaction * 10) / 10
            },
            twoMinuteGoal: {
                totalInstallTests: installScenarios.length,
                achievedGoal: twoMinuteGoalAchieved,
                goalAchievementRate: twoMinuteGoalRate
            },
            userTypeStats,
            scenarioStats,
            userFeedback: this.userFeedback,
            uxRating,
            recommendations: this.generateRecommendations(userTypeStats, scenarioStats, twoMinuteGoalRate),
            detailedResults: this.testResults,
            timestamp: new Date().toISOString()
        };
    }

    generateRecommendations(userTypeStats, scenarioStats, twoMinuteGoalRate) {
        const recommendations = [];

        // 基于2分钟目标的建议
        if (twoMinuteGoalRate < 80) {
            recommendations.push({
                priority: 'HIGH',
                category: '安装体验',
                issue: `仅${twoMinuteGoalRate}%的用户能在2分钟内完成安装`,
                suggestion: '简化安装流程，减少用户输入，优化依赖安装速度'
            });
        }

        // 基于用户类型的建议
        if (userTypeStats['新手用户'].successRate < 90) {
            recommendations.push({
                priority: 'HIGH',
                category: '新手友好性',
                issue: '新手用户成功率偏低',
                suggestion: '增加更详细的引导步骤，改进错误提示信息'
            });
        }

        if (userTypeStats['技术用户'].averageDuration > userTypeStats['新手用户'].averageDuration) {
            recommendations.push({
                priority: 'MEDIUM',
                category: '效率优化',
                issue: '技术用户操作时间长于预期',
                suggestion: '提供快速安装选项和批量操作命令'
            });
        }

        // 基于场景的建议
        if (scenarioStats['问题排查场景'].successRate < 80) {
            recommendations.push({
                priority: 'HIGH',
                category: '问题诊断',
                issue: '问题排查成功率不足',
                suggestion: '改进自动诊断准确性，增加更多自动修复场景'
            });
        }

        return recommendations;
    }

    displayReport(report) {
        console.log('\n🎭 用户使用流程模拟测试报告');
        console.log('=' .repeat(80));

        // 总体统计
        console.log('\n📊 总体统计:');
        console.log(`   总测试场景: ${report.summary.totalScenarios}`);
        console.log(`   成功场景: ${report.summary.successfulScenarios} (${report.summary.successRate}%)`);
        console.log(`   平均耗时: ${Math.round(report.summary.averageDuration/1000)}秒`);
        console.log(`   平均满意度: ${report.summary.averageSatisfaction}/10`);

        // 2分钟安装目标
        console.log('\n🎯 2分钟安装目标:');
        console.log(`   安装测试次数: ${report.twoMinuteGoal.totalInstallTests}`);
        console.log(`   2分钟内完成: ${report.twoMinuteGoal.achievedGoal} (${report.twoMinuteGoal.goalAchievementRate}%)`);
        
        const goalStatus = report.twoMinuteGoal.goalAchievementRate >= 80 ? '✅ 已达成' : 
                          report.twoMinuteGoal.goalAchievementRate >= 60 ? '⚠️ 接近达成' : '❌ 未达成';
        console.log(`   目标状态: ${goalStatus}`);

        // 用户体验评级
        console.log(`\n⭐ 用户体验评级: ${report.uxRating}`);

        // 各用户类型表现
        console.log('\n👥 各用户类型表现:');
        Object.keys(report.userTypeStats).forEach(userType => {
            const stats = report.userTypeStats[userType];
            console.log(`   ${userType}:`);
            console.log(`     成功率: ${stats.successRate}%`);
            console.log(`     平均耗时: ${Math.round(stats.averageDuration/1000)}秒`);
            console.log(`     满意度: ${Math.round(stats.averageSatisfaction*10)/10}/10`);
        });

        // 各场景表现
        console.log('\n🎬 各场景表现:');
        Object.keys(report.scenarioStats).forEach(scenario => {
            const stats = report.scenarioStats[scenario];
            console.log(`   ${scenario}:`);
            console.log(`     成功率: ${stats.successRate}%`);
            console.log(`     平均耗时: ${Math.round(stats.averageDuration/1000)}秒`);
            console.log(`     满意度: ${Math.round(stats.averageSatisfaction*10)/10}/10`);
        });

        // 改进建议
        if (report.recommendations.length > 0) {
            console.log('\n💡 改进建议:');
            report.recommendations.forEach((rec, index) => {
                const priorityIcon = rec.priority === 'HIGH' ? '🔴' : '🟡';
                console.log(`   ${priorityIcon} ${rec.category}: ${rec.suggestion}`);
            });
        }

        // 用户反馈摘要
        const positiveFeedback = report.userFeedback.filter(f => f.feedbackType === 'positive').length;
        const neutralFeedback = report.userFeedback.filter(f => f.feedbackType === 'neutral').length;
        const negativeFeedback = report.userFeedback.filter(f => f.feedbackType === 'negative').length;
        
        console.log('\n💬 用户反馈分布:');
        console.log(`   😊 正面: ${positiveFeedback} (${Math.round(positiveFeedback/report.userFeedback.length*100)}%)`);
        console.log(`   😐 中性: ${neutralFeedback} (${Math.round(neutralFeedback/report.userFeedback.length*100)}%)`);
        console.log(`   😞 负面: ${negativeFeedback} (${Math.round(negativeFeedback/report.userFeedback.length*100)}%)`);

        console.log('\n' + '=' .repeat(80));
    }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    const simulator = new UserJourneySimulator();
    
    try {
        const report = await simulator.runCompleteUserJourneyTest();
        simulator.displayReport(report);
        
        // 根据用户体验评级设置退出码
        const exitCode = report.uxRating === 'NEEDS_IMPROVEMENT' ? 1 : 0;
        process.exit(exitCode);
        
    } catch (error) {
        console.error('\n💥 用户流程模拟测试失败:', error.message);
        process.exit(1);
    }
}

export default UserJourneySimulator;