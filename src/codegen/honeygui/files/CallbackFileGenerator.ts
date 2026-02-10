/**
 * 回调文件生成器
 * 负责生成 callbacks.h 和 callbacks.c 文件
 */
import { Component } from '../../../hml/types';
import { EventGeneratorFactory } from '../events';
import { getMessageCallbackName, generateEventCallbackName } from '../events/EventCodeGenerator';

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
   * 特别处理 list_item：包含 list_item 本身及其所有子组件
   */
  private flattenComponents(components: Component[]): Component[] {
    const visited = new Set<string>();
    const result: Component[] = [];
    
    const traverse = (comp: Component) => {
      // 防止重复访问
      if (visited.has(comp.id)) return;
      visited.add(comp.id);
      
      result.push(comp);
      
      // 递归处理子组件（包括 list_item 的子组件）
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
   * @param baseName 设计名称
   * @param existingCallbacksC 现有的 callbacks.c 文件内容（可选），用于提取自定义函数声明
   */
  generateHeader(baseName: string, existingCallbacksC?: string): string {
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
        code += `void ${funcName}(void *obj, gui_event_t *e);\n`;
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

    // 从 callbacks.c 的保护区提取自定义函数并生成声明
    if (existingCallbacksC) {
      const customFunctions = this.extractCustomFunctionDeclarations(existingCallbacksC);
      if (customFunctions.length > 0) {
        code += `\n// 自定义函数声明（从 callbacks.c 保护区自动提取）\n`;
        customFunctions.forEach(declaration => {
          code += `${declaration};\n`;
        });
      }
    }

    code += `
#endif // ${guardName}
`;

    return code;
  }

  /**
   * 生成回调实现文件
   * @param baseName 设计名称
   * @param existingContent 现有文件内容（可选），用于检查已存在的函数
   */
  generateImplementation(baseName: string, existingContent?: string): string {
    // 收集所有时间标签和计时器标签（使用 allComponents）
    const timeLabels = this.allComponents.filter(c => c.type === 'hg_time_label');
    const timerLabels = this.allComponents.filter(c => c.type === 'hg_label' && c.data?.isTimerLabel === true);
    
    // 提取现有文件中 custom_functions 保护区的函数名
    const existingFunctions = existingContent ? this.extractFunctionNamesFromProtectedArea(existingContent) : new Set<string>();
    
    // 检查是否需要 tp_algo.h（用于抬起区域检测）
    const needsTpAlgo = this.checkNeedsTpAlgo();
    
    let code = `#include "${baseName}_callbacks.h"
#include "../ui/${baseName}_ui.h"
#include <stdio.h>
#include <string.h>
#include <time.h>
`;

    // 如果需要抬起区域检测，添加 tp_algo.h
    if (needsTpAlgo) {
      code += `#include "tp_algo.h"\n`;
    }

    code += `\n`;

    // 为每个时间标签声明外部全局变量（在 UI 文件中定义）
    if (timeLabels.length > 0) {
      code += `// 时间字符串全局变量（在 UI 文件中定义）\n`;
      timeLabels.forEach(label => {
        const bufferSize = this.getTimeBufferSize(label.data?.timeFormat);
        code += `extern char ${label.id}_time_str[${bufferSize}];\n`;
      });
      code += `\n`;
    }

    // 为每个计时器标签声明外部全局变量（在 UI 文件中定义）
    if (timerLabels.length > 0) {
      code += `// 计时器字符串全局变量（在 UI 文件中定义）\n`;
      timerLabels.forEach(label => {
        const bufferSize = this.getTimerBufferSize(label.data?.timerFormat);
        code += `extern char ${label.id}_timer_str[${bufferSize}];\n`;
        code += `extern int ${label.id}_timer_value;\n`;
      });
      code += `\n`;
    }

    code += `// 事件回调函数实现\n\n`;

    // 收集 switchView 回调实现
    const switchViewImpls = this.collectSwitchViewCallbackImpls();
    switchViewImpls.forEach(impl => {
      code += impl + '\n\n';
    });

    // 收集 onMessage 回调实现（跳过已存在的）
    const messageImpls = this.collectMessageCallbackImpls(existingFunctions);
    messageImpls.forEach(impl => {
      code += impl + '\n\n';
    });

    // 收集 controlTimer 回调实现（跳过已存在的）
    const controlTimerImpls = this.collectControlTimerCallbackImpls(existingFunctions);
    controlTimerImpls.forEach(impl => {
      code += impl + '\n\n';
    });

    // 收集按键事件回调实现（跳过已存在的）
    const keyEventImpls = this.collectKeyEventCallbackImpls(existingFunctions);
    keyEventImpls.forEach(impl => {
      code += impl + '\n\n';
    });

    // 生成时间更新回调
    const timeUpdateImpls = this.collectTimeUpdateCallbackImpls();
    timeUpdateImpls.forEach(impl => {
      code += impl + '\n\n';
    });

    // 生成预设定时器回调实现（跳过已存在的）
    const timerCallbackImpls = this.collectTimerCallbackImpls(existingFunctions);
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

    // 生成普通回调函数模板（跳过已存在的）
    const callbackFunctions = this.collectCallbackFunctions();
    const switchViewFuncNames = new Set(this.collectSwitchViewCallbackNames());
    const timeUpdateFuncNames = new Set(this.collectTimeUpdateCallbackNames());
    const timerCallbackNames = new Set(this.collectTimerCallbackNames());
    const msgCallbackNames = new Set(this.collectMessageCallbackNames());
    const controlTimerCallbackNames = new Set(this.collectControlTimerCallbackNames());
    const keyEventCallbackNames = new Set(this.collectKeyEventCallbackNames());
    
    callbackFunctions.forEach(funcName => {
      // 跳过特殊类型的回调（它们有专门的生成逻辑）
      if (switchViewFuncNames.has(funcName) || timeUpdateFuncNames.has(funcName) || timerCallbackNames.has(funcName) || msgCallbackNames.has(funcName) || controlTimerCallbackNames.has(funcName) || keyEventCallbackNames.has(funcName)) return;
      
      // 跳过已存在于 custom_functions 保护区的函数
      if (existingFunctions.has(funcName)) {
        // 函数已存在，不生成模板
        return;
      }
      
      code += `void ${funcName}(void *obj, gui_event_t *e)\n`;
      code += `{\n`;
      code += `    GUI_UNUSED(obj);\n`;
      code += `    GUI_UNUSED(e);\n`;
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
   * 从 custom_functions 保护区提取已存在的函数名
   */
  private extractFunctionNamesFromProtectedArea(content: string): Set<string> {
    const functionNames = new Set<string>();
    
    // 提取 custom_functions 保护区内容
    const regex = /\/\* @protected start custom_functions \*\/([\s\S]*?)\/\* @protected end custom_functions \*\//;
    const match = content.match(regex);
    
    if (match && match[1]) {
      const protectedContent = match[1];
      
      // 匹配函数定义：void function_name(...) 或 static void function_name(...)
      const funcRegex = /(?:static\s+)?void\s+(\w+)\s*\(/g;
      let funcMatch;
      
      while ((funcMatch = funcRegex.exec(protectedContent)) !== null) {
        functionNames.add(funcMatch[1]);
      }
    }
    
    return functionNames;
  }

  /**
   * 从 callbacks.c 的 custom_functions 保护区提取自定义函数声明
   * 返回函数声明数组（不包含函数体）
   */
  private extractCustomFunctionDeclarations(content: string): string[] {
    const declarations: string[] = [];
    
    // 提取 custom_functions 保护区内容
    const regex = /\/\* @protected start custom_functions \*\/([\s\S]*?)\/\* @protected end custom_functions \*\//;
    const match = content.match(regex);
    
    if (!match || !match[1]) {
      return declarations;
    }
    
    const protectedContent = match[1];
    
    // 匹配函数定义（包括 static）
    // 支持多种返回类型：void, int, char*, gui_obj_t*, 等
    const funcRegex = /((?:static\s+)?(?:void|int|char\s*\*|gui_obj_t\s*\*|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|bool)\s+\w+\s*\([^)]*\))/g;
    let funcMatch;
    
    while ((funcMatch = funcRegex.exec(protectedContent)) !== null) {
      const declaration = funcMatch[1].trim();
      // 移除 static 关键字（头文件中不需要）
      const cleanDeclaration = declaration.replace(/^static\s+/, '');
      declarations.push(cleanDeclaration);
    }
    
    return declarations;
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
   * @param existingFunctions 已存在的函数名集合（从 custom_functions 保护区提取）
   */
  private collectMessageCallbackImpls(existingFunctions: Set<string> = new Set()): string[] {
    const impls = new Map<string, string>(); // 使用 Map 去重，key 为函数名

    this.allComponents.forEach(component => {
      const generator = EventGeneratorFactory.getGenerator(component.type);
      if (generator.getMessageCallbackImpl) {
        generator.getMessageCallbackImpl(component, this.componentMap).forEach(impl => {
          // 提取函数名作为 key
          const match = impl.match(/void\s+(\w+)\s*\(/);
          if (match) {
            const funcName = match[1];
            // 跳过已存在于 custom_functions 保护区的函数
            if (!existingFunctions.has(funcName)) {
              impls.set(funcName, impl);
            }
          }
        });
      }
    });

    return Array.from(impls.values());
  }

  /**
   * 收集所有 controlTimer 回调实现
   * @param existingFunctions 已存在的函数名集合（从 custom_functions 保护区提取）
   */
  private collectControlTimerCallbackImpls(existingFunctions: Set<string> = new Set()): string[] {
    const impls = new Map<string, string>(); // 使用 Map 去重，key 为函数名

    this.allComponents.forEach(component => {
      const generator = EventGeneratorFactory.getGenerator(component.type);
      if (generator.getControlTimerCallbackImpl) {
        generator.getControlTimerCallbackImpl(component, this.componentMap).forEach(impl => {
          // 提取函数名作为 key
          const match = impl.match(/void\s+(\w+)\s*\(/);
          if (match) {
            const funcName = match[1];
            // 跳过已存在于 custom_functions 保护区的函数
            if (!existingFunctions.has(funcName)) {
              impls.set(funcName, impl);
            }
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
   * 收集所有 controlTimer 回调函数名
   */
  private collectControlTimerCallbackNames(): string[] {
    const names: string[] = [];

    this.allComponents.forEach(component => {
      if (!component.eventConfigs) return;
      
      // 为每个事件类型维护独立的索引
      const eventTypeIndexMap = new Map<string, number>();
      
      component.eventConfigs.forEach(eventConfig => {
        if (eventConfig.type === 'onMessage') return;
        
        // 跳过按键事件（按键事件的 controlTimer 在按键回调中处理）
        if ((eventConfig.type === 'onKeyShortPress' || eventConfig.type === 'onKeyLongPress') && eventConfig.keyName) {
          return;
        }
        
        const controlTimerActions = eventConfig.actions.filter(a => 
          a.type === 'controlTimer' && a.timerTargets && a.timerTargets.length > 0
        );
        
        if (controlTimerActions.length > 0) {
          const currentIndex = eventTypeIndexMap.get(eventConfig.type) || 0;
          
          controlTimerActions.forEach((_, actionIndex) => {
            const callbackName = generateEventCallbackName(component.id, eventConfig.type, currentIndex + actionIndex);
            names.push(callbackName);
          });
          
          eventTypeIndexMap.set(eventConfig.type, currentIndex + controlTimerActions.length);
        }
      });
    });

    return names;
  }

  /**
   * 收集所有按键事件回调实现
   * @param existingFunctions 已存在的函数名集合（从 custom_functions 保护区提取）
   */
  private collectKeyEventCallbackImpls(existingFunctions: Set<string> = new Set()): string[] {
    const impls = new Map<string, string>(); // 使用 Map 去重，key 为函数名

    this.allComponents.forEach(component => {
      const generator = EventGeneratorFactory.getGenerator(component.type);
      if (generator.getKeyEventCallbackImpl) {
        generator.getKeyEventCallbackImpl(component, this.componentMap).forEach(impl => {
          // 提取函数名作为 key
          const match = impl.match(/void\s+(\w+)\s*\(/);
          if (match) {
            const funcName = match[1];
            // 跳过已存在于 custom_functions 保护区的函数
            if (!existingFunctions.has(funcName)) {
              impls.set(funcName, impl);
            }
          }
        });
      }
    });

    return Array.from(impls.values());
  }

  /**
   * 收集所有按键事件回调函数名
   */
  private collectKeyEventCallbackNames(): string[] {
    const names: string[] = [];

    this.allComponents.forEach(component => {
      if (!component.eventConfigs) return;
      let keyEventIndex = 0;
      component.eventConfigs.forEach(eventConfig => {
        if ((eventConfig.type === 'onKeyShortPress' || eventConfig.type === 'onKeyLongPress') && eventConfig.keyName) {
          names.push(`${component.id}_key_${keyEventIndex}_cb`);
          keyEventIndex++;
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

    // 时间标签的更新回调
    this.allComponents.forEach(component => {
      if (component.type === 'hg_time_label') {
        const timeFormat = component.data?.timeFormat || 'HH:mm:ss';
        const funcName = `${component.id}_time_update_cb`;
        const impl = this.generateTimeUpdateCallback(component.id, timeFormat);
        impls.set(funcName, impl);
      }
    });

    // 计时器标签的更新回调
    this.allComponents.forEach(component => {
      if (component.type === 'hg_label' && component.data?.isTimerLabel === true) {
        const timerFormat = component.data?.timerFormat || 'HH:MM:SS';
        const timerType = component.data?.timerType || 'stopwatch';
        const funcName = `${component.id}_timer_update_cb`;
        const impl = this.generateTimerUpdateCallback(component.id, timerFormat, timerType);
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
      // 计时器标签的更新回调
      if (component.type === 'hg_label' && component.data?.isTimerLabel === true) {
        names.push(`${component.id}_timer_update_cb`);
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
          // 预设动作模式：支持 segments（多段动画）或 actions（单段动画）
          if (timer.mode === 'preset' && ((timer.segments && timer.segments.length > 0) || (timer.actions && timer.actions.length > 0))) {
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
   * @param existingFunctions 已存在的函数名集合（从 custom_functions 保护区提取）
   */
  private collectTimerCallbackImpls(existingFunctions: Set<string> = new Set()): string[] {
    const impls = new Map<string, string>();

    this.allComponents.forEach(component => {
      // 支持新版 timers 数组
      if (component.data?.timers && Array.isArray(component.data.timers)) {
        component.data.timers.forEach((timer: any) => {
          // 预设动作模式：支持 segments（多段动画）或 actions（单段动画）
          if (timer.mode === 'preset' && ((timer.segments && timer.segments.length > 0) || (timer.actions && timer.actions.length > 0))) {
            // 预设动作模式：生成自动实现的回调函数
            const callback = `${component.id}_${timer.id}_cb`;
            if (!impls.has(callback)) {
              const impl = this.generatePresetTimerCallbackFromConfig(component, timer);
              impls.set(callback, impl);
            }
          } else if (timer.mode === 'custom' && timer.callback) {
            // 自定义函数模式：生成空实现供用户填充
            const callback = timer.callback;
            // 跳过已存在于 custom_functions 保护区的函数
            if (!impls.has(callback) && !existingFunctions.has(callback)) {
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
          // 跳过已存在于 custom_functions 保护区的函数
          if (!impls.has(callback) && !existingFunctions.has(callback)) {
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
        // 调整透明度动作
        code += `    // 调整透明度: ${action.from} -> ${action.to}\n`;
        code += `    const uint8_t opacity_origin = ${action.from};\n`;
        code += `    const uint8_t opacity_target = ${action.to};\n`;
        code += `    int16_t opacity_cur = opacity_origin + (opacity_target - opacity_origin) * cnt / cnt_max;\n`;
        // hg_image 使用 gui_img_set_opacity，其他组件使用 target->opacity_value
        if (component.type === 'hg_image') {
          code += `    gui_img_set_opacity((gui_img_t *)target, opacity_cur);\n`;
        } else {
          code += `    target->opacity_value = opacity_cur;\n`;
        }
        code += `    \n`;
      } else if (action.type === 'rotation') {
        // 调整旋转动作（仅支持 hg_image）
        code += `    // 调整旋转: ${action.angleOrigin}° -> ${action.angleTarget}°\n`;
        code += `    const float angle_origin = ${action.angleOrigin};\n`;
        code += `    const float angle_target = ${action.angleTarget};\n`;
        code += `    float angle_cur = angle_origin + (angle_target - angle_origin) * cnt / cnt_max;\n`;
        code += `    gui_img_rotation((gui_img_t *)target, angle_cur);\n`;
        code += `    \n`;
      } else if (action.type === 'scale') {
        // 调整缩放动作（仅支持 hg_image）
        code += `    // 调整缩放: (${action.zoomXOrigin}, ${action.zoomYOrigin}) -> (${action.zoomXTarget}, ${action.zoomYTarget})\n`;
        code += `    const float zoom_x_origin = ${action.zoomXOrigin};\n`;
        code += `    const float zoom_x_target = ${action.zoomXTarget};\n`;
        code += `    const float zoom_y_origin = ${action.zoomYOrigin};\n`;
        code += `    const float zoom_y_target = ${action.zoomYTarget};\n`;
        code += `    float zoom_x_cur = zoom_x_origin + (zoom_x_target - zoom_x_origin) * cnt / cnt_max;\n`;
        code += `    float zoom_y_cur = zoom_y_origin + (zoom_y_target - zoom_y_origin) * cnt / cnt_max;\n`;
        code += `    gui_img_scale((gui_img_t *)target, zoom_x_cur, zoom_y_cur);\n`;
        code += `    \n`;
      } else if (action.type === 'setFocus') {
        // 设置焦点动作（适配所有组件）
        code += `    // 设置焦点\n`;
        code += `    gui_obj_focus_set(target);\n`;
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
   * 从 TimerConfig 生成预设动作的定时器回调函数（支持多段动画）
   */
  private generatePresetTimerCallbackFromConfig(component: Component, timer: any): string {
    const callback = `${component.id}_${timer.id}_cb`;
    const segments = timer.segments || [];
    const interval = timer.interval || 1000;
    const stopOnComplete = timer.stopOnComplete !== false;
    const timerName = timer.name || timer.id;
    
    // 如果有多段动画，使用新的多段动画生成逻辑
    if (segments.length > 0) {
      return this.generateMultiSegmentTimerCallback(component, timer, callback, timerName, interval, stopOnComplete, segments);
    }
    
    // 否则使用旧的单段动画逻辑（兼容旧版）
    const actions = timer.actions || [];
    const duration = timer.duration || 1000;
    const delayStart = timer.delayStart || 0;
    
    // 计算 cnt_max 和 cnt_wait
    const cntMax = Math.ceil(duration / interval);
    const cntWait = Math.ceil(delayStart / interval);
    
    let code = `/**
 * ${timerName}
 * 组件: ${component.id}
 * 模式: 预设动作（单段）
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
      code += this.generateActionCode(action, delayStart > 0, 'cnt', 'cnt_wait', 'cnt_max', component);
    });
    
    // 增加计数器
    code += `    cnt++;\n`;
    
    // 如果启用了日志，添加 gui_log 打印
    if (timer.enableLog) {
      code += `    gui_log("${callback}: cnt=%d\\n", cnt);\n`;
    }
    
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
   * 生成多段动画的定时器回调函数
   */
  private generateMultiSegmentTimerCallback(
    component: Component,
    timer: any,
    callback: string,
    timerName: string,
    interval: number,
    stopOnComplete: boolean,
    segments: any[]
  ): string {
    // 计算每段的 cnt_max
    const segmentCntMaxes = segments.map(seg => Math.ceil(seg.duration / interval));
    const totalCntMax = segmentCntMaxes.reduce((sum, cnt) => sum + cnt, 0);
    
    let code = `/**
 * ${timerName}
 * 组件: ${component.id}
 * 模式: 预设动作（多段动画）
 * 段数: ${segments.length}
 */
void ${callback}(void *obj)\n{\n`;
    code += `    gui_obj_t *target = (gui_obj_t *)obj;\n`;
    code += `    static uint16_t cnt = 0;\n`;
    code += `    const uint16_t total_cnt_max = ${totalCntMax};\n`;
    code += `    \n`;
    
    // 为每段生成边界常量
    let cumulativeCnt = 0;
    segments.forEach((seg, idx) => {
      const segCntMax = segmentCntMaxes[idx];
      code += `    const uint16_t seg${idx}_start = ${cumulativeCnt};\n`;
      code += `    const uint16_t seg${idx}_end = ${cumulativeCnt + segCntMax};\n`;
      cumulativeCnt += segCntMax;
    });
    code += `    \n`;
    
    // cnt++ 在判断前执行
    code += `    cnt++;\n`;
    
    // 如果启用了日志，添加 gui_log 打印
    if (timer.enableLog) {
      code += `    gui_log("${callback}: cnt=%d\\n", cnt);\n`;
    }
    
    code += `    \n`;
    
    // 为每段生成条件分支（使用 if-else 提高效率）
    segments.forEach((seg, idx) => {
      const actions = seg.actions || [];
      const ifKeyword = idx === 0 ? 'if' : 'else if';
      
      if (actions.length === 0) {
        // 空段（等待）
        code += `    // 段 ${idx + 1}: 等待 ${seg.duration}ms\n`;
        code += `    ${ifKeyword} (cnt > seg${idx}_start && cnt <= seg${idx}_end) {\n`;
        code += `        // 无动作，仅等待\n`;
        code += `    }\n`;
      } else {
        // 检查是否所有动作都不需要段内计数器（跳转界面、更换图片、设置可见性、切换定时动画、设置焦点等）
        const allNoSegCounter = actions.every((action: any) => 
          action.type === 'switchView' || action.type === 'changeImage' || action.type === 'visibility' || action.type === 'switchTimer' || action.type === 'setFocus'
        );
        
        // 有动作的段
        code += `    // 段 ${idx + 1}: ${seg.duration}ms, ${actions.length} 个动作\n`;
        code += `    ${ifKeyword} (cnt > seg${idx}_start && cnt <= seg${idx}_end) {\n`;
        
        // 只有在需要渐变计算时才生成段内计数器
        if (!allNoSegCounter) {
          code += `        uint16_t seg_cnt = cnt - seg${idx}_start;\n`;
          code += `        const uint16_t seg_cnt_max = seg${idx}_end - seg${idx}_start;\n`;
          code += `        \n`;
        }
        
        // 为每个动作生成代码
        actions.forEach((action: any) => {
          const actionCode = this.generateActionCode(action, false, 'seg_cnt', '', 'seg_cnt_max', component);
          // 缩进处理
          const indentedCode = actionCode.split('\n').map(line => line ? `        ${line}` : line).join('\n');
          code += indentedCode;
        });
        
        code += `    }\n`;
      }
    });
    
    code += `    \n`;
    
    // 到达总时间后的处理
    if (stopOnComplete) {
      code += `    if (cnt >= total_cnt_max) {\n`;
      code += `        gui_obj_stop_timer(target);\n`;
      code += `        cnt = 0; // 重置计数器\n`;
      code += `    }\n`;
    } else {
      code += `    if (cnt >= total_cnt_max) {\n`;
      code += `        cnt = 0; // 重置计数器，继续循环\n`;
      code += `    }\n`;
    }
    
    code += `}\n`;
    
    return code;
  }

  /**
   * 生成单个动作的代码
   */
  private generateActionCode(action: any, hasDelay: boolean, cntVar: string, waitVar: string, maxVar: string, component?: Component): string {
    let code = '';
    const progressExpr = hasDelay ? `(${cntVar} - ${waitVar}) / ${maxVar}` : `${cntVar} / ${maxVar}`;
    
    if (action.type === 'visibility') {
      // 设置可见性动作
      const visible = action.visible !== false; // 默认为 true
      code += `    // 设置可见性: ${visible ? '显示' : '隐藏'}\n`;
      code += `    gui_obj_show(target, ${visible ? 'true' : 'false'});\n`;
      code += `    \n`;
    } else if (action.type === 'changeImage') {
      // 更换图片动作（仅支持 hg_image）
      let imagePath = action.imagePath || '';
      // 去掉 assets/ 前缀，只保留后面的路径
      if (imagePath.startsWith('assets/')) {
        imagePath = imagePath.substring(6); // 去掉 'assets/'
      }
      // 将路径后缀改为 .bin
      if (imagePath && !imagePath.endsWith('.bin')) {
        imagePath = imagePath.replace(/\.[^.]+$/, '.bin');
      }
      code += `    // 更换图片: ${imagePath}\n`;
      code += `    gui_img_set_src((gui_img_t *)target, "${imagePath}", IMG_SRC_FILESYS);\n`;
      code += `    gui_img_refresh_size((gui_img_t *)target);\n`;
      code += `    \n`;
    } else if (action.type === 'imageSequence') {
      // 图片序列动作（仅支持 hg_image）
      const imageSequence = action.imageSequence || [];
      if (imageSequence.length > 0) {
        // 处理图片路径：去掉 assets/ 前缀，改为 .bin 后缀
        const processedPaths = imageSequence.map((path: string) => {
          let processed = path;
          if (processed.startsWith('assets/')) {
            processed = processed.substring(6);
          }
          if (processed && !processed.endsWith('.bin')) {
            processed = processed.replace(/\.[^.]+$/, '.bin');
          }
          return processed;
        });
        
        code += `    // 图片序列动画: ${processedPaths.length} 张图片\n`;
        code += `    const void *img_data_array[${processedPaths.length}] = {\n`;
        processedPaths.forEach((path: string, idx: number) => {
          code += `        "${path}"${idx < processedPaths.length - 1 ? ',' : ''}\n`;
        });
        code += `    };\n`;
        code += `    uint16_t index = (${processedPaths.length} - 1) * ${progressExpr};\n`;
        code += `    gui_img_set_src((gui_img_t *)target, img_data_array[index], IMG_SRC_FILESYS);\n`;
        code += `    gui_img_refresh_size((gui_img_t *)target);\n`;
        code += `    \n`;
      }
    } else if (action.type === 'switchView') {
      // 跳转界面动作
      const targetName = action.target || 'unknown_view';
      const switchOutStyle = action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION';
      const switchInStyle = action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION';
      code += `    // 跳转界面: ${targetName}\n`;
      code += `    gui_view_switch_direct(gui_view_get_current(), "${targetName}", ${switchOutStyle}, ${switchInStyle});\n`;
      code += `    \n`;
    } else if (action.type === 'switchTimer') {
      // 切换定时动画动作
      const timerId = action.timerId || '';
      if (!timerId) {
        code += `    // 警告：未指定目标定时动画ID\n`;
        return code;
      }
      
      // 查找目标定时器配置
      const targetTimer = component?.data?.timers?.find((t: any) => t.id === timerId);
      if (!targetTimer) {
        code += `    // 警告：未找到定时动画 ${timerId}\n`;
        return code;
      }
      
      // 生成回调函数名
      let callback: string;
      if (targetTimer.mode === 'preset') {
        callback = `${component?.id}_${targetTimer.id}_cb`;
      } else if (targetTimer.mode === 'custom' && targetTimer.callback) {
        callback = targetTimer.callback;
      } else {
        code += `    // 警告：定时动画 ${timerId} 配置无效\n`;
        return code;
      }
      
      const timerName = targetTimer.name || targetTimer.id;
      code += `    // 切换定时动画: ${timerName}\n`;
      code += `    gui_obj_create_timer(target, ${targetTimer.interval}, ${targetTimer.reload !== false ? 'true' : 'false'}, ${callback});\n`;
      // 如果目标定时器没有设置立即运行，则调用 gui_obj_start_timer
      if (!targetTimer.runImmediately) {
        code += `    gui_obj_start_timer(target);\n`;
      }
      code += `    cnt = 0; // 重置计数器\n`;
      code += `    return; // 切换定时动画后立即返回\n`;
      code += `    \n`;
    } else if (action.type === 'position') {
      // 调整位置动作
      code += `    // 调整位置: (${action.fromX}, ${action.fromY}) -> (${action.toX}, ${action.toY})\n`;
      code += `    const int16_t x_origin = ${action.fromX};\n`;
      code += `    const int16_t y_origin = ${action.fromY};\n`;
      code += `    const int16_t x_target = ${action.toX};\n`;
      code += `    const int16_t y_target = ${action.toY};\n`;
      code += `    int16_t x_cur = x_origin + (x_target - x_origin) * ${progressExpr};\n`;
      code += `    int16_t y_cur = y_origin + (y_target - y_origin) * ${progressExpr};\n`;
      code += `    gui_obj_move(target, x_cur, y_cur);\n`;
      code += `    \n`;
    } else if (action.type === 'size') {
      // 调整大小动作（仅支持 hg_window）
      code += `    // 调整大小: (${action.fromW}, ${action.fromH}) -> (${action.toW}, ${action.toH})\n`;
      code += `    const int16_t w_origin = ${action.fromW};\n`;
      code += `    const int16_t h_origin = ${action.fromH};\n`;
      code += `    const int16_t w_target = ${action.toW};\n`;
      code += `    const int16_t h_target = ${action.toH};\n`;
      code += `    int16_t w_cur = w_origin + (w_target - w_origin) * ${progressExpr};\n`;
      code += `    int16_t h_cur = h_origin + (h_target - h_origin) * ${progressExpr};\n`;
      code += `    target->w = w_cur;\n`;
      code += `    target->h = h_cur;\n`;
      code += `    \n`;
    } else if (action.type === 'opacity') {
      // 调整透明度动作
      code += `    // 调整透明度: ${action.from} -> ${action.to}\n`;
      code += `    const uint8_t opacity_origin = ${action.from};\n`;
      code += `    const uint8_t opacity_target = ${action.to};\n`;
      code += `    int16_t opacity_cur = opacity_origin + (opacity_target - opacity_origin) * ${progressExpr};\n`;
      // hg_image 使用 gui_img_set_opacity，其他组件使用 target->opacity_value
      if (component?.type === 'hg_image') {
        code += `    gui_img_set_opacity((gui_img_t *)target, opacity_cur);\n`;
      } else {
        code += `    target->opacity_value = opacity_cur;\n`;
      }
      code += `    \n`;
    } else if (action.type === 'rotation') {
      // 调整旋转动作（仅支持 hg_image）
      code += `    // 调整旋转: ${action.angleOrigin}° -> ${action.angleTarget}°\n`;
      code += `    const float angle_origin = ${action.angleOrigin};\n`;
      code += `    const float angle_target = ${action.angleTarget};\n`;
      code += `    float angle_cur = angle_origin + (angle_target - angle_origin) * ${progressExpr};\n`;
      code += `    gui_img_rotation((gui_img_t *)target, angle_cur);\n`;
      code += `    \n`;
    } else if (action.type === 'scale') {
      // 调整缩放动作（仅支持 hg_image）
      code += `    // 调整缩放: (${action.zoomXOrigin}, ${action.zoomYOrigin}) -> (${action.zoomXTarget}, ${action.zoomYTarget})\n`;
      code += `    const float zoom_x_origin = ${action.zoomXOrigin};\n`;
      code += `    const float zoom_x_target = ${action.zoomXTarget};\n`;
      code += `    const float zoom_y_origin = ${action.zoomYOrigin};\n`;
      code += `    const float zoom_y_target = ${action.zoomYTarget};\n`;
      code += `    float zoom_x_cur = zoom_x_origin + (zoom_x_target - zoom_x_origin) * ${progressExpr};\n`;
      code += `    float zoom_y_cur = zoom_y_origin + (zoom_y_target - zoom_y_origin) * ${progressExpr};\n`;
      code += `    gui_img_scale((gui_img_t *)target, zoom_x_cur, zoom_y_cur);\n`;
      code += `    \n`;
    } else if (action.type === 'setFocus') {
      // 设置焦点动作（适配所有组件）
      code += `    // 设置焦点\n`;
      code += `    gui_obj_focus_set(target);\n`;
      code += `    \n`;
    }
    
    return code;
  }

  /**
   * 检查是否需要 tp_algo.h（用于抬起区域检测）
   */
  private checkNeedsTpAlgo(): boolean {
    return this.allComponents.some(component => {
      if (!component.eventConfigs) return false;
      return component.eventConfigs.some(eventConfig => 
        eventConfig.type === 'onTouchUp' && eventConfig.checkReleaseArea === true
      );
    });
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
   * 获取计时器格式对应的缓冲区大小
   */
  private getTimerBufferSize(timerFormat?: string): number {
    switch (timerFormat) {
      case 'HH:MM:SS': return 10;  // "HH:MM:SS\0" = 9 + 1
      case 'MM:SS': return 6;      // "MM:SS\0" = 5 + 1
      case 'MM:SS:MS': return 10;  // "MM:SS:MS\0" = 9 + 1
      case 'SS': return 4;         // "SS\0" = 2 + 1
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
   * 生成计时器更新回调函数
   * 用于正计时/倒计时功能
   * 参考秒表实现，使用毫秒级计数
   */
  private generateTimerUpdateCallback(componentId: string, timerFormat: string, timerType: string): string {
    let formatStr = '';
    let formatLogic = '';

    // 根据格式生成格式化逻辑（使用毫秒级计数）
    switch (timerFormat) {
      case 'HH:MM:SS':
        formatStr = '%02u:%02u:%02u';
        formatLogic = `sprintf(${componentId}_timer_str, "${formatStr}", 
           (${componentId}_timer_value / 3600000),
           (${componentId}_timer_value % 3600000) / 60000,
           (${componentId}_timer_value % 60000) / 1000);`;
        break;
      case 'MM:SS':
        formatStr = '%02u:%02u';
        formatLogic = `sprintf(${componentId}_timer_str, "${formatStr}", 
           (${componentId}_timer_value / 60000),
           (${componentId}_timer_value % 60000) / 1000);`;
        break;
      case 'MM:SS:MS':
        formatStr = '%02u:%02u:%02u';
        formatLogic = `sprintf(${componentId}_timer_str, "${formatStr}", 
           (${componentId}_timer_value / 60000),
           (${componentId}_timer_value % 60000) / 1000,
           (${componentId}_timer_value % 1000) / 10);`;
        break;
      case 'SS':
        formatStr = '%02u';
        formatLogic = `sprintf(${componentId}_timer_str, "${formatStr}", 
           (${componentId}_timer_value / 1000));`;
        break;
      default:
        formatStr = '%02u:%02u:%02u';
        formatLogic = `sprintf(${componentId}_timer_str, "${formatStr}", 
           (${componentId}_timer_value / 3600000),
           (${componentId}_timer_value % 3600000) / 60000,
           (${componentId}_timer_value % 60000) / 1000);`;
    }

    let code = `/**\n`;
    code += ` * 计时器更新回调函数\n`;
    code += ` * 类型: ${timerType === 'stopwatch' ? '正计时（Stopwatch）' : '倒计时（Countdown）'}\n`;
    code += ` * 格式: ${timerFormat}\n`;
    code += ` * 注意: timer_value 以毫秒为单位，定时器间隔建议设置为 10-100ms\n`;
    code += ` */\n`;
    code += `void ${componentId}_timer_update_cb(void *p)\n`;
    code += `{\n`;
    code += `    GUI_UNUSED(p);\n`;
    code += `    \n`;
    
    if (timerType === 'stopwatch') {
      // 正计时：参考秒表实现
      code += `    // 正计时：每次调用增加时间（假设定时器间隔为 10ms）\n`;
      code += `    ${componentId}_timer_value += 10;\n`;
    } else {
      // 倒计时：每次调用减少时间
      code += `    // 倒计时：每次调用减少时间（假设定时器间隔为 10ms）\n`;
      code += `    if (${componentId}_timer_value > 10) {\n`;
      code += `        ${componentId}_timer_value -= 10;\n`;
      code += `    } else {\n`;
      code += `        ${componentId}_timer_value = 0;\n`;
      code += `        // 倒计时结束，可以在此处停止定时器\n`;
      code += `        // gui_obj_stop_timer((gui_obj_t *)${componentId});\n`;
      code += `    }\n`;
    }
    
    code += `    \n`;
    code += `    // 格式化计时器字符串\n`;
    code += `    ${formatLogic}\n`;
    code += `    \n`;
    code += `    // 更新显示\n`;
    code += `    gui_text_content_set((gui_text_t *)${componentId}, ${componentId}_timer_str, strlen(${componentId}_timer_str));\n`;
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
          // 检查是否指定了控制目标
          const controlTarget = component.data?.controlTarget;
          
          let onCallbackBody = '';
          let offCallbackBody = '';
          
          if (controlTarget) {
            // 如果指定了控制目标，根据目标类型生成相应的回调
            const targetComp = this.componentMap.get(controlTarget);
            
            if (targetComp) {
              // 判断目标类型并生成相应的控制代码
              if (targetComp.type === 'hg_timer_label') {
                // 计时器标签：使用生成的控制函数
                onCallbackBody = `    // 启动计时器\n    ${targetComp.id}_start();`;
                offCallbackBody = `    // 停止计时器\n    ${targetComp.id}_stop();`;
              } else if (targetComp.type === 'hg_label' && targetComp.data?.isTimerLabel === true) {
                // 旧版计时器标签（向后兼容）：启动/停止计时器
                onCallbackBody = `    // 启动计时器\n    gui_obj_start_timer((void *)${targetComp.id});`;
                offCallbackBody = `    // 停止计时器\n    if (GUI_BASE(${targetComp.id})->timer) {\n        gui_obj_stop_timer((void *)${targetComp.id});\n    }`;
              } else if (targetComp.type === 'hg_video') {
                // 视频播放器：播放/暂停
                onCallbackBody = `    // 播放视频\n    // TODO: 实现视频播放逻辑\n    // gui_video_play(${targetComp.id});`;
                offCallbackBody = `    // 暂停视频\n    // TODO: 实现视频暂停逻辑\n    // gui_video_pause(${targetComp.id});`;
              } else {
                // 其他组件：显示/隐藏控制
                onCallbackBody = `    // 显示目标组件\n    gui_obj_show(${targetComp.id}, true);`;
                offCallbackBody = `    // 隐藏目标组件\n    gui_obj_show(${targetComp.id}, false);`;
              }
            } else {
              // 目标组件不存在
              onCallbackBody = `    // 警告：控制目标 "${controlTarget}" 不存在\n    // TODO: 请检查 controlTarget 属性是否正确`;
              offCallbackBody = `    // 警告：控制目标 "${controlTarget}" 不存在\n    // TODO: 请检查 controlTarget 属性是否正确`;
            }
          } else {
            // 如果没有指定控制目标，查找同一个 view 中所有 timerAutoStart=false 的计时标签
            const parentView = this.findParentView(component);
            const timerLabels = parentView ? this.findTimerLabelsInView(parentView) : [];
            
            if (timerLabels.length > 0) {
              // 找到了计时标签，生成计时器控制代码
              onCallbackBody = timerLabels.map(label => {
                if (label.type === 'hg_timer_label') {
                  return `    // 启动计时器\n    ${label.id}_start();`;
                } else {
                  return `    // 启动计时器\n    gui_obj_start_timer((void *)${label.id});`;
                }
              }).join('\n');
              offCallbackBody = timerLabels.map(label => {
                if (label.type === 'hg_timer_label') {
                  return `    // 停止计时器\n    ${label.id}_stop();`;
                } else {
                  return `    // 停止计时器\n    if (GUI_BASE(${label.id})->timer) {\n        gui_obj_stop_timer((void *)${label.id});\n    }`;
                }
              }).join('\n');
            } else {
              // 没有找到任何控制目标，生成通用模板
              onCallbackBody = `    // TODO: 实现开启状态的业务逻辑\n    // 提示：可以在按钮属性中设置 "Control Target" 来指定控制目标\n    // 例如：music_player_play();`;
              offCallbackBody = `    // TODO: 实现关闭状态的业务逻辑\n    // 提示：可以在按钮属性中设置 "Control Target" 来指定控制目标\n    // 例如：music_player_pause();`;
            }
          }
          
          const impl = `/* USER CODE BEGIN ${component.id}_on_callback */
/**
 * ${component.id} 开启状态回调
 * 当按钮切换到开启状态时调用
 */
void ${component.id}_on_callback(void)
{
${onCallbackBody}
}
/* USER CODE END ${component.id}_on_callback */

/* USER CODE BEGIN ${component.id}_off_callback */
/**
 * ${component.id} 关闭状态回调
 * 当按钮切换到关闭状态时调用
 */
void ${component.id}_off_callback(void)
{
${offCallbackBody}
}
/* USER CODE END ${component.id}_off_callback */
`;
          impls.push(impl);
        }
      }
    });

    return impls;
  }

  /**
   * 查找组件所在的父 view
   */
  private findParentView(component: Component): Component | null {
    // 遍历所有组件，找到包含该组件的 view
    for (const comp of this.allComponents) {
      if ((comp.type === 'hg_view' || comp.type === 'hg_window') && 
          comp.children && comp.children.includes(component.id)) {
        return comp;
      }
    }
    return null;
  }

  /**
   * 查找 view 中所有设置了 timerAutoStart=false 的计时标签
   */
  private findTimerLabelsInView(view: Component): Component[] {
    const timerLabels: Component[] = [];
    
    if (!view.children) return timerLabels;
    
    // 遍历 view 的所有子组件
    view.children.forEach(childId => {
      const child = this.componentMap.get(childId);
      if (child) {
        // 支持新版 hg_timer_label 和旧版 hg_label (isTimerLabel=true)
        const isTimerLabel = child.type === 'hg_timer_label' || 
                            (child.type === 'hg_label' && child.data?.isTimerLabel === true);
        const autoStart = child.data?.timerAutoStart !== false; // 默认自动启动
        
        if (isTimerLabel && !autoStart) {
          timerLabels.push(child);
        }
      }
    });
    
    return timerLabels;
  }
}
