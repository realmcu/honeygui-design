import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

/**
 * 环境检查结果
 */
export interface EnvironmentCheckResult {
    success: boolean;
    sconsInstalled: boolean;
    compilerInstalled: boolean;
    sdkPathValid: boolean;
    errors: string[];
}

/**
 * 环境检查工具
 * 检查编译仿真所需的工具链
 */
export class EnvironmentChecker {
    /**
     * 检查完整环境
     */
    async checkAll(sdkPath: string): Promise<EnvironmentCheckResult> {
        const result: EnvironmentCheckResult = {
            success: true,
            sconsInstalled: false,
            compilerInstalled: false,
            sdkPathValid: false,
            errors: []
        };

        // 检查 SCons
        result.sconsInstalled = await this.checkSCons();
        if (!result.sconsInstalled) {
            result.errors.push('SCons 未安装。请运行: pip install scons');
            result.success = false;
        }

        // 检查编译器
        result.compilerInstalled = await this.checkCompiler();
        if (!result.compilerInstalled) {
            const compilerName = process.platform === 'win32' ? 'MinGW' : 'GCC';
            result.errors.push(`${compilerName} 未安装。请安装 C 编译器。`);
            result.success = false;
        }

        // 检查 SDK 路径
        result.sdkPathValid = this.checkSdkPath(sdkPath);
        if (!result.sdkPathValid) {
            result.errors.push(`HoneyGUI SDK 路径无效: ${sdkPath}`);
            result.success = false;
        }

        return result;
    }

    /**
     * 检查 SCons 是否安装
     */
    private async checkSCons(): Promise<boolean> {
        try {
            await execAsync('scons --version');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 检查编译器是否安装
     */
    private async checkCompiler(): Promise<boolean> {
        try {
            const command = process.platform === 'win32' ? 'gcc --version' : 'gcc --version';
            await execAsync(command);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 检查 SDK 路径是否有效
     */
    private checkSdkPath(sdkPath: string): boolean {
        if (!sdkPath || !fs.existsSync(sdkPath)) {
            return false;
        }

        // 检查关键目录是否存在
        const realgui = fs.existsSync(`${sdkPath}/realgui`);
        const win32sim = fs.existsSync(`${sdkPath}/win32_sim`);

        return realgui && win32sim;
    }

    /**
     * 生成安装指南
     */
    getInstallGuide(result: EnvironmentCheckResult): string {
        const lines: string[] = ['编译仿真环境检查失败，请安装以下工具：\n'];

        if (!result.sconsInstalled) {
            lines.push('1. SCons 构建工具');
            lines.push('   安装命令: pip install scons');
            lines.push('');
        }

        if (!result.compilerInstalled) {
            if (process.platform === 'win32') {
                lines.push('2. MinGW 编译器');
                lines.push('   下载地址: https://www.mingw-w64.org/');
            } else {
                lines.push('2. GCC 编译器');
                lines.push('   安装命令: sudo apt-get install build-essential (Ubuntu/Debian)');
                lines.push('   安装命令: sudo yum groupinstall "Development Tools" (CentOS/RHEL)');
            }
            lines.push('');
        }

        if (!result.sdkPathValid) {
            lines.push('3. HoneyGUI SDK 路径');
            lines.push('   请在项目配置或 VSCode 设置中配置正确的 SDK 路径');
            lines.push('');
        }

        return lines.join('\n');
    }
}
