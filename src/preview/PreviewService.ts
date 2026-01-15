import * as vscode from 'vscode';
import { ProjectUtils } from '../utils/ProjectUtils';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 预览服务类
 * 集成仿真预览模式
 */
export class PreviewService {
  private context: vscode.ExtensionContext;
  private statusBarItem: vscode.StatusBarItem;
  private outputChannel: vscode.OutputChannel;
  private currentSimulatorTerminal: vscode.Terminal | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
    // 创建输出通道
    this.outputChannel = vscode.window.createOutputChannel('HoneyGUI Preview');
    
    // 创建状态栏项
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this.statusBarItem.text = '$(eye) 预览';
    this.statusBarItem.command = 'honeygui.preview';
    this.statusBarItem.show();

    // 监听终端关闭事件
    vscode.window.onDidCloseTerminal((terminal) => {
      if (terminal === this.currentSimulatorTerminal) {
        this.currentSimulatorTerminal = null;
        this.outputChannel.appendLine('[终端] 预览终端已关闭');
      }
    });
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
   * 启动预览（集成仿真）- 只预览当前 HML 文件
   * 使用独立的 .preview/src 目录，assets 和 build 共用项目的
   */
  public async startPreview(): Promise<void> {
    try {
      // 0. 关闭之前的预览终端
      if (this.currentSimulatorTerminal) {
        this.outputChannel.appendLine('[终端] 关闭之前的预览终端...');
        this.currentSimulatorTerminal.dispose();
        this.currentSimulatorTerminal = null;
      }

      // 1. 获取当前打开的 HML 文件
      let currentHmlFile: string | undefined;
      const activeEditor = vscode.window.activeTextEditor;
      
      if (activeEditor && activeEditor.document.fileName.endsWith('.hml')) {
        currentHmlFile = activeEditor.document.fileName;
      } else {
        const openDocuments = vscode.workspace.textDocuments;
        const hmlDocuments = openDocuments.filter(doc => doc.fileName.endsWith('.hml'));
        
        if (hmlDocuments.length === 1) {
          currentHmlFile = hmlDocuments[0].fileName;
        } else if (hmlDocuments.length > 1) {
          const items = hmlDocuments.map(doc => ({
            label: path.basename(doc.fileName),
            description: path.dirname(doc.fileName),
            filePath: doc.fileName
          }));
          
          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要预览的 HML 文件'
          });
          
          if (!selected) {
            return;
          }
          
          currentHmlFile = selected.filePath;
        }
      }
      
      if (!currentHmlFile) {
        vscode.window.showErrorMessage(vscode.l10n.t('Please open an HML file first'));
        return;
      }

      const hmlFileName = path.basename(currentHmlFile);
      const designName = path.basename(currentHmlFile, '.hml');
      
      // 2. 获取项目根目录
      const projectRoot = ProjectUtils.findProjectRoot(currentHmlFile);
      if (!projectRoot) {
        vscode.window.showErrorMessage(vscode.l10n.t('Cannot find project root (project.json)'));
        return;
      }

