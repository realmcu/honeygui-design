/**
 * HoneyGUI code generator module entry point
 */

export { HoneyGuiCCodeGenerator, Component, CodeGenOptions, CodeGenResult } from './HoneyGuiCCodeGenerator';
export { HoneyGuiApiMapper, HoneyGuiApiMapping, PropertySetter, EventHandler } from './HoneyGuiApiMapper';

/**
 * Convenience function: generate C code from a component array
 */
import { HoneyGuiCCodeGenerator, Component, CodeGenOptions, CodeGenResult } from './HoneyGuiCCodeGenerator';

export async function generateHoneyGuiCode(
  components: Component[],
  options: CodeGenOptions
): Promise<CodeGenResult> {
  const generator = new HoneyGuiCCodeGenerator(components, options);
  return await generator.generate();
}
