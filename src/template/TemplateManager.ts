import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProjectTemplate } from './ProjectTemplate';
import { logger } from '../utils/Logger';

/**
 * 简化的模板管理器
 * 从 template-projects 目录加载标准项目作为模板
 */
export class TemplateManager {
  private templates: Map<string, ProjectTemplate> = new Map();
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * 加载所有可用模板
   */
  public async loadTemplates(): Promise<void> {
    this.templates.clear();

    // 从扩展的 template-projects 目录加载
    const templateDir = path.join(this.context.extensionPath, 'template-projects');
    
    if (!fs.existsSync(templateDir)) {
      logger.warn(`模板目录不存在: ${templateDir}`);
      return;
    }

    try {
      const entries = fs.readdirSync(templateDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const currentTemplateDir = path.join(templateDir, entry.name);
          try {
            const template = await ProjectTemplate.loadFromDir(currentTemplateDir);
            this.templates.set(template.getName(), template);
            logger.info(`加载模板: ${template.getName()}`);
          } catch (error) {
            logger.warn(`加载模板失败 (${entry.name}): ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    } catch (error) {
      logger.error(`扫描模板目录失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取所有模板
   */
  public async getTemplates(): Promise<ProjectTemplate[]> {
    if (this.templates.size === 0) {
      await this.loadTemplates();
    }
    return Array.from(this.templates.values());
  }

  /**
   * 根据名称获取模板
   */
  public async getTemplateByName(name: string): Promise<ProjectTemplate | undefined> {
    if (this.templates.size === 0) {
      await this.loadTemplates();
    }
    return this.templates.get(name);
  }

  /**
   * 获取模板选择列表
   */
  public async getTemplateQuickPickItems(): Promise<vscode.QuickPickItem[]> {
    const templates = await this.getTemplates();
    return templates.map(template => {
      const info = template.getInfo();
      return {
        label: info.name,
        description: info.description
      };
    });
  }

  /**
   * 应用模板创建新项目
   */
  public async applyTemplate(
    templateName: string, 
    outputDir: string, 
    projectName: string,
    sdkPath?: string
  ): Promise<void> {
    const template = await this.getTemplateByName(templateName);
    if (!template) {
      throw new Error(`模板不存在: ${templateName}`);
    }

    try {
      await template.generate(outputDir, projectName, sdkPath);
      logger.info(`成功创建项目: ${projectName}`);
    } catch (error) {
      throw new Error(`应用模板失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 刷新模板列表
   */
  public async refreshTemplates(): Promise<void> {
    await this.loadTemplates();
  }

  /**
   * 获取模板数量
   */
  public getTemplateCount(): number {
    return this.templates.size;
  }
}
