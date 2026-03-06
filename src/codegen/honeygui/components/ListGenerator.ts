/**
 * hg_list 组件代码生成器
 * 生成 gui_list_create() 调用和相关属性设置
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';
import { ComponentGeneratorFactory } from './index';
import { EventGeneratorFactory } from '../events';

export class ListGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    try {
      const indentStr = '    '.repeat(indent);
      const parentRef = context.getParentRef(component);
      let { x, y, width, height } = component.position;

      // 获取屏幕尺寸（从根 hg_view 获取）
      let screenWidth = 480;  // 默认值
      let screenHeight = 272; // 默认值
      
      // 查找根 hg_view 组件获取屏幕尺寸
      const allComponents = Array.from(context.componentMap.values());
      const rootView = allComponents.find(c => c.type === 'hg_view' && !c.parent);
      if (rootView) {
        screenWidth = rootView.position.width;
        screenHeight = rootView.position.height;
      }

      // 边界检查：确保 x + width <= screenWidth
      if (x + width > screenWidth) {
        width = Math.max(1, screenWidth - x);
      }

      // 边界检查：确保 y + height <= screenHeight
      if (y + height > screenHeight) {
        height = Math.max(1, screenHeight - y);
      }

      // 获取 list 属性
      // itemWidth 和 itemHeight 在 style group 中，但为了兼容性，同时检查 data 和 style
      const itemWidth = component.style?.itemWidth ?? component.data?.itemWidth ?? 100;
      const itemHeight = component.style?.itemHeight ?? component.data?.itemHeight ?? 100;
      const space = component.style?.space ?? component.data?.space ?? 10;  // 默认间距为 10
      const direction = component.style?.direction ?? component.data?.direction ?? 'VERTICAL';
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

      // 获取样式和数量（需要在创建后立即设置）
      const style = component.style?.style ?? 'LIST_CLASSIC';
      const noteNum = component.data?.noteNum ?? 5;

      // 生成创建代码，使用位置与大小中的宽高值
      let code = `${indentStr}${component.id} = gui_list_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height}, ${noteLength}, ${space}, ${dirEnum}, ${noteDesignCallback}, NULL, ${createBar ? 'true' : 'false'});\n`;
      
      // 立即设置样式和数量（必须在创建后立即设置，否则某些样式效果会失效）
      code += `${indentStr}gui_list_set_style(${component.id}, ${style});\n`;
      code += `${indentStr}gui_list_set_note_num(${component.id}, ${noteNum});\n`;

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

      // 获取 list 属性（style 和 noteNum 已经在 generateCreation 中设置）
      const autoAlign = component.data?.autoAlign ?? true;
      const inertia = component.data?.inertia ?? true;
      const loop = component.data?.loop ?? false;
      const offset = component.data?.offset ?? 0;
      const outScope = component.data?.outScope ?? 0;
      const style = component.style?.style ?? 'LIST_CLASSIC';
      const cardStackLocation = component.style?.cardStackLocation ?? 0;
      // 圆环半径：默认值根据方向决定（纵向=宽度，横向=高度）
      const direction = component.style?.direction ?? 'VERTICAL';
      const defaultCircleRadius = direction === 'VERTICAL' ? component.position.width : component.position.height;
      const circleRadius = component.style?.circleRadius ?? defaultCircleRadius;
      const enableAreaDisplay = component.data?.enableAreaDisplay ?? false;

      // 1. 条件生成 gui_list_set_auto_align()（仅当 autoAlign 为 true）
      if (autoAlign === true) {
        code += `${indentStr}gui_list_set_auto_align(${component.id}, true);\n`;
      }

      // 2. 条件生成 gui_list_set_inertia()（仅当 inertia 为 false）
      if (inertia === false) {
        code += `${indentStr}gui_list_set_inertia(${component.id}, false);\n`;
      }

      // 3. 条件生成 gui_list_enable_loop()（仅当 loop 为 true）
      // 循环滚动开启时，超出范围强制为 0，样式不能为 LIST_CARD
      if (loop === true) {
        code += `${indentStr}gui_list_enable_loop(${component.id}, true);\n`;
      }

      // 4. 条件生成 gui_list_set_offset()（仅当 offset 非零）
      if (offset !== 0) {
        code += `${indentStr}gui_list_set_offset(${component.id}, ${offset});\n`;
      }

      // 5. 条件生成 gui_list_set_out_scope()（仅当 outScope 非零且不是循环模式且不是 LIST_CARD）
      // 循环滚动或 LIST_CARD 样式时，超出范围必须为 0
      if (outScope !== 0 && !loop && style !== 'LIST_CARD') {
        code += `${indentStr}gui_list_set_out_scope(${component.id}, ${outScope});\n`;
      }

      // 6. LIST_CARD 样式特有：设置堆叠位置（总是调用，即使值为0）
      if (style === 'LIST_CARD') {
        code += `${indentStr}gui_list_set_card_stack_location(${component.id}, ${cardStackLocation});\n`;
      }

      // 7. LIST_CIRCLE 样式特有：设置圆环半径（总是调用，使用默认值或用户设置值）
      if (style === 'LIST_CIRCLE') {
        code += `${indentStr}gui_list_set_circle_radius(${component.id}, ${circleRadius});\n`;
      }

      // 8. 条件生成 gui_list_enable_area_display()（仅当 enableAreaDisplay 为 true）
      if (enableAreaDisplay === true) {
        code += `${indentStr}gui_list_enable_area_display(${component.id}, true);\n`;
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
      
      // 根据是否开启循环滚动，使用不同的 index 计算方式
      const loop = component.data?.loop ?? false;
      if (loop) {
        code += `    // 循环滚动模式：处理负索引\n`;
        code += `    int16_t index = note->index;\n`;
        code += `    gui_list_t *list = (gui_list_t *)obj->parent;\n`;
        code += `    uint8_t note_num = list->note_num;\n`;
        code += `    index %= note_num;\n`;
        code += `    index += note_num;\n`;
        code += `    index %= note_num;\n`;
      } else {
        code += `    uint16_t index = note->index;\n`;
      }
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
                // 传入 isFirstLevel=true，因为这是 list_item 的直接子组件
                code += this.generateChildComponentCode(child, context, getGenerator, 2, true);
              } catch (childError) {
                const childErrorMsg = childError instanceof Error ? childError.message : String(childError);
                console.error(`[ListGenerator] Failed to generate child component ${childId}: ${childErrorMsg}`);
                code += `        // ERROR: Failed to generate child component ${childId}\n`;
                code += `        // Reason: ${childErrorMsg}\n`;
              }
            }
          });
        }
        
        // 为 list_item 本身生成事件绑定（如果有）
        if (listItem.eventConfigs && listItem.eventConfigs.length > 0) {
          const eventGenerator = EventGeneratorFactory.getGenerator('hg_list_item');
          if (eventGenerator) {
            // 生成事件绑定代码
            let eventCode = eventGenerator.generateEventBindings(listItem, 2, context.componentMap);
            // 只替换 gui_obj_add_event_cb 的第一个参数（组件引用），保持回调函数名不变
            // 例如：gui_obj_add_event_cb(list_item_id, callback, ...) -> gui_obj_add_event_cb(obj, callback, ...)
            eventCode = eventCode.replace(
              new RegExp(`gui_obj_add_event_cb\\(${listItem.id},`, 'g'),
              'gui_obj_add_event_cb(obj,'
            );
            eventCode = eventCode.replace(
              new RegExp(`gui_msg_subscribe\\(${listItem.id},`, 'g'),
              'gui_msg_subscribe(obj,'
            );
            code += eventCode;
          }
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
   * 检查组件是否设置了按键事件
   */
  private hasKeyEvents(component: Component): boolean {
    if (!component.eventConfigs || component.eventConfigs.length === 0) {
      return false;
    }
    
    return component.eventConfigs.some(eventConfig => 
      (eventConfig.type === 'onKeyShortPress' || eventConfig.type === 'onKeyLongPress') && 
      eventConfig.keyName
    );
  }

  /**
   * 生成子组件的创建代码
   * @param component 要生成的组件
   * @param context 生成器上下文（包含父组件引用信息）
   * @param getGenerator 获取生成器的函数
   * @param indent 缩进级别
   * @param isFirstLevel 是否是 list_item 的第一层子组件（第一层使用 note，更深层使用实际父组件）
   */
  private generateChildComponentCode(
    component: Component, 
    context: GeneratorContext, 
    getGenerator: (type: string) => ComponentCodeGenerator, 
    indent: number,
    isFirstLevel: boolean = true
  ): string {
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

      // 决定使用哪个上下文：
      // - 第一层子组件：使用 note 作为父组件
      // - 更深层子组件：使用传入的 context（已经包含正确的父组件引用）
      let effectiveContext: GeneratorContext;
      
      if (isFirstLevel) {
        // 第一层：强制使用 note
        effectiveContext = {
          componentMap: context.componentMap,
          getParentRef: (_comp: Component) => '(gui_obj_t *)note',
          projectRoot: context.projectRoot
        };
      } else {
        // 更深层：使用传入的 context
        effectiveContext = context;
      }

      // 使用对应的生成器生成创建代码
      const generator = getGenerator(component.type);
      if (!generator) {
        throw new Error(`No generator found for component type: ${component.type}`);
      }

      let creationCode = generator.generateCreation(component, indent, effectiveContext);
      
      // 对于 hg_view 和 hg_window，需要处理子组件占位符
      if (component.type === 'hg_view' || component.type === 'hg_window') {
        let childrenCode = '';
        if (component.children && component.children.length > 0) {
          childrenCode += '\n';
          // 创建新的上下文，将父组件引用更新为当前组件
          const parentId = component.id;
          const nestedContext: GeneratorContext = {
            componentMap: context.componentMap,
            getParentRef: (_comp: Component) => `(gui_obj_t *)${parentId}`,
            projectRoot: context.projectRoot
          };
          component.children.forEach(childId => {
            const child = context.componentMap.get(childId);
            if (child) {
              try {
                // 传入 isFirstLevel=false，因为这些是 window/view 的子组件，不是 list_item 的直接子组件
                childrenCode += this.generateChildComponentCode(child, nestedContext, getGenerator, indent, false);
              } catch (nestedError) {
                const nestedErrorMsg = nestedError instanceof Error ? nestedError.message : String(nestedError);
                console.error(`[ListGenerator] Failed to generate nested child component ${childId}: ${nestedErrorMsg}`);
                childrenCode += `${indentStr}// ERROR: Failed to generate nested child ${childId}\n`;
                childrenCode += `${indentStr}// Reason: ${nestedErrorMsg}\n`;
              }
            }
          });
        }
        // 替换占位符（包括子组件和事件绑定）
        creationCode = creationCode.replace(/__CHILDREN_PLACEHOLDER__/g, childrenCode);
        creationCode = creationCode.replace(/__EVENT_BINDINGS_PLACEHOLDER__/g, ''); // window 在 list 中不需要事件绑定
        code += creationCode;
      } else {
        // 普通组件：直接添加创建代码
        code += creationCode;
        
        // 生成属性设置代码
        code += generator.generatePropertySetters(component, indent, effectiveContext);

        // 双态按钮：生成点击事件绑定
        if (component.type === 'hg_button' && (component.data?.toggleMode === true || component.data?.toggleMode === 'true')) {
          const buttonGenerator = ComponentGeneratorFactory.getGenerator('hg_button');
          if ('generateEventBinding' in buttonGenerator) {
            code += (buttonGenerator as any).generateEventBinding(component, indent);
          }
        }

        // 按键效果：为 rect、circle、image 生成事件绑定
        if (['hg_rect', 'hg_circle', 'hg_image'].includes(component.type)) {
          const buttonMode = component.data?.buttonMode;
          if (buttonMode && buttonMode !== 'none') {
            const generator = ComponentGeneratorFactory.getGenerator(component.type);
            if ('generateEventBinding' in generator) {
              code += (generator as any).generateEventBinding(component, indent);
            }
          }
        }

        // 生成事件绑定代码
        const eventGenerator = EventGeneratorFactory.getGenerator(component.type);
        if (eventGenerator && component.eventConfigs && component.eventConfigs.length > 0) {
          code += eventGenerator.generateEventBindings(component, indent, context.componentMap);
        }

        // 如果组件设置了按键事件，添加焦点设置
        if (this.hasKeyEvents(component)) {
          code += `${indentStr}gui_obj_focus_set((gui_obj_t *)${component.id});\n`;
        }

        // 递归生成子组件（如果有）
        if (component.children && component.children.length > 0) {
          // 创建新的上下文，将父组件引用更新为当前组件
          const parentId = component.id;
          const nestedContext: GeneratorContext = {
            componentMap: context.componentMap,
            getParentRef: (_comp: Component) => `(gui_obj_t *)${parentId}`,
            projectRoot: context.projectRoot
          };
          component.children.forEach(childId => {
            const child = context.componentMap.get(childId);
            if (child) {
              try {
                // 传入 isFirstLevel=false，因为这些是普通组件的子组件
                code += this.generateChildComponentCode(child, nestedContext, getGenerator, indent, false);
              } catch (nestedError) {
                const nestedErrorMsg = nestedError instanceof Error ? nestedError.message : String(nestedError);
                console.error(`[ListGenerator] Failed to generate nested child component ${childId}: ${nestedErrorMsg}`);
                code += `${indentStr}// ERROR: Failed to generate nested child ${childId}\n`;
                code += `${indentStr}// Reason: ${nestedErrorMsg}\n`;
              }
            }
          });
        }
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
