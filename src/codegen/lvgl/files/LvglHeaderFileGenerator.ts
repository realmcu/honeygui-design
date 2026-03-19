/**
 * LVGL 头文件生成器
 * 从 LvglCCodeGenerator.generateHeader() 提取
 * 生成 {designName}_lvgl_ui.h 内容
 */
import { Component } from '../../../hml/types';

export class LvglHeaderFileGenerator {
  /**
   * 生成 {designName}_lvgl_ui.h 文件内容
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
