/**
 * LVGL header file generator
 * Extracted from LvglCCodeGenerator.generateHeader()
 * Generates {designName}_lvgl_ui.h content
 */
import { Component } from '../../../hml/types';

export class LvglHeaderFileGenerator {
  /**
   * Generate {designName}_lvgl_ui.h file content
   */
  generate(designName: string, orderedComponents: Component[]): string {
    const guard = `${designName.toUpperCase()}_LVGL_UI_H`;

    let code = `/**\n`;
    code += ` * ${designName} LVGL UI definitions (auto-generated)\n`;
    code += ` * Generated at: ${new Date().toISOString()}\n`;
    code += ` */\n`;
    code += `#ifndef ${guard}\n`;
    code += `#define ${guard}\n\n`;
    code += `#include "lvgl.h"\n\n`;
    code += `#ifdef __cplusplus\n`;
    code += `extern "C" {\n`;
    code += `#endif\n\n`;

    code += `// Component handles\n`;
    orderedComponents.forEach(c => {
      code += `extern lv_obj_t * ${c.id};\n`;
    });

    code += `\nvoid ${designName}_lvgl_ui_create(lv_obj_t * parent);\n\n`;
    code += `#ifdef __cplusplus\n`;
    code += `}\n`;
    code += `#endif\n\n`;
    code += `#endif /* ${guard} */\n`;
    return code;
  }
}
