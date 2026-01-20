/**
 * 回调文件生成器
 * 负责生成 callbacks.h 和 callbacks.c 文件
 */
import { Component } from '../../../hml/types';
import { EventGeneratorFactory } from '../events';
import { getMessageCallbackName } from '../events/EventCodeGenerator';

export class CallbackFileGenerator {
  private components: Component[];
  private componentMap: Map<string, Component>;
  private allComponents: Component[]; // 包含所有嵌套组件的扁平数组

  constructor(components: Component[]) {
    this.components = components;
    this.componentMap = new Map(components.map(c => [c.id, c]));
    // 递归收集所有组件（包括嵌套的）
    this.allComponents = this.flattenComponents(components);
  }

  /**
   * 递归展开所有组件（包括嵌套在容器内的子组件）
   */
  private flattenComponents(components: Component[]): Component[] {
    const visited = new Set<string>();
    const result: Component[] = [];
    
    const traverse = (comp: Component) => {
      // 防止重复访问
      if (visited.has(comp.id)) return;
      visited.add(comp.id);
      
      result.push(comp);
      if (comp.children && comp.children.length > 0) {
        comp.children.forEach(childId => {
          const child = this.componentMap.get(childId);
          if (child) {
            traverse(child);
          }
        });
      }
    };
    
    components.forEach(comp => traverse(comp));
    return result;
  }

  /**
   * 生成回调头文件
   */
  generateHeader(baseName: string): string {
    const guardName = `${baseName.toUpperCase()}_CALLBACKS_H`;
    let code = `#ifndef ${guardName}
#define ${guardName}

#include "gui_api.h"
#include "gui_text.h"

`;

    // 为拆分时间组件添加 extern 声明
    const splitTimeLabels = this.allComponents.filter(c => 
      c.type === 'hg_time_label' && c.data?.timeFormat === 'HH:mm-split'
    );
    
    if (splitTimeLabels.length > 0) {
      code += `// 拆分时间组件全局变量（在 UI 文件中定义）\n`;
      splitTimeLabels.forEach(label => {
        code += `extern gui_text_t *${label.id}_hour;\n`;
        code += `extern gui_text_t *${label.id}_colon;\n`;
        code += `extern gui_text_t *${label.id}_min;\n`;
      });
      code += `\n`;
    }

    code += `// 事件回调函数声明\n`;

    const callbackFunctions = this.collectCallbackFunctions();
    const msgCallbackNames = new Set(this.collectMessageCallbackNames());
    
    callbackFunctions.forEach(funcName => {
      if (msgCallbackNames.has(funcName)) {
        // onMessage 回调签名不同
        code += `void ${funcName}(gui_obj_t *obj, const char *topic, void *data, uint16_t len);\n`;
      } else {
        code += `void ${funcName}(void *obj, gui_event_t event, void *param);\n`;
      }
    });

    // 添加时间更新回调声明
    const timeUpdateFuncNames = this.collectTimeUpdateCallbackNames();
    timeUpdateFuncNames.forEach(funcName => {
      code += `void ${funcName}(void *p);\n`;
    });

    // 添加用户配置的定时器回调声明
    const timerCallbackNames = this.collectTimerCallbackNames();
    if (timerCallbackNames.length > 0) {
      code += `\n// 用户配置的定时器回调函数声明\n`;
      timerCallbackNames.forEach(funcName => {
        code += `void ${funcName}(void *obj);\n`;
      });
    }

    // 添加双态按钮状态回调声明
    const toggleButtonCallbacks = this.collectToggleButtonCallbackNames();
    if (toggleButtonCallbacks.length > 0) {
      code += `\n// 双态按钮状态回调函数声明\n`;
      toggleButtonCallbacks.forEach(({ onCallback, offCallback }) => {
        code += `void ${onCallback}(void);\n`;
        code += `void ${offCallback}(void);\n`;
      });
    }

    code += `
#endif // ${guardName}
`;

    return code;
  }

