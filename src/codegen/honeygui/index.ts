/**
 * HoneyGUI代码生成器模块入口
 */

export { HoneyGuiCCodeGenerator, Component, CodeGenOptions, CodeGenResult } from './HoneyGuiCCodeGenerator';
export { HoneyGuiApiMapper, HoneyGuiApiMapping, PropertySetter, EventHandler } from './HoneyGuiApiMapper';

/**
 * 便捷函数：从组件数组生成C代码
 */
import { HoneyGuiCCodeGenerator, Component, CodeGenOptions, CodeGenResult } from './HoneyGuiCCodeGenerator';

export async function generateHoneyGuiCode(
  components: Component[],
  options: CodeGenOptions
): Promise<CodeGenResult> {
  const generator = new HoneyGuiCCodeGenerator(components, options);
  return await generator.generate();
}
