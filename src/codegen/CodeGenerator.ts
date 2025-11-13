import * as vscode from 'vscode';
import { Component } from '../hml/HmlParser';
import { DesignerModel } from '../designer/DesignerModel';

/**
 * 代码生成器选项
 */
export interface CodeGeneratorOptions {
  /** 输出目录路径 */
  outputDir: string;
  /** 项目名称 */
  projectName: string;
  /** 是否启用代码保护区 */
  enableProtectedAreas: boolean;
  /** 是否生成调试信息 */
  generateDebugInfo: boolean;
}

/**
 * 代码生成结果
 */
export interface CodeGenerationResult {
  /** 是否成功 */
  success: boolean;
  /** 生成的文件路径列表 */
  generatedFiles: string[];
  /** 错误信息（如果有） */
  error?: string;
  /** 警告信息（如果有） */
  warnings?: string[];
}

/**
 * 代码生成器抽象类
 */
export abstract class CodeGenerator {
  protected options: CodeGeneratorOptions;
  protected model: DesignerModel;

  /**
   * 构造函数
   * @param model 设计器模型
   * @param options 代码生成选项
   */
  constructor(model: DesignerModel, options: CodeGeneratorOptions) {
    this.model = model;
    this.options = options;
  }

  /**
   * 生成代码
   */
  public abstract generate(): Promise<CodeGenerationResult>;

  /**
   * 获取生成器类型名称
   */
  public abstract getGeneratorName(): string;

  /**
   * 检查输出目录是否存在，不存在则创建
   */
  protected async ensureOutputDirExists(): Promise<boolean> {
    try {
      const outputDirUri = vscode.Uri.file(this.options.outputDir);
      const exists = await this.existsAsync(outputDirUri);
      if (!exists) {
        await vscode.workspace.fs.createDirectory(outputDirUri);
      }
      return true;
    } catch (error) {
      console.error('创建输出目录失败:', error);
      return false;
    }
  }

  /**
   * 检查文件/目录是否存在
   */
  private async existsAsync(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 写入文件，支持代码保护区合并
   */
  protected async writeFileWithMerge(filePath: string, content: string): Promise<boolean> {
    try {
      const fileUri = vscode.Uri.file(filePath);
      const exists = await this.existsAsync(fileUri);
      
      if (exists && this.options.enableProtectedAreas) {
        // 如果文件存在且启用了保护区，尝试合并
        const existingContent = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString('utf8');
        const mergedContent = this.mergeWithProtectedAreas(existingContent, content);
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(mergedContent, 'utf8'));
      } else {
        // 直接写入新文件
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
      }
      return true;
    } catch (error) {
      console.error(`写入文件失败 ${filePath}:`, error);
      return false;
    }
  }

  /**
   * 合并新内容与现有内容，保留代码保护区
   */
  protected mergeWithProtectedAreas(existingContent: string, newContent: string): string {
    // 保护区标记正则表达式
    const protectedStartRegex = /\/\*\s*@protected\s+start\s+([\w-]+)\s*\*\//g;
    const protectedEndRegex = /\/\*\s*@protected\s+end\s+([\w-]+)\s*\*\//g;
    
    // 收集现有保护区内容
    const protectedAreas: { [key: string]: string } = {};
    let match;
    let lastIndex = 0;
    let currentId: string | null = null;
    let currentContent = '';
    
    // 遍历所有行来提取保护区
    const lines = existingContent.split('\n');
    for (const line of lines) {
      const startMatch = line.match(/\/\*\s*@protected\s+start\s+([\w-]+)\s*\*\//);
      const endMatch = line.match(/\/\*\s*@protected\s+end\s+([\w-]+)\s*\*\//);
      
      if (startMatch) {
        currentId = startMatch[1];
        currentContent = '';
      } else if (endMatch && currentId && endMatch[1] === currentId) {
        protectedAreas[currentId] = currentContent;
        currentId = null;
      } else if (currentId) {
        currentContent += line + '\n';
      }
    }
    
    // 将保护区内容插入到新内容中
    let result = newContent;
    for (const [id, content] of Object.entries(protectedAreas)) {
      const placeholder = `/* @protected start ${id} */\n/* @protected end ${id} */`;
      const replacement = `/* @protected start ${id} */\n${content}/* @protected end ${id} */`;
      result = result.replace(placeholder, replacement);
    }
    
    return result;
  }

  /**
   * 生成唯一标识符
   */
  protected generateUniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 清理文件名，移除非法字符
   */
  protected sanitizeFilename(filename: string): string {
    return filename.replace(/[<>"/\\|?*]/g, '_');
  }
}

/**
 * 代码生成器工厂类
 */
export class CodeGeneratorFactory {
  /**
   * 创建代码生成器
   * @param type 生成器类型
   * @param model 设计器模型
   * @param options 选项
   */
  public static createGenerator(
    type: 'cpp' | 'c',
    model: DesignerModel,
    options: CodeGeneratorOptions
  ): CodeGenerator {
    switch (type) {
      case 'cpp':
        // 动态导入C++生成器
        const { CppCodeGenerator } = require('./cpp/CppCodeGenerator');
        return new CppCodeGenerator(model, options);
      case 'c':
        // C语言生成器可以复用C++生成器，只需调整输出格式
        const { CCppCodeGenerator } = require('./cpp/CppCodeGenerator');
        return new CCppCodeGenerator(model, options);
      default:
        throw new Error(`不支持的代码生成器类型: ${type}`);
    }
  }
}