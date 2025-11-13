import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PreviewRunner } from './PreviewRunner';
import { HmlController } from '../hml/HmlController';

/**
 * 预览服务类，处理HoneyGUI的预览功能，包括命令注册、文件监听和用户交互
 */
export class PreviewService {
  private context: vscode.ExtensionContext;
  private runner: PreviewRunner;
  private hmlController: HmlController;
  private statusBarItem: vscode.StatusBarItem;
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private currentPreviewFile: string | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.runner = PreviewRunner.getInstance(this.getRunnerOptions());
    this.hmlController = new HmlController();
    
    // 创建状态栏项
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this.statusBarItem.text = '$(play-circle) 预览: 未运行';
    this.statusBarItem.command = 'honeygui.preview.toggle';
    this.statusBarItem.show();

    // 设置Runner监听器
    this.setupRunnerListeners();
  }

  /**
   * 从VSCode配置获取Runner选项
   */
  private getRunnerOptions(): any {
    const config = vscode.workspace.getConfiguration('honeygui.preview');
    return {
      runnerPath: config.get<string>('runnerPath', ''),
      autoDownload: config.get<boolean>('autoDownload', true),
      timeoutMs: config.get<number>('timeoutMs', 10000),
      logLevel: config.get<'debug' | 'info' | 'warn' | 'error'>('logLevel', 'info')
    };
  }

  /**
   * 设置Runner事件监听器
   */
  private setupRunnerListeners(): void {
    this.runner.setListeners({
      onStart: () => {
        this.updateStatusBar('$(sync~spin) 预览: 启动中...');
        vscode.window.setStatusBarMessage('HoneyGUI 预览正在启动...', 2000);
      },
      
      onSuccess: () => {
        this.updateStatusBar('$(play-circle) 预览: 运行中');
        vscode.window.showInformationMessage('HoneyGUI 预览已成功启动');
      },
      
      onError: (error) => {
        this.updateStatusBar('$(stop-circle) 预览: 错误');
        vscode.window.showErrorMessage(`HoneyGUI 预览错误: ${error.message}`);
        this.stopFileWatcher();
      },
      
      onExit: (code) => {
        this.updateStatusBar('$(play-circle) 预览: 未运行');
        this.currentPreviewFile = null;
        this.stopFileWatcher();
        
        if (code !== null && code !== 0) {
          vscode.window.showWarningMessage(`HoneyGUI 预览异常退出，退出码: ${code}`);
        } else {
          vscode.window.setStatusBarMessage('HoneyGUI 预览已停止', 2000);
        }
      },
      
      onLog: (message) => {
        // 将日志输出到VSCode的输出通道
        this.outputToChannel(message);
      },
      
      onReload: () => {
        vscode.window.setStatusBarMessage('HoneyGUI 预览已热重载', 1000);
      }
    });
  }

  /**
   * 更新状态栏显示
   */
  private updateStatusBar(text: string): void {
    this.statusBarItem.text = text;
  }

  /**
   * 输出消息到VSCode输出通道
   */
  private outputToChannel(message: string): void {
    const outputChannel = vscode.window.createOutputChannel('HoneyGUI Preview');
    outputChannel.appendLine(message);
  }

  /**
   * 注册预览相关命令
   */
  public registerCommands(): void {
    // 注册预览命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand('honeygui.preview', async () => {
        await this.startPreview();
      })
    );

    // 注册预览切换命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand('honeygui.preview.toggle', async () => {
        const status = this.runner.getStatus();
        if (status.isRunning) {
          await this.stopPreview();
        } else {
          await this.startPreview();
        }
      })
    );

    // 注册停止预览命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand('honeygui.preview.stop', async () => {
        await this.stopPreview();
      })
    );

    // 注册重新加载预览命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand('honeygui.preview.reload', async () => {
        await this.reloadPreview();
      })
    );
  }

  /**
   * 启动预览
   */
  public async startPreview(): Promise<void> {
    try {
      const hmlFile = await this.selectHmlFile();
      if (!hmlFile) {
        return;
      }

      const status = this.runner.getStatus();
      
      // 检查Runner是否已安装
      if (!status.isInstalled && status.isRunning) {
        vscode.window.showErrorMessage('HoneyGUI Runner未安装，请检查配置');
        return;
      }

      // 检查文件是否存在
      if (!fs.existsSync(hmlFile)) {
        vscode.window.showErrorMessage(`HML文件不存在: ${hmlFile}`);
        return;
      }

      // 验证HML文件格式
      try {
        await this.hmlController.loadFile(hmlFile);
      } catch (error) {
        vscode.window.showErrorMessage(`HML文件格式错误: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }

      // 确定资源目录
      const workspaceFolder = this.getWorkspaceFolder(hmlFile);
      let assetsPath: string | undefined;
      
      if (workspaceFolder) {
        const potentialAssetsPath = path.join(workspaceFolder, 'assets', 'images');
        if (fs.existsSync(potentialAssetsPath)) {
          assetsPath = potentialAssetsPath;
        }
      }

      // 启动预览
      await this.runner.start(hmlFile, assetsPath, true);
      this.currentPreviewFile = hmlFile;
      
      // 开始监听文件变化
      this.startFileWatcher(workspaceFolder);
      
    } catch (error) {
      vscode.window.showErrorMessage(`启动预览失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 打开预览（供外部调用）
   */
  public async openPreview(): Promise<void> {
    await this.startPreview();
  }

  /**
   * 停止预览
   */
  public async stopPreview(): Promise<void> {
    try {
      await this.runner.stop();
    } catch (error) {
      vscode.window.showErrorMessage(`停止预览失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 重新加载预览
   */
  public async reloadPreview(): Promise<void> {
    try {
      const status = this.runner.getStatus();
      if (!status.isRunning) {
        await this.startPreview();
        return;
      }
      
      await this.runner.reload();
    } catch (error) {
      vscode.window.showErrorMessage(`重新加载预览失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 选择要预览的HML文件
   */
  private async selectHmlFile(): Promise<string | undefined> {
    // 如果有活动编辑器且是HML文件，使用它
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.fileName.endsWith('.hml')) {
      return activeEditor.document.fileName;
    }

    // 否则，让用户选择文件
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('没有打开的工作区');
      return undefined;
    }

    // 查找工作区中的所有HML文件
    const hmlFiles = await vscode.workspace.findFiles('**/*.hml', '**/node_modules/**', 100);
    
    if (hmlFiles.length === 0) {
      vscode.window.showErrorMessage('工作区中未找到HML文件');
      return undefined;
    }
    
    if (hmlFiles.length === 1) {
      return hmlFiles[0].fsPath;
    }

    // 显示文件选择列表
    const filePaths = hmlFiles.map(uri => uri.fsPath);
    const relativePaths = filePaths.map(filePath => {
      const workspaceFolder = this.getWorkspaceFolder(filePath);
      return workspaceFolder ? path.relative(workspaceFolder, filePath) : filePath;
    });

    const selectedRelativePath = await vscode.window.showQuickPick(relativePaths, {
      placeHolder: '选择要预览的HML文件',
      ignoreFocusOut: true
    });

    if (!selectedRelativePath) {
      return undefined;
    }

    const index = relativePaths.indexOf(selectedRelativePath);
    return index >= 0 ? filePaths[index] : undefined;
  }

  /**
   * 获取文件所属的工作区路径
   */
  private getWorkspaceFolder(filePath: string): string | undefined {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    return workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
  }

  /**
   * 开始监听文件变化
   */
  private startFileWatcher(workspaceFolder?: string): void {
    // 停止之前的监听器
    this.stopFileWatcher();
    
    if (!workspaceFolder) {
      return;
    }

    // 创建文件监听器，监听UI相关文件变化
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceFolder, '{ui/**/*.hml,assets/**/*}'),
      false, // ignoreCreateEvents
      true,  // ignoreChangeEvents
      false  // ignoreDeleteEvents
    );

    // 监听文件变化事件
    this.fileWatcher.onDidChange(async (uri) => {
      const status = this.runner.getStatus();
      if (status.isRunning) {
        await this.runner.reload();
      }
    });

    this.context.subscriptions.push(this.fileWatcher);
  }

  /**
   * 停止文件监听
   */
  private stopFileWatcher(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = undefined;
    }
  }

  /**
   * 获取预览状态信息
   */
  public getStatus(): {
    isRunning: boolean;
    currentFile?: string;
    runnerInstalled: boolean;
  } {
    const runnerStatus = this.runner.getStatus();
    return {
      isRunning: runnerStatus.isRunning,
      currentFile: this.currentPreviewFile || undefined,
      runnerInstalled: runnerStatus.isInstalled
    };
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // 停止预览
    this.stopPreview().catch(err => {
      console.error('清理预览服务时出错:', err);
    });
    
    // 移除状态栏项
    this.statusBarItem.dispose();
    
    // 停止文件监听
    this.stopFileWatcher();
  }
}
