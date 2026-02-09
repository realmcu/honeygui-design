/**
 * hg_window 组件代码生成器
 * 对应 HoneyGUI 的 gui_win API
 * 
 * 与 hg_view 的区别：
 * - 使用 gui_win_create 而不是 GUI_VIEW_INSTANCE
 * - 支持 blur 效果（gui_win_enable_blur, gui_win_set_blur_degree）
 * - 不支持视图切换功能
 * 
 * 句柄类型：gui_obj_t * (在句柄定义时就使用此类型)
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class WindowGenerator implements ComponentCodeGenerator {
  
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    
    // 获取位置和尺寸
    const { x, y, width, height } = component.position;
    
    // 获取 blur 相关属性
    const enableBlur = component.data?.enableBlur ?? false;
    const blurDegree = component.data?.blurDegree ?? 225; // 默认值 225
    
    let code = '';
    
    // 创建 window
    code += `${indentStr}${component.id} = gui_win_create(${parentRef}, "${component.id}", ${x}, ${y}, ${width}, ${height});\n`;
    
    // 设置 blur 效果
    if (enableBlur) {
      code += `${indentStr}gui_win_enable_blur((gui_win_t *)${component.id}, true);\n`;
      code += `${indentStr}gui_win_set_blur_degree((gui_win_t *)${component.id}, ${blurDegree});\n`;
    }
    
    // 设置可见属性（与 hg_image 保持一致）
    if (component.visible !== undefined) {
      code += `${indentStr}gui_obj_show((gui_obj_t *)${component.id}, ${component.visible ? 'true' : 'false'});\n`;
    }

    // 生成定时器绑定代码（在子组件之前）
    if (context.generateTimerBindings) {
      code += context.generateTimerBindings(component, indent);
    }

    
    // Window 中的时间标签初始化代码
    // 注意：不生成 time_t now 和 struct tm *t 的声明，因为它们已经在 view 的 switch_in 函数中声明了
    // 这里只生成 sprintf 调用来初始化时间字符串
    const timeLabels = this.collectTimeLabels(component, context);
    if (timeLabels.length > 0) {
      code += `\n${indentStr}// 初始化时间字符串（使用 view 中已声明的 now 和 t 变量）\n`;
      code += `${indentStr}if (t != NULL)\n`;
      code += `${indentStr}{\n`;
      timeLabels.forEach(labelId => {
        const labelComp = context.componentMap.get(labelId);
        const timeFormat = labelComp?.data?.timeFormat;
        const formatCode = this.getTimeFormatCode(timeFormat);
        code += `${indentStr}    sprintf(${labelId}_time_str, "${formatCode.format}", ${formatCode.args});\n`;
      });
      code += `${indentStr}}\n`;
    }
    
    // 子组件创建代码由主生成器处理（通过 childrenCode 回调）
    code += `__CHILDREN_PLACEHOLDER__`;
    
    // 事件绑定代码占位符（由主生成器填充）
    code += `__EVENT_BINDINGS_PLACEHOLDER__`;
    
    // 为所有带时间格式的 label 创建定时器
    if (timeLabels.length > 0) {
      code += `\n${indentStr}// 创建时间更新定时器\n`;
      timeLabels.forEach(labelId => {
        const labelComp = context.componentMap.get(labelId);
        const timeFormat = labelComp?.data?.timeFormat;
        // 跳过拆分时间格式（已在 LabelGenerator 中创建定时器）
        if (timeFormat === 'HH:mm-split') {
          return;
        }
        const interval = this.getTimerInterval(timeFormat);
        code += `${indentStr}gui_obj_create_timer(GUI_BASE(${labelId}), ${interval}, true, ${labelId}_time_update_cb);\n`;
      });
    }
    
    return code;
  }

  generatePropertySetters(_component: Component, _indent: number, _context: GeneratorContext): string {
    // window 组件的属性在创建时已设置
    return '';
  }

  /**
   * 收集当前 window 下所有时间标签组件
   */
  private collectTimeLabels(component: Component, context: GeneratorContext): string[] {
    const timeLabels: string[] = [];
    
    const collectRecursive = (comp: Component) => {
      // 检查当前组件是否是时间标签
      if (comp.type === 'hg_time_label') {
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
   * 根据时间格式获取定时器间隔（毫秒）
   */
  private getTimerInterval(timeFormat?: string): number {
    if (!timeFormat) return 500;
    
    switch (timeFormat) {
      case 'HH:mm:ss':
      case 'YYYY-MM-DD HH:mm:ss':
        return 500; // 带秒：500ms
      case 'HH:mm':
      case 'MM-DD HH:mm':
        return 30000; // 只有时分：30秒
      case 'YYYY-MM-DD':
        return 60000; // 只有日期：60秒
      default:
        return 500;
    }
  }

  /**
   * 根据时间格式获取 sprintf 格式化代码
   */
  private getTimeFormatCode(timeFormat?: string): { format: string; args: string } {
    switch (timeFormat) {
      case 'HH:mm:ss':
        return {
          format: '%02d:%02d:%02d',
          args: 't->tm_hour, t->tm_min, t->tm_sec'
        };
      case 'HH:mm':
      case 'HH:mm-split':  // 拆分时间格式使用相同的格式
        return {
          format: '%02d:%02d',
          args: 't->tm_hour, t->tm_min'
        };
      case 'YYYY-MM-DD':
        return {
          format: '%04d-%02d-%02d',
          args: 't->tm_year + 1900, t->tm_mon + 1, t->tm_mday'
        };
      case 'YYYY-MM-DD HH:mm:ss':
        return {
          format: '%04d-%02d-%02d %02d:%02d:%02d',
          args: 't->tm_year + 1900, t->tm_mon + 1, t->tm_mday, t->tm_hour, t->tm_min, t->tm_sec'
        };
      case 'MM-DD HH:mm':
        return {
          format: '%02d-%02d %02d:%02d',
          args: 't->tm_mon + 1, t->tm_mday, t->tm_hour, t->tm_min'
        };
      default:
        return {
          format: '%02d:%02d:%02d',
          args: 't->tm_hour, t->tm_min, t->tm_sec'
        };
    }
  }
}
