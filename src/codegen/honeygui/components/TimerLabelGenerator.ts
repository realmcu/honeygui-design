/**
 * 计时器标签组件代码生成器
 * 继承自 LabelGenerator，专门处理计时器功能
 * 
 * 参考实现：HoneyGUI/example/application/watch_turnkey_410_502/app_stopwatch.c
 * 核心机制：
 * 1. 全局变量存储计时器状态（time_count, timer_running）
 * 2. 定时器回调每 10ms 更新一次计时器值（gui_obj_create_timer(obj, 10, -1, callback)）
 * 3. 回调中通过 time_count += 10 更新计时器（正计时）或 time_count -= 10（倒计时）
 * 4. 控制函数（start/stop/reset）管理计时器状态
 * 5. 按钮事件调用控制函数，而不是操作显示/隐藏
 */
import { Component } from '../../../hml/types';
import { GeneratorContext } from './ComponentGenerator';
import { LabelGenerator } from './LabelGenerator';

export class TimerLabelGenerator extends LabelGenerator {

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;
    
    // 检查是否启用滚动
    const enableScroll = component.data?.enableScroll === true || component.data?.enableScroll === 'true';
    
    // 根据是否滚动选择不同的 API
    const createFunction = enableScroll ? 'gui_scroll_text_create' : 'gui_text_create';

    return `${indentStr}${component.id} = ${createFunction}(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

    // 检查是否启用滚动
    const enableScroll = component.data?.enableScroll === true || component.data?.enableScroll === 'true';
    const scrollDirection = component.data?.scrollDirection || 'horizontal';
    const scrollReverse = component.data?.scrollReverse === true || component.data?.scrollReverse === 'true';

    // 获取属性值
    const fontSize = component.data?.fontSize || 16;
    const color = component.style?.color || '#ffffff';
    const rgb = this.colorToRgb(color);
    
    // 计时器模式：使用全局变量
    const varName = `${component.id}_time_str`;
    const text = varName;
    const textLengthExpr = `strlen(${varName})`;

    // 确定字体类型
    const fontType = this.getFontType(component);
    const fontFile = component.data?.fontFile;

    // 根据是否滚动选择不同的 API
    const widgetCast = enableScroll ? 'gui_scroll_text_t' : 'gui_text_t';
    const setFunction = enableScroll ? 'gui_scroll_text_set' : 'gui_text_set';
    
    // 设置文本内容和基本属性
    code += `${indentStr}${setFunction}((${widgetCast} *)${component.id}, ${text}, ${fontType}, gui_rgb(${rgb.r}, ${rgb.g}, ${rgb.b}), ${textLengthExpr}, ${fontSize});\n`;

    // 设置字体文件路径（如果指定了字体文件）
    if (fontFile) {
      const convertedFontFile = this.getConvertedFontFileName(component);
      const fontMode = this.getFontMode();
      const typeSetFunction = enableScroll ? 'gui_scroll_text_type_set' : 'gui_text_type_set';
      code += `${indentStr}${typeSetFunction}((${widgetCast} *)${component.id}, "${convertedFontFile}", ${fontMode});\n`;
    }

    // 对齐方式 - 滚动文本不需要 gui_text_mode_set
    if (!enableScroll) {
      const textMode = this.getTextMode(component);
      code += `${indentStr}gui_text_mode_set((gui_text_t *)${component.id}, ${textMode});\n`;
    }

    // 滚动文本特有：设置滚动参数
    if (enableScroll) {
      let scrollModeStr: string;
      const vAlign = component.style?.vAlign || 'TOP';
      
      if (scrollDirection === 'horizontal') {
        if (vAlign === 'MID') {
          scrollModeStr = scrollReverse ? 'SCROLL_X_MID_REVERSE' : 'SCROLL_X_MID';
        } else {
          scrollModeStr = scrollReverse ? 'SCROLL_X_REVERSE' : 'SCROLL_X';
        }
      } else {
        scrollModeStr = scrollReverse ? 'SCROLL_Y_REVERSE' : 'SCROLL_Y';
      }
      
      const startOffset = component.data?.scrollStartOffset ?? 0;
      const endOffset = component.data?.scrollEndOffset ?? 0;
      const interval = component.data?.scrollInterval ?? 3000;
      const duration = component.data?.scrollDuration ?? 0;
      
      code += `${indentStr}gui_scroll_text_scroll_set((gui_scroll_text_t *)${component.id}, ${scrollModeStr}, ${startOffset}, ${endOffset}, ${interval}, ${duration});\n`;
    }

    // 字间距
    const letterSpacing = component.style?.letterSpacing;
    if (letterSpacing !== undefined && letterSpacing !== 0) {
      code += `${indentStr}gui_text_extra_letter_spacing_set((gui_text_t *)${component.id}, ${letterSpacing});\n`;
    }

    // 行间距
    const lineSpacing = component.style?.lineSpacing;
    if (lineSpacing !== undefined && lineSpacing !== 0) {
      code += `${indentStr}gui_text_extra_line_spacing_set((gui_text_t *)${component.id}, ${lineSpacing});\n`;
    }

    // 断词保护
    const wordBreak = component.style?.wordBreak;
    if (wordBreak === true) {
      code += `${indentStr}gui_text_wordwrap_set((gui_text_t *)${component.id}, true);\n`;
    }

    // 可见性
    if (component.visible === false) {
      code += `${indentStr}gui_obj_show((gui_obj_t *)${component.id}, false);\n`;
    }

    // 计时器模式：创建定时器（间隔 10ms，无限循环）
    code += `${indentStr}// 创建计时器定时器（间隔 10ms，无限循环）\n`;
    code += `${indentStr}gui_obj_create_timer((gui_obj_t *)${component.id}, 10, -1, ${component.id}_timer_cb);\n`;
    
