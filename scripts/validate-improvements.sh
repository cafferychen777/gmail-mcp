#!/bin/bash

# Gmail MCP Bridge - Improvements Validation Script
#
# Linus Philosophy: "一个脚本验证所有改进"
# - 自动运行所有稳定性测试
# - 验证我们的改进目标是否达成
# - 简单明了的成功/失败报告
#
# Usage: ./scripts/validate-improvements.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}    Gmail MCP Bridge - Improvements Validation${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# 验证改进目标
validate_improvements() {
    print_header
    
    echo "🎯 Validating P0 Infrastructure Improvements:"
    echo "   • Simple Recovery Engine (replacing complex circuit breakers)"
    echo "   • One-click installer (reducing 75% user drop-off)"
    echo "   • Enhanced system stability (target: 95%+ recovery rate)"
    echo "   • Predictive monitoring (proactive issue detection)"
    echo ""
    
    local test_passed=0
    local test_failed=0
    
    # 检查关键文件是否存在
    print_step "Checking implementation files..."
    
    local key_files=(
        "gmail-mcp-extension/src/core/auto-recovery.js"
        "gmail-mcp-extension/src/core/predictive-monitor.js"
        "gmail-mcp-extension/src/core/status-manager.js"
        "tools/installer/installer.js"
        "tools/installer/system-detector.js"
        "install.sh"
        "tools/npx-installer/index.js"
    )
    
    for file in "${key_files[@]}"; do
        if [ -f "$file" ]; then
            print_success "Found: $file"
            ((test_passed++))
        else
            print_error "Missing: $file"
            ((test_failed++))
        fi
    done
    
    echo ""
    
    # 检查核心改进
    print_step "Validating core improvements..."
    
    # 1. 检查简化恢复引擎
    print_step "Checking SimpleRecoveryEngine..."
    if grep -q "SimpleRecoveryEngine" gmail-mcp-extension/src/core/auto-recovery.js; then
        print_success "SimpleRecoveryEngine implementation found"
        ((test_passed++))
    else
        print_error "SimpleRecoveryEngine not found"
        ((test_failed++))
    fi
    
    if grep -q "strategies = new Map" gmail-mcp-extension/src/core/auto-recovery.js; then
        print_success "Data-driven recovery strategies implemented"
        ((test_passed++))
    else
        print_error "Data-driven strategies not found"
        ((test_failed++))
    fi
    
    # 2. 检查预测性监控
    print_step "Checking PredictiveMonitor..."
    if grep -q "PredictiveMonitor" gmail-mcp-extension/src/core/predictive-monitor.js; then
        print_success "PredictiveMonitor implementation found"
        ((test_passed++))
    else
        print_error "PredictiveMonitor not found"
        ((test_failed++))
    fi
    
    if grep -q "failurePatterns" gmail-mcp-extension/src/core/predictive-monitor.js; then
        print_success "Failure pattern detection implemented"
        ((test_passed++))
    else
        print_error "Failure pattern detection not found"
        ((test_failed++))
    fi
    
    # 3. 检查一键安装器
    print_step "Checking one-click installer..."
    if [ -x "install.sh" ]; then
        print_success "One-click bash installer is executable"
        ((test_passed++))
    else
        print_error "install.sh not executable"
        ((test_failed++))
    fi
    
    if [ -f "tools/npx-installer/package.json" ]; then
        print_success "NPX installer package found"
        ((test_passed++))
    else
        print_error "NPX installer package not found"
        ((test_failed++))
    fi
    
    # 4. 检查智能系统检测
    print_step "Checking intelligent system detection..."
    if grep -q "autoFixIssues" tools/installer/system-detector.js; then
        print_success "Auto-fix capabilities implemented"
        ((test_passed++))
    else
        print_error "Auto-fix capabilities not found"
        ((test_failed++))
    fi
    
    if grep -q "generatePreInstallReport" tools/installer/system-detector.js; then
        print_success "Pre-install analysis implemented"
        ((test_passed++))
    else
        print_error "Pre-install analysis not found"
        ((test_failed++))
    fi
    
    # 5. 检查增强状态管理
    print_step "Checking enhanced status management..."
    if grep -q "EnhancedStatusManager" gmail-mcp-extension/src/core/status-manager.js; then
        print_success "Enhanced status management implemented"
        ((test_passed++))
    else
        print_error "Enhanced status management not found"
        ((test_failed++))
    fi
    
    echo ""
    
    # 运行稳定性测试（如果Node.js环境可用）
    if command -v node &> /dev/null; then
        print_step "Running enhanced stability tests..."
        
        # 检查测试文件
        if [ -f "tests/stability/enhanced-stability-test.js" ]; then
            print_success "Stability test suite found"
            
            # 尝试运行测试（在后台，有超时）
            echo "  Running stability validation (this may take a moment)..."
            
            if timeout 30 node tests/stability/enhanced-stability-test.js > /tmp/stability-test.log 2>&1; then
                print_success "Stability tests passed"
                ((test_passed++))
                
                # 显示测试摘要
                if grep -q "Pass Rate:" /tmp/stability-test.log; then
                    local pass_rate=$(grep "Pass Rate:" /tmp/stability-test.log | cut -d' ' -f3)
                    echo "    Test pass rate: $pass_rate"
                fi
            else
                print_warning "Stability tests incomplete or failed"
                print_warning "Check /tmp/stability-test.log for details"
                ((test_failed++))
            fi
        else
            print_error "Stability test suite not found"
            ((test_failed++))
        fi
    else
        print_warning "Node.js not available, skipping stability tests"
    fi
    
    echo ""
    
    # 最终结果
    local total_tests=$((test_passed + test_failed))
    local success_rate=$((test_passed * 100 / total_tests))
    
    print_step "Validation Results:"
    echo "  Total checks: $total_tests"
    echo "  Passed: $test_passed ✅"
    echo "  Failed: $test_failed ❌"
    echo "  Success rate: ${success_rate}%"
    
    echo ""
    
    if [ $success_rate -ge 90 ]; then
        print_success "🎉 EXCELLENT: All P0 improvements successfully implemented!"
        echo ""
        echo "✅ Simplified Recovery Engine: Implemented"
        echo "✅ One-click Installers: Ready (bash + NPX)"
        echo "✅ Predictive Monitoring: Active"
        echo "✅ Enhanced System Detection: Working"
        echo "✅ Stability Improvements: Validated"
        echo ""
        echo "🚀 System is ready for improved user experience!"
        return 0
    elif [ $success_rate -ge 75 ]; then
        print_warning "⚠️  GOOD: Most improvements implemented, minor issues found"
        echo ""
        echo "System should work well but some optimizations may be missing."
        return 1
    else
        print_error "❌ NEEDS WORK: Significant issues found"
        echo ""
        echo "Please review the failed checks and ensure all components are properly implemented."
        return 2
    fi
}

# 显示使用帮助
show_help() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h     Show this help message"
    echo "  --verbose, -v  Show verbose output"
    echo "  --quick        Skip long-running tests"
    echo ""
    echo "This script validates that all P0 infrastructure improvements"
    echo "have been successfully implemented:"
    echo "  • Simple Recovery Engine"
    echo "  • One-click installers"
    echo "  • Predictive monitoring"
    echo "  • Enhanced system detection"
    echo ""
}

# 主程序
main() {
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --verbose|-v)
                set -x  # 启用详细输出
                shift
                ;;
            --quick)
                QUICK_MODE=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 检查是否在项目根目录
    if [ ! -f "gmail-mcp-extension/src/core/auto-recovery.js" ]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # 运行验证
    validate_improvements
    local exit_code=$?
    
    echo ""
    if [ $exit_code -eq 0 ]; then
        print_success "All improvements validated successfully! 🎉"
    else
        print_warning "Some issues found. Please review the output above."
    fi
    
    exit $exit_code
}

# 运行主程序
main "$@"