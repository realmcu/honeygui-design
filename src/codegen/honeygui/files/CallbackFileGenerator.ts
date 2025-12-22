/**
 * 回调文件生成器
 * 负责生成 callbacks.h 和 callbacks.c 文件
 */
import { Component } from '../../../hml/types';
import { EventGeneratorFactory } from '../events';

export class CallbackFileGenerator {
  private components: Component[];
  private componentMap: Map<string, Component>;

  constructor(components: Component[]) {
    this.components = components;
    this.componentMap = new Map(components.map(c => [c.id, c]));
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
    callbackFunctions.forEach(funcName => {
      code += `void ${funcName}(void *obj, gui_event_t event, void *param);\n`;
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
    let code = `#include "${baseName}_callbacks.h"
#include "../ui/${baseName}_ui.h"
#include <stdio.h>

// 事件回调函数实现

`;

    // 收集 switchView 回调实现
    const switchViewImpls = this.collectSwitchViewCallbackImpls();
    switchViewImpls.forEach(impl => {
      code += impl + '\n\n';
    });

    // 生成普通回调函数模板
    const callbackFunctions = this.collectCallbackFunctions();
    const switchViewFuncNames = new Set(this.collectSwitchViewCallbackNames());
    
    callbackFunctions.forEach(funcName => {
      if (switchViewFuncNames.has(funcName)) return;
      
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

    this.components.forEach(component => {
      const generator = EventGeneratorFactory.getGenerator(component.type);
      generator.collectCallbackFunctions(component).forEach(fn => functions.add(fn));
    });

    return Array.from(functions).sort();
  }

  /**
   * 收集所有 switchView 回调实现
   */
  private collectSwitchViewCallbackImpls(): string[] {
    const impls: string[] = [];

    this.components.forEach(component => {
      const generator = EventGeneratorFactory.getGenerator(component.type);
      if (generator.getSwitchViewCallbackImpl) {
        generator.getSwitchViewCallbackImpl(component, this.componentMap).forEach(impl => {
          impls.push(impl);
        });
      }
    });

    return impls;
  }

  /**
   * 收集所有 switchView 回调函数名
   */
  private collectSwitchViewCallbackNames(): string[] {
    const names: string[] = [];

    this.components.forEach(component => {
      if (!component.eventConfigs) return;
      component.eventConfigs.forEach(eventConfig => {
        eventConfig.actions.forEach(action => {
          if (action.type === 'switchView' && action.target) {
            names.push(`${component.id}_switch_view_cb`);
          }
        });
      });
    });

    return names;
  }
}
