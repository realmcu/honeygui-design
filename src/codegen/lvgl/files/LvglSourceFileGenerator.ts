/**
 * LVGL source file generator
 * Extracted from LvglCCodeGenerator.generateSource()
 * Generates {designName}_lvgl_ui.c content
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglComponentGeneratorFactory } from '../components';

export class LvglSourceFileGenerator {
  /**
   * Generate {designName}_lvgl_ui.c file content
   * @param designName Design name
   * @param orderedComponents Components ordered by creation sequence
   * @param ctx Generator context
   * @param imageVars Built-in image resource variable name list
   * @param fontVars Built-in font resource variable name list
   * @param getParentRef Function to get parent component reference
   */
  generate(
    designName: string,
    orderedComponents: Component[],
    ctx: LvglGeneratorContext,
    imageVars: string[],
    fontVars: string[],
    getParentRef: (component: Component) => string
  ): string {
    let code = `/**\n`;
    code += ` * ${designName} LVGL UI implementation (auto-generated)\n`;
    code += ` * Generated at: ${new Date().toISOString()}\n`;
    code += ` */\n`;
    code += `#include "${designName}_lvgl_ui.h"\n`;
    code += `#include "${designName}_lvgl_callbacks.h"\n\n`;

    // Built-in image resource declarations
    if (imageVars.length > 0) {
      code += `// LVGL built-in image resource declarations\n`;
      imageVars.forEach(v => { code += `extern const lv_image_dsc_t ${v};\n`; });
      code += `\n`;
    }

    // Built-in font resource declarations
    if (fontVars.length > 0) {
      code += `// LVGL built-in font resource declarations\n`;
      fontVars.forEach(v => { code += `extern const lv_font_t ${v};\n`; });
      code += `\n`;
    }

    // Iterate all registered generators to produce global definitions (event callbacks separated to callbacks file)
    for (const [, generator] of LvglComponentGeneratorFactory.getAllGenerators()) {
      if (generator.generateGlobalDefinitions) {
        code += generator.generateGlobalDefinitions(orderedComponents);
      }
    }

    // Component handle definitions
    code += `// Component handle definitions\n`;
    orderedComponents.forEach(c => {
      code += `lv_obj_t * ${c.id} = NULL;\n`;
    });

    // ui_create function (screens are created internally, no parent needed)
    code += `\nvoid ${designName}_lvgl_ui_create(void)\n`;
    code += `{\n`;

    orderedComponents.forEach(component => {
      const parentRef = getParentRef(component);
      const generator = LvglComponentGeneratorFactory.getGenerator(component.type);

      code += `    // ${component.id} (${component.type})\n`;
      code += generator.generateCreation(component, parentRef, ctx);

      if (component.visible === false) {
        code += `    lv_obj_add_flag(${component.id}, LV_OBJ_FLAG_HIDDEN);\n`;
      }
      if (component.enabled === false) {
        code += `    lv_obj_add_state(${component.id}, LV_STATE_DISABLED);\n`;
      }
      code += `\n`;
    });

    // Bind radio mutual exclusion event handler on parent containers
    const radioComponents = orderedComponents.filter(c => c.type === 'hg_radio');
    if (radioComponents.length > 0) {
      const parentIds = new Set<string>();
      for (const radio of radioComponents) {
        if (radio.parent && !parentIds.has(radio.parent)) {
          parentIds.add(radio.parent);
          code += `    // Radio group mutual exclusion for ${radio.parent}\n`;
          code += `    lv_obj_add_event_cb(${radio.parent}, radio_event_handler, LV_EVENT_CLICKED, &${radio.parent}_radio_active_index);\n\n`;
        }
      }
    }

    code += `}\n`;
    return code;
  }
}
