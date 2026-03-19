/**
 * LVGL 源文件生成器
 * 从 LvglCCodeGenerator.generateSource() 提取
 * 生成 {designName}_lvgl_ui.c 内容
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglComponentGeneratorFactory } from '../components';

export class LvglSourceFileGenerator {
  /**
   * 生成 {designName}_lvgl_ui.c 文件内容
   * @param designName 设计名称
   * @param orderedComponents 按创建顺序排列的组件列表
   * @param ctx 生成器上下文
   * @param imageVars 内置图片资源变量名列表
   * @param fontVars 内置字体资源变量名列表
   * @param getParentRef 获取父组件引用的函数
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

    // 内置图片资源声明
    if (imageVars.length > 0) {
      code += `// LVGL built-in image resource declarations\n`;
      imageVars.forEach(v => { code += `extern const lv_image_dsc_t ${v};\n`; });
      code += `\n`;
    }

    // 内置字体资源声明
    if (fontVars.length > 0) {
      code += `// LVGL built-in font resource declarations\n`;
      fontVars.forEach(v => { code += `extern const lv_font_t ${v};\n`; });
      code += `\n`;
    }

    // 遍历所有已注册的生成器，生成全局定义（事件回调已分离到 callbacks 文件）
    for (const [, generator] of LvglComponentGeneratorFactory.getAllGenerators()) {
      if (generator.generateGlobalDefinitions) {
        code += generator.generateGlobalDefinitions(orderedComponents);
      }
    }

    // 组件句柄定义
    code += `// Component handle definitions\n`;
    orderedComponents.forEach(c => {
      code += `lv_obj_t * ${c.id} = NULL;\n`;
    });

    // ui_create 函数
    code += `\nvoid ${designName}_lvgl_ui_create(lv_obj_t * parent)\n`;
    code += `{\n`;
    code += `    if(parent == NULL) {\n`;
    code += `        parent = lv_screen_active();\n`;
    code += `    }\n\n`;

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

    code += `}\n`;
    return code;
  }
}