      // 3. 显示进度提示
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `预览: ${hmlFileName}`,
        cancellable: false
      }, async (progress) => {
        this.outputChannel.clear();
        this.outputChannel.show(true);
        this.outputChannel.appendLine(`[预览] 当前文件: ${hmlFileName}`);

        // 5. 保存当前文件
        progress.report({ message: '保存文件...' });
        const document = vscode.workspace.textDocuments.find(doc => doc.fileName === currentHmlFile);
        if (document && document.isDirty) {
          await document.save();
        }

        // 6. 创建预览 src 目录
        progress.report({ message: '准备预览环境...' });
        const previewSrcDir = path.join(projectRoot, '.preview', 'src');
        await this.setupPreviewSrcDirectory(previewSrcDir);

        // 7. 生成当前文件的代码到预览目录（禁用跨 view 事件）
        progress.report({ message: '生成代码...' });
        await this.generateSingleFileToPreview(currentHmlFile, previewSrcDir, designName, true);

        // 8. 生成预览入口文件
        progress.report({ message: '生成入口文件...' });
        await this.generatePreviewEntryFile(previewSrcDir, designName, currentHmlFile);

        // 9. 备份项目 src 目录，替换为预览 src
        progress.report({ message: '切换到预览模式...' });
        const projectSrcDir = path.join(projectRoot, 'src');
        const backupSrcDir = path.join(projectRoot, '.preview', 'src_backup');
        await this.switchToPreviewMode(projectSrcDir, previewSrcDir, backupSrcDir);

        try {
          // 10. 使用项目目录编译运行（src 已替换为预览版本）
          progress.report({ message: '正在编译...' });
          await this.runPreviewSimulation(projectRoot, hmlFileName, projectSrcDir, backupSrcDir);

        } catch (error) {
          // 出错时恢复 src 目录
          await this.restoreSrcDirectory(projectSrcDir, backupSrcDir);
          throw error;
        }
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(vscode.l10n.t('Preview failed: {0}', message));
    }
  }

  /**
   * 设置预览 src 目录结构
   */
  private async setupPreviewSrcDirectory(previewSrcDir: string): Promise<void> {
    // 只清理 src 目录，不删除整个 .preview 目录
    if (fs.existsSync(previewSrcDir)) {
      // 删除 src 目录下的内容
      const entries = fs.readdirSync(previewSrcDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(previewSrcDir, entry.name);
        if (entry.isDirectory()) {
          await this.deleteFolderRecursive(fullPath);
        } else {
          fs.unlinkSync(fullPath);
        }
      }
    }

    // 创建预览 src 目录结构
    fs.mkdirSync(path.join(previewSrcDir, 'ui'), { recursive: true });
    fs.mkdirSync(path.join(previewSrcDir, 'callbacks'), { recursive: true });
    fs.mkdirSync(path.join(previewSrcDir, 'user'), { recursive: true });

    this.outputChannel.appendLine(`[预览目录] ${previewSrcDir}`);
  }

  /**
   * 切换到预览模式：备份项目 src，使用预览 src
   */
  private async switchToPreviewMode(projectSrcDir: string, previewSrcDir: string, backupSrcDir: string): Promise<void> {
    // 备份项目 src 目录
    if (fs.existsSync(projectSrcDir)) {
      if (fs.existsSync(backupSrcDir)) {
        await this.deleteFolderRecursive(backupSrcDir);
      }
      await this.copyDirectory(projectSrcDir, backupSrcDir);
      
      // 从备份中删除 Entry 文件，避免恢复时冲突
      this.removeOtherEntryFiles(backupSrcDir);
      
      this.outputChannel.appendLine(`[备份] 项目 src 已备份`);
    }

    // 删除项目 src 目录
    if (fs.existsSync(projectSrcDir)) {
      await this.deleteFolderRecursive(projectSrcDir);
    }

    // 复制预览 src 到项目 src
    await this.copyDirectory(previewSrcDir, projectSrcDir);
    this.outputChannel.appendLine(`[切换] 已切换到预览模式`);
  }

  /**
   * 恢复 src 目录
   */
  private async restoreSrcDirectory(projectSrcDir: string, backupSrcDir: string): Promise<void> {
    if (!fs.existsSync(backupSrcDir)) {
      return;
    }

    // 删除预览 src
    if (fs.existsSync(projectSrcDir)) {
      await this.deleteFolderRecursive(projectSrcDir);
    }

    // 恢复备份的 src
    await this.copyDirectory(backupSrcDir, projectSrcDir);
    this.outputChannel.appendLine(`[恢复] 已恢复项目 src 目录`);
  }

  /**
   * 生成单个文件到预览目录
   * @param disableCrossViewEvents 是否禁用跨 view 的事件（预览模式）
   */
  private async generateSingleFileToPreview(
    hmlFile: string, 
    previewSrcDir: string, 
    designName: string,
    disableCrossViewEvents: boolean = false
  ): Promise<void> {
    const { HmlController } = await import('../hml/HmlController');
    const { CodeGeneratorFactory } = await import('../codegen/CodeGeneratorFactory');

    const hmlController = new HmlController();
    await hmlController.loadFile(hmlFile);

    let components = hmlController.currentDocument?.view.components || [];
    
    // 预览模式：过滤掉跨文件的 view 事件
    if (disableCrossViewEvents) {
      // 获取当前文件中定义的所有 view 名称
      const localViewNames = this.getLocalViewNames(components);
      
      components = this.filterCrossFileViewEvents(components, localViewNames);
      const filteredCount = this.countCrossFileViewEvents(
        hmlController.currentDocument?.view.components || [], 
        localViewNames
      );
      if (filteredCount > 0) {
        this.outputChannel.appendLine(`[预览模式] 已禁用 ${filteredCount} 个跨文件 view 事件`);
        this.outputChannel.appendLine(`[预览模式] 当前文件内的 view 切换仍然有效`);
      }
    }

    const generatorOptions = {
      srcDir: previewSrcDir,
      designName,
      enableProtectedAreas: true
    };

    const projectRoot = ProjectUtils.findProjectRoot(hmlFile);
    const config = projectRoot ? ProjectUtils.loadProjectConfig(projectRoot) : {};
    const targetEngine = config.targetEngine || 'honeygui';

    const generator = CodeGeneratorFactory.create(targetEngine, components as any, generatorOptions);
    const result = await generator.generate();

    if (!result.success) {
      throw new Error(result.errors?.[0] || '代码生成失败');
    }

    this.outputChannel.appendLine(`[代码生成] 成功生成 ${result.files?.length || 0} 个文件`);
  }

  /**
   * 获取当前 HML 文件中定义的所有 view 名称
   */
  private getLocalViewNames(components: any[]): Set<string> {
    const viewNames = new Set<string>();
    
    for (const component of components) {
      // 只有 hg_view 和 hg_window 类型的组件才是 view
      if ((component.type === 'hg_view' || component.type === 'hg_window') && component.name) {
        viewNames.add(component.name);
        this.outputChannel.appendLine(`[本地 view] ${component.name} (${component.id})`);
      }
    }
    
    if (viewNames.size === 0) {
      this.outputChannel.appendLine(`[警告] 未找到任何本地 view 定义`);
    }
    
    return viewNames;
  }

  /**
   * 过滤掉跨文件的 view 事件（保留同文件内的 view 切换）
   */
  private filterCrossFileViewEvents(components: any[], localViewNames: Set<string>): any[] {
    return components.map(component => {
      // 处理新的 eventConfigs 格式
      if (component.eventConfigs && Array.isArray(component.eventConfigs)) {
        const filteredEventConfigs = component.eventConfigs.map((eventConfig: any) => {
          if (!eventConfig.actions || !Array.isArray(eventConfig.actions)) {
            return eventConfig;
          }

          // 过滤掉指向外部文件 view 的 switchView action
          const filteredActions = eventConfig.actions.filter((action: any) => {
            if (action.type !== 'switchView') {
              return true; // 保留非 switchView 的 action
            }
            
            // 获取目标 view 名称
            let targetViewName: string | undefined;
            
            if (action.target) {
              // 先尝试作为组件 ID 查找
              const targetComponent = components.find(c => c.id === action.target);
              if (targetComponent) {
                targetViewName = targetComponent.name;
              } else {
                // 如果找不到组件，可能 target 直接就是 view 名称
                targetViewName = action.target;
              }
            } else if (action.params?.targetView) {
              targetViewName = action.params.targetView;
            }
            
            if (!targetViewName) {
              return true; // 没有目标 view，保留
            }
            
            // 只保留指向当前文件内 view 的切换
            const isLocal = localViewNames.has(targetViewName);
            if (!isLocal) {
              this.outputChannel.appendLine(`[过滤] 移除跨文件事件: ${component.name || component.id} -> ${targetViewName}`);
            }
            return isLocal;
          });

          return {
            ...eventConfig,
            actions: filteredActions
          };
        }).filter((eventConfig: any) => eventConfig.actions && eventConfig.actions.length > 0); // 移除空事件

        component = {
          ...component,
          eventConfigs: filteredEventConfigs.length > 0 ? filteredEventConfigs : undefined
        };
      }

      // 兼容旧的 events 格式（如果存在）
      if (component.events && Array.isArray(component.events)) {
        const filteredEvents = component.events.map((event: any) => {
          if (!event.actions || !Array.isArray(event.actions)) {
            return event;
          }

          const filteredActions = event.actions.filter((action: any) => {
            if (action.type !== 'switchView') {
              return true;
            }
            
            const targetView = action.params?.targetView;
            if (!targetView) {
              return true;
            }
            
            return localViewNames.has(targetView);
          });

          return {
            ...event,
            actions: filteredActions
          };
        }).filter((event: any) => event.actions && event.actions.length > 0);

        component = {
          ...component,
          events: filteredEvents
        };
      }

      return component;
    });
  }

  /**
   * 统计跨文件 view 事件的数量
   */
  private countCrossFileViewEvents(components: any[], localViewNames: Set<string>): number {
    let count = 0;
    
    for (const component of components) {
      // 统计 eventConfigs 中的跨文件事件
      if (component.eventConfigs && Array.isArray(component.eventConfigs)) {
        for (const eventConfig of component.eventConfigs) {
          if (eventConfig.actions && Array.isArray(eventConfig.actions)) {
            for (const action of eventConfig.actions) {
              if (action.type === 'switchView') {
                // 获取目标 view 名称
                let targetViewName: string | undefined;
                if (action.target) {
                  // 先尝试作为组件 ID 查找
                  const targetComponent = components.find(c => c.id === action.target);
                  if (targetComponent) {
                    targetViewName = targetComponent.name;
                  } else {
                    // 如果找不到组件，可能 target 直接就是 view 名称
                    targetViewName = action.target;
                  }
                } else if (action.params?.targetView) {
                  targetViewName = action.params.targetView;
                }
                
                // 只统计指向外部文件的 view
                if (targetViewName && !localViewNames.has(targetViewName)) {
                  count++;
                }
              }
            }
          }
        }
      }
      
      // 兼容旧的 events 格式
      if (component.events && Array.isArray(component.events)) {
        for (const event of component.events) {
          if (event.actions && Array.isArray(event.actions)) {
            for (const action of event.actions) {
              if (action.type === 'switchView') {
                const targetView = action.params?.targetView;
                if (targetView && !localViewNames.has(targetView)) {
                  count++;
                }
              }
            }
          }
        }
      }
    }
    
    return count;
  }

  /**
   * 生成预览入口文件
   */
  private async generatePreviewEntryFile(
    previewSrcDir: string, 
    designName: string, 
    currentHmlFile: string
  ): Promise<void> {
    // 从 HML 文件中读取 view 的实际名称
    const viewName = await this.getViewNameFromHml(currentHmlFile);
    
    // 生成预览入口文件
    const entryFilePath = path.join(previewSrcDir, 'PreviewEntry.c');
    
    const entryContent = `#include "gui_api.h"
#include "gui_view.h"
#include "gui_components_init.h"
#include "gui_vfs.h"
#include "hg_romfs.h"
#include "ui/${designName}_ui.h"

extern const struct romfs_dirent app_romfs_root;

static int app_init(void)
{
    // Mount romfs from embedded data
    gui_vfs_mount_romfs("/", &app_romfs_root, 0);
    
    // Create and start the preview view
    gui_view_create(gui_obj_get_root(), "${viewName}", 0, 0, 0, 0);
    
    return 0;
}

GUI_INIT_APP_EXPORT(app_init);
`;

    fs.writeFileSync(entryFilePath, entryContent);
    
    // 删除预览 src 目录中所有其他的 Entry 文件，避免重复定义
    this.removeOtherEntryFiles(previewSrcDir);
    
    this.outputChannel.appendLine(`[入口文件] PreviewEntry.c (启动 view: ${viewName})`);
    this.outputChannel.appendLine(`[预览模式] 跨 view 事件已禁用，专注于当前界面预览`);
  }

  /**
   * 删除目录中的其他 Entry 文件
   */
  private removeOtherEntryFiles(dir: string): void {
    if (!fs.existsSync(dir)) {
      return;
    }

    const files = fs.readdirSync(dir);
    for (const file of files) {
      // 删除所有以 Entry.c 结尾但不是 PreviewEntry.c 的文件
      if (file.endsWith('Entry.c') && file !== 'PreviewEntry.c') {
        const filePath = path.join(dir, file);
        try {
          fs.unlinkSync(filePath);
          this.outputChannel.appendLine(`[清理] 删除入口文件: ${file}`);
        } catch (err) {
          this.outputChannel.appendLine(`[警告] 无法删除 ${file}: ${err}`);
        }
      }
    }
  }

  /**
   * 从 HML 文件中获取 view 的名称
   */
  private async getViewNameFromHml(hmlFile: string): Promise<string> {
    const { HmlController } = await import('../hml/HmlController');
    
    const hmlController = new HmlController();
    await hmlController.loadFile(hmlFile);
    
    // 获取根组件（hg_view）
    const components = hmlController.currentDocument?.view.components || [];
    const rootView = components.find(c => c.type === 'hg_view' && !c.parent);
    
    if (rootView && rootView.name) {
      return rootView.name;
    }
    
    // 如果没有找到，使用默认命名规则
    const designName = path.basename(hmlFile, '.hml');
    return `${designName}_view`;
  }

  /**
   * 运行预览仿真
   */
  private async runPreviewSimulation(projectRoot: string, hmlFileName: string, projectSrcDir: string, backupSrcDir: string): Promise<void> {
    const { EnvironmentChecker } = await import('../simulation/EnvironmentChecker');
    const { BuildManager } = await import('../simulation/BuildManager');

    // 1. 环境检查
    this.outputChannel.appendLine('[环境检查] 开始...');
    const checker = new EnvironmentChecker();
    const result = await checker.checkAll();
    if (!result.success) {
      const guide = checker.getInstallGuide(result);
      throw new Error(guide);
    }
    this.outputChannel.appendLine('[环境检查] 通过');

    // 2. 准备编译环境（使用项目目录，src 已替换为预览版本）
    this.outputChannel.appendLine('[编译环境] 准备中...');
    const buildManager = new BuildManager(projectRoot, this.outputChannel);
    await buildManager.setupBuildDir();
    await buildManager.convertAssets();
    await buildManager.copyGeneratedCode();
    this.outputChannel.appendLine('[编译环境] 准备完成');

    // 3. 编译
    this.outputChannel.appendLine('[编译] 开始...');
    await buildManager.compile();
    this.outputChannel.appendLine('[编译] 完成');

    // 4. 恢复 src 目录（编译完成后立即恢复）
    await this.restoreSrcDirectory(projectSrcDir, backupSrcDir);

    // 5. 运行
    this.outputChannel.appendLine('[运行] 启动仿真器...');
    const exePath = buildManager.getExecutablePath();
    const buildDir = buildManager.getBuildDir();

    // 创建终端运行仿真器
    const simulatorTerminal = vscode.window.createTerminal({
      name: `HoneyGUI Preview - ${hmlFileName}`,
      cwd: buildDir,
      env: {
        SDL_STDIO_REDIRECT: '0',
        TERM: 'xterm'
      }
    });

    // 保存终端引用
    this.currentSimulatorTerminal = simulatorTerminal;

    simulatorTerminal.show();

    if (process.platform === 'win32') {
      simulatorTerminal.sendText(exePath);
    } else {
      simulatorTerminal.sendText(exePath);
    }

    this.outputChannel.appendLine('[运行] 仿真器已在终端中启动');
    vscode.window.showInformationMessage(vscode.l10n.t('Preview started: {0}', hmlFileName));
  }

  /**
   * 复制目录
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    if (!fs.existsSync(src)) {
      return;
    }

    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * 递归删除文件夹
   */
  private async deleteFolderRecursive(folderPath: string): Promise<void> {
    if (fs.existsSync(folderPath)) {
      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        const curPath = path.join(folderPath, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          await this.deleteFolderRecursive(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      }
      fs.rmdirSync(folderPath);
    }
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    if (this.currentSimulatorTerminal) {
      this.currentSimulatorTerminal.dispose();
      this.currentSimulatorTerminal = null;
    }
    this.statusBarItem.dispose();
    this.outputChannel.dispose();
  }
}