  /**
   * 生成回调实现文件
   */
  generateImplementation(baseName: string): string {
    // 收集所有时间标签（使用 allComponents）
    const timeLabels = this.allComponents.filter(c => c.type === 'hg_time_label');
    
    let code = `#include "${baseName}_callbacks.h"
#include "../ui/${baseName}_ui.h"
#include <stdio.h>
#include <string.h>
#include <time.h>

`;

    // 为每个时间标签声明外部全局变量（在 UI 文件中定义）
    if (timeLabels.length > 0) {
      code += `// 时间字符串全局变量（在 UI 文件中定义）\n`;
      timeLabels.forEach(label => {
        const bufferSize = this.getTimeBufferSize(label.data?.timeFormat);
        code += `extern char ${label.id}_time_str[${bufferSize}];\n`;
      });
      code += `\n`;
    }

    code += `// 事件回调函数实现\n\n`;

    // 收集 switchView 回调实现
    const switchViewImpls = this.collectSwitchViewCallbackImpls();
    switchViewImpls.forEach(impl => {
      code += impl + '\n\n';
    });

    // 收集 onMessage 回调实现
    const messageImpls = this.collectMessageCallbackImpls();
    messageImpls.forEach(impl => {
      code += impl + '\n\n';
    });

    // 生成时间更新回调
    const timeUpdateImpls = this.collectTimeUpdateCallbackImpls();
    timeUpdateImpls.forEach(impl => {
      code += impl + '\n\n';
    });

    // 生成预设定时器回调实现
    const timerCallbackImpls = this.collectTimerCallbackImpls();
    if (timerCallbackImpls.length > 0) {
      code += `// 预设定时器回调函数\n\n`;
      timerCallbackImpls.forEach(impl => {
        code += impl + '\n\n';
      });
    }

    // 生成双态按钮状态回调
    const toggleButtonImpls = this.collectToggleButtonCallbackImpls();
    if (toggleButtonImpls.length > 0) {
      code += `// 双态按钮状态回调函数\n\n`;
      toggleButtonImpls.forEach(impl => {
        code += impl + '\n';
      });
    }

    // 生成普通回调函数模板
    const callbackFunctions = this.collectCallbackFunctions();
    const switchViewFuncNames = new Set(this.collectSwitchViewCallbackNames());
    const timeUpdateFuncNames = new Set(this.collectTimeUpdateCallbackNames());
    const timerCallbackNames = new Set(this.collectTimerCallbackNames());
    const msgCallbackNames = new Set(this.collectMessageCallbackNames());
    
    callbackFunctions.forEach(funcName => {
      if (switchViewFuncNames.has(funcName) || timeUpdateFuncNames.has(funcName) || timerCallbackNames.has(funcName) || msgCallbackNames.has(funcName)) return;
      
      code += `void ${funcName}(void *obj, gui_event_t event, void *param)\n`;
      code += `{\n`;
      code += `    GUI_UNUSED(obj);\n`;
      code += `    GUI_UNUSED(event);\n`;
      code += `    GUI_UNUSED(param);\n`;
      code += `    // TODO: 实现事件处理逻辑\n`;
      code += `    printf("${funcName} triggered\\n");\n`;
      code += `}\n\n`;
    });

    code += `/* @protected start custom_functions */
// 自定义函数
/* @protected end custom_functions */
`;

    return code;
  }

  /**
   * 收集所有需要生成的回调函数名
   */
  collectCallbackFunctions(): string[] {
    const functions = new Set<string>();

    // 使用 allComponents 而不是 components，包含所有嵌套组件
    this.allComponents.forEach(component => {
      const generator = EventGeneratorFactory.getGenerator(component.type);
      generator.collectCallbackFunctions(component).forEach(fn => functions.add(fn));
    });

    return Array.from(functions).sort();
  }

