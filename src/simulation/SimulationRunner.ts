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
    private currentTask: vscode.TaskExecution | null = null; // 当前运行的任务
    private isRunning: boolean = false;
    private listener?: RunnerListener;
    private buildManager: BuildManager | null = null;
    private isManuallyStopped: boolean = false; // 标记是否手动停止
    private taskEndListener: vscode.Disposable | null = null; // 任务结束监听器
    private processMonitorInterval: NodeJS.Timeout | null = null; // 进程监听定时器
    private hasExited: boolean = false; // 标记是否已经处理过退出事件

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
    async start(): Promise<void> {
        try {
            this.listener?.onStart?.();

            const targetEngine = this.resolveTargetEngine();
            this.log(`目标引擎: ${targetEngine}`);

            if (targetEngine === 'lvgl') {
                await this.startLvglSimulation();
                this.isRunning = true;
                this.listener?.onSuccess?.();
                return;
            }

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
        this.isManuallyStopped = true;
        
        // 终止任务
        if (this.currentTask) {
            this.log('正在停止仿真器任务...');
            this.currentTask.terminate();
            this.currentTask = null;
        }
        
        // 清理任务监听器
        if (this.taskEndListener) {
            this.taskEndListener.dispose();
            this.taskEndListener = null;
        }
        
        // 兼容：如果有进程，也终止
        if (this.currentProcess && this.currentProcess.pid) {
            this.log('正在停止仿真器进程...');
            
            try {
                if (process.platform === 'win32') {
                    exec(`taskkill /F /T /PID ${this.currentProcess.pid}`, { windowsHide: true }, (error) => {
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
                                    exec(`taskkill /F /T /PID ${this.currentProcess.pid}`, { windowsHide: true });
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
        }
        
        this.log('仿真器已停止');
        this.isRunning = false;
        this.isManuallyStopped = false;
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
        this.log(vscode.l10n.t('Checking build environment...'));

        const checker = new EnvironmentChecker();
        const result = await checker.checkAll();

        if (!result.success) {
            const guide = checker.getInstallGuide(result);
            throw new Error(guide);
        }

        this.log(vscode.l10n.t('Environment check passed'));
    }

    /**
     * 生成代码
     */
    private async generateCode(): Promise<void> {
        this.log(vscode.l10n.t('Generating C code (all views)...'));

        // 使用统一的代码生成器
        const codeGenerator = new CodeGenerator();
        const result = await codeGenerator.generate(this.projectRoot);

        if (!result.success) {
            throw new Error(result.errors?.[0]?.error || vscode.l10n.t('Code generation failed'));
        }

        this.log(vscode.l10n.t('Code generation completed: {0} files', result.totalFiles));
    }

    /**
     * 准备编译环境
     */
    private async setupBuildEnvironment(): Promise<void> {
        this.log(vscode.l10n.t('Preparing build environment...'));

        this.buildManager = new BuildManager(this.projectRoot, this.outputChannel);

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
     * 运行仿真器（使用 Task API，在终端中显示输出并监听退出）
     */
    private async run(): Promise<void> {
        if (!this.buildManager) {
            throw new Error('编译管理器未初始化');
        }

        const exePath = this.buildManager.getExecutablePath();
        const buildDir = this.buildManager.getBuildDir();
        
        this.log(`启动仿真器: ${exePath}`);
        this.log(`工作目录: ${buildDir}`);

        // 停止已有的仿真器
        if (this.currentTask || this.currentProcess) {
            await this.stop();
        }

        // 创建一个 Shell Task 来运行仿真器
        const task = new vscode.Task(
            { type: 'shell' },
            vscode.TaskScope.Workspace,
            'HoneyGUI Simulator',
            'HoneyGUI',
            new vscode.ShellExecution(exePath, {
                cwd: buildDir,
                env: {
                    SDL_STDIO_REDIRECT: '0'
                }
            }),
            [] // 不需要 problem matcher
        );

        // 配置任务显示
        task.presentationOptions = {
            reveal: vscode.TaskRevealKind.Always,
            panel: vscode.TaskPanelKind.Dedicated,
            clear: false,
            showReuseMessage: false
        };

        // 监听任务结束事件
        this.hasExited = false;
        this.taskEndListener = vscode.tasks.onDidEndTask((e) => {
            if (e.execution === this.currentTask) {
                this.handleTaskEnd();
            }
        });

        // 执行任务
        this.currentTask = await vscode.tasks.executeTask(task);

        // 尝试获取进程 ID 并监听进程退出（更快响应）
        setTimeout(async () => {
            if (this.currentTask) {
                try {
                    // 获取任务的进程 ID
                    const processId = (this.currentTask as any).processId;
                    if (processId) {
                        this.log(`仿真器进程 PID: ${processId}`);
                        this.startProcessMonitor(processId);
                    }
                } catch (err) {
                    // 如果无法获取进程 ID，依赖 onDidEndTask 事件
                    this.log('无法获取进程 ID，使用任务结束事件监听');
                }
            }
        }, 500);

        this.log('仿真器已启动');
        this.log('提示: 仿真器输出将显示在终端中');
    }

    /**
     * 启动 LVGL 仿真（基于 honeygui-design/lvgl-pc）
     */
    private async startLvglSimulation(): Promise<void> {
        const lvglPcRoot = this.getLvglPcRoot();
        this.log(`使用 LVGL PC 工程: ${lvglPcRoot}`);

        if (!fs.existsSync(lvglPcRoot)) {
            throw new Error(`LVGL PC 工程不存在: ${lvglPcRoot}`);
        }

        const cmakeLists = path.join(lvglPcRoot, 'CMakeLists.txt');
        if (!fs.existsSync(cmakeLists)) {
            throw new Error(`LVGL PC 工程不完整，缺少 CMakeLists.txt: ${cmakeLists}`);
        }

        const lvglHeader = path.join(lvglPcRoot, 'lvgl-lib', 'include', 'lvgl', 'lvgl.h');
        if (!fs.existsSync(lvglHeader)) {
            this.log('未检测到预编译 LVGL 库，开始构建 lvgl-lib...');
            if (process.platform === 'win32') {
                await this.runCommand('cmd', ['/c', 'scripts\\build-lvgl-lib.cmd'], lvglPcRoot, '构建 lvgl-lib 失败');
            } else {
                throw new Error('当前仅支持 Windows 下通过 scripts/build-lvgl-lib.cmd 构建 LVGL 预编译库');
            }
        }

        this.log('配置 LVGL PC CMake 工程...');
        if (process.platform === 'win32') {
            await this.runCommand('cmake', ['-G', 'MinGW Makefiles', '-S', '.', '-B', 'build'], lvglPcRoot, 'CMake 配置失败');
        } else {
            await this.runCommand('cmake', ['-S', '.', '-B', 'build'], lvglPcRoot, 'CMake 配置失败');
        }

        this.log('编译 LVGL PC 工程...');
        await this.runCommand('cmake', ['--build', 'build', '-j4'], lvglPcRoot, 'LVGL PC 编译失败');

        const exeName = process.platform === 'win32' ? 'lvgl_pc.exe' : 'lvgl_pc';
        const exePath = path.join(lvglPcRoot, 'build', exeName);
        if (!fs.existsSync(exePath)) {
            throw new Error(`未找到 LVGL 可执行文件: ${exePath}`);
        }

        await this.runTaskExecutable(exePath, path.join(lvglPcRoot, 'build'), 'LVGL PC Simulator', 'LVGL');
    }

    /**
     * 获取当前项目目标引擎
     */
    private resolveTargetEngine(): 'honeygui' | 'lvgl' {
        const config = ProjectUtils.loadProjectConfig(this.projectRoot);
        return config.targetEngine === 'lvgl' ? 'lvgl' : 'honeygui';
    }

    /**
     * 解析 LVGL PC 工程目录（位于扩展根目录下的 lvgl-pc）
     */
    private getLvglPcRoot(): string {
        return path.join(__dirname, '..', '..', '..', 'lvgl-pc');
    }

    /**
     * 运行命令并将输出写入日志
     */
    private async runCommand(cmd: string, args: string[], cwd: string, errorPrefix: string): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(cmd, args, {
                cwd,
                shell: false,
                windowsHide: true
            });

            child.stdout?.on('data', (data) => {
                const text = data.toString().trim();
                if (text) {
                    text.split('\n').forEach((line: string) => {
                        const trimmed = line.trim();
                        if (trimmed) {
                            this.log(trimmed);
                        }
                    });
                }
            });

            child.stderr?.on('data', (data) => {
                const text = data.toString().trim();
                if (text) {
                    text.split('\n').forEach((line: string) => {
                        const trimmed = line.trim();
                        if (trimmed) {
                            this.log(trimmed);
                        }
                    });
                }
            });

            child.on('error', (err) => {
                reject(new Error(`${errorPrefix}: ${err.message}`));
            });

            child.on('exit', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`${errorPrefix}，退出码: ${code}`));
                }
            });
        });
    }

    /**
     * 使用 Task API 启动可执行程序并监听退出
     */
    private async runTaskExecutable(exePath: string, cwd: string, taskName: string, taskSource: string): Promise<void> {
        this.log(`启动仿真器: ${exePath}`);
        this.log(`工作目录: ${cwd}`);

        if (this.currentTask || this.currentProcess) {
            await this.stop();
        }

        const task = new vscode.Task(
            { type: 'shell' },
            vscode.TaskScope.Workspace,
            taskName,
            taskSource,
            new vscode.ShellExecution(exePath, {
                cwd,
                env: {
                    SDL_STDIO_REDIRECT: '0'
                }
            }),
            []
        );

        task.presentationOptions = {
            reveal: vscode.TaskRevealKind.Always,
            panel: vscode.TaskPanelKind.Dedicated,
            clear: false,
            showReuseMessage: false
        };

        this.hasExited = false;
        this.taskEndListener = vscode.tasks.onDidEndTask((e) => {
            if (e.execution === this.currentTask) {
                this.handleTaskEnd();
            }
        });

        this.currentTask = await vscode.tasks.executeTask(task);

        setTimeout(async () => {
            if (this.currentTask) {
                try {
                    const processId = (this.currentTask as any).processId;
                    if (processId) {
                        this.log(`仿真器进程 PID: ${processId}`);
                        this.startProcessMonitor(processId);
                    }
                } catch {
                    this.log('无法获取进程 ID，使用任务结束事件监听');
                }
            }
        }, 500);

        this.log('仿真器已启动');
        this.log('提示: 仿真器输出将显示在终端中');
    }

    /**
     * 处理任务结束
     */
    private handleTaskEnd(): void {
        if (this.hasExited) {
            return; // 已经处理过退出事件
        }
        this.hasExited = true;

        const wasManuallyStopped = this.isManuallyStopped;
        this.log(`仿真器任务已结束`);
        this.currentTask = null;
        this.isRunning = false;
        
        // 清理监听器
        if (this.taskEndListener) {
            this.taskEndListener.dispose();
            this.taskEndListener = null;
        }
        
        // 清理进程监听器
        if (this.processMonitorInterval) {
            clearInterval(this.processMonitorInterval);
            this.processMonitorInterval = null;
        }
        
        // 通知监听器仿真已退出
        this.listener?.onExit?.(wasManuallyStopped ? null : 0);
    }

    /**
     * 监听进程是否还在运行（更快响应进程退出）
     */
    private startProcessMonitor(pid: number): void {
        this.processMonitorInterval = setInterval(() => {
            try {
                // 发送信号 0 来检查进程是否存在
                process.kill(pid, 0);
                // 进程还在运行
            } catch (err) {
                // 进程已退出，立即处理
                this.handleTaskEnd();
            }
        }, 100); // 每 100ms 检查一次，快速响应
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
            await this.removeDirectoryWithRetry(buildDir, 5, 500);
        }

        if (deep) {
            // 深度清理：清理整个 src 目录
            const srcDir = path.join(this.projectRoot, 'src');
            if (fs.existsSync(srcDir)) {
                this.log(`清理 src 目录: ${srcDir}`);
                await this.removeDirectoryWithRetry(srcDir, 5, 500);
            }
        } else {
            // 普通清理：只清理 src/ui 目录
            const uiDir = path.join(this.projectRoot, 'src', 'ui');
            if (fs.existsSync(uiDir)) {
                this.log(`清理 src/ui 目录: ${uiDir}`);
                await this.removeDirectoryWithRetry(uiDir, 5, 500);
            }
        }

        this.log('清理完成');
    }

    /**
     * 带重试机制的目录删除
     * 解决 Windows 上文件被占用导致的 EBUSY 错误
     * @param dirPath 目录路径
     * @param maxRetries 最大重试次数
     * @param delayMs 每次重试的延迟（毫秒）
     */
    private async removeDirectoryWithRetry(dirPath: string, maxRetries: number, delayMs: number): Promise<void> {
        // 先等待一小段时间，让文件系统释放句柄
        await new Promise(resolve => setTimeout(resolve, 100));
        
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // 尝试使用 maxRetries 选项，让 Node.js 自己重试
                await fs.promises.rm(dirPath, { 
                    recursive: true, 
                    force: true,
                    maxRetries: 3,
                    retryDelay: 100
                });
                
                // 成功，记录日志并返回
                if (attempt > 1) {
                    this.log(`目录删除成功（第 ${attempt} 次尝试）`);
                }
                return;
                
            } catch (error) {
                lastError = error as Error;
                const errorCode = (error as any)?.code;
                
                // 如果不是文件占用错误，直接抛出
                if (errorCode !== 'EBUSY' && errorCode !== 'EPERM' && errorCode !== 'EACCES' && errorCode !== 'ENOTEMPTY') {
                    throw error;
                }
                
                // 如果是最后一次尝试，尝试备用方案
                if (attempt === maxRetries) {
                    this.log(`目录删除失败，已重试 ${maxRetries} 次，尝试备用方案...`);
                    break;
                }
                
                // 等待后重试
                this.log(`目录删除失败（第 ${attempt} 次尝试），${delayMs}ms 后重试... 错误: ${errorCode}`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                
                // 指数退避：每次重试延迟翻倍
                delayMs *= 2;
            }
        }
        
        // 所有重试都失败，尝试逐个删除文件
        try {
            this.log('尝试逐个删除文件...');
            await this.removeDirectoryRecursively(dirPath);
            this.log('逐个删除成功');
            return;
        } catch (recursiveError) {
            this.log(`逐个删除也失败: ${(recursiveError as Error).message}`);
        }
        
        // 最后尝试：使用 rimraf 风格的强制删除
        try {
            this.log('尝试强制删除（忽略错误）...');
            await this.forceRemoveDirectory(dirPath);
            this.log('强制删除成功');
            return;
        } catch (forceError) {
            this.log(`强制删除失败: ${(forceError as Error).message}`);
        }
        
        // 抛出详细的错误信息
        throw new Error(
            `无法删除目录 ${dirPath}\n\n` +
            `错误: ${lastError?.message || '未知错误'}\n\n` +
            `可能原因：\n` +
            `1. 文件被其他进程占用（如编译进程、文件浏览器、杀毒软件）\n` +
            `2. 文件权限不足\n` +
            `3. 磁盘错误\n\n` +
            `建议：\n` +
            `1. 关闭所有可能占用文件的程序（如文件浏览器）\n` +
            `2. 暂时关闭杀毒软件的实时保护\n` +
            `3. 手动删除 build 目录后重试\n` +
            `4. 重启 VSCode`
        );
    }

    /**
     * 强制删除目录（忽略部分错误）
     * 尽可能删除文件，即使部分文件删除失败也继续
     */
    private async forceRemoveDirectory(dirPath: string): Promise<void> {
        if (!fs.existsSync(dirPath)) {
            return;
        }

        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            
            // 并行删除所有条目（提高速度）
            await Promise.allSettled(
                entries.map(async (entry) => {
                    const fullPath = path.join(dirPath, entry.name);
                    
                    if (entry.isDirectory()) {
                        // 递归删除子目录
                        await this.forceRemoveDirectory(fullPath);
                    } else {
                        // 删除文件
                        try {
                            await fs.promises.unlink(fullPath);
                        } catch (error) {
                            // 忽略单个文件删除失败
                            this.log(`跳过文件: ${entry.name} (${(error as Error).message})`);
                        }
                    }
                })
            );
            
            // 尝试删除目录本身
            try {
                await fs.promises.rmdir(dirPath);
            } catch (error) {
                // 如果目录不为空，再次尝试
                const errorCode = (error as any)?.code;
                if (errorCode === 'ENOTEMPTY') {
                    // 等待一下再试
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await fs.promises.rmdir(dirPath);
                } else {
                    throw error;
                }
            }
        } catch (error) {
            // 记录错误但不抛出
            this.log(`删除目录时出错: ${(error as Error).message}`);
        }
    }

    /**
     * 递归删除目录（逐个删除文件）
     * 作为备用方案，当批量删除失败时使用
     */
    private async removeDirectoryRecursively(dirPath: string): Promise<void> {
        if (!fs.existsSync(dirPath)) {
            return;
        }

        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                // 递归删除子目录
                await this.removeDirectoryRecursively(fullPath);
            } else {
                // 删除文件，带重试
                for (let i = 0; i < 3; i++) {
                    try {
                        await fs.promises.unlink(fullPath);
                        break;
                    } catch (error) {
                        if (i === 2) throw error;
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }
            }
        }
        
        // 删除空目录，带重试
        for (let i = 0; i < 3; i++) {
            try {
                await fs.promises.rmdir(dirPath);
                break;
            } catch (error) {
                if (i === 2) throw error;
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    }

    /**
     * 清理资源
     */
    dispose(): void {
        this.stop();
        if (this.taskEndListener) {
            this.taskEndListener.dispose();
            this.taskEndListener = null;
        }
        this.buildManager?.dispose();
    }
}
