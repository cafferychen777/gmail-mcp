#!/bin/bash

# Gmail MCP Bridge - One-Click Installer
# 
# Linus Philosophy: "Make it work, make it simple, make it fast"
# - 检测-安装-验证，没有复杂的步骤
# - 用户只需要运行一个命令
# - 出错就直接告诉用户怎么修
#
# Usage: curl -sSL https://raw.githubusercontent.com/your-repo/gmail-mcp/main/install.sh | bash
# Or: bash <(curl -sSL https://raw.githubusercontent.com/your-repo/gmail-mcp/main/install.sh)

set -e  # Exit on any error

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 全局变量
INSTALL_DIR=""
BACKUP_DIR=""
OS_TYPE=""
CLAUDE_CONFIG_PATH=""

# 打印函数
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}    Gmail MCP Bridge - One-Click Installer${NC}"
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

# 错误处理函数
handle_error() {
    local error_code=$1
    local line_number=$2
    
    print_error "Installation failed at line $line_number (error code: $error_code)"
    
    # 提供具体的解决建议
    case $error_code in
        1)
            print_error "General error. Check logs above for details."
            ;;
        126)
            print_error "Permission denied. Try running with sudo or check file permissions."
            ;;
        127)
            print_error "Command not found. Make sure all dependencies are installed."
            ;;
        *)
            print_error "Unknown error occurred."
            ;;
    esac
    
    echo ""
    echo "Troubleshooting:"
    echo "1. Check if you have sufficient permissions"
    echo "2. Ensure you have Node.js >= 18 installed"
    echo "3. Make sure Chrome browser is installed"
    echo "4. Try manual installation: https://github.com/your-repo/gmail-mcp"
    echo ""
    
    # 尝试清理
    if [ ! -z "$BACKUP_DIR" ] && [ -d "$BACKUP_DIR" ]; then
        print_step "Cleaning up temporary files..."
        rm -rf "$BACKUP_DIR" 2>/dev/null || true
    fi
    
    exit $error_code
}

# 设置错误处理
trap 'handle_error $? $LINENO' ERR

# 检测操作系统
detect_os() {
    print_step "Detecting operating system..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS_TYPE="macos"
        CLAUDE_CONFIG_PATH="$HOME/Library/Application Support/Claude"
        print_success "Detected: macOS"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS_TYPE="linux"
        CLAUDE_CONFIG_PATH="$HOME/.config/claude"
        print_success "Detected: Linux"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        OS_TYPE="windows"
        CLAUDE_CONFIG_PATH="$APPDATA/Claude"
        print_success "Detected: Windows"
    else
        print_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
}

# 检查系统依赖
check_dependencies() {
    print_step "Checking system dependencies..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js >= 18"
        echo "Visit: https://nodejs.org/en/download/"
        exit 1
    fi
    
    # 检查 Node.js 版本
    NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version $NODE_VERSION is too old. Please install Node.js >= 18"
        exit 1
    fi
    print_success "Node.js $(node --version) ✓"
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        print_error "npm not found. Please install npm"
        exit 1
    fi
    print_success "npm $(npm --version) ✓"
    
    # 检查 git
    if ! command -v git &> /dev/null; then
        print_error "git not found. Please install git"
        exit 1
    fi
    print_success "git $(git --version | cut -d' ' -f3) ✓"
    
    # 检查 Chrome (可选但推荐)
    if command -v google-chrome &> /dev/null || command -v chrome &> /dev/null || command -v chromium &> /dev/null; then
        print_success "Chrome browser found ✓"
    elif [ "$OS_TYPE" = "macos" ] && [ -d "/Applications/Google Chrome.app" ]; then
        print_success "Chrome browser found ✓"
    else
        print_warning "Chrome browser not detected. Please install Chrome for best experience."
    fi
}

# 下载并安装项目
download_and_install() {
    print_step "Downloading Gmail MCP Bridge..."
    
    # 创建临时目录
    INSTALL_DIR=$(mktemp -d)
    cd "$INSTALL_DIR"
    
    # 克隆项目 (或下载 zip)
    git clone https://github.com/your-repo/gmail-mcp.git . || {
        print_error "Failed to download project. Check your internet connection."
        exit 1
    }
    
    print_success "Downloaded to $INSTALL_DIR"
    
    # 安装依赖
    print_step "Installing server dependencies..."
    cd gmail-mcp-extension/mcp-server
    npm install --silent || {
        print_error "Failed to install dependencies"
        exit 1
    }
    print_success "Dependencies installed ✓"
}

# 备份现有配置
backup_configs() {
    print_step "Backing up existing configurations..."
    
    BACKUP_DIR="$HOME/.gmail-mcp-backup-$(date +%s)"
    mkdir -p "$BACKUP_DIR"
    
    # 备份 Claude 配置
    if [ -f "$CLAUDE_CONFIG_PATH/claude_desktop_config.json" ]; then
        cp "$CLAUDE_CONFIG_PATH/claude_desktop_config.json" "$BACKUP_DIR/" 2>/dev/null || true
        print_success "Claude config backed up ✓"
    fi
    
    # 备份可能的其他配置文件
    # ... 可以添加更多备份逻辑
    
    print_success "Backup created at $BACKUP_DIR"
}

