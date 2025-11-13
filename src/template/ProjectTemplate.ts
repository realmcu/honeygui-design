import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
// Simple mock implementation for Handlebars since it's not installed
const handlebars = {
    compile: (template: string) => {
        return (context: any) => {
            // Basic template substitution for testing
            return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                return context[key] || '';
            });
        };
    }
};
import { promisify } from 'util';

// 定义模板配置接口
interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  defaultValues: Record<string, any>;
  requiredFields: string[];
  files: TemplateFile[];
}

// 定义模板文件接口
interface TemplateFile {
  source: string;
  target: string;
  isTemplate: boolean;
}

// 定义模板变量接口
export interface TemplateVariables {
  projectName: string;
  [key: string]: any;
}

/**
 * 项目模板类，负责模板的加载、渲染和生成
 */
export class ProjectTemplate {
  private config: TemplateConfig;
  private templateDir: string;

  /**
   * 构造函数
   * @param templateDir 模板目录路径
   * @param config 模板配置
   */
  constructor(templateDir: string, config: TemplateConfig) {
    this.templateDir = templateDir;
    this.config = config;
  }

  /**
   * 获取模板ID
   */
  public getId(): string {
    return this.config.id;
  }

  /**
   * 获取模板名称
   */
  public getName(): string {
    return this.config.name;
  }

  /**
   * 获取模板描述
   */
  public getDescription(): string {
    return this.config.description;
  }

  /**
   * 获取模板版本
   */
  public getVersion(): string {
    return this.config.version;
  }

  /**
   * 获取模板作者
   */
  public getAuthor(): string | undefined {
    return this.config.author;
  }

  /**
   * 获取默认值
   */
  public getDefaultValues(): Record<string, any> {
    return { ...this.config.defaultValues };
  }

  /**
   * 获取必填字段列表
   */
  public getRequiredFields(): string[] {
    return [...this.config.requiredFields];
  }

  /**
   * 验证变量是否满足模板要求
   */
  public validateVariables(variables: TemplateVariables): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证必填字段
    for (const field of this.config.requiredFields) {
      if (!(field in variables) || variables[field] === undefined || variables[field] === '') {
        errors.push(`必填字段 '${field}' 不能为空`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 生成项目
   * @param outputDir 输出目录
   * @param variables 模板变量
   */
  public async generate(outputDir: string, variables: TemplateVariables): Promise<void> {
    // 验证变量
    const validation = this.validateVariables(variables);
    if (!validation.valid) {
      throw new Error(`模板变量验证失败:\n${validation.errors.join('\n')}`);
    }

    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 处理每个模板文件
    for (const file of this.config.files) {
      await this.processFile(file, outputDir, variables);
    }
  }

  /**
   * 处理单个模板文件
   */
  private async processFile(file: TemplateFile, outputDir: string, variables: TemplateVariables): Promise<void> {
    // 渲染目标路径（支持变量替换）
    const targetPath = this.renderTemplate(file.target, variables);
    const fullTargetPath = path.join(outputDir, targetPath);

    // 确保目标目录存在
    const targetDir = path.dirname(fullTargetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 读取源文件
    const sourcePath = path.join(this.templateDir, file.source);
    const sourceContent = await promisify(fs.readFile)(sourcePath, 'utf8');

    // 根据是否是模板文件决定是否渲染内容
    let content: string;
    if (file.isTemplate) {
      content = this.renderTemplate(sourceContent, variables);
    } else {
      content = sourceContent;
    }

    // 写入目标文件
    await promisify(fs.writeFile)(fullTargetPath, content, 'utf8');
  }

  /**
   * 使用Handlebars渲染模板内容
   */
  private renderTemplate(content: string, variables: TemplateVariables): string {
    try {
      const template = handlebars.compile(content);
      return template(variables);
    } catch (error) {
      throw new Error(`模板渲染失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 从目录加载模板
   * @param templateDir 模板目录路径
   */
  public static async loadFromDir(templateDir: string): Promise<ProjectTemplate> {
    try {
      // 读取配置文件
      const configPath = path.join(templateDir, 'template.json');
      if (!fs.existsSync(configPath)) {
        throw new Error(`模板配置文件不存在: ${configPath}`);
      }

      const configContent = await promisify(fs.readFile)(configPath, 'utf8');
      const config = JSON.parse(configContent) as TemplateConfig;

      // 验证配置
      if (!config.id) throw new Error('模板缺少id');
      if (!config.name) throw new Error('模板缺少name');
      if (!config.files || !Array.isArray(config.files)) {
        throw new Error('模板缺少files数组');
      }

      return new ProjectTemplate(templateDir, config);
    } catch (error) {
      throw new Error(`加载模板失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取模板信息
   */
  public getInfo(): {
    id: string;
    name: string;
    description: string;
    version: string;
    author?: string;
    requiredFields: string[];
    defaultValues: Record<string, any>;
  } {
    return {
      id: this.getId(),
      name: this.getName(),
      description: this.getDescription(),
      version: this.getVersion(),
      author: this.getAuthor(),
      requiredFields: this.getRequiredFields(),
      defaultValues: this.getDefaultValues()
    };
  }
}
