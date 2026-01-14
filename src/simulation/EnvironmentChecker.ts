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
    libSimValid: boolean;
    errors: string[];
}

/**
 * 环境检查工具
 * 检查编译仿真所需的工具链
 */
export class EnvironmentChecker {
    /**
     * 检查完整环境
     * @param libSimPath 插件内置的 lib/sim 路径
     */
    async checkAll(libSimPath: string): Promise<EnvironmentCheckResult> {
        const result: EnvironmentCheckResult = {
            success: true,
            sconsInstalled: false,
            compilerInstalled: false,
            libSimValid: false,
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

        // 检查内置库路径
        result.libSimValid = this.checkLibSimPath(libSimPath);
        if (!result.libSimValid) {
            result.errors.push(`内置库路径无效: ${libSimPath}`);
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
     * 检查内置库路径是否有效
     */
    private checkLibSimPath(libSimPath: string): boolean {
        if (!libSimPath || !fs.existsSync(libSimPath)) {
            return false;
        }

        // 检查关键目录/文件是否存在
        const win32sim = fs.existsSync(`${libSimPath}/win32_sim`);
        const include = fs.existsSync(`${libSimPath}/include`);

        return win32sim && include;
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

        if (!result.libSimValid) {
            lines.push('3. 内置库文件缺失');
            lines.push('   请重新安装插件');
            lines.push('');
        }

        return lines.join('\n');
    }
}
