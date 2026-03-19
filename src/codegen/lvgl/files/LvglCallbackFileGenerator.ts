/**
 * LVGL 回调文件生成器
 * 生成独立的回调代码文件，每个回调函数体内包含保护区标记
 */

/** 回调函数实现描述 */
export interface CallbackImpl {
  /** 回调函数名，如 "btn1_event_cb" */
  name: string;
  /** C 函数签名，如 "void btn1_event_cb(lv_event_t * e)" */
  signature: string;
  /** 默认函数体（不含保护区标记，不含外层花括号） */
  body: string;
}

export class LvglCallbackFileGenerator {
  /**
   * 生成 {designName}_lvgl_callbacks.h
   * @param designName 设计名称
   * @param callbackFunctions 回调函数名列表
   */
  generateHeader(designName: string, callbackFunctions: string[]): string {
    const guard = `${designName.toUpperCase()}_LVGL_CALLBACKS_H`;
    let code = `/**\n`;
    code += ` * ${designName} LVGL callback declarations (auto-generated)\n`;
    code += ` */\n`;
    code += `#ifndef ${guard}\n`;
    code += `#define ${guard}\n\n`;
    code += `#include "lvgl.h"\n\n`;

    for (const fn of callbackFunctions) {
      code += `void ${fn}(lv_event_t * e);\n`;
    }

    code += `\n#endif /* ${guard} */\n`;
    return code;
  }

  /**
   * 生成 {designName}_lvgl_callbacks.c（含保护区标记）
   * @param designName 设计名称
   * @param callbackImpls 回调函数实现列表
   */
  generateImplementation(designName: string, callbackImpls: CallbackImpl[]): string {
    let code = `/**\n`;
    code += ` * ${designName} LVGL callback implementations (auto-generated)\n`;
    code += ` * User code inside protected areas will be preserved on regeneration.\n`;
    code += ` */\n`;
    code += `#include "${designName}_lvgl_callbacks.h"\n\n`;

    for (const impl of callbackImpls) {
      code += `${impl.signature}\n`;
      code += `{\n`;
      code += impl.body;
      code += `    /* USER CODE BEGIN ${impl.name} */\n`;
      code += `    /* USER CODE END ${impl.name} */\n`;
      code += `}\n\n`;
    }

    return code;
  }
}
