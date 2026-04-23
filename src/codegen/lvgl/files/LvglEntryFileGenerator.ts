/**
 * LVGL entry file generator
 * Generates lvgl_generated_ui.h and lvgl_generated_ui.c content
 *
 * Supports multi-design projects: calls all designs' UI create functions,
 * then explicitly loads the specified entry screen (similar to HoneyGUI's
 * EntryFileGenerator which uses entry="true" to determine the initial view).
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
   *
   * All designs' UI create functions are called to create all screens.
   * Then the specified entry view is explicitly loaded as the active screen.
   *
   * @param entryDesignName The current design name (used as fallback for single-design)
   * @param allDesignNames All design names in the project
   * @param entryViewId The entry view ID to load as the initial screen
   */
  generateSource(entryDesignName: string, allDesignNames?: string[], entryViewId?: string): string {
    const designNames = allDesignNames || [entryDesignName];

    let code = `/**\n`;
    code += ` * LVGL generated entry implementation (auto-generated)\n`;
    code += ` * Generated at: ${new Date().toISOString()}\n`;
    code += ` */\n`;
    code += `#include "lvgl_generated_ui.h"\n`;

    // Include all design headers
    for (const name of designNames) {
      code += `#include "${name}_lvgl_ui.h"\n`;
    }

    code += `\n`;
    code += `void lvgl_generated_ui_create(void)\n`;
    code += `{\n`;

    // Call all designs' UI create functions (creates all screens)
    for (const name of designNames) {
      code += `    ${name}_lvgl_ui_create();\n`;
    }

    // Explicitly load the entry screen (overrides any previous lv_screen_load calls)
    if (entryViewId) {
      code += `\n    /* Load the entry screen */\n`;
      code += `    lv_screen_load(${entryViewId});\n`;
    }

    code += `}\n`;
    return code;
  }
}
