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
            vscode.window.showErrorMessage(vscode.l10n.t('Please open an HML file first'));
            return;
        }

        const projectRoot = ProjectUtils.findProjectRoot(filePath);
        if (!projectRoot) {
            vscode.window.showErrorMessage(vscode.l10n.t('Cannot find project root (project.json)'));
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
                title: vscode.l10n.t('Code generation completed'),
                cancellable: false
            },
            async (progress) => {
                const result = await codeGenerator.generate(projectRoot, (prog) => {
                    progress.report({
                        increment: 100 / prog.total,
                        message: `${prog.designName} (${prog.current}/${prog.total})...`
                    });
                });

                if (result.success) {
                    vscode.window.showInformationMessage(
                        vscode.l10n.t('Code generated successfully, {0} files written', result.totalFiles)
                    );
                } else {
                    const errorMsg = result.errors.map(e => `${e.designName}: ${e.error}`).join('\n');
                    vscode.window.showWarningMessage(
                        vscode.l10n.t('Code generated with warnings: {0}', `${result.successCount}/${result.successCount + result.errors.length}`),
                        vscode.l10n.t('View Documentation')
                    ).then(selection => {
                        if (selection === vscode.l10n.t('View Documentation')) {
                            vscode.window.showErrorMessage(errorMsg, { modal: true });
                        }
                    });
                }
            }
        );
    }
}
