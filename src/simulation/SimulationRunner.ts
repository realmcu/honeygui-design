import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, exec, ChildProcess } from 'child_process';
import { RunnerStatus, RunnerListener } from '../common/RunnerStatus';
import { EnvironmentChecker } from './EnvironmentChecker';
import { BuildManager } from './BuildManager';
import { CodeGenerator } from '../services/CodeGenerator';
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
    private simulatorTerminal: vscode.Terminal | null = null;
    private isRunning: boolean = false;
    private listener?: RunnerListener;
    private buildManager: BuildManager | null = null;

    constructor(projectRoot: string, sdkPath: string, outputChannel: vscode.OutputChannel) {
        this.projectRoot = projectRoot;
        this.sdkPath = sdkPath;
        this.outputChannel = outputChannel;
        
        // 监听终端关闭事件
        vscode.window.onDidCloseTerminal((terminal) => {
            if (terminal === this.simulatorTerminal) {
                this.isRunning = false;
                this.simulatorTerminal = null;
                this.listener?.onExit?.(0);
                this.log('仿真器终端已关闭');
            }
        });
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
    async start(): Promise<void> {
        try {
            this.listener?.onStart?.();

            // 1. 环境检查
            await this.checkEnvironment();

            // 2. 生成代码（所有 HML 文件）
            await this.generateCode();

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
        // 关闭终端方式的仿真器
        if (this.simulatorTerminal) {
            this.log('正在关闭仿真器终端...');
            this.simulatorTerminal.dispose();
            this.simulatorTerminal = null;
            this.log('仿真器终端已关闭');
        }
        
        // 兼容旧的进程方式（保留以防需要）
        if (this.currentProcess && this.currentProcess.pid) {
            this.log('正在停止仿真器进程...');
            
            try {
                if (process.platform === 'win32') {
                    exec(`taskkill /F /T /PID ${this.currentProcess.pid}`, (error) => {
                        if (error) {
                            this.log(`taskkill 错误: ${error.message}`);
                        }
                    });
                } else {
                    try {
                        process.kill(-this.currentProcess.pid, 'SIGTERM');
                    } catch (err) {
                        this.currentProcess.kill('SIGTERM');
                    }
                }
                
                await new Promise<void>((resolve) => {
                    const timeout = setTimeout(() => {
                        if (this.currentProcess && this.currentProcess.pid) {
                            try {
                                if (process.platform === 'win32') {
                                    exec(`taskkill /F /T /PID ${this.currentProcess.pid}`);
                                } else {
                                    try {
                                        process.kill(-this.currentProcess.pid, 'SIGKILL');
                                    } catch {
                                        this.currentProcess?.kill('SIGKILL');
                                    }
                                }
                            } catch (err) {
                                // 进程可能已经退出
                            }
                        }
                        resolve();
                    }, 2000);
                    
                    this.currentProcess?.once('exit', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                });
            } catch (err) {
                this.log(`停止进程时出错: ${err}`);
            }
            
            this.currentProcess = null;
            this.log('仿真器进程已停止');
        }
        this.isRunning = false;
    }

    /**
     * 获取状态
     */
    getStatus(): RunnerStatus {
        return {
            isRunning: this.isRunning
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
    private async generateCode(): Promise<void> {
        this.log('生成 C 代码（所有界面）...');

        // 使用统一的代码生成器
        const codeGenerator = new CodeGenerator();
        const result = await codeGenerator.generate(this.projectRoot);

        if (!result.success) {
            throw new Error(result.errors?.[0]?.error || '代码生成失败');
        }

        this.log(`代码生成完成: ${result.totalFiles} 个文件`);
    }

    /**
     * 准备编译环境
     */
    private async setupBuildEnvironment(): Promise<void> {
        this.log('准备编译环境...');

        this.buildManager = new BuildManager(this.projectRoot, this.sdkPath, this.outputChannel);

        await this.buildManager.setupBuildDir();
        await this.buildManager.convertAssets();
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
     * 运行仿真器（使用 Terminal，支持交互输入）
     */
    private async run(): Promise<void> {
        if (!this.buildManager) {
            throw new Error('编译管理器未初始化');
        }

        const exePath = this.buildManager.getExecutablePath();
        const buildDir = this.buildManager.getBuildDir();
        
        this.log(`启动仿真器: ${exePath}`);
        this.log(`工作目录: ${buildDir}`);

        // 关闭已有的仿真器终端
        if (this.simulatorTerminal) {
            this.simulatorTerminal.dispose();
            this.simulatorTerminal = null;
        }

        // 创建新终端运行仿真器
        this.simulatorTerminal = vscode.window.createTerminal({
            name: 'HoneyGUI Simulator',
            cwd: buildDir,
            env: {
                SDL_STDIO_REDIRECT: '0',
                TERM: 'xterm'
            }
        });

        // 显示终端
        this.simulatorTerminal.show();

        // 发送运行命令
        if (process.platform === 'win32') {
            this.simulatorTerminal.sendText(exePath);
        } else {
            // Linux: 直接运行
            this.simulatorTerminal.sendText(exePath);
        }

        this.log('仿真器已在终端中启动');
        this.log('提示: 可在终端中输入 letter shell 命令进行交互');
    }

    /**
     * 输出日志
     */
    private log(message: string): void {
        this.listener?.onLog?.(message);
    }

    /**
     * 清理编译产物
     * @param deep 是否深度清理
     */
    async clean(deep: boolean = false): Promise<void> {
        this.log(deep ? '开始深度清理...' : '开始清理编译产物...');

        // 清理 build 目录（包含所有编译产物和转换后的资源）
        const buildDir = path.join(this.projectRoot, 'build');
        if (fs.existsSync(buildDir)) {
            this.log(`清理 build 目录: ${buildDir}`);
            await fs.promises.rm(buildDir, { recursive: true, force: true });
        }

        if (deep) {
            // 深度清理：清理整个 src 目录
            const srcDir = path.join(this.projectRoot, 'src');
            if (fs.existsSync(srcDir)) {
                this.log(`清理 src 目录: ${srcDir}`);
                await fs.promises.rm(srcDir, { recursive: true, force: true });
            }
        } else {
            // 普通清理：只清理 src/ui 目录
            const uiDir = path.join(this.projectRoot, 'src', 'ui');
            if (fs.existsSync(uiDir)) {
                this.log(`清理 src/ui 目录: ${uiDir}`);
                await fs.promises.rm(uiDir, { recursive: true, force: true });
            }
        }

        this.log('清理完成');
    }

    /**
     * 清理资源
     */
    dispose(): void {
        this.stop();
        if (this.simulatorTerminal) {
            this.simulatorTerminal.dispose();
            this.simulatorTerminal = null;
        }
        this.buildManager?.dispose();
    }
}
