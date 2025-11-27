import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/Logger';
import { ProjectUtils } from '../utils/ProjectUtils';
import { HmlController } from '../hml/HmlController';
import { generateHoneyGuiCode, CodeGenOptions } from '../codegen/honeygui';

/**
 * 代码生成管理器 - 处理代码生成相关的逻辑
 */
export class CodeGenManager {
    private readonly _hmlController: HmlController;

    constructor(hmlController: HmlController) {
        this._hmlController = hmlController;
    }

    /**
     * 生成代码
     */
    public async generateCode(
        language: 'cpp' | 'c' = 'cpp', 
        options: Partial<CodeGenOptions> | undefined, 
        content: string | undefined,
        currentFilePath: string | undefined,
        saveCallback: () => Promise<boolean>
    ): Promise<void> {
        try {
            // 确保当前设计已保存
            if (!currentFilePath) {
                const saveFirst = await vscode.window.showInformationMessage(
                    '请先保存当前设计，然后再生成代码',
                    '保存',
                    '取消'
                );

                if (saveFirst === '保存') {
                    const saved = await saveCallback();
                    if (!saved) {
                        return;
                    }
                    // 保存后 currentFilePath 应该已经被更新，但这里我们无法直接获取更新后的值
                    // 需要依赖调用者传递更新后的值，或者重新获取
                    // 由于 saveCallback 是异步的，调用者在 saved 为 true 时应该已经更新了 filePath
                    // 但这里我们可能需要一种方式来获取最新的 filePath
                    // 简单起见，如果 saveCallback 返回 true，我们假设外部会重新调用或这里不需要 filePath (但下面需要)
                    // 实际上，saveCallback 应该返回最新的 filePath 或者我们让外部处理保存逻辑
                    
                    // 这里我们抛出一个特殊的错误或者让用户重新触发，或者改进接口设计
                    // 为了简化，我们假设 saveCallback 会处理保存，如果成功，我们需要最新的 filePath
                    // 由于 JS 的闭包特性，如果 currentFilePath 是基本类型，这里不会更新
                    // 所以我们可能需要传递一个获取 filePath 的函数
                    vscode.window.showInformationMessage('保存成功，请重新点击生成代码');
                    return;
                } else {
                    return;
                }
            }

            // 查找项目根目录
            const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
            if (!projectRoot) {
                vscode.window.showErrorMessage('未找到项目根目录（project.json）');
                return;
            }
            
            const config = ProjectUtils.loadProjectConfig(projectRoot);
            const uiDir = ProjectUtils.getUiDir(projectRoot);
            const relativePath = path.relative(uiDir, currentFilePath);
            
            // 检查是否在ui目录下
            if (relativePath.startsWith('..')) {
                vscode.window.showErrorMessage(`HML文件必须在${config.uiDir || 'ui'}目录下`);
                return;
            }
            
            // 提取设计稿目录名：main/main.hml -> main
            const pathParts = relativePath.split(path.sep);
            if (pathParts.length < 2) {
                vscode.window.showErrorMessage(`HML文件路径格式不正确，应为 ${config.uiDir}/设计稿名/设计稿名.hml`);
                return;
            }
            
            const designName = pathParts[0];
            const srcDir = ProjectUtils.getSrcDir(projectRoot);
            const outputDir = path.join(srcDir, 'autogen', designName);

            // 准备代码生成选项
            const hmlFileName = path.basename(currentFilePath || 'HoneyGUIApp', '.hml');
            const generatorOptions: CodeGenOptions = {
                outputDir,
                hmlFileName,
                enableProtectedAreas: true,
                ...options
            };

            const genResult = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `正在生成${language.toUpperCase()}代码...`,
                    cancellable: true
                },
                async (progress, token) => {
                    token.onCancellationRequested(() => {
                        throw new Error('代码生成已取消');
                    });

                    // 更新进度
                    progress.report({ increment: 10, message: '准备生成器...' });

                    // 确保模型已同步
                    if (content) {
                        this._hmlController.parseContent(content);
                    } else if (currentFilePath) {
                        await this._hmlController.loadFile(currentFilePath);
                    }

                    progress.report({ increment: 30, message: '创建代码生成器...' });

                    progress.report({ increment: 50, message: '生成代码文件...' });

                    const components = this._hmlController.currentDocument?.view.components || [];
                    const result = await generateHoneyGuiCode(components as any, generatorOptions);

                    progress.report({ increment: 90, message: '完成代码生成...' });

                    return result;
                }
            );

