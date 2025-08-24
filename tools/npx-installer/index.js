#!/usr/bin/env node

/**
 * Gmail MCP Bridge - NPX Installer
 * 
 * Linus Style: "Make it just work"
 * - Interactive installer for users who prefer npx
 * - Simple questions, direct actions
 * - No over-engineering
 * 
 * Usage: npx gmail-mcp-installer
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Import with dynamic require to handle different environments
let chalk, ora, inquirer;
try {
  chalk = require('chalk');
  ora = require('ora');
  inquirer = require('inquirer');
} catch (error) {
  console.log('Installing required dependencies...');
  execSync('npm install chalk@4.1.2 ora@5.4.1 inquirer@8.2.4', { stdio: 'inherit' });
  chalk = require('chalk');
  ora = require('ora');
  inquirer = require('inquirer');
}

/**
 * Simple installer class - no complex state management
 */
class NPXInstaller {
  constructor() {
    this.isDryRun = process.argv.includes('--dry-run');
    this.isForced = process.argv.includes('--force');
    
    this.osType = this._detectOS();
    this.claudeConfigPath = this._getClaudeConfigPath();
    this.installDir = path.join(os.homedir(), '.gmail-mcp');
    
    console.log(chalk.blue.bold('\n🚀 Gmail MCP Bridge Installer'));
    console.log(chalk.gray('Making Gmail work with Claude Desktop via MCP\n'));
  }
  
  /**
   * Main installation flow
   */
  async install() {
    try {
      // Pre-flight checks
      await this._checkSystem();
      
      if (!this.isForced) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Ready to install Gmail MCP Bridge?',
          default: true
        }]);
        
        if (!confirm) {
          console.log(chalk.yellow('Installation cancelled.'));
          return;
        }
      }
      
      // Installation steps
      await this._downloadProject();
      await this._installDependencies();  
      await this._configureClaudeDesktop();
      await this._setupChromeExtension();
      await this._verifyInstallation();
      
      this._showSuccessMessage();
      
    } catch (error) {
      console.error(chalk.red('\n✗ Installation failed:'), error.message);
      process.exit(1);
    }
  }
  
  /**
   * System checks - simple and direct
   */
  async _checkSystem() {
    const spinner = ora('Checking system requirements...').start();
    
    try {
      // Check Node.js version
      const nodeVersion = process.version.slice(1).split('.')[0];
      if (parseInt(nodeVersion) < 18) {
        throw new Error(`Node.js ${process.version} is too old. Please install Node.js >= 18`);
      }
      
      // Check if git is available
      try {
        execSync('git --version', { stdio: 'ignore' });
      } catch {
        throw new Error('Git not found. Please install git');
      }
      
      // Check Claude Desktop config directory
      if (!fs.existsSync(path.dirname(this.claudeConfigPath))) {
        spinner.warn(chalk.yellow('Claude Desktop config directory not found. Will create it.'));
      }
      
      spinner.succeed('System requirements check passed ✓');
      
    } catch (error) {
      spinner.fail('System requirements check failed');
      throw error;
    }
  }
  
  /**
   * Download project from GitHub
   */
  async _downloadProject() {
    const spinner = ora('Downloading Gmail MCP Bridge...').start();
    
    if (this.isDryRun) {
      spinner.succeed('Would download project (dry run)');
      return;
    }
    
    try {
      // Remove existing installation
      if (fs.existsSync(this.installDir)) {
        execSync(`rm -rf "${this.installDir}"`, { stdio: 'ignore' });
      }
      
      // Clone repository
      execSync(
        `git clone https://github.com/your-repo/gmail-mcp.git "${this.installDir}"`,
        { stdio: 'ignore' }
      );
      
      spinner.succeed('Project downloaded successfully ✓');
      
    } catch (error) {
      spinner.fail('Failed to download project');
      throw new Error('Could not clone repository. Check your internet connection.');
    }
  }
  
  /**
   * Install Node.js dependencies
   */
  async _installDependencies() {
    const spinner = ora('Installing dependencies...').start();
    
    if (this.isDryRun) {
      spinner.succeed('Would install dependencies (dry run)');
      return;
    }
    
    try {
      const serverDir = path.join(this.installDir, 'gmail-mcp-extension', 'mcp-server');
      
      execSync('npm install --silent', {
        cwd: serverDir,
        stdio: 'ignore'
      });
      
      spinner.succeed('Dependencies installed ✓');
      
    } catch (error) {
      spinner.fail('Failed to install dependencies');
      throw error;
    }
  }
  
  /**
   * Configure Claude Desktop
   */
  async _configureClaudeDesktop() {
    const spinner = ora('Configuring Claude Desktop...').start();
    
    if (this.isDryRun) {
      spinner.succeed('Would configure Claude Desktop (dry run)');
      return;
    }
    
    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.claudeConfigPath);
      fs.mkdirSync(configDir, { recursive: true });
      
      // Backup existing config
      if (fs.existsSync(this.claudeConfigPath)) {
        const backupPath = `${this.claudeConfigPath}.backup.${Date.now()}`;
        fs.copyFileSync(this.claudeConfigPath, backupPath);
        spinner.text = 'Backing up existing Claude config...';
      }
      
      // Generate new config
      const serverScript = path.join(this.installDir, 'gmail-mcp-extension', 'mcp-server', 'index.js');
      const config = {
        mcpServers: {
          'gmail-mcp-bridge': {
            command: 'node',
            args: [serverScript],
            env: {
              NODE_ENV: 'production'
            }
          }
        }
      };
      
      fs.writeFileSync(this.claudeConfigPath, JSON.stringify(config, null, 2));
      
      spinner.succeed('Claude Desktop configured ✓');
      
    } catch (error) {
      spinner.fail('Failed to configure Claude Desktop');
      throw error;
    }
  }
  
  /**
   * Setup Chrome extension  
   */
  async _setupChromeExtension() {
    const spinner = ora('Preparing Chrome extension...').start();
    
    const extensionDir = path.join(this.installDir, 'gmail-mcp-extension', 'extension');
    
    if (!fs.existsSync(extensionDir)) {
      spinner.fail('Chrome extension files not found');
      throw new Error('Extension directory missing from project');
    }
    
    spinner.succeed('Chrome extension prepared ✓');
    
    // Store extension path for later display
    this.extensionPath = extensionDir;
  }
  
  /**
   * Verify installation
   */
  async _verifyInstallation() {
    const spinner = ora('Verifying installation...').start();
    
    if (this.isDryRun) {
      spinner.succeed('Would verify installation (dry run)');
      return;
    }
    
    try {
      // Check critical files exist
      const serverScript = path.join(this.installDir, 'gmail-mcp-extension', 'mcp-server', 'index.js');
      if (!fs.existsSync(serverScript)) {
        throw new Error('MCP server script not found');
      }
      
      if (!fs.existsSync(this.claudeConfigPath)) {
        throw new Error('Claude configuration not found');  
      }
      
      spinner.succeed('Installation verified ✓');
      
    } catch (error) {
      spinner.fail('Installation verification failed');
      throw error;
    }
  }
  
  /**
   * Show success message with next steps
   */
  _showSuccessMessage() {
    console.log(chalk.green.bold('\n🎉 Gmail MCP Bridge installed successfully!'));
    
    console.log(chalk.blue.bold('\n📋 Next Steps:'));
    console.log(chalk.white('1. Restart Claude Desktop application'));
    console.log(chalk.white('2. Install Chrome extension:'));
    console.log(chalk.gray(`   • Open Chrome and go to: chrome://extensions/`));
    console.log(chalk.gray(`   • Enable "Developer mode"`));
    console.log(chalk.gray(`   • Click "Load unpacked"`));
    console.log(chalk.gray(`   • Select folder: ${this.extensionPath}`));
    console.log(chalk.white('3. Open Gmail in Chrome'));
    console.log(chalk.white('4. Test the integration in Claude'));
    
    console.log(chalk.blue.bold('\n📍 Installation Details:'));
    console.log(chalk.gray(`• Project: ${this.installDir}`));
    console.log(chalk.gray(`• Config: ${this.claudeConfigPath}`));
    console.log(chalk.gray(`• Extension: ${this.extensionPath}`));
    
    console.log(chalk.blue.bold('\n📖 Resources:'));
    console.log(chalk.gray('• Documentation: https://github.com/your-repo/gmail-mcp'));
    console.log(chalk.gray('• Issues: https://github.com/your-repo/gmail-mcp/issues'));
  }
  
  /**
   * Detect operating system
   */
  _detectOS() {
    const platform = os.platform();
    switch (platform) {
      case 'darwin': return 'macos';
      case 'win32': return 'windows';
      case 'linux': return 'linux';
      default: throw new Error(`Unsupported platform: ${platform}`);
    }
  }
  
  /**
   * Get Claude Desktop config path
   */
  _getClaudeConfigPath() {
    const homeDir = os.homedir();
    
    switch (this.osType) {
      case 'macos':
        return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      case 'windows':
        return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
      case 'linux':
        return path.join(homeDir, '.config', 'claude', 'claude_desktop_config.json');
      default:
        throw new Error(`Unsupported OS: ${this.osType}`);
    }
  }
}

// Main execution
if (require.main === module) {
  const installer = new NPXInstaller();
  installer.install().catch(error => {
    console.error(chalk.red('Fatal error:'), error.message);
    process.exit(1);
  });
}

module.exports = NPXInstaller;