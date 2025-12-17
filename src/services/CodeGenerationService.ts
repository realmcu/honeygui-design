import * as vscode from 'vscode';
import { CodeGenerator } from './CodeGenerator';
import { ProjectUtils } from '../utils/ProjectUtils';

export class CodeGenerationService {
    /**
     * 从文件路径生成代码
     */
    public static async generateFromFile(
        filePath: string | undefined,
        codeGenerator: CodeGenerator
    ): Promise<void> {
        if (!filePath) {
            vscode.window.showErrorMessage('未找到当前HML文件');
            return;
        }

        const projectRoot = ProjectUtils.findProjectRoot(filePath);
        if (!projectRoot) {
            vscode.window.showErrorMessage('未找到项目根目录');
            return;
        }

        await this.generate(projectRoot, codeGenerator);
    }

    /**
     * 从项目根目录生成代码
     */
    public static async generate(
        projectRoot: string,
        codeGenerator: CodeGenerator
    ): Promise<void> {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: '正在生成代码...',
                cancellable: false
            },
            async (progress) => {
                const result = await codeGenerator.generate(projectRoot, (prog) => {
                    progress.report({
                        increment: 100 / prog.total,
                        message: `正在生成 ${prog.designName} (${prog.current}/${prog.total})...`
                    });
                });

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
            }
        );
    }
}
