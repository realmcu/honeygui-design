/**
 * LVGL entry file generator
 * Extracted from LvglCCodeGenerator.generateEntryHeader() and generateEntrySource()
 * Generates lvgl_generated_ui.h and lvgl_generated_ui.c content
 */

export class LvglEntryFileGenerator {
  /**
   * Generate lvgl_generated_ui.h file content
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
    code += `void lvgl_generated_ui_create(void);\n\n`;
    code += `#ifdef __cplusplus\n`;
    code += `}\n`;
    code += `#endif\n\n`;
    code += `#endif /* LVGL_GENERATED_UI_H */\n`;
    return code;
  }

  /**
   * Generate lvgl_generated_ui.c file content
   */
  generateSource(designName: string): string {
    let code = `/**\n`;
    code += ` * LVGL generated entry implementation (auto-generated)\n`;
    code += ` * Generated at: ${new Date().toISOString()}\n`;
    code += ` */\n`;
    code += `#include "lvgl_generated_ui.h"\n`;
    code += `#include "${designName}_lvgl_ui.h"\n\n`;
    code += `void lvgl_generated_ui_create(void)\n`;
    code += `{\n`;
    code += `    ${designName}_lvgl_ui_create();\n`;
    code += `}\n`;
    return code;
  }
}
