/**
 * hg_list 组件代码生成器
 * 生成 gui_list_create() 调用和相关属性设置
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class ListGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    try {
      const indentStr = '    '.repeat(indent);
      const parentRef = context.getParentRef(component);
      const { x, y, width, height } = component.position;

      // 获取 list 属性
      const itemWidth = component.data?.itemWidth ?? 100;
      const itemHeight = component.data?.itemHeight ?? 100;
      const space = component.data?.space ?? 0;
      const direction = component.data?.direction ?? 'VERTICAL';
      const createBar = component.data?.createBar ?? false;

      // 验证必需属性
      if (!component.id) {
        throw new Error('List component missing required id');
      }
      if (!component.name) {
        throw new Error(`List component ${component.id} missing required name`);
      }

      // 根据 direction 确定 note_length
      const noteLength = direction === 'VERTICAL' ? itemHeight : itemWidth;

      // 根据 direction 生成 LIST_DIR 枚举值
      const dirEnum = direction === 'VERTICAL' ? 'VERTICAL' : 'HORIZONTAL';

      // 生成 note_design 回调函数名
      const noteDesignCallback = `${component.id}_note_design`;

      // list 控件的宽高建议设置为 0，自动适应父容器
      // 这样可以确保 list 在父容器内正常滚动
      const listWidth = 0;
      const listHeight = 0;

      // 生成创建代码
      let code = `${indentStr}${component.id} = gui_list_create(${parentRef}, "${component.name}", ${x}, ${y}, ${listWidth}, ${listHeight}, ${noteLength}, ${space}, ${dirEnum}, ${noteDesignCallback}, NULL, ${createBar ? 'true' : 'false'});\n`;

      return code;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ListGenerator] generateCreation failed for component ${component.id}: ${errorMsg}`);
      
      // 返回带有错误注释的代码
      const indentStr = '    '.repeat(indent);
      return `${indentStr}// ERROR: Failed to generate list creation code for ${component.id}\n` +
             `${indentStr}// Reason: ${errorMsg}\n` +
             `${indentStr}// Please check the component configuration\n`;
    }
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    try {
      const indentStr = '    '.repeat(indent);
      let code = '';

      // 验证组件 ID
      if (!component.id) {
        throw new Error('List component missing required id');
      }

      // 获取 list 属性
      const noteNum = component.data?.noteNum ?? 5;
      const style = component.style?.style ?? 'LIST_CLASSIC';  // 从 style 对象中读取
      const autoAlign = component.data?.autoAlign ?? true;
      const inertia = component.data?.inertia ?? true;
      const loop = component.data?.loop ?? false;
      const offset = component.data?.offset ?? 0;
      const outScope = component.data?.outScope ?? 0;

      // 验证属性值
      if (noteNum < 1) {
        throw new Error(`Invalid noteNum value: ${noteNum} (must be >= 1)`);
      }

      // 1. 生成 gui_list_set_note_num() 调用
      code += `${indentStr}gui_list_set_note_num(${component.id}, ${noteNum});\n`;

      // 2. 生成 gui_list_set_style() 调用（转换样式名称为枚举值）
      code += `${indentStr}gui_list_set_style(${component.id}, ${style});\n`;

      // 3. 条件生成 gui_list_set_auto_align()（仅当 autoAlign 为 true）
      if (autoAlign === true) {
        code += `${indentStr}gui_list_set_auto_align(${component.id}, true);\n`;
      }

      // 4. 条件生成 gui_list_set_inertia()（仅当 inertia 为 false）
      if (inertia === false) {
        code += `${indentStr}gui_list_set_inertia(${component.id}, false);\n`;
      }

      // 5. 条件生成 gui_list_enable_loop()（仅当 loop 为 true）
      if (loop === true) {
        code += `${indentStr}gui_list_enable_loop(${component.id}, true);\n`;
      }

      // 6. 条件生成 gui_list_set_offset()（仅当 offset 非零）
      if (offset !== 0) {
        code += `${indentStr}gui_list_set_offset(${component.id}, ${offset});\n`;
      }

      // 7. 条件生成 gui_list_set_out_scope()（仅当 outScope 非零）
      if (outScope !== 0) {
        code += `${indentStr}gui_list_set_out_scope(${component.id}, ${outScope});\n`;
      }

      return code;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ListGenerator] generatePropertySetters failed for component ${component.id}: ${errorMsg}`);
      
      // 返回带有错误注释的代码
      const indentStr = '    '.repeat(indent);
      return `${indentStr}// ERROR: Failed to generate list property setters for ${component.id}\n` +
             `${indentStr}// Reason: ${errorMsg}\n` +
             `${indentStr}// Please check the component properties\n`;
    }
  }

  /**
   * 生成 note_design 回调函数
   * 用于设计每个 list_item 的内容
   */
  generateNoteDesignCallback(component: Component, context: GeneratorContext, getGenerator: (type: string) => ComponentCodeGenerator): string {
    try {
      const callbackName = `${component.id}_note_design`;
      let code = '';

      // 验证组件 ID
      if (!component.id) {
        throw new Error('List component missing required id');
      }

      // 获取所有 list_item 子组件
      const listItems = this.getAllListItems(component, context);
      
      if (listItems.length === 0) {
        // 没有 list_item，生成空回调
        code += `// note_design 回调函数声明\n`;
        code += `static void ${callbackName}(gui_obj_t *obj, void *param);\n\n`;
        code += `// note_design 回调函数实现\n`;
        code += `static void ${callbackName}(gui_obj_t *obj, void *param)\n`;
        code += `{\n`;
        code += `    GUI_UNUSED(obj);\n`;
        code += `    GUI_UNUSED(param);\n`;
        code += `    // 没有子组件\n`;
        code += `}\n\n`;
        return code;
      }

      // 生成回调函数声明
      code += `// note_design 回调函数声明\n`;
      code += `static void ${callbackName}(gui_obj_t *obj, void *param);\n\n`;

      // 生成回调函数实现
      code += `// note_design 回调函数实现\n`;
      code += `static void ${callbackName}(gui_obj_t *obj, void *param)\n`;
      code += `{\n`;
      code += `    GUI_UNUSED(param);\n`;
      code += `    \n`;
      code += `    // 转换 obj 为 gui_list_note_t * 类型\n`;
      code += `    gui_list_note_t *note = (gui_list_note_t *)obj;\n`;
      code += `    uint16_t index = note->index;\n`;
      code += `    \n`;

      // 生成 switch-case 结构，根据 index 创建不同的内容
      code += `    // 根据 index 创建不同的 list_item 内容\n`;
      code += `    switch (index)\n`;
      code += `    {\n`;

      // 为每个 list_item 生成一个 case
      listItems.forEach((listItem, idx) => {
        code += `    case ${idx}:\n`;
        code += `    {\n`;
        
        // 生成该 list_item 的子组件
        if (listItem.children && listItem.children.length > 0) {
          listItem.children.forEach(childId => {
            const child = context.componentMap.get(childId);
            if (child) {
              try {
                code += this.generateChildComponentCode(child, context, getGenerator, 2);
              } catch (childError) {
                const childErrorMsg = childError instanceof Error ? childError.message : String(childError);
                console.error(`[ListGenerator] Failed to generate child component ${childId}: ${childErrorMsg}`);
                code += `        // ERROR: Failed to generate child component ${childId}\n`;
                code += `        // Reason: ${childErrorMsg}\n`;
              }
            }
          });
        }
        
        code += `        break;\n`;
        code += `    }\n`;
      });

      // 添加 default case
      code += `    default:\n`;
      code += `        break;\n`;
      code += `    }\n`;

      code += `}\n\n`;

      return code;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ListGenerator] generateNoteDesignCallback failed for component ${component.id}: ${errorMsg}`);
      
      // 返回带有错误注释的回调函数
      const callbackName = component.id ? `${component.id}_note_design` : 'unknown_note_design';
      return `// ERROR: Failed to generate note_design callback for ${component.id}\n` +
             `// Reason: ${errorMsg}\n` +
             `static void ${callbackName}(gui_obj_t *obj, void *param)\n` +
             `{\n` +
             `    GUI_UNUSED(obj);\n` +
             `    GUI_UNUSED(param);\n` +
             `    // Please check the list component configuration\n` +
             `}\n\n`;
    }
  }

  /**
   * 获取所有 list_item 子组件（按顺序）
   */
  private getAllListItems(listComponent: Component, context: GeneratorContext): Component[] {
    if (!listComponent.children || listComponent.children.length === 0) {
      return [];
    }

    const listItems: Component[] = [];
    
    // 查找所有 hg_list_item 类型的子组件
    for (const childId of listComponent.children) {
      const child = context.componentMap.get(childId);
      if (child && child.type === 'hg_list_item') {
        listItems.push(child);
      }
    }

    // 按 index 排序（如果有 index 属性）
    listItems.sort((a, b) => {
      const indexA = (a.data?.index as number) ?? 0;
      const indexB = (b.data?.index as number) ?? 0;
      return indexA - indexB;
    });

    return listItems;
  }

  /**
   * 生成子组件的创建代码
   * 使用 note 作为父组件
   */
  private generateChildComponentCode(component: Component, context: GeneratorContext, getGenerator: (type: string) => ComponentCodeGenerator, indent: number): string {
    try {
      const indentStr = '    '.repeat(indent);
      let code = '';

      // 验证组件
      if (!component.id) {
        throw new Error('Child component missing required id');
      }
      if (!component.type) {
        throw new Error(`Child component ${component.id} missing required type`);
      }

      // 添加注释
      code += `${indentStr}// 创建 ${component.name || component.id} (${component.type})\n`;

      // 创建一个修改后的上下文，将父组件引用改为 note
      const modifiedContext: GeneratorContext = {
        componentMap: context.componentMap,
        getParentRef: () => '(gui_obj_t *)note'
      };

      // 使用对应的生成器生成创建代码
      const generator = getGenerator(component.type);
      if (!generator) {
        throw new Error(`No generator found for component type: ${component.type}`);
      }

      code += generator.generateCreation(component, indent, modifiedContext);

      // 生成属性设置代码
      code += generator.generatePropertySetters(component, indent, modifiedContext);

      // 递归生成子组件（如果有）
      if (component.children && component.children.length > 0) {
        component.children.forEach(childId => {
          const child = context.componentMap.get(childId);
          if (child) {
            try {
              code += this.generateChildComponentCode(child, context, getGenerator, indent);
            } catch (nestedError) {
              const nestedErrorMsg = nestedError instanceof Error ? nestedError.message : String(nestedError);
              console.error(`[ListGenerator] Failed to generate nested child component ${childId}: ${nestedErrorMsg}`);
              code += `${indentStr}// ERROR: Failed to generate nested child ${childId}\n`;
              code += `${indentStr}// Reason: ${nestedErrorMsg}\n`;
            }
          }
        });
      }

      return code;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ListGenerator] generateChildComponentCode failed for component ${component.id}: ${errorMsg}`);
      
      // 返回带有错误注释的代码
      const indentStr = '    '.repeat(indent);
      return `${indentStr}// ERROR: Failed to generate child component code for ${component.id}\n` +
             `${indentStr}// Reason: ${errorMsg}\n`;
    }
  }
}