    // 根据 autoStart 决定是否立即启动
    const autoStart = component.data?.timerAutoStart !== false; // 默认自动启动
    if (autoStart) {
      code += `${indentStr}${component.id}_start();\n`;
    }

    return code;
  }

  /**
   * 生成计时器相关的全局变量和回调函数
   * 参考 app_stopwatch.c 的实现方式
   */
  generateTimerGlobals(component: Component): string {
    let code = '';
    const varName = `${component.id}_time_str`;
    
    // 获取计时器配置（兼容 timerFormat 和 timerDisplayFormat）
    const timerType = component.data?.timerType || 'stopwatch'; // stopwatch 或 countdown
    const displayFormat = component.data?.timerFormat || component.data?.timerDisplayFormat || 'HH:MM:SS';
    const initialValue = component.data?.timerInitialValue || 0; // 毫秒
    
    // 计算初始显示字符串
    const initialDisplay = this.formatTime(initialValue, displayFormat);
    
    // 全局变量：计时器状态
    code += `// ${component.id} 计时器全局变量\n`;
    code += `static uint32_t ${component.id}_time_count = ${initialValue}; // 毫秒\n`;
    code += `static bool ${component.id}_timer_running = false;\n`;
    code += `static char ${varName}[16] = "${initialDisplay}";\n\n`;
    
    // 格式化函数：根据显示格式生成时间字符串
    code += `// ${component.id} 格式化时间字符串\n`;
    code += `static void ${component.id}_format_time(void)\n`;
    code += `{\n`;
    
    switch (displayFormat) {
      case 'HH:MM:SS':
        code += `    uint32_t hours = ${component.id}_time_count / 3600000;\n`;
        code += `    uint32_t minutes = (${component.id}_time_count % 3600000) / 60000;\n`;
        code += `    uint32_t seconds = (${component.id}_time_count % 60000) / 1000;\n`;
        code += `    snprintf(${varName}, sizeof(${varName}), "%02u:%02u:%02u", hours, minutes, seconds);\n`;
        break;
      case 'MM:SS':
        code += `    uint32_t minutes = ${component.id}_time_count / 60000;\n`;
        code += `    uint32_t seconds = (${component.id}_time_count % 60000) / 1000;\n`;
        code += `    snprintf(${varName}, sizeof(${varName}), "%02u:%02u", minutes, seconds);\n`;
        break;
      case 'MM:SS:MS':
        code += `    uint32_t minutes = ${component.id}_time_count / 60000;\n`;
        code += `    uint32_t seconds = (${component.id}_time_count % 60000) / 1000;\n`;
        code += `    uint32_t centiseconds = (${component.id}_time_count % 1000) / 10;\n`;
        code += `    snprintf(${varName}, sizeof(${varName}), "%02u:%02u.%02u", minutes, seconds, centiseconds);\n`;
        break;
      case 'SS':
        code += `    uint32_t seconds = ${component.id}_time_count / 1000;\n`;
        code += `    snprintf(${varName}, sizeof(${varName}), "%02u", seconds);\n`;
        break;
      default:
        code += `    snprintf(${varName}, sizeof(${varName}), "%u", ${component.id}_time_count);\n`;
    }
    
    code += `}\n\n`;
    
    // 定时器回调函数：每 10ms 更新一次
    code += `// ${component.id} 定时器回调（每 10ms 调用一次）\n`;
    code += `static void ${component.id}_timer_cb(void *obj)\n`;
    code += `{\n`;
    code += `    if (!${component.id}_timer_running) {\n`;
    code += `        return;\n`;
    code += `    }\n\n`;
    
    if (timerType === 'countdown') {
      // 倒计时模式
      code += `    // 倒计时模式\n`;
      code += `    if (${component.id}_time_count >= 10) {\n`;
      code += `        ${component.id}_time_count -= 10;\n`;
      code += `    } else {\n`;
      code += `        ${component.id}_time_count = 0;\n`;
      code += `        ${component.id}_timer_running = false;\n`;
      code += `        gui_obj_stop_timer((gui_obj_t *)obj);\n`;
      code += `    }\n`;
    } else {
      // 正计时模式（stopwatch）
      code += `    // 正计时模式\n`;
      code += `    ${component.id}_time_count += 10;\n`;
    }
    
    code += `\n`;
    code += `    ${component.id}_format_time();\n`;
    code += `    gui_text_content_set((gui_text_t *)obj, ${varName}, strlen(${varName}));\n`;
    code += `}\n\n`;
    
    // 控制函数：启动计时器
    code += `// ${component.id} 启动计时器\n`;
    code += `void ${component.id}_start(void)\n`;
    code += `{\n`;
    code += `    ${component.id}_timer_running = true;\n`;
    code += `    gui_obj_start_timer((gui_obj_t *)${component.id});\n`;
    code += `}\n\n`;
    
    // 控制函数：停止计时器
    code += `// ${component.id} 停止计时器\n`;
    code += `void ${component.id}_stop(void)\n`;
    code += `{\n`;
    code += `    ${component.id}_timer_running = false;\n`;
    code += `    gui_obj_stop_timer((gui_obj_t *)${component.id});\n`;
    code += `}\n\n`;
    
    // 控制函数：重置计时器
    code += `// ${component.id} 重置计时器\n`;
    code += `void ${component.id}_reset(void)\n`;
    code += `{\n`;
    code += `    ${component.id}_time_count = ${initialValue};\n`;
    code += `    ${component.id}_timer_running = false;\n`;
    code += `    ${component.id}_format_time();\n`;
    code += `    gui_text_content_set((gui_text_t *)${component.id}, ${varName}, strlen(${varName}));\n`;
    code += `}\n\n`;
    
    return code;
  }

  /**
   * 生成计时器控制函数的头文件声明
   */
  generateTimerHeaders(component: Component): string {
    let code = '';
    code += `// ${component.id} 计时器控制函数\n`;
    code += `void ${component.id}_start(void);\n`;
    code += `void ${component.id}_stop(void);\n`;
    code += `void ${component.id}_reset(void);\n\n`;
    return code;
  }

  /**
   * 格式化时间（用于生成初始显示字符串）
   */
  private formatTime(ms: number, format: string): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    
    switch (format) {
      case 'HH:MM:SS':
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      case 'MM:SS':
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      case 'MM:SS:MS':
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
      case 'SS':
        return seconds.toString().padStart(2, '0');
      default:
        return ms.toString();
    }
  }
}
