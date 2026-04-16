import * as path from 'path';
import * as fs from 'fs';
import { ProjectUtils } from '../utils/ProjectUtils';
import { HmlController } from '../hml/HmlController';
import { CodeGenOptions } from '../codegen/ICodeGenerator';
import { CodeGeneratorFactory, TargetEngine } from '../codegen/CodeGeneratorFactory';
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

        // 递归扫描 ui/ 下所有 .hml 文件
        const hmlFiles: string[] = [];
        const scanDir = (dir: string) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isFile() && entry.name.endsWith('.hml')) {
                    hmlFiles.push(fullPath);
                } else if (entry.isDirectory()) {
                    scanDir(fullPath);
                }
            }
        };
        scanDir(uiDir);

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

        // 生成项目入口文件（仅 HoneyGUI 引擎需要）
        const targetEngine: TargetEngine = config.targetEngine || 'honeygui';
        if (targetEngine === 'honeygui') {
            try {
                // 从 HML 文件中查找 entry view 的 ID
                const entryViewId = await this.findEntryViewId(hmlFiles);
                const entryFile = EntryFileGenerator.generate(srcDir, config.name || 'HoneyGUI', entryViewId, config.romfsBaseAddr);
                logger.info(`入口文件: ${path.basename(entryFile)}`);
            } catch (error) {
                logger.error(`生成入口文件失败: ${error}`);
            }
        }

        let successCount = 0;
        let totalFiles = 0;
        const errors: Array<{ designName: string; error: string }> = [];

        for (let i = 0; i < hmlFiles.length; i++) {
            const hmlFile = hmlFiles[i];
            // 使用 HML 文件名（不含扩展名）作为 designName
            const designName = path.basename(hmlFile, '.hml');

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
     * 从 HML 文件列表中查找 entry view 的 ID
     */
    private async findEntryViewId(hmlFiles: string[]): Promise<string | undefined> {
        for (const hmlFile of hmlFiles) {
            try {
                const hmlController = new HmlController();
                const doc = await hmlController.loadFile(hmlFile);
                const components = doc.view.components || [];
                const entryView = components.find(
                    c => c.type === 'hg_view' && (c.data?.entry === true || c.data?.entry === 'true')
                );
                if (entryView) {
                    return entryView.id;
                }
            } catch {
                // 跳过解析失败的文件
            }
        }
        return undefined;
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

        const generatorOptions: CodeGenOptions = {
            srcDir,
            designName,
            enableProtectedAreas: true
        };

        // 获取项目配置中的目标引擎
        const projectRoot = ProjectUtils.findProjectRoot(path.dirname(hmlFile));
        const config = projectRoot ? ProjectUtils.loadProjectConfig(projectRoot) : {};
        const targetEngine: TargetEngine = config.targetEngine || 'honeygui';

        // 使用工厂创建代码生成器
        const components = hmlController.currentDocument?.view.components || [];
        const generator = CodeGeneratorFactory.create(targetEngine, components as any, generatorOptions);
        const result = await generator.generate();

        if (!result.success) {
            throw new Error(result.errors?.[0] || '生成失败');
        }

        return { fileCount: result.files?.length || 0 };
    }
}
