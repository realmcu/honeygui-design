import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { RunnerStatus, RunnerListener } from '../common/RunnerStatus';
import { EnvironmentChecker } from './EnvironmentChecker';
import { BuildManager } from './BuildManager';
import { generateHoneyGuiCode } from '../codegen/honeygui';
import { HmlController } from '../hml/HmlController';
import { ProjectUtils } from '../utils/ProjectUtils';

/**
 * 编译仿真运行器
 * 负责完整的编译仿真流程
 */
export class SimulationRunner {
    private projectRoot: string;
    private sdkPath: string;
    private outputChannel: vscode.OutputChannel;
    private currentProcess: ChildProcess | null = null;
    private isRunning: boolean = false;
    private currentFile: string | null = null;
    private listener?: RunnerListener;
    private buildManager: BuildManager | null = null;

    constructor(projectRoot: string, sdkPath: string, outputChannel: vscode.OutputChannel) {
        this.projectRoot = projectRoot;
        this.sdkPath = sdkPath;
        this.outputChannel = outputChannel;
    }

    /**
     * 设置事件监听器
     */
    setListener(listener: RunnerListener): void {
        this.listener = listener;
    }

    /**
     * 启动编译仿真
     */
    async start(hmlFile: string): Promise<void> {
        try {
            this.currentFile = hmlFile;
            this.listener?.onStart?.();

            // 1. 环境检查
            await this.checkEnvironment();

            // 2. 生成代码
            await this.generateCode(hmlFile);

            // 3. 准备编译环境
            await this.setupBuildEnvironment();

            // 4. 编译
            await this.compile();

            // 5. 运行
            await this.run();

            this.isRunning = true;
            this.listener?.onSuccess?.();
        } catch (error) {
            this.listener?.onError?.(error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    /**
     * 停止仿真
     */
    async stop(): Promise<void> {
        if (this.currentProcess) {
            this.currentProcess.kill();
            this.currentProcess = null;
        }
        this.isRunning = false;
        this.currentFile = null;
    }

    /**
     * 获取状态
     */
    getStatus(): RunnerStatus {
        return {
            isRunning: this.isRunning,
            currentFile: this.currentFile || undefined
        };
    }

    /**
     * 检查环境
     */
    private async checkEnvironment(): Promise<void> {
        this.log('检查编译环境...');

        const checker = new EnvironmentChecker();
        const result = await checker.checkAll(this.sdkPath);

        if (!result.success) {
            const guide = checker.getInstallGuide(result);
            throw new Error(guide);
        }

        this.log('环境检查通过');
    }

    /**
     * 生成代码
     */
    private async generateCode(hmlFile: string): Promise<void> {
        this.log('生成 C 代码...');

        const hmlController = new HmlController();
        await hmlController.loadFile(hmlFile);

        const designName = path.basename(path.dirname(hmlFile));
        const hmlFileName = path.basename(hmlFile, '.hml');
        const outputDir = path.join(this.projectRoot, 'src', 'autogen', designName);

        const components = hmlController.currentDocument?.view.components || [];
        const result = await generateHoneyGuiCode(components as any, {
            outputDir,
            hmlFileName,
            enableProtectedAreas: true
        });

        if (!result.success) {
            throw new Error(result.errors?.[0] || '代码生成失败');
        }

        this.log(`代码生成完成: ${result.files.length} 个文件`);
    }

    /**
     * 准备编译环境
     */
    private async setupBuildEnvironment(): Promise<void> {
        this.log('准备编译环境...');

        this.buildManager = new BuildManager(this.projectRoot, this.sdkPath, this.outputChannel);

        await this.buildManager.setupBuildDir();
        await this.buildManager.copyGeneratedCode();

        this.log('编译环境准备完成');
    }

    /**
     * 编译
     */
    private async compile(): Promise<void> {
        if (!this.buildManager) {
            throw new Error('编译管理器未初始化');
        }

        await this.buildManager.compile();
    }

    /**
     * 运行仿真器
     */
    private async run(): Promise<void> {
        if (!this.buildManager) {
            throw new Error('编译管理器未初始化');
        }

        const exePath = this.buildManager.getExecutablePath();
        const buildDir = this.buildManager.getBuildDir();
        
        this.log(`启动仿真器: ${exePath}`);
        this.log(`工作目录: ${buildDir}`);

        // 使用 stdbuf 强制无缓冲输出（Linux）或直接运行（Windows）
        let command: string;
        let args: string[];
        
        if (process.platform === 'win32') {
            command = exePath;
            args = [];
        } else {
            // Linux: 使用 stdbuf -o0 -e0 强制标准输出和错误输出无缓冲
            command = 'stdbuf';
            args = ['-o0', '-e0', exePath];
        }

        this.currentProcess = spawn(command, args, {
            cwd: buildDir,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { 
                ...process.env,
                SDL_STDIO_REDIRECT: '0',  // SDL 不重定向输出
                TERM: 'xterm'  // 确保终端类型
            },
            shell: false
        });

        // 实时输出 stdout
        if (this.currentProcess.stdout) {
            this.currentProcess.stdout.setEncoding('utf8');
            this.currentProcess.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');
                lines.forEach((line: string) => {
                    const trimmed = line.trim();
                    if (trimmed) {
                        this.log(`[仿真] ${trimmed}`);
                    }
                });
            });
        }

        // 实时输出 stderr
        if (this.currentProcess.stderr) {
            this.currentProcess.stderr.setEncoding('utf8');
            this.currentProcess.stderr.on('data', (data) => {
                const lines = data.toString().split('\n');
                lines.forEach((line: string) => {
                    const trimmed = line.trim();
                    if (trimmed) {
                        this.log(`[仿真错误] ${trimmed}`);
                    }
                });
            });
        }

        this.currentProcess.on('spawn', () => {
            this.log('仿真器进程已启动 (PID: ' + this.currentProcess?.pid + ')');
        });

        this.currentProcess.on('exit', (code) => {
            this.isRunning = false;
            this.currentProcess = null;
            this.listener?.onExit?.(code);
            this.log(`仿真器已退出，退出码: ${code}`);
        });

        this.currentProcess.on('error', (error) => {
            this.listener?.onError?.(error);
            this.log(`[错误] 仿真器进程错误: ${error.message}`);
        });
        
        this.log('仿真器已启动，等待输出...');
        this.log('注意: HoneyGUI 的日志可能直接显示在图形窗口中');
    }

    /**
     * 输出日志
     */
    private log(message: string): void {
        this.listener?.onLog?.(message);
    }

    /**
     * 清理资源
     */
    dispose(): void {
        this.stop();
        this.buildManager?.dispose();
    }
}
