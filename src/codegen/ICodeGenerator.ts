/**
 * 代码生成器接口
 * 支持多种GUI引擎的代码生成
 */

import { Component } from '../hml/types';

export type OverwritePolicy = 'always' | 'once' | 'protected';

export interface CodeGenOptions {
  srcDir: string;           // src 根目录
  designName: string;       // 设计名称（用于文件命名）
  enableProtectedAreas?: boolean;
}

export interface CodeGenResult {
  success: boolean;
  files: string[];
  errors?: string[];
}

/**
 * 代码生成器接口
 */
export interface ICodeGenerator {
  /**
   * 生成所有代码文件
   */
  generate(): Promise<CodeGenResult>;
}

/**
 * 代码生成器构造函数类型
 */
export interface ICodeGeneratorConstructor {
  new (components: Component[], options: CodeGenOptions): ICodeGenerator;
}
