/**
 * hg_view 组件代码生成器
 * 使用 GUI_VIEW_INSTANCE 宏生成视图代码
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

// 事件类型到 GUI_EVENT 的映射（用于 view 的 switch 事件）
const VIEW_SWITCH_EVENT_MAP: Record<string, string> = {
  // 触摸事件
  'onClick': 'GUI_EVENT_TOUCH_CLICKED',
  'onLongPress': 'GUI_EVENT_TOUCH_LONG',
  // 键盘事件
  'onKeyShortClick': 'GUI_EVENT_KB_SHORT_PRESSED',
  'onKeyLongClick': 'GUI_EVENT_KB_LONG_PRESSED',
  // 滑动事件
  'onSwipeLeft': 'GUI_EVENT_TOUCH_MOVE_LEFT',
  'onSwipeRight': 'GUI_EVENT_TOUCH_MOVE_RIGHT',
  'onSwipeUp': 'GUI_EVENT_TOUCH_MOVE_UP',
  'onSwipeDown': 'GUI_EVENT_TOUCH_MOVE_DOWN',
};

export class ViewGenerator implements ComponentCodeGenerator {
  
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const name = component.name;
    // 正确处理 residentMemory：支持 boolean 和 string 类型
    const residentMemoryValue = component.data?.residentMemory;
    const residentMemory = residentMemoryValue === true || residentMemoryValue === 'true';
    // 动画步长默认值为屏幕高度的 1/10
    const defaultAnimateStep = Math.round(component.position.height / 10);
    const animateStep = component.data?.animateStep ?? defaultAnimateStep;
    // 透明度默认值为 255（完全不透明）
    const opacity = component.data?.opacity ?? 255;

    let code = '';
    
    // 生成 switch_out 回调
    code += `${indentStr}static void ${name}_switch_out(gui_view_t *view)\n`;
    code += `${indentStr}{\n`;
    code += `${indentStr}    GUI_UNUSED(view);\n`;
    code += `${indentStr}}\n\n`;
    
    // 生成 switch_in 回调
    code += `${indentStr}static void ${name}_switch_in(gui_view_t *view)\n`;
    code += `${indentStr}{\n`;
    
    // 设置动画步长（总是设置，使用默认值或用户配置值）
    code += `${indentStr}    // 设置动画步长\n`;
    code += `${indentStr}    gui_view_set_animate_step(view, ${animateStep});\n`;
    code += '\n';
    
    // 设置透明度
    code += `${indentStr}    // 设置透明度\n`;
    code += `${indentStr}    gui_view_set_opacity(view, ${opacity});\n`;
    
    // 为 hg_view 自己的定时器生成绑定代码（放在设置函数之后）
    const viewTimerBindings = this.generateViewTimerBindings(component, indent + 1);
    if (viewTimerBindings.trim()) {
      code += '\n';
      code += viewTimerBindings;
    }
    
    code += '\n';
    
    // 注册视图切换事件
    const switchViewEvents = this.extractSwitchViewEvents(component, context);
    if (switchViewEvents.length > 0) {
      switchViewEvents.forEach(({ guiEvent, targetName, switchOutStyle, switchInStyle }) => {
        code += `${indentStr}    gui_view_switch_on_event(view, "${targetName}", ${switchOutStyle}, ${switchInStyle}, ${guiEvent});\n`;
      });
    } else {
      // 没有视图切换事件时添加 GUI_UNUSED
      code += `${indentStr}    GUI_UNUSED(view);\n`;
    }
    
    // 初始化时间字符串变量（在函数开头统一声明，避免重复定义）
    // 收集所有时间标签（包括 window 中的），以确保 now 和 t 变量被声明
    const allTimeLabels = this.collectAllTimeLabels(component, context);
    const hasTimeLabels = allTimeLabels.length > 0;
    
    // 只初始化 view 直接子组件中的时间标签（不包括 window 中的）
    const viewTimeLabels = this.collectViewTimeLabels(component, context);
    
    if (hasTimeLabels) {
      code += `\n${indentStr}    // 初始化时间字符串\n`;
      code += `${indentStr}    time_t now = time(NULL);\n`;
      code += `${indentStr}    struct tm *t = localtime(&now);\n`;
      if (viewTimeLabels.length > 0) {
        code += `${indentStr}    if (t != NULL)\n`;
        code += `${indentStr}    {\n`;
        viewTimeLabels.forEach(labelId => {
          const labelComp = context.componentMap.get(labelId);
          const timeFormat = labelComp?.data?.timeFormat;
          const formatCode = this.getTimeFormatCode(timeFormat);
          code += `${indentStr}        sprintf(${labelId}_time_str, "${formatCode.format}", ${formatCode.args});\n`;
        });
        code += `${indentStr}    }\n`;
      }
      code += '\n';
    }
    
    // 子组件创建代码由主生成器处理（通过 childrenCode 回调）
    code += `__CHILDREN_PLACEHOLDER__`;
    
    // 事件绑定代码占位符（由主生成器填充）
    code += `__EVENT_BINDINGS_PLACEHOLDER__`;
    
    // 为 view 直接子组件中的时间标签创建定时器（window 中的由 WindowGenerator 处理）
    if (viewTimeLabels.length > 0) {
      code += `\n${indentStr}    // 创建时间更新定时器\n`;
      viewTimeLabels.forEach(labelId => {
        const labelComp = context.componentMap.get(labelId);
        const timeFormat = labelComp?.data?.timeFormat;
        // 跳过拆分时间格式（已在 LabelGenerator 中创建定时器）
        if (timeFormat === 'HH:mm-split') {
          return;
        }
        const interval = this.getTimerInterval(timeFormat);
        code += `${indentStr}    gui_obj_create_timer(GUI_BASE(${labelId}), ${interval}, true, ${labelId}_time_update_cb);\n`;
      });
    }
    
    code += `${indentStr}}\n`;
    
    // GUI_VIEW_INSTANCE 宏调用（第二个参数为常驻内存标志）
    code += `${indentStr}GUI_VIEW_INSTANCE("${name}", ${residentMemory ? 'true' : 'false'}, ${name}_switch_in, ${name}_switch_out);\n`;

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
   * 收集所有时间标签（包括 window 中的）
   * 用于判断是否需要声明 now 和 t 变量
   */
  private collectAllTimeLabels(component: Component, context: GeneratorContext): string[] {
    const timeLabels: string[] = [];
    
    const collectRecursive = (comp: Component) => {
      // 检查当前组件是否是时间标签
      if (comp.type === 'hg_time_label') {
        timeLabels.push(comp.id);
      }
      
      // 递归检查所有子组件（包括 hg_window）
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
   * 收集 view 直接子组件中的时间标签（不包括 window 中的）
   * 用于生成初始化代码和定时器
   */
  private collectViewTimeLabels(component: Component, context: GeneratorContext): string[] {
    const timeLabels: string[] = [];
    
    const collectRecursive = (comp: Component) => {
      // 检查当前组件是否是时间标签
      if (comp.type === 'hg_time_label') {
        timeLabels.push(comp.id);
      }
      
      // 递归检查子组件，但跳过 hg_window
      if (comp.children) {
        comp.children.forEach(childId => {
          const child = context.componentMap.get(childId);
          if (child && child.type !== 'hg_window') {
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

  /**
   * 为 hg_view 组件生成定时器绑定代码
   * 使用函数入参 view 而不是组件名称
   */
  private generateViewTimerBindings(component: Component, indent: number): string {
    const indentStr = '    '.repeat(indent);
    const timers = component.data?.timers;
    
    if (!timers || !Array.isArray(timers) || timers.length === 0) {
      return '';
    }

    let code = '';
    const name = component.name;
    
    // 过滤出启用的定时器
    const enabledTimers = timers.filter((timer: any) => timer.enabled !== false);
    
    if (enabledTimers.length === 0) {
      return '';
    }

    code += `${indentStr}// 创建定时器\n`;
    
    enabledTimers.forEach((timer: any, index: number) => {
      const interval = timer.interval || 1000;
      const reload = timer.reload !== false;
      
      // 确定回调函数名
      let callbackName: string;
      if (timer.mode === 'custom' && timer.callback) {
        callbackName = timer.callback;
      } else {
        // preset 模式或没有指定回调函数，使用自动生成的名称
        callbackName = `${name}_timer_${index}_cb`;
      }
      
      // 使用 view 作为变量名（转换为 gui_obj_t*）
      code += `${indentStr}gui_obj_create_timer((gui_obj_t *)view, ${interval}, ${reload ? 'true' : 'false'}, ${callbackName});\n`;
      code += `${indentStr}gui_obj_start_timer((gui_obj_t *)view);\n`;
    });

    return code;
  }
}
