import * as vscode from 'vscode';

/**
 * 预览服务类
 * 快速预览模式（解释执行HML）- 功能开发中
 */
export class PreviewService {
  private context: vscode.ExtensionContext;
  private statusBarItem: vscode.StatusBarItem;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
    // 创建状态栏项
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this.statusBarItem.text = '$(eye) 预览';
    this.statusBarItem.command = 'honeygui.preview';
    this.statusBarItem.show();
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
  }

  /**
   * 启动预览
   */
  public async startPreview(): Promise<void> {
    vscode.window.showInformationMessage(
      '预览功能开发中\n\n' +
      '当前请使用"编译仿真"功能验证设计效果。\n' +
      '预览功能将在后续版本中提供快速的解释执行模式。'
    );
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