            if ((genResult as any).success) {
                // 显示成功消息
                const generatedFiles = (genResult as any).files || [];
                const message = `成功生成${language.toUpperCase()}代码文件（${generatedFiles.length}个文件）`;
                vscode.window.showInformationMessage(message);

                // 询问是否打开生成的文件
                const openFiles = await vscode.window.showInformationMessage(
                    '是否要在编辑器中打开生成的主要文件？',
                    '打开',
                    '取消'
                );

                if (openFiles === '打开' && generatedFiles.length > 0) {
                    // 打开第一个生成的文件（通常是主文件）
                    const mainFile = generatedFiles.find((file: string) => 
                        file.includes('Application') || file.includes('main') || file.includes('Window')
                    ) || generatedFiles[0];

                    const document = await vscode.workspace.openTextDocument(mainFile);
                    await vscode.window.showTextDocument(document);
                }
            } else {
                // 显示错误消息
                const errors = (genResult as any).errors;
                vscode.window.showErrorMessage(`代码生成失败: ${errors && errors.length ? errors[0] : '未知错误'}`);
            }

            // 如果有警告，显示警告
            if ((genResult as any).warnings && (genResult as any).warnings.length > 0) {
                for (const warning of (genResult as any).warnings) {
                    vscode.window.showWarningMessage(`警告: ${warning}`);
                }
            }

        } catch (error) {
            logger.error(`代码生成错误: ${error}`);
            vscode.window.showErrorMessage(`代码生成过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 生成所有设计稿的代码
     */
    public async generateAllCode(currentFilePath: string | undefined): Promise<void> {
        try {
            if (!currentFilePath) {
                vscode.window.showErrorMessage('未找到当前文件路径');
                return;
            }

            const projectRoot = ProjectUtils.findProjectRoot(currentFilePath);
            if (!projectRoot) {
                vscode.window.showErrorMessage('未找到项目根目录');
                return;
            }

            const generator = new (await import('../services/BatchCodeGenerator')).BatchCodeGenerator();
            
            // 先扫描文件
            const hmlFiles = await generator.scanHmlFiles(projectRoot);
            if (hmlFiles.length === 0) {
                vscode.window.showInformationMessage('未找到任何HML文件');
                return;
            }

            // 执行批量生成
            const result = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: '正在生成所有设计稿的代码...',
                    cancellable: false
                },
                async (progress) => {
                    return await generator.generateAll(projectRoot, (prog) => {
                        progress.report({
                            increment: 100 / prog.total,
                            message: `正在生成 ${prog.designName} (${prog.current}/${prog.total})...`
                        });
                    });
                }
            );

            // 显示结果
            if (result.success) {
                vscode.window.showInformationMessage(
                    `成功生成 ${result.successCount} 个设计稿的代码，共 ${result.totalFiles} 个文件`
                );
            } else {
                const errorMsg = result.errors.map(e => `${e.designName}: ${e.error}`).join('\n');
                vscode.window.showWarningMessage(
                    `生成完成，成功 ${result.successCount} 个，失败 ${result.errors.length} 个`,
                    '查看详情'
                ).then(selection => {
                    if (selection === '查看详情') {
                        vscode.window.showErrorMessage(errorMsg, { modal: true });
                    }
                });
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '未知错误';
            logger.error(`批量代码生成错误: ${errorMsg}`);
            vscode.window.showErrorMessage(`批量生成失败: ${errorMsg}`);
        }
    }
}
