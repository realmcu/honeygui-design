import * as path from 'path';
import * as fs from 'fs';
import { ProjectUtils } from '../utils/ProjectUtils';
import { HmlController } from '../hml/HmlController';
import { generateHoneyGuiCode, CodeGenOptions } from '../codegen/honeygui';
import { EntryFileGenerator } from '../codegen/EntryFileGenerator';
import { logger } from '../utils/Logger';

export interface GenerationResult {
    success: boolean;
    successCount: number;
    totalFiles: number;
    errors: Array<{ designName: string; error: string }>;
}

export interface GenerationProgress {
    current: number;
    total: number;
    designName: string;
}

export class CodeGenerator {
    /**
     * 扫描项目中的所有 HML 文件
     */
    public async scanHmlFiles(projectRoot: string): Promise<string[]> {
        const uiDir = ProjectUtils.getUiDir(projectRoot);

        if (!fs.existsSync(uiDir)) {
            throw new Error(`UI目录不存在: ${uiDir}`);
        }

        const hmlFiles: string[] = [];
        const designDirs = fs.readdirSync(uiDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const designName of designDirs) {
            const designDir = path.join(uiDir, designName);
            // 查找目录下所有 .hml 文件
            const files = fs.readdirSync(designDir);
            for (const file of files) {
                if (file.endsWith('.hml')) {
                    hmlFiles.push(path.join(designDir, file));
                }
            }
        }

        return hmlFiles;
    }

    /**
     * 生成代码
     */
    public async generate(
        projectRoot: string,
        onProgress?: (progress: GenerationProgress) => void
    ): Promise<GenerationResult> {
        const hmlFiles = await this.scanHmlFiles(projectRoot);
        
        if (hmlFiles.length === 0) {
            return {
                success: true,
                successCount: 0,
                totalFiles: 0,
                errors: []
            };
        }

        const config = ProjectUtils.loadProjectConfig(projectRoot);
        const srcDir = ProjectUtils.getSrcDir(projectRoot);
        const autogenDir = path.join(srcDir, 'autogen');

        // 生成项目入口文件（只生成一次）
        try {
            const entryFile = EntryFileGenerator.generate(autogenDir, config.name || 'HoneyGUI');
            logger.info(`入口文件: ${path.basename(entryFile)}`);
        } catch (error) {
            logger.error(`生成入口文件失败: ${error}`);
        }

        let successCount = 0;
        let totalFiles = 0;
        const errors: Array<{ designName: string; error: string }> = [];

        for (let i = 0; i < hmlFiles.length; i++) {
            const hmlFile = hmlFiles[i];
            const designName = path.basename(path.dirname(hmlFile));

            onProgress?.({
                current: i + 1,
                total: hmlFiles.length,
                designName
            });

            try {
                const result = await this.generateSingle(hmlFile, srcDir, designName);
                successCount++;
                totalFiles += result.fileCount;
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : '未知错误';
                errors.push({
                    designName,
                    error: errorMsg
                });
                logger.error(`生成 ${designName} 失败: ${errorMsg}`);
            }
        }

        return {
            success: errors.length === 0,
            successCount,
            totalFiles,
            errors
        };
    }

    /**
     * 生成单个 HML 文件的代码
     */
    private async generateSingle(
        hmlFile: string,
        srcDir: string,
        designName: string
    ): Promise<{ fileCount: number }> {
        const hmlController = new HmlController();
        await hmlController.loadFile(hmlFile);

        const outputDir = path.join(srcDir, 'autogen', designName);
        const hmlFileName = path.basename(hmlFile, '.hml'); // 使用实际的文件名
        const generatorOptions: CodeGenOptions = {
            outputDir,
            hmlFileName,
            enableProtectedAreas: true
        };

        const components = hmlController.currentDocument?.view.components || [];
        const result = await generateHoneyGuiCode(components as any, generatorOptions);

        if (!(result as any).success) {
            throw new Error((result as any).errors?.[0] || '生成失败');
        }

        return { fileCount: (result as any).files?.length || 0 };
    }
}
