/**
 * 代码生成器工厂
 * 根据目标引擎类型创建对应的代码生成器
 */

import { Component } from '../hml/types';
import { ICodeGenerator, ICodeGeneratorConstructor, CodeGenOptions } from './ICodeGenerator';
import { HoneyGuiCCodeGenerator } from './honeygui/HoneyGuiCCodeGenerator';
import { LvglCCodeGenerator } from './lvgl/LvglCCodeGenerator';

export type TargetEngine = 'honeygui' | 'lvgl';

/**
 * 代码生成器工厂类
 */
export class CodeGeneratorFactory {
  private static generators: Map<TargetEngine, ICodeGeneratorConstructor> = new Map([
    ['honeygui', HoneyGuiCCodeGenerator as any],
    ['lvgl', LvglCCodeGenerator as any],
  ]);

  /**
   * 创建代码生成器实例
   * @param engine 目标引擎类型
   * @param components 组件列表
   * @param options 代码生成选项
   */
  static create(
    engine: TargetEngine,
    components: Component[],
    options: CodeGenOptions
  ): ICodeGenerator {
    const GeneratorClass = this.generators.get(engine);
    
    if (!GeneratorClass) {
      throw new Error(`Unsupported target engine: ${engine}`);
    }

    return new GeneratorClass(components, options);
  }

  /**
   * 获取支持的引擎列表
   */
  static getSupportedEngines(): TargetEngine[] {
    return Array.from(this.generators.keys());
  }

  /**
   * 检查引擎是否支持
   */
  static isEngineSupported(engine: string): engine is TargetEngine {
    return this.generators.has(engine as TargetEngine);
  }
}
