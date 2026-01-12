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

// 事件回调函数声明
`;

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
    const timeLabels = this.allComponents.filter(c => c.type === 'hg_label' && c.data?.timeFormat);
    
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

    // 生成普通回调函数模板
    const callbackFunctions = this.collectCallbackFunctions();
    const switchViewFuncNames = new Set(this.collectSwitchViewCallbackNames());
    const timeUpdateFuncNames = new Set(this.collectTimeUpdateCallbackNames());
    const msgCallbackNames = new Set(this.collectMessageCallbackNames());
    
    callbackFunctions.forEach(funcName => {
      if (switchViewFuncNames.has(funcName) || timeUpdateFuncNames.has(funcName) || msgCallbackNames.has(funcName)) return;
      
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
      if (component.type === 'hg_label' && component.data?.timeFormat) {
        const timeFormat = component.data.timeFormat;
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
      if (component.type === 'hg_label' && component.data?.timeFormat) {
        names.push(`${component.id}_time_update_cb`);
      }
    });

    return names;
  }

  /**
   * 获取时间格式对应的缓冲区大小
   */
  private getTimeBufferSize(timeFormat?: string): number {
    switch (timeFormat) {
      case 'HH:mm:ss': return 10;  // "HH:MM:SS\0" = 9, 留一点余量
      case 'HH:mm': return 8;       // "HH:MM\0" = 6
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
      //code += `    gui_log("[TIME] Formatted: %s (hour=%d, min=%d, sec=%d)\\n", ${componentId}_time_str, t->tm_hour, t->tm_min, t->tm_sec);\n`;
    } else if (timeFormat === 'HH:mm') {
      code += `    sprintf(${componentId}_time_str, "${formatStr}", t->tm_hour, t->tm_min);\n`;
      //code += `    gui_log("[TIME] Formatted: %s\\n", ${componentId}_time_str);\n`;
    } else if (timeFormat === 'YYYY-MM-DD') {
      code += `    sprintf(${componentId}_time_str, "${formatStr}", t->tm_year + 1900, t->tm_mon + 1, t->tm_mday);\n`;
      //code += `    gui_log("[TIME] Formatted: %s\\n", ${componentId}_time_str);\n`;
    } else if (timeFormat === 'YYYY-MM-DD HH:mm:ss') {
      code += `    sprintf(${componentId}_time_str, "${formatStr}", t->tm_year + 1900, t->tm_mon + 1, t->tm_mday, t->tm_hour, t->tm_min, t->tm_sec);\n`;
      //code += `    gui_log("[TIME] Formatted: %s\\n", ${componentId}_time_str);\n`;
    } else if (timeFormat === 'MM-DD HH:mm') {
      code += `    sprintf(${componentId}_time_str, "${formatStr}", t->tm_mon + 1, t->tm_mday, t->tm_hour, t->tm_min);\n`;
      //code += `    gui_log("[TIME] Formatted: %s\\n", ${componentId}_time_str);\n`;
    }

    code += `    \n`;
    code += `    gui_text_content_set((gui_text_t *)${componentId}, ${componentId}_time_str, strlen(${componentId}_time_str));\n`;
    code += `}`;

    return code;
  }
}
