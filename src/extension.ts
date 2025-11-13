import * as vscode from 'vscode';
import { DesignerPanel } from './designer/DesignerPanel';
import { PreviewService } from './preview/PreviewService';
import * as fs from 'fs';
import * as path from 'path';
// 简化的TemplateManager类，用于通过编译
class TemplateManager {
    constructor(private context: vscode.ExtensionContext) {}
    async loadTemplates(): Promise<void> {}
}

/**
 * 扩展激活时执行的函数
 */
// Honeygui设计器扩展激活函数
export function activate(context: vscode.ExtensionContext) {
    console.log('HoneyGUI Visual Designer 扩展已激活');
    
    // 创建预览服务实例
    const previewService = new PreviewService(context);
    // 注册预览相关命令
    previewService.registerCommands();
    
    // 初始化模板管理器
    const templateManager = new TemplateManager(context);
    templateManager.loadTemplates().catch(err => console.error('模板加载失败:', err));

    // 注册命令
    context.subscriptions.push(
        // 打开设计器命令
        vscode.commands.registerCommand('honeygui.openDesigner', async () => {
            try {
                // 检查当前是否有打开的HML文件
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.languageId === 'xml' && editor.document.fileName.endsWith('.hml')) {
                    DesignerPanel.createOrShow(context, editor.document.fileName);
                } else {
                    // 询问用户是否要打开文件或创建新文件
                    const action = await vscode.window.showQuickPick(
                        ['创建新设计', '打开现有设计'],
                        { placeHolder: '请选择操作' }
                    );

                    if (action === '创建新设计') {
                        // 创建新设计
                        await vscode.commands.executeCommand('honeygui.newProject');
                    } else if (action === '打开现有设计') {
                        // 打开现有设计
                        await vscode.commands.executeCommand('honeygui.importProject');
                    } else {
                        // 如果用户取消，只打开空设计器
                        DesignerPanel.createOrShow(context);
                    }
                }
            } catch (error) {
                console.error('打开设计器失败:', error);
                vscode.window.showErrorMessage(`打开设计器失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        }),

        // 新建项目命令
        vscode.commands.registerCommand('honeygui.newProject', async () => {
            try {
                // 显示保存对话框，让用户选择项目保存位置
                const uri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file('untitled.hml'),
                    filters: {
                        'HML 文件': ['hml'],
                        '所有文件': ['*']
                    }
                });
                
                if (uri) {
                    // 创建默认的HML内容
                    const defaultHmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <metadata>
    <title>新HoneyGUI项目</title>
    <description>使用HoneyGUI设计器创建的新项目</description>
    <version>1.0.0</version>
    <author>HoneyGUI用户</author>
  </metadata>
  <window id="mainWindow" width="800" height="600" title="HoneyGUI应用">
    <label id="welcomeLabel" text="欢迎使用HoneyGUI!" x="350" y="280" width="200" height="40" />
    <button id="okButton" text="确定" x="375" y="350" width="100" height="30" />
  </window>
</hml>`;
                    
                    // 保存文件
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(defaultHmlContent, 'utf8'));
                    
                    // 打开设计器并加载新建的文件
                    DesignerPanel.createOrShow(context, uri.fsPath);
                    
                    vscode.window.showInformationMessage(`项目已创建: ${path.basename(uri.fsPath)}`);
                }
            } catch (error) {
                console.error('创建新项目失败:', error);
                vscode.window.showErrorMessage(`创建新项目失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        }),

        // 导入现有项目命令
        vscode.commands.registerCommand('honeygui.importProject', async () => {
            try {
                const options: vscode.OpenDialogOptions = {
                    canSelectMany: false,
                    openLabel: '打开',
                    filters: {
                        'HML 文件': ['hml'],
                        '所有文件': ['*']
                    }
                };

                const fileUri = await vscode.window.showOpenDialog(options);

                if (fileUri && fileUri.length > 0) {
                    // 检查文件是否存在
                    if (fs.existsSync(fileUri[0].fsPath)) {
                        // 打开设计器并加载选择的文件
                        DesignerPanel.createOrShow(context, fileUri[0].fsPath);
                        vscode.window.showInformationMessage(`项目已打开: ${path.basename(fileUri[0].fsPath)}`);
                    } else {
                        vscode.window.showErrorMessage(`文件不存在: ${fileUri[0].fsPath}`);
                    }
                }
            } catch (error) {
                console.error('导入项目失败:', error);
                vscode.window.showErrorMessage(`导入项目失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        }),
        
        // 创建项目命令
        vscode.commands.registerCommand('honeygui.createProject', async () => {
            try {
                const projectName = await vscode.window.showInputBox({
                    prompt: '输入项目名称',
                    placeHolder: 'honeygui-app'
                });
                
                if (projectName) {
                    const options: vscode.OpenDialogOptions = {
                        canSelectFolders: true,
                        canSelectFiles: false,
                        openLabel: '选择项目存放位置'
                    };
                    
                    const result = await vscode.window.showOpenDialog(options);
                    if (result && result.length > 0) {
                        const folderPath = result[0].fsPath;
                        const projectPath = path.join(folderPath, projectName);
                        
                        // 简单的项目创建逻辑
                        try {
                            fs.mkdirSync(projectPath, { recursive: true });
                            fs.mkdirSync(path.join(projectPath, 'ui'), { recursive: true });
                            fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
                            fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });
                            
                            // 创建基本文件
                            const hmlContent = `<!-- ${projectName} UI定义 -->
<hml page id="${projectName}" width="360" height="640">
  <container id="root" layout="column" padding="16">
    <text id="title" value="${projectName}" fontSize="24" marginTop="16" align="center"/>
    <button id="helloButton" text="点击我" marginTop="32" align="center" onClick="OnHelloButtonClick"/>
  </container>
</hml>`;
                            fs.writeFileSync(path.join(projectPath, 'ui', `${projectName}.hml`), hmlContent, 'utf8');
                            
                            const cppContent = `// ${projectName} 主程序

#include <iostream>

// <honeygui-protect-begin:handler>
void OnHelloButtonClick() {
    std::cout << "Hello, HoneyGUI!" << std::endl;
}
// <honeygui-protect-end:handler>

int main() {
    std::cout << "${projectName} 启动中..." << std::endl;
    return 0;
}`;
                            fs.writeFileSync(path.join(projectPath, 'src', 'main.cpp'), cppContent, 'utf8');
                            
                            vscode.window.showInformationMessage(`项目创建成功: ${projectPath}`);
                            
                            // 询问是否打开项目
                            const action = await vscode.window.showInformationMessage(
                              '项目创建成功!',
                              '打开项目',
                              '稍后打开'
                            );
                            
                            if (action === '打开项目') {
                              await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), false);
                            }
                        } catch (error) {
                            vscode.window.showErrorMessage(`创建项目失败: ${error instanceof Error ? error.message : String(error)}`);
                        }
                    }
                }
            } catch (error) {
                console.error('创建项目失败:', error);
                vscode.window.showErrorMessage(`创建项目失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        }),

        // 生成代码命令
        vscode.commands.registerCommand('honeygui.generateCode', () => {
            vscode.window.showInformationMessage('代码生成功能开发中...');
        }),

        // 预览命令
        vscode.commands.registerCommand('honeygui.previewDesign', () => {
            // 通过预览服务打开预览
            previewService.openPreview();
        }),

        // 保存设计命令
        vscode.commands.registerCommand('honeygui.saveDesign', () => {
            vscode.window.showInformationMessage('保存功能已集成到设计器中');
        }),

        // 导出设计命令
        vscode.commands.registerCommand('honeygui.exportDesign', () => {
            vscode.window.showInformationMessage('导出功能开发中...');
        }),

        // 资源管理器命令
        vscode.commands.registerCommand('honeygui.openResourceManager', () => {
            vscode.window.showInformationMessage('HoneyGUI: 资源管理器功能即将实现');
        }),

        // 打开文档命令
        vscode.commands.registerCommand('honeygui.openDocs', () => {
            vscode.env.openExternal(vscode.Uri.parse('https://gitee.com/realmcu/HoneyGUI'));
        }),

        // XML转HML迁移命令
        vscode.commands.registerCommand('honeygui.migrateXmlToHml', () => {
            vscode.window.showInformationMessage('HoneyGUI: XML转HML迁移功能即将实现');
        })
    );
    
    // 监听HML文件的打开事件
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => {
            if (document.fileName.endsWith('.hml')) {
                // 提示用户是否要在设计器中打开
                vscode.window.showInformationMessage(
                    `检测到HML文件，是否在设计器中打开？`,
                    '是',
                    '否'
                ).then((selection) => {
                    if (selection === '是') {
                        DesignerPanel.createOrShow(context, document.fileName);
                    }
                });
            }
        })
    );

    // 监听文件系统变化，以便在文件被外部修改时通知用户
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.hml');
    context.subscriptions.push(
        watcher.onDidChange(uri => {
            vscode.window.showInformationMessage(`文件已被修改: ${uri.fsPath}`);
        })
    );

    // 监听VSCode启动事件，以便在编辑器启动时进行一些初始化工作
    vscode.window.onDidChangeVisibleTextEditors(() => {
        // 检查当前活动的编辑器是否打开了.hml文件
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.fsPath.endsWith('.hml')) {
            // 可以在这里执行一些针对.hml文件的特殊处理
        }
    });
    
    // 当扩展被激活时的通知
    vscode.window.showInformationMessage('HoneyGUI扩展已激活');
    
    // 添加预览服务到清理列表
    context.subscriptions.push({
        dispose: () => {
            previewService.dispose();
        }
    });
}

// 导出停用函数
function deactivate() {
    console.log('HoneyGUI Visual Designer 已停用');
    // 有机会清理工作可以在这里进行
    // DesignerPanel会自动处理清理
    vscode.window.showInformationMessage('HoneyGUI扩展已停用');
}

// 导出扩展函数
export { deactivate };