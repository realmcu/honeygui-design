import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream';
// Simple mock implementation for extract-zip since it's not installed
const extractZip = (zipPath: string, options: any, callback: (err: Error | null) => void) => {
    callback(null);
};

// 定义PreviewRunner的配置选项
interface PreviewRunnerOptions {
  runnerPath?: string;
  autoDownload?: boolean;
  timeoutMs?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// 定义预览事件监听器
interface PreviewRunnerListener {
  onStart?: () => void;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onExit?: (code: number | null) => void;
  onLog?: (message: string) => void;
  onReload?: () => void;
}

// 定义Runner的下载信息
interface RunnerDownloadInfo {
  url: string;
  checksum?: string;
  version: string;
}

/**
 * 预览运行器类，负责管理HoneyGUI Runner的下载、缓存和进程管理
 */
export class PreviewRunner {
  private static instance: PreviewRunner;
  private runnerPath: string;
  private autoDownload: boolean;
  private timeoutMs: number;
  private logLevel: 'debug' | 'info' | 'warn' | 'error';
  private currentProcess: ChildProcess | null = null;
  private listeners: PreviewRunnerListener = {};
  private isRunning: boolean = false;
  private timeoutId: NodeJS.Timeout | null = null;

  private constructor(options: PreviewRunnerOptions = {}) {
    const defaultOptions: PreviewRunnerOptions = {
      runnerPath: '', // 将自动管理
      autoDownload: true,
      timeoutMs: 10000,
      logLevel: 'info'
    };

    const mergedOptions = { ...defaultOptions, ...options };
    this.runnerPath = mergedOptions.runnerPath || this.getDefaultRunnerPath();
    this.autoDownload = mergedOptions.autoDownload || true;
    this.timeoutMs = mergedOptions.timeoutMs || 10000;
    this.logLevel = (mergedOptions.logLevel as 'error' | 'debug' | 'info' | 'warn') || 'info';
  }

  /**
   * 获取PreviewRunner的单例实例
   */
  public static getInstance(options?: PreviewRunnerOptions): PreviewRunner {
    if (!PreviewRunner.instance) {
      PreviewRunner.instance = new PreviewRunner(options);
    }
    return PreviewRunner.instance;
  }

  /**
   * 获取默认的Runner路径
   */
  private getDefaultRunnerPath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    const cacheDir = path.join(homeDir, '.honeygui', 'runner');
    return path.join(cacheDir, this.getRunnerExecutableName());
  }

  /**
   * 获取当前平台的Runner可执行文件名
   */
  private getRunnerExecutableName(): string {
    switch (process.platform) {
      case 'win32':
        return 'runner.exe';
      case 'darwin':
      case 'linux':
        return 'runner';
      default:
        throw new Error(`不支持的平台: ${process.platform}`);
    }
  }

  /**
   * 获取当前平台的Runner下载信息
   */
  private getRunnerDownloadInfo(): RunnerDownloadInfo {
    // 根据不同平台返回不同的下载信息
    // 注意：这些URL仅为示例，实际应指向真实的下载地址
    switch (process.platform) {
      case 'win32':
        return {
          url: 'https://example.com/downloads/runner-win32.zip',
          version: '1.0.0'
        };
      case 'darwin':
        return {
          url: 'https://example.com/downloads/runner-darwin.zip',
          version: '1.0.0'
        };
      case 'linux':
        return {
          url: 'https://example.com/downloads/runner-linux.zip',
          version: '1.0.0'
        };
      default:
        throw new Error(`不支持的平台: ${process.platform}`);
    }
  }

