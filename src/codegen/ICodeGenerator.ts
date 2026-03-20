/**
 * Code generator interface
 * Supports code generation for multiple GUI engines
 */

import { Component } from '../hml/types';

export type OverwritePolicy = 'always' | 'once' | 'protected';

export interface CodeGenOptions {
  srcDir: string;           // Root src directory
  designName: string;       // Design name (used for file naming)
  enableProtectedAreas?: boolean;
}

export interface CodeGenResult {
  success: boolean;
  files: string[];
  errors?: string[];
}

/**
 * Code generator interface
 */
export interface ICodeGenerator {
  /**
   * Generate all code files
   */
  generate(): Promise<CodeGenResult>;
}

/**
 * Code generator constructor type
 */
export interface ICodeGeneratorConstructor {
  new (components: Component[], options: CodeGenOptions): ICodeGenerator;
}
