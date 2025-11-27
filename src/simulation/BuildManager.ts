import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { SConstructGenerator } from './SConstructGenerator';

/**
 * 编译管理器
 * 负责设置编译目录、拷贝文件、执行编译
 */
export class BuildManager {
    private buildDir: string;
    private projectRoot: string;
    private sdkPath: string;
    private outputChannel: vscode.OutputChannel;

    constructor(projectRoot: string, sdkPath: string) {
        this.projectRoot = projectRoot;
        this.sdkPath = sdkPath;
        this.buildDir = path.join(projectRoot, '.honeygui-build');
        this.outputChannel = vscode.window.createOutputChannel('HoneyGUI Simulation');
    }

    /**
     * 准备编译目录
     */
    async setupBuildDir(): Promise<void> {
        this.log('准备编译目录...');

        // 创建编译目录
        if (!fs.existsSync(this.buildDir)) {
            fs.mkdirSync(this.buildDir, { recursive: true });
        }

        // 创建子目录
        fs.mkdirSync(path.join(this.buildDir, 'src'), { recursive: true });
        fs.mkdirSync(path.join(this.buildDir, 'build'), { recursive: true });

        // 更新 .gitignore
        await this.updateGitignore();

        this.log('编译目录准备完成');
    }

    /**
     * 拷贝生成的代码
     */
    async copyGeneratedCode(): Promise<void> {
        this.log('拷贝生成的代码...');

        const srcAutogen = path.join(this.projectRoot, 'src', 'autogen');
        const destAutogen = path.join(this.buildDir, 'src', 'autogen');

        if (fs.existsSync(srcAutogen)) {
            this.copyDirectory(srcAutogen, destAutogen);
            this.log('代码拷贝完成');
        } else {
            throw new Error(`生成的代码目录不存在: ${srcAutogen}`);
        }
    }

    /**
     * 拷贝 SDK 的 win32_sim
     */
    async copySdkFiles(): Promise<void> {
        this.log('拷贝 SDK 文件...');

        const sdkWin32Sim = path.join(this.sdkPath, 'win32_sim');
        const destWin32Sim = path.join(this.buildDir, 'win32_sim');

        if (!fs.existsSync(sdkWin32Sim)) {
            throw new Error(`SDK win32_sim 目录不存在: ${sdkWin32Sim}`);
        }

        // 只在首次或不存在时拷贝
        if (!fs.existsSync(destWin32Sim)) {
            this.copyDirectory(sdkWin32Sim, destWin32Sim);
            this.log('SDK 文件拷贝完成');
        } else {
            this.log('SDK 文件已存在，跳过拷贝');
        }
    }

    /**
     * 生成 SConstruct
     */
    async generateSConstruct(projectName: string): Promise<void> {
        this.log('生成 SConstruct...');

        const generator = new SConstructGenerator();
        const content = generator.generate({
            sdkPath: this.sdkPath,
            buildDir: this.buildDir,
            projectName
        });

        const sconstruct = path.join(this.buildDir, 'SConstruct');
        fs.writeFileSync(sconstruct, content, 'utf-8');

        this.log('SConstruct 生成完成');
    }

    /**
     * 执行编译
     */
    async compile(): Promise<void> {
        this.log('开始编译...');
        this.outputChannel.show(true);

        return new Promise((resolve, reject) => {
            const compileProcess = spawn('scons', ['-j4'], {
                cwd: this.buildDir,
                shell: true
            });

            compileProcess.stdout?.on('data', (data) => {
                this.log(data.toString());
            });

            compileProcess.stderr?.on('data', (data) => {
                this.log(data.toString(), true);
            });

            compileProcess.on('exit', (code) => {
                if (code === 0) {
                    this.log('编译成功！');
                    resolve();
                } else {
                    const error = `编译失败，退出码: ${code}`;
                    this.log(error, true);
                    reject(new Error(error));
                }
            });

            compileProcess.on('error', (error) => {
                this.log(`编译进程错误: ${error.message}`, true);
                reject(error);
            });
        });
    }

    /**
     * 获取可执行文件路径
     */
    getExecutablePath(): string {
        const exeName = process.platform === 'win32' ? 'gui.exe' : 'gui';
        return path.join(this.buildDir, 'build', exeName);
    }

    /**
     * 更新 .gitignore
     */
    private async updateGitignore(): Promise<void> {
        const gitignorePath = path.join(this.projectRoot, '.gitignore');
        const entry = '.honeygui-build/';

        let content = '';
        if (fs.existsSync(gitignorePath)) {
            content = fs.readFileSync(gitignorePath, 'utf-8');
        }

        if (!content.includes(entry)) {
            content += `\n# HoneyGUI 编译仿真目录\n${entry}\n`;
            fs.writeFileSync(gitignorePath, content, 'utf-8');
        }
    }

    /**
     * 递归拷贝目录
     */
    private copyDirectory(src: string, dest: string): void {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    /**
     * 输出日志
     */
    private log(message: string, isError: boolean = false): void {
        const prefix = isError ? '[错误]' : '[信息]';
        this.outputChannel.appendLine(`${prefix} ${message}`);
    }

    /**
     * 清理资源
     */
    dispose(): void {
        this.outputChannel.dispose();
    }
}