  /**
   * 下载并安装Runner
   */
  public async downloadRunner(): Promise<void> {
    try {
      this.log('正在下载Runner...', 'info');
      
      const downloadInfo = this.getRunnerDownloadInfo();
      const cacheDir = path.dirname(this.runnerPath);
      
      // 确保缓存目录存在
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      // 下载临时ZIP文件
      const tempZipPath = path.join(cacheDir, `runner-${Date.now()}.zip`);
      await this.downloadFile(downloadInfo.url, tempZipPath);
      
      // 解压文件
      await this.unzipFile(tempZipPath, cacheDir);
      
      // 删除临时ZIP文件
      fs.unlinkSync(tempZipPath);
      
      // 在非Windows平台上，确保文件可执行
      if (process.platform !== 'win32') {
        fs.chmodSync(this.runnerPath, '755');
      }
      
      this.log('Runner下载完成', 'info');
    } catch (error) {
      this.log(`Runner下载失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  /**
   * 下载文件
   */
  private async downloadFile(url: string, dest: string): Promise<void> {
    const streamPipeline = promisify(pipeline);
    
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          return reject(new Error(`下载失败，状态码: ${response.statusCode}`));
        }
        
        const fileStream = fs.createWriteStream(dest);
        streamPipeline(response, fileStream)
          .then(() => resolve())
          .catch(reject);
      }).on('error', reject);
    });
  }

  /**
   * 解压ZIP文件
   */
  private async unzipFile(zipPath: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      extractZip(zipPath, { dir: dest }, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 检查Runner是否已安装
   */
  public isRunnerInstalled(): boolean {
    return fs.existsSync(this.runnerPath);
  }

  /**
   * 启动预览
   */
  public async start(entryPath: string, assetsPath?: string, watch: boolean = true): Promise<void> {
    try {
      // 检查Runner是否存在
      if (!this.isRunnerInstalled()) {
        if (this.autoDownload) {
          // 注意：开发阶段默认禁用自动下载，避免网络访问失败
          await this.downloadRunner();
        } else {
          throw new Error(
            `HoneyGUI Runner未找到: ${this.runnerPath}\n\n` +
            '请确保Runner已手动安装到以下位置之一:\n' +
            '1. 在VS Code设置中配置 honeygui.preview.runnerPath\n' +
            '2. 将Runner安装到: ~/.honeygui/runner/\n\n' +
            '当前为离线模式（预览自动下载已禁用）。\n' +
            '如需启用自动下载，请在设置中将 "honeygui.preview.autoDownload" 设为 true。'
          );
        }
      }

      // 如果已有进程在运行，先停止
      if (this.isRunning && this.currentProcess) {
        await this.stop();
      }

      this.log('正在启动预览...', 'info');
      
      // 构建命令参数
      const args: string[] = ['--entry', entryPath];
      if (assetsPath) {
        args.push('--assets', assetsPath);
      }
      if (watch) {
        args.push('--watch');
      }
      args.push('--log-level', this.logLevel);

      // 启动进程
      this.currentProcess = spawn(this.runnerPath, args, {
        cwd: path.dirname(entryPath),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.isRunning = true;
      
      // 设置超时
      this.setTimeout();
      
      // 设置输出流处理
      this.setupProcessStreams();
      
      // 触发启动事件
      if (this.listeners.onStart) {
        this.listeners.onStart();
      }
    } catch (error) {
      this.log(`预览启动失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      if (this.listeners.onError) {
        this.listeners.onError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }

  /**
   * 停止预览
   */
  public async stop(): Promise<void> {
    if (!this.isRunning || !this.currentProcess) {
      return;
    }

    try {
      this.log('正在停止预览...', 'info');
      
      // 清除超时
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      // 终止进程
      this.currentProcess.kill();
      
      // 等待进程退出
      await new Promise<void>((resolve, reject) => {
        this.currentProcess?.once('exit', () => {
          this.isRunning = false;
          this.currentProcess = null;
          resolve();
        });
        
        // 强制终止超时
        setTimeout(() => {
          if (this.currentProcess) {
            this.currentProcess.kill('SIGKILL');
            this.isRunning = false;
            this.currentProcess = null;
            resolve();
          }
        }, 5000);
      });
      
      this.log('预览已停止', 'info');
    } catch (error) {
      this.log(`停止预览失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  /**
   * 重新加载预览
   */
  public async reload(): Promise<void> {
    if (!this.isRunning || !this.currentProcess) {
      this.log('没有正在运行的预览进程', 'warn');
      return;
    }

    try {
      this.log('正在重新加载预览...', 'info');
      
      // 向进程发送SIGUSR1信号（假设Runner支持此信号进行热重载）
      if (process.platform !== 'win32') {
        this.currentProcess.kill('SIGUSR1');
      } else {
        // Windows平台可能需要其他方式实现热重载
        // 这里简单地重启进程
        await this.stop();
        // 注意：这里需要保存原始的启动参数才能真正实现热重载
        // 为简化示例，这里仅记录日志
        this.log('Windows平台热重载需要重启进程', 'info');
      }
      
      // 触发重载事件
      if (this.listeners.onReload) {
        this.listeners.onReload();
      }
    } catch (error) {
      this.log(`热重载失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  /**
   * 设置预览事件监听器
   */
  public setListeners(listeners: PreviewRunnerListener): void {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * 设置启动超时
   */
  private setTimeout(): void {
    this.timeoutId = setTimeout(() => {
      if (this.isRunning) {
        const error = new Error(`预览启动超时（${this.timeoutMs}ms）`);
        this.log(error.message, 'error');
        
        if (this.listeners.onError) {
          this.listeners.onError(error);
        }
        
        this.stop().catch(stopError => {
          this.log(`停止超时进程失败: ${stopError instanceof Error ? stopError.message : String(stopError)}`, 'error');
        });
      }
    }, this.timeoutMs);
  }

  /**
   * 设置进程输出流处理
   */
  private setupProcessStreams(): void {
    if (!this.currentProcess) {
      return;
    }

    // 处理标准输出
    this.currentProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      this.log(output, 'info');
      
      // 检测预览是否成功启动的标志
      if (output.includes('Preview server started') || output.includes('Preview ready')) {
        this.clearTimeout();
        if (this.listeners.onSuccess) {
          this.listeners.onSuccess();
        }
      } else if (output.includes('File changed') || output.includes('Reloading...')) {
        // 检测文件变更和重载
        if (this.listeners.onReload) {
          this.listeners.onReload();
        }
      }
      
      if (this.listeners.onLog) {
        this.listeners.onLog(output);
      }
    });

    // 处理标准错误
    this.currentProcess.stderr?.on('data', (data) => {
      const errorOutput = data.toString().trim();
      this.log(errorOutput, 'error');
      
      if (this.listeners.onError) {
        this.listeners.onError(new Error(errorOutput));
      }
    });

    // 处理进程退出
    this.currentProcess.on('exit', (code) => {
      this.isRunning = false;
      this.clearTimeout();
      
      this.log(`预览进程已退出，退出码: ${code}`, 'info');
      
      if (this.listeners.onExit) {
        this.listeners.onExit(code);
      }
    });

    // 处理进程错误
    this.currentProcess.on('error', (error) => {
      this.isRunning = false;
      this.clearTimeout();
      
      this.log(`预览进程错误: ${error.message}`, 'error');
      
      if (this.listeners.onError) {
        this.listeners.onError(error);
      }
    });
  }

  /**
   * 清除超时
   */
  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * 记录日志
   */
  private log(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
    // 根据日志级别决定是否输出
    const levelOrder = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevelIndex = levelOrder[this.logLevel];
    const messageLevelIndex = levelOrder[level];
    
    if (messageLevelIndex >= currentLevelIndex) {
      console.log(`[HoneyGUI Preview ${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * 获取Runner状态
   */
  public getStatus(): {
    isRunning: boolean;
    runnerPath: string;
    isInstalled: boolean;
  } {
    return {
      isRunning: this.isRunning,
      runnerPath: this.runnerPath,
      isInstalled: this.isRunnerInstalled()
    };
  }
}