  /**
   * 收集所有 switchView 回调实现
   */
  private collectSwitchViewCallbackImpls(): string[] {
    const impls = new Map<string, string>(); // 使用 Map 去重，key 为函数名

    this.allComponents.forEach(component => {
      const generator = EventGeneratorFactory.getGenerator(component.type);
      if (generator.getSwitchViewCallbackImpl) {
        generator.getSwitchViewCallbackImpl(component, this.componentMap).forEach(impl => {
          // 提取函数名作为 key
          const match = impl.match(/void\s+(\w+)\s*\(/);
          if (match) {
            const funcName = match[1];
            impls.set(funcName, impl);
          }
        });
      }
    });

    return Array.from(impls.values());
  }

  /**
   * 收集所有 switchView 回调函数名
   */
  private collectSwitchViewCallbackNames(): string[] {
    const names: string[] = [];

    this.allComponents.forEach(component => {
      if (!component.eventConfigs) return;
      component.eventConfigs.forEach(eventConfig => {
        if (eventConfig.type === 'onMessage') return; // onMessage 单独处理
        eventConfig.actions.forEach(action => {
          if (action.type === 'switchView' && action.target) {
            names.push(`${component.id}_switch_view_cb`);
          }
        });
      });
    });

    return names;
  }

  /**
   * 收集所有 onMessage 回调实现
   */
  private collectMessageCallbackImpls(): string[] {
    const impls = new Map<string, string>(); // 使用 Map 去重，key 为函数名

    this.allComponents.forEach(component => {
      const generator = EventGeneratorFactory.getGenerator(component.type);
      if (generator.getMessageCallbackImpl) {
        generator.getMessageCallbackImpl(component, this.componentMap).forEach(impl => {
          // 提取函数名作为 key
          const match = impl.match(/void\s+(\w+)\s*\(/);
          if (match) {
            const funcName = match[1];
            impls.set(funcName, impl);
          }
        });
      }
    });

    return Array.from(impls.values());
  }

  /**
   * 收集所有 onMessage 回调函数名
   */
  private collectMessageCallbackNames(): string[] {
    const names: string[] = [];

    this.allComponents.forEach(component => {
      if (!component.eventConfigs) return;
      let msgIndex = 0;
      component.eventConfigs.forEach(eventConfig => {
        if (eventConfig.type === 'onMessage' && eventConfig.message) {
          names.push(getMessageCallbackName(component, eventConfig, msgIndex));
          msgIndex++;
        }
      });
    });

    return names;
  }

  /**
   * 收集所有时间更新回调实现
   */
  private collectTimeUpdateCallbackImpls(): string[] {
    const impls = new Map<string, string>(); // 使用 Map 去重，key 为函数名

    this.allComponents.forEach(component => {
      if (component.type === 'hg_time_label') {
        const timeFormat = component.data?.timeFormat || 'HH:mm:ss';
        const funcName = `${component.id}_time_update_cb`;
        const impl = this.generateTimeUpdateCallback(component.id, timeFormat);
        impls.set(funcName, impl);
      }
    });

    return Array.from(impls.values());
  }

  /**
   * 收集所有时间更新回调函数名
   */
  private collectTimeUpdateCallbackNames(): string[] {
    const names: string[] = [];

    this.allComponents.forEach(component => {
      if (component.type === 'hg_time_label') {
        names.push(`${component.id}_time_update_cb`);
      }
    });

    return names;
  }

  /**
   * 收集所有用户配置的定时器回调函数名
   */
  private collectTimerCallbackNames(): string[] {
    const names = new Set<string>();

    this.allComponents.forEach(component => {
      // 支持新版 timers 数组
      if (component.data?.timers && Array.isArray(component.data.timers)) {
        component.data.timers.forEach((timer: any) => {
          if (timer.mode === 'preset' && timer.actions && timer.actions.length > 0) {
            // 预设动作模式：使用定时器 ID 生成回调函数名
            names.add(`${component.id}_${timer.id}_cb`);
          } else if (timer.mode === 'custom' && timer.callback) {
            // 自定义函数模式
            names.add(timer.callback);
          }
        });
      }
      // 兼容旧版单定时器格式
      else if (component.data?.timerEnabled === true) {
        const timerMode = component.data.timerMode || 'custom';
        
        if (timerMode === 'preset' && component.data.timerActions && component.data.timerActions.length > 0) {
          // 预设动作模式：使用自动生成的回调函数名
          names.add(`${component.id}_preset_timer_cb`);
        } else if (timerMode === 'custom' && component.data.timerCallback) {
          // 自定义函数模式
          names.add(component.data.timerCallback);
        }
      }
    });

    return Array.from(names);
  }

  /**
   * 收集所有用户配置的定时器回调实现
   */
  private collectTimerCallbackImpls(): string[] {
    const impls = new Map<string, string>();

    this.allComponents.forEach(component => {
      // 支持新版 timers 数组
      if (component.data?.timers && Array.isArray(component.data.timers)) {
        component.data.timers.forEach((timer: any) => {
          if (timer.mode === 'preset' && timer.actions && timer.actions.length > 0) {
            // 预设动作模式：生成自动实现的回调函数
            const callback = `${component.id}_${timer.id}_cb`;
            if (!impls.has(callback)) {
              const impl = this.generatePresetTimerCallbackFromConfig(component, timer);
              impls.set(callback, impl);
            }
          } else if (timer.mode === 'custom' && timer.callback) {
            // 自定义函数模式：生成空实现供用户填充
            const callback = timer.callback;
            if (!impls.has(callback)) {
              const timerName = timer.name || timer.id;
              const impl = `/**
 * ${timerName}
 * 组件: ${component.id}
 */
void ${callback}(void *obj)
{
    GUI_UNUSED(obj);
    // TODO: 实现定时器回调逻辑
}`;
              impls.set(callback, impl);
            }
          }
        });
      }
      // 兼容旧版单定时器格式
      else if (component.data?.timerEnabled === true) {
        const timerMode = component.data.timerMode || 'custom';
        
        if (timerMode === 'preset' && component.data.timerActions && component.data.timerActions.length > 0) {
          // 预设动作模式：生成自动实现的回调函数
          const callback = `${component.id}_preset_timer_cb`;
          if (!impls.has(callback)) {
            const impl = this.generatePresetTimerCallback(component);
            impls.set(callback, impl);
          }
        } else if (timerMode === 'custom' && component.data.timerCallback) {
          // 自定义函数模式：生成空实现供用户填充
          const callback = component.data.timerCallback;
          if (!impls.has(callback)) {
            const impl = `void ${callback}(void *obj)
{
    GUI_UNUSED(obj);
    // TODO: 实现定时器回调逻辑
}`;
            impls.set(callback, impl);
          }
        }
      }
    });

    return Array.from(impls.values());
  }

  /**
   * 生成预设动作的定时器回调函数
   */
  private generatePresetTimerCallback(component: Component): string {
    const callback = `${component.id}_preset_timer_cb`;
    const actions = component.data?.timerActions || [];
    const duration = component.data?.timerDuration || 1000;
    const interval = component.data?.timerInterval || 1000;
    const stopOnComplete = component.data?.timerStopOnComplete !== false;
    
    // 计算 cnt_max
    const cntMax = Math.ceil(duration / interval);
    
    let code = `void ${callback}(void *obj)\n{\n`;
    code += `    gui_obj_t *target = (gui_obj_t *)obj;\n`;
    code += `    static uint16_t cnt = 0;\n`;
    code += `    const uint16_t cnt_max = ${cntMax};\n`;
    code += `    \n`;
    
    // 为每个动作生成代码
    actions.forEach((action: any) => {
      if (action.type === 'position') {
        // 调整位置动作
        code += `    // 调整位置: (${action.fromX}, ${action.fromY}) -> (${action.toX}, ${action.toY})\n`;
        code += `    const int16_t x_origin = ${action.fromX};\n`;
        code += `    const int16_t y_origin = ${action.fromY};\n`;
        code += `    const int16_t x_target = ${action.toX};\n`;
        code += `    const int16_t y_target = ${action.toY};\n`;
        code += `    int16_t x_cur = x_origin + (x_target - x_origin) * cnt / cnt_max;\n`;
        code += `    int16_t y_cur = y_origin + (y_target - y_origin) * cnt / cnt_max;\n`;
        code += `    gui_obj_move(target, x_cur, y_cur);\n`;
        code += `    \n`;
      } else if (action.type === 'size') {
        // 调整大小动作（仅支持 hg_window）
        code += `    // 调整大小: (${action.fromW}, ${action.fromH}) -> (${action.toW}, ${action.toH})\n`;
        code += `    const int16_t w_origin = ${action.fromW};\n`;
        code += `    const int16_t h_origin = ${action.fromH};\n`;
        code += `    const int16_t w_target = ${action.toW};\n`;
        code += `    const int16_t h_target = ${action.toH};\n`;
        code += `    int16_t w_cur = w_origin + (w_target - w_origin) * cnt / cnt_max;\n`;
        code += `    int16_t h_cur = h_origin + (h_target - h_origin) * cnt / cnt_max;\n`;
        code += `    target->w = w_cur;\n`;
        code += `    target->h = h_cur;\n`;
        code += `    \n`;
      } else if (action.type === 'opacity') {
        // 调整透明度动作（仅支持 hg_image）
        code += `    // 调整透明度: ${action.from} -> ${action.to}\n`;
        code += `    const uint8_t opacity_origin = ${action.from};\n`;
        code += `    const int16_t opacity_target = ${action.to};\n`;
        code += `    int16_t opacity_cur = opacity_origin + (opacity_target - opacity_origin) * cnt / cnt_max;\n`;
        code += `    gui_img_set_opacity((gui_img_t *)target, opacity_cur);\n`;
        code += `    \n`;
      }
    });
    
    // 增加计数器
    code += `    cnt++;\n`;
    
    // 到达总时间后的处理
    if (stopOnComplete) {
      code += `    if (cnt >= cnt_max) {\n`;
      code += `        gui_obj_stop_timer(target);\n`;
      code += `        cnt = 0; // 重置计数器\n`;
      code += `    }\n`;
    } else {
      code += `    if (cnt >= cnt_max) {\n`;
      code += `        cnt = 0; // 重置计数器，继续循环\n`;
      code += `    }\n`;
    }
    
    code += `}\n`;
    
    return code;
  }

  /**
   * 从 TimerConfig 生成预设动作的定时器回调函数（支持延时启动）
   */
  private generatePresetTimerCallbackFromConfig(component: Component, timer: any): string {
    const callback = `${component.id}_${timer.id}_cb`;
    const actions = timer.actions || [];
    const duration = timer.duration || 1000;
    const interval = timer.interval || 1000;
    const stopOnComplete = timer.stopOnComplete !== false;
    const delayStart = timer.delayStart || 0;
    const timerName = timer.name || timer.id;
    
    // 计算 cnt_max 和 cnt_wait
    const cntMax = Math.ceil(duration / interval);
    const cntWait = Math.ceil(delayStart / interval);
    
    let code = `/**
 * ${timerName}
 * 组件: ${component.id}
 * 模式: 预设动作
 */
void ${callback}(void *obj)\n{\n`;
    code += `    gui_obj_t *target = (gui_obj_t *)obj;\n`;
    code += `    static uint16_t cnt = 0;\n`;
    code += `    const uint16_t cnt_max = ${cntMax};\n`;
    
    // 如果有延时启动，添加 cnt_wait
    if (delayStart > 0) {
      code += `    const uint16_t cnt_wait = ${cntWait}; // 延时启动: ${delayStart}ms\n`;
      code += `    \n`;
      code += `    // 延时启动检查\n`;
      code += `    if (cnt <= cnt_wait) {\n`;
      code += `        cnt++;\n`;
      code += `        return;\n`;
      code += `    }\n`;
      code += `    \n`;
    } else {
      code += `    \n`;
    }
    
    // 为每个动作生成代码
    actions.forEach((action: any) => {
      if (action.type === 'position') {
        // 调整位置动作
        code += `    // 调整位置: (${action.fromX}, ${action.fromY}) -> (${action.toX}, ${action.toY})\n`;
        code += `    const int16_t x_origin = ${action.fromX};\n`;
        code += `    const int16_t y_origin = ${action.fromY};\n`;
        code += `    const int16_t x_target = ${action.toX};\n`;
        code += `    const int16_t y_target = ${action.toY};\n`;
        if (delayStart > 0) {
          code += `    int16_t x_cur = x_origin + (x_target - x_origin) * (cnt - cnt_wait) / cnt_max;\n`;
          code += `    int16_t y_cur = y_origin + (y_target - y_origin) * (cnt - cnt_wait) / cnt_max;\n`;
        } else {
          code += `    int16_t x_cur = x_origin + (x_target - x_origin) * cnt / cnt_max;\n`;
          code += `    int16_t y_cur = y_origin + (y_target - y_origin) * cnt / cnt_max;\n`;
        }
        code += `    gui_obj_move(target, x_cur, y_cur);\n`;
        code += `    \n`;
      } else if (action.type === 'size') {
        // 调整大小动作（仅支持 hg_window）
        code += `    // 调整大小: (${action.fromW}, ${action.fromH}) -> (${action.toW}, ${action.toH})\n`;
        code += `    const int16_t w_origin = ${action.fromW};\n`;
        code += `    const int16_t h_origin = ${action.fromH};\n`;
        code += `    const int16_t w_target = ${action.toW};\n`;
        code += `    const int16_t h_target = ${action.toH};\n`;
        if (delayStart > 0) {
          code += `    int16_t w_cur = w_origin + (w_target - w_origin) * (cnt - cnt_wait) / cnt_max;\n`;
          code += `    int16_t h_cur = h_origin + (h_target - h_origin) * (cnt - cnt_wait) / cnt_max;\n`;
        } else {
          code += `    int16_t w_cur = w_origin + (w_target - w_origin) * cnt / cnt_max;\n`;
          code += `    int16_t h_cur = h_origin + (h_target - h_origin) * cnt / cnt_max;\n`;
        }
        code += `    target->w = w_cur;\n`;
        code += `    target->h = h_cur;\n`;
        code += `    \n`;
      } else if (action.type === 'opacity') {
        // 调整透明度动作（仅支持 hg_image）
        code += `    // 调整透明度: ${action.from} -> ${action.to}\n`;
        code += `    const uint8_t opacity_origin = ${action.from};\n`;
        code += `    const int16_t opacity_target = ${action.to};\n`;
        if (delayStart > 0) {
          code += `    int16_t opacity_cur = opacity_origin + (opacity_target - opacity_origin) * (cnt - cnt_wait) / cnt_max;\n`;
        } else {
          code += `    int16_t opacity_cur = opacity_origin + (opacity_target - opacity_origin) * cnt / cnt_max;\n`;
        }
        code += `    gui_img_set_opacity((gui_img_t *)target, opacity_cur);\n`;
        code += `    \n`;
      }
    });
    
    // 增加计数器
    code += `    cnt++;\n`;
    
    // 到达总时间后的处理
    const totalCnt = delayStart > 0 ? `cnt_wait + cnt_max` : `cnt_max`;
    if (stopOnComplete) {
      code += `    if (cnt >= ${totalCnt}) {\n`;
      code += `        gui_obj_stop_timer(target);\n`;
      code += `        cnt = 0; // 重置计数器\n`;
      code += `    }\n`;
    } else {
      code += `    if (cnt >= ${totalCnt}) {\n`;
      code += `        cnt = 0; // 重置计数器，继续循环\n`;
      code += `    }\n`;
    }
    
    code += `}\n`;
    
    return code;
  }

  /**
   * 获取时间格式对应的缓冲区大小
   */
  private getTimeBufferSize(timeFormat?: string): number {
    switch (timeFormat) {
      case 'HH:mm:ss': return 10;  // "HH:MM:SS\0" = 9
      case 'HH:mm': return 10;      // "HH:MM\0" = 6，留余量
      case 'HH:mm-split': return 10; // 拆分时间格式，与 HH:mm 相同，需要访问 str+3
      case 'YYYY-MM-DD': return 12; // "YYYY-MM-DD\0" = 11
      case 'YYYY-MM-DD HH:mm:ss': return 22; // "YYYY-MM-DD HH:MM:SS\0" = 20
      case 'MM-DD HH:mm': return 16; // "MM-DD HH:MM\0" = 13
      default: return 10;
    }
  }

  /**
   * 生成时间更新回调函数
   * 使用全局变量存储时间字符串（与 SDK 保持一致）
   */
  private generateTimeUpdateCallback(componentId: string, timeFormat: string): string {
    let formatStr = '';

    switch (timeFormat) {
      case 'HH:mm:ss':
        formatStr = '%02d:%02d:%02d';
        break;
      case 'HH:mm':
      case 'HH:mm-split':  // 拆分时间格式使用相同的格式字符串
        formatStr = '%02d:%02d';
        break;
      case 'YYYY-MM-DD':
        formatStr = '%04d-%02d-%02d';
        break;
      case 'YYYY-MM-DD HH:mm:ss':
        formatStr = '%04d-%02d-%02d %02d:%02d:%02d';
        break;
      case 'MM-DD HH:mm':
        formatStr = '%02d-%02d %02d:%02d';
        break;
      default:
        formatStr = '%02d:%02d:%02d';
    }

    let code = `void ${componentId}_time_update_cb(void *p)\n`;
    code += `{\n`;
    
    // 拆分时间格式需要特殊处理
    if (timeFormat === 'HH:mm-split') {
      code += `    GUI_UNUSED(p);\n`;
      code += `    \n`;
      code += `    time_t now = time(NULL);\n`;
      code += `    struct tm *t = localtime(&now);\n`;
      code += `    if (t == NULL)\n`;
      code += `    {\n`;
      code += `        return;\n`;
      code += `    }\n`;
      code += `    \n`;
      code += `    // 更新时间字符串\n`;
      code += `    sprintf(${componentId}_time_str, "${formatStr}", t->tm_hour, t->tm_min);\n`;
      code += `    \n`;
      code += `    // 更新小时组件（前2个字符）\n`;
      code += `    if (${componentId}_hour) {\n`;
      code += `        gui_text_content_set(${componentId}_hour, ${componentId}_time_str, 2);\n`;
      code += `    }\n`;
      code += `    \n`;
      code += `    // 更新分钟组件（后2个字符，跳过冒号）\n`;
      code += `    if (${componentId}_min) {\n`;
      code += `        gui_text_content_set(${componentId}_min, ${componentId}_time_str + 3, 2);\n`;
      code += `    }\n`;
    } else {
      // 普通时间格式处理
      code += `    GUI_UNUSED(p);\n`;
      code += `    \n`;
      code += `    time_t now = time(NULL);\n`;
      code += `    struct tm *t = localtime(&now);\n`;
      code += `    if (t == NULL)\n`;
      code += `    {\n`;
      code += `        return;\n`;
      code += `    }\n`;
      code += `    \n`;

      // 根据格式生成不同的 sprintf 调用
      if (timeFormat === 'HH:mm:ss') {
        code += `    sprintf(${componentId}_time_str, "${formatStr}", t->tm_hour, t->tm_min, t->tm_sec);\n`;
      } else if (timeFormat === 'HH:mm') {
        code += `    sprintf(${componentId}_time_str, "${formatStr}", t->tm_hour, t->tm_min);\n`;
      } else if (timeFormat === 'YYYY-MM-DD') {
        code += `    sprintf(${componentId}_time_str, "${formatStr}", t->tm_year + 1900, t->tm_mon + 1, t->tm_mday);\n`;
      } else if (timeFormat === 'YYYY-MM-DD HH:mm:ss') {
        code += `    sprintf(${componentId}_time_str, "${formatStr}", t->tm_year + 1900, t->tm_mon + 1, t->tm_mday, t->tm_hour, t->tm_min, t->tm_sec);\n`;
      } else if (timeFormat === 'MM-DD HH:mm') {
        code += `    sprintf(${componentId}_time_str, "${formatStr}", t->tm_mon + 1, t->tm_mday, t->tm_hour, t->tm_min);\n`;
      }

      code += `    \n`;
      code += `    gui_text_content_set((gui_text_t *)${componentId}, ${componentId}_time_str, strlen(${componentId}_time_str));\n`;
    }
    
    code += `}`;

    return code;
  }

  /**
   * 收集所有双态按钮回调函数名
   */
  private collectToggleButtonCallbackNames(): Array<{ onCallback: string; offCallback: string }> {
    const callbacks: Array<{ onCallback: string; offCallback: string }> = [];

    this.allComponents.forEach(component => {
      if (component.type === 'hg_button') {
        const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
        if (toggleMode) {
          callbacks.push({
            onCallback: `${component.id}_on_callback`,
            offCallback: `${component.id}_off_callback`
          });
        }
      }
    });

    return callbacks;
  }

  /**
   * 收集所有双态按钮回调实现
   */
  private collectToggleButtonCallbackImpls(): string[] {
    const impls: string[] = [];

    this.allComponents.forEach(component => {
      if (component.type === 'hg_button') {
        const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
        if (toggleMode) {
          const impl = `/* USER CODE BEGIN ${component.id}_on_callback */
/**
 * ${component.id} 开启状态回调
 * 当按钮切换到开启状态时调用
 */
void ${component.id}_on_callback(void)
{
    // TODO: 实现开启状态的业务逻辑
    // 例如：music_player_play();
}
/* USER CODE END ${component.id}_on_callback */

/* USER CODE BEGIN ${component.id}_off_callback */
/**
 * ${component.id} 关闭状态回调
 * 当按钮切换到关闭状态时调用
 */
void ${component.id}_off_callback(void)
{
    // TODO: 实现关闭状态的业务逻辑
    // 例如：music_player_pause();
}
/* USER CODE END ${component.id}_off_callback */
`;
          impls.push(impl);
        }
      }
    });

    return impls;
  }
}
