/**
 * LVGL 入口文件生成器
 * 从 LvglCCodeGenerator.generateEntryHeader() 和 generateEntrySource() 提取
 * 生成 lvgl_generated_ui.h 和 lvgl_generated_ui.c 内容
 */

export class LvglEntryFileGenerator {
  /**
   * 生成 lvgl_generated_ui.h 文件内容
   */
  generateHeader(): string {
    let code = `/**\n`;
    code += ` * LVGL generated entry (auto-generated)\n`;
    code += ` * Generated at: ${new Date().toISOString()}\n`;
    code += ` */\n`;
    code += `#ifndef LVGL_GENERATED_UI_H\n`;
    code += `#define LVGL_GENERATED_UI_H\n\n`;
    code += `#include "lvgl.h"\n\n`;
    code += `#ifdef __cplusplus\n`;
    code += `extern "C" {\n`;
    code += `#endif\n\n`;
    code += `void lvgl_generated_ui_create(lv_obj_t * parent);\n\n`;
    code += `#ifdef __cplusplus\n`;
    code += `}\n`;
    code += `#endif\n\n`;
    code += `#endif /* LVGL_GENERATED_UI_H */\n`;
    return code;
  }

  /**
   * 生成 lvgl_generated_ui.c 文件内容
   */
  generateSource(designName: string): string {
    let code = `/**\n`;
    code += ` * LVGL generated entry implementation (auto-generated)\n`;
    code += ` * Generated at: ${new Date().toISOString()}\n`;
    code += ` */\n`;
    code += `#include "lvgl_generated_ui.h"\n`;
    code += `#include "${designName}_lvgl_ui.h"\n\n`;
    code += `void lvgl_generated_ui_create(lv_obj_t * parent)\n`;
    code += `{\n`;
    code += `    ${designName}_lvgl_ui_create(parent);\n`;
    code += `}\n`;
    return code;
  }
}
