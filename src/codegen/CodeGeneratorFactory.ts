/**
 * Code generator factory
 * Creates the corresponding code generator based on target engine type
 */

import { Component } from '../hml/types';
import { ICodeGenerator, ICodeGeneratorConstructor, CodeGenOptions } from './ICodeGenerator';
import { HoneyGuiCCodeGenerator } from './honeygui/HoneyGuiCCodeGenerator';
import { LvglCCodeGenerator } from './lvgl/LvglCCodeGenerator';

export type TargetEngine = 'honeygui' | 'lvgl';

/**
 * Code generator factory class
 */
export class CodeGeneratorFactory {
  private static generators: Map<TargetEngine, ICodeGeneratorConstructor> = new Map([
    ['honeygui', HoneyGuiCCodeGenerator as any],
    ['lvgl', LvglCCodeGenerator as any],
  ]);

  /**
   * Create a code generator instance
   * @param engine Target engine type
   * @param components Component list
   * @param options Code generation options
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
   * Get the list of supported engines
   */
  static getSupportedEngines(): TargetEngine[] {
    return Array.from(this.generators.keys());
  }

  /**
   * Check if an engine is supported
   */
  static isEngineSupported(engine: string): engine is TargetEngine {
    return this.generators.has(engine as TargetEngine);
  }
}
