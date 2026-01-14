import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { ProjectUtils } from '../utils/ProjectUtils';

const execAsync = promisify(exec);

/**
 * 环境检查结果
 */
export interface EnvironmentCheckResult {
    success: boolean;
    pythonInstalled: boolean;
    pythonVersion?: string;
    sconsInstalled: boolean;
    sconsVersion?: string;
    compilerInstalled: boolean;
    compilerVersion?: string;
    sdlInstalled?: boolean;
    sdlVersion?: string;
    ffmpegInstalled: boolean;
    ffmpegVersion?: string;
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
     */
    async checkAll(): Promise<EnvironmentCheckResult> {
        const libSimPath = ProjectUtils.getLibSimPath();
        const result: EnvironmentCheckResult = {
            success: true,
            pythonInstalled: false,
            sconsInstalled: false,
            compilerInstalled: false,
            ffmpegInstalled: false,
            libSimValid: false,
            errors: []
        };

        // 检查 Python
        const pythonCheck = await this.checkPython();
        result.pythonInstalled = pythonCheck.installed;
        result.pythonVersion = pythonCheck.version;
        if (!result.pythonInstalled) {
            result.errors.push('Python 未安装。请从 https://www.python.org/ 下载安装');
            result.success = false;
        }

        // 检查 SCons
        const sconsCheck = await this.checkSCons();
        result.sconsInstalled = sconsCheck.installed;
        result.sconsVersion = sconsCheck.version;
        if (!result.sconsInstalled) {
            result.errors.push('SCons 未安装。请运行: pip install scons');
            result.success = false;
        }

        // 检查编译器
        const compilerCheck = await this.checkCompiler();
        result.compilerInstalled = compilerCheck.installed;
        result.compilerVersion = compilerCheck.version;
        if (!result.compilerInstalled) {
            const compilerName = process.platform === 'win32' ? 'MinGW' : 'GCC';
            result.errors.push(`${compilerName} 未安装。请安装 C 编译器。`);
            result.success = false;
        }

        // 检查 SDL (仅 Linux/WSL)
        if (process.platform === 'linux') {
            const sdlCheck = await this.checkSDL();
            result.sdlInstalled = sdlCheck.installed;
            result.sdlVersion = sdlCheck.version;
            if (!result.sdlInstalled) {
                result.errors.push('SDL2 未安装。请运行: sudo apt-get install libsdl2-dev');
                result.success = false;
            }
        }

        // 检查 FFmpeg
        const ffmpegCheck = await this.checkFFmpeg();
        result.ffmpegInstalled = ffmpegCheck.installed;
        result.ffmpegVersion = ffmpegCheck.version;
        if (!result.ffmpegInstalled) {
            result.errors.push('FFmpeg 未安装。视频转换功能将不可用');
        }

        // 检查内置库路径
        result.libSimValid = this.checkLibSimPath(libSimPath);
        if (!result.libSimValid) {
            result.errors.push(`内置库路径无效: ${libSimPath}`);
            result.success = false;
        }

        return result;
    }

    private async checkPython(): Promise<{ installed: boolean; version?: string }> {
        try {
            const { stdout } = await execAsync('python --version');
            return { installed: true, version: stdout.trim() };
        } catch {
            try {
                const { stdout } = await execAsync('python3 --version');
                return { installed: true, version: stdout.trim() };
            } catch {
                return { installed: false };
            }
        }
    }

    private async checkSCons(): Promise<{ installed: boolean; version?: string }> {
        try {
            const { stdout } = await execAsync('scons --version');
            const match = stdout.match(/SCons.*?(\d+\.\d+\.\d+)/);
            return { installed: true, version: match ? match[1] : stdout.split('\n')[0] };
        } catch {
            return { installed: false };
        }
    }

    private async checkCompiler(): Promise<{ installed: boolean; version?: string }> {
        try {
            const { stdout } = await execAsync('gcc --version');
            const match = stdout.match(/gcc.*?(\d+\.\d+\.\d+)/i);
            return { installed: true, version: match ? match[1] : stdout.split('\n')[0] };
        } catch {
            return { installed: false };
        }
    }

    private async checkSDL(): Promise<{ installed: boolean; version?: string }> {
        try {
            const { stdout } = await execAsync('pkg-config --modversion sdl2');
            return { installed: true, version: stdout.trim() };
        } catch {
            return { installed: false };
        }
    }

    private async checkFFmpeg(): Promise<{ installed: boolean; version?: string }> {
        try {
            const { stdout } = await execAsync('ffmpeg -version');
            const match = stdout.match(/ffmpeg version (\S+)/);
            return { installed: true, version: match ? match[1] : stdout.split('\n')[0] };
        } catch {
            return { installed: false };
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

        if (!result.pythonInstalled) {
            lines.push('1. Python');
            lines.push('   下载地址: https://www.python.org/');
            lines.push('');
        }

        if (!result.sconsInstalled) {
            lines.push('2. SCons 构建工具');
            lines.push('   安装命令: pip install scons');
            lines.push('');
        }

        if (!result.compilerInstalled) {
            if (process.platform === 'win32') {
                lines.push('3. MinGW 编译器');
                lines.push('   下载地址: https://www.mingw-w64.org/');
            } else {
                lines.push('3. GCC 编译器');
                lines.push('   安装命令: sudo apt-get install build-essential (Ubuntu/Debian)');
                lines.push('   安装命令: sudo yum groupinstall "Development Tools" (CentOS/RHEL)');
            }
            lines.push('');
        }

        if (result.sdlInstalled === false) {
            lines.push('4. SDL2 开发库');
            lines.push('   安装命令: sudo apt-get install libsdl2-dev (Ubuntu/Debian)');
            lines.push('   安装命令: sudo yum install SDL2-devel (CentOS/RHEL)');
            lines.push('');
        }

        if (!result.ffmpegInstalled) {
            lines.push('5. FFmpeg (可选，用于视频转换)');
            lines.push('   下载地址: https://ffmpeg.org/');
            lines.push('');
        }

        if (!result.libSimValid) {
            lines.push('6. 内置库文件缺失');
            lines.push('   请重新安装插件');
            lines.push('');
        }

        return lines.join('\n');
    }
}
