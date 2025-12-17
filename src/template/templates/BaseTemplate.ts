/**
 * 模板基类
 */

import * as fs from 'fs';
import * as path from 'path';
import { ITemplate, TemplateConfig, TemplateAsset } from './ITemplate';

export abstract class BaseTemplate implements ITemplate {
    abstract id: string;
    abstract name: string;
    abstract description: string;
    abstract category: string;
    abstract recommendedResolution: string;
    
    /**
     * 获取模板项目路径
     */
    protected abstract getTemplateProjectPath(): string;
    
    /**
     * 生成 HML（保留接口兼容性）
     */
    generateHml(config: TemplateConfig): string {
        throw new Error('Use createProject() instead');
    }
    
    /**
     * 创建项目（拷贝模板项目）
     */
    async createProject(
        targetPath: string,
        projectName: string,
        appId: string,
        sdkPath: string
    ): Promise<void> {
        const templatePath = this.getTemplateProjectPath();
        
        // 1. 拷贝整个项目目录
        this.copyDirectory(templatePath, targetPath);
        
        // 2. 替换所有文件中的变量
        const variables = {
            PROJECT_NAME: projectName,
            APP_ID: appId,
            SDK_PATH: sdkPath,
            CREATED_TIME: new Date().toLocaleString()
        };
        this.replaceVariablesInProject(targetPath, variables);
        
        // 3. 重命名 HML 文件
        this.renameHmlFile(targetPath, projectName);
    }
    
    /**
     * 递归拷贝目录
     */
    private copyDirectory(src: string, dest: string): void {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        const entries = fs.readdirSync(src, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                // 跳过 .template.* 文件，它们会在后续处理
                if (entry.name.includes('.template.')) {
                    continue;
                }
                
                // 检查是否存在对应的 .template 版本
                const templateVersion = this.getTemplateVersion(srcPath);
                const sourceFile = templateVersion || srcPath;
                
                fs.copyFileSync(sourceFile, destPath);
            }
        }
    }
    
    /**
     * 获取文件的模板版本（如果存在）
     */
    private getTemplateVersion(filePath: string): string | null {
        const dir = path.dirname(filePath);
        const basename = path.basename(filePath);
        const ext = path.extname(filePath);
        const nameWithoutExt = basename.slice(0, -ext.length);
        
        // 检查 name.template.ext 格式
        const templatePath = path.join(dir, `${nameWithoutExt}.template${ext}`);
        if (fs.existsSync(templatePath)) {
            return templatePath;
        }
        
        return null;
    }
    
    /**
     * 替换项目中所有文件的变量
     */
    private replaceVariablesInProject(projectPath: string, variables: Record<string, string>): void {
        const files = this.getAllFiles(projectPath);
        
        for (const file of files) {
            // 只处理文本文件
            if (this.isTextFile(file)) {
                let content = fs.readFileSync(file, 'utf8');
                
                // 替换所有变量
                for (const [key, value] of Object.entries(variables)) {
                    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                    content = content.replace(regex, value);
                }
                
                fs.writeFileSync(file, content, 'utf8');
            }
        }
    }
    
    /**
     * 重命名 HML 文件
     */
    private renameHmlFile(projectPath: string, projectName: string): void {
        const hmlDir = path.join(projectPath, 'ui', 'main');
        if (!fs.existsSync(hmlDir)) return;
        
        const files = fs.readdirSync(hmlDir);
        
        for (const file of files) {
            if (file.endsWith('.hml')) {
                const oldPath = path.join(hmlDir, file);
                const newPath = path.join(hmlDir, `${projectName}Main.hml`);
                if (oldPath !== newPath) {
                    fs.renameSync(oldPath, newPath);
                }
                break;
            }
        }
    }
    
    /**
     * 获取目录下所有文件
     */
    private getAllFiles(dir: string): string[] {
        const files: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...this.getAllFiles(fullPath));
            } else {
                files.push(fullPath);
            }
        }
        
        return files;
    }
    
    /**
     * 判断是否为文本文件
     */
    private isTextFile(filePath: string): boolean {
        const textExtensions = ['.hml', '.json', '.md', '.txt', '.ts', '.js', '.c', '.h'];
        const ext = path.extname(filePath).toLowerCase();
        return textExtensions.includes(ext);
    }
    
    getAssets(): TemplateAsset[] {
        return [];
    }
    
    async copyAssets(projectPath: string): Promise<void> {
        // 不再需要，资源已经在项目目录中
    }
    
    getPreviewImage(): string | null {
        return null;
    }
}
