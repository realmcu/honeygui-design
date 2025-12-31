/**
 * hg_view 组件代码生成器
 * 使用 GUI_VIEW_INSTANCE 宏生成视图代码
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';
import { LabelGenerator, FontInitInfo } from './LabelGenerator';

// 事件类型到 GUI_EVENT 的映射（用于 view 的 switch 事件）
const VIEW_SWITCH_EVENT_MAP: Record<string, string> = {
  'onSwipeLeft': 'GUI_EVENT_TOUCH_MOVE_LEFT',
  'onSwipeRight': 'GUI_EVENT_TOUCH_MOVE_RIGHT',
  'onSwipeUp': 'GUI_EVENT_TOUCH_MOVE_UP',
  'onSwipeDown': 'GUI_EVENT_TOUCH_MOVE_DOWN',
};

export class ViewGenerator implements ComponentCodeGenerator {
  
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const name = component.name;

    let code = '';
    
    // 生成 switch_out 回调
    code += `${indentStr}static void ${name}_switch_out(gui_view_t *view)\n`;
    code += `${indentStr}{\n`;
    code += `${indentStr}    GUI_UNUSED(view);\n`;
    code += `${indentStr}}\n\n`;
    
    // 生成 switch_in 回调
    code += `${indentStr}static void ${name}_switch_in(gui_view_t *view)\n`;
    code += `${indentStr}{\n`;
    
    // 收集当前 view 下所有需要初始化的点阵字体
    const fontInitInfos = this.collectBitmapFonts(component, context);
    if (fontInitInfos.length > 0) {
      code += `${indentStr}    // 初始化点阵字体（从文件系统加载）\n`;
      for (const info of fontInitInfos) {
        code += `${indentStr}    gui_font_mem_init_fs((uint8_t *)"${info.fontPath}");\n`;
      }
      code += '\n';
    }
    
    // 注册视图切换事件
    const switchViewEvents = this.extractSwitchViewEvents(component, context);
    if (switchViewEvents.length > 0) {
      switchViewEvents.forEach(({ guiEvent, targetName, switchOutStyle, switchInStyle }) => {
        code += `${indentStr}    gui_view_switch_on_event(view, "${targetName}", ${switchOutStyle}, ${switchInStyle}, ${guiEvent});\n`;
      });
    } else if (fontInitInfos.length === 0) {
      // 只有在没有字体初始化且没有视图切换事件时才添加 GUI_UNUSED
      code += `${indentStr}    GUI_UNUSED(view);\n`;
    }
    
    // 子组件创建代码由主生成器处理（通过 childrenCode 回调）
    code += `__CHILDREN_PLACEHOLDER__`;
    
    // 为所有带时间格式的 label 创建定时器
    const timeLabels = this.collectTimeLabels(component, context);
    if (timeLabels.length > 0) {
      code += `\n${indentStr}    // 创建时间更新定时器\n`;
      timeLabels.forEach(labelId => {
        const labelComp = context.componentMap.get(labelId);
        const interval = this.getTimerInterval(labelComp?.data?.timeFormat);
        code += `${indentStr}    gui_obj_create_timer(GUI_BASE(${labelId}), ${interval}, true, ${labelId}_time_update_cb);\n`;
      });
    }
    
    code += `${indentStr}}\n`;
    
    // GUI_VIEW_INSTANCE 宏调用
    code += `${indentStr}GUI_VIEW_INSTANCE("${name}", false, ${name}_switch_in, ${name}_switch_out);\n`;

    return code;
  }

  generatePropertySetters(_component: Component, _indent: number, _context: GeneratorContext): string {
    // view 组件没有额外的属性设置
    return '';
  }

  /**
   * 从 eventConfigs 中提取 switchView 事件
   */
  private extractSwitchViewEvents(component: Component, context: GeneratorContext): Array<{
    guiEvent: string;
    targetName: string;
    switchOutStyle: string;
    switchInStyle: string;
  }> {
    const result: Array<{
      guiEvent: string;
      targetName: string;
      switchOutStyle: string;
      switchInStyle: string;
    }> = [];

    if (!component.eventConfigs) return result;

    component.eventConfigs.forEach(eventConfig => {
      const guiEvent = VIEW_SWITCH_EVENT_MAP[eventConfig.type];
      if (!guiEvent) return;

      eventConfig.actions.forEach(action => {
        if (action.type === 'switchView' && action.target) {
          const targetComponent = context.componentMap.get(action.target);
          const targetName = targetComponent?.name || action.target;
          result.push({
            guiEvent,
            targetName,
            switchOutStyle: action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION',
            switchInStyle: action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION',
          });
        }
      });
    });

    return result;
  }

  /**
   * 收集当前 view 下所有带时间格式的 label 组件
   */
  private collectTimeLabels(component: Component, context: GeneratorContext): string[] {
    const timeLabels: string[] = [];
    
    const collectRecursive = (comp: Component) => {
      // 检查当前组件是否是带时间格式的 label
      if (comp.type === 'hg_label' && comp.data?.timeFormat) {
        timeLabels.push(comp.id);
      }
      
      // 递归检查子组件
      if (comp.children) {
        comp.children.forEach(childId => {
          const child = context.componentMap.get(childId);
          if (child) {
            collectRecursive(child);
          }
        });
      }
    };
    
    collectRecursive(component);
    return timeLabels;
  }

  /**
   * 收集当前 view 下所有需要初始化的点阵字体
   * 只有点阵字体需要预加载，矢量字体不需要
   */
  private collectBitmapFonts(component: Component, context: GeneratorContext): FontInitInfo[] {
    const allComponents: Component[] = [];
    
    const collectRecursive = (comp: Component) => {
      allComponents.push(comp);
      
      // 递归收集子组件
      if (comp.children) {
        comp.children.forEach(childId => {
          const child = context.componentMap.get(childId);
          if (child) {
            collectRecursive(child);
          }
        });
      }
    };
    
    collectRecursive(component);
    
    // 使用 LabelGenerator 的静态方法收集字体信息
    return LabelGenerator.collectFontInitInfos(allComponents);
  }

  /**
   * 根据时间格式获取定时器间隔（毫秒）
   */
  private getTimerInterval(timeFormat?: string): number {
    if (!timeFormat) return 1000;
    
    switch (timeFormat) {
      case 'HH:mm:ss':
      case 'YYYY-MM-DD HH:mm:ss':
        return 1000; // 1 秒
      case 'HH:mm':
      case 'MM-DD HH:mm':
        return 1000; // 1 秒（虽然只显示分钟，但保持 1 秒更新以便及时切换）
      case 'YYYY-MM-DD':
        return 60000; // 60 秒（日期变化慢，可以降低更新频率）
      default:
        return 1000;
    }
  }
}