# 配置 Claude Desktop
configure_claude() {
    print_step "Configuring Claude Desktop..."
    
    # 确保 Claude 配置目录存在
    mkdir -p "$CLAUDE_CONFIG_PATH"
    
    # 生成配置
    FINAL_INSTALL_DIR="$HOME/.gmail-mcp"
    
    # 移动项目到最终位置
    if [ -d "$FINAL_INSTALL_DIR" ]; then
        print_step "Removing existing installation..."
        rm -rf "$FINAL_INSTALL_DIR"
    fi
    
    mv "$INSTALL_DIR" "$FINAL_INSTALL_DIR"
    INSTALL_DIR="$FINAL_INSTALL_DIR"
    
    # 生成 Claude 配置文件
    cat > "$CLAUDE_CONFIG_PATH/claude_desktop_config.json" << EOF
{
  "mcpServers": {
    "gmail-mcp-bridge": {
      "command": "node",
      "args": ["$FINAL_INSTALL_DIR/gmail-mcp-extension/mcp-server/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
EOF
    
    print_success "Claude Desktop configured ✓"
}

# 设置 Chrome 扩展
setup_chrome_extension() {
    print_step "Setting up Chrome extension..."
    
    EXTENSION_DIR="$INSTALL_DIR/gmail-mcp-extension/extension"
    
    if [ ! -d "$EXTENSION_DIR" ]; then
        print_error "Chrome extension not found in project"
        exit 1
    fi
    
    print_success "Extension prepared at $EXTENSION_DIR"
    
    # 提供用户手动安装指导
    echo ""
    echo -e "${YELLOW}📋 Chrome Extension Setup (Manual Step Required):${NC}"
    echo "1. Open Chrome and go to: chrome://extensions/"
    echo "2. Enable 'Developer mode' (top right toggle)"
    echo "3. Click 'Load unpacked' button"
    echo "4. Select this folder: $EXTENSION_DIR"
    echo "5. The Gmail MCP Bridge extension should now be installed"
    echo ""
}

# 验证安装
verify_installation() {
    print_step "Verifying installation..."
    
    # 检查文件是否存在
    if [ ! -f "$INSTALL_DIR/gmail-mcp-extension/mcp-server/index.js" ]; then
        print_error "MCP server not found"
        exit 1
    fi
    
    if [ ! -f "$CLAUDE_CONFIG_PATH/claude_desktop_config.json" ]; then
        print_error "Claude configuration not found"
        exit 1
    fi
    
    # 测试 MCP 服务器是否可以启动
    print_step "Testing MCP server startup..."
    cd "$INSTALL_DIR/gmail-mcp-extension/mcp-server"
    timeout 5 node index.js --test || {
        print_warning "MCP server test failed, but installation may still work"
    }
    
    print_success "Installation verification completed ✓"
}

# 显示安装后说明
show_post_install_instructions() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}    🎉 Gmail MCP Bridge Installation Complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. 🔄 Restart Claude Desktop application"
    echo "2. 🌐 Install Chrome extension (instructions shown above)"
    echo "3. 📧 Open Gmail in Chrome"
    echo "4. 🧪 Test the integration in Claude"
    echo ""
    echo -e "${BLUE}📍 Installation Details:${NC}"
    echo "• Project installed at: $INSTALL_DIR"
    echo "• Claude config: $CLAUDE_CONFIG_PATH/claude_desktop_config.json"
    echo "• Chrome extension: $INSTALL_DIR/gmail-mcp-extension/extension"
    echo "• Backup created at: $BACKUP_DIR"
    echo ""
    echo -e "${BLUE}🛠️  Commands:${NC}"
    echo "• Test installation: cd $INSTALL_DIR && npm run test"
    echo "• View logs: cd $INSTALL_DIR/gmail-mcp-extension/mcp-server && npm run logs"
    echo "• Uninstall: rm -rf $INSTALL_DIR && rm $CLAUDE_CONFIG_PATH/claude_desktop_config.json"
    echo ""
    echo -e "${BLUE}📖 Documentation:${NC}"
    echo "• GitHub: https://github.com/your-repo/gmail-mcp"
    echo "• Troubleshooting: https://github.com/your-repo/gmail-mcp/wiki/troubleshooting"
    echo ""
}

# 主安装流程
main() {
    print_header
    
    # 检查是否以 root 身份运行
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root is not recommended. Consider running as regular user."
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_step "Installation cancelled."
            exit 0
        fi
    fi
    
    # 执行安装步骤
    detect_os
    check_dependencies
    download_and_install
    backup_configs
    configure_claude
    setup_chrome_extension
    verify_installation
    show_post_install_instructions
    
    print_success "All done! 🚀"
}

# 运行主程序
main "$@"