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
    let code = `#include "${baseName}_callbacks.h"
#include "../ui/${baseName}_ui.h"
#include <stdio.h>
#include <time.h>

// 事件回调函数实现

`;

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
    const impls: string[] = [];

    this.components.forEach(component => {
      const generator = EventGeneratorFactory.getGenerator(component.type);
      if (generator.getMessageCallbackImpl) {
        generator.getMessageCallbackImpl(component, this.componentMap).forEach(impl => {
          impls.push(impl);
        });
      }
    });

    return impls;
  }

  /**
   * 收集所有 onMessage 回调函数名
   */
  private collectMessageCallbackNames(): string[] {
    const names: string[] = [];

    this.components.forEach(component => {
      if (!component.eventConfigs) return;
      component.eventConfigs.forEach(eventConfig => {
        if (eventConfig.type === 'onMessage' && eventConfig.message) {
          names.push(`${component.id}_on_msg_${eventConfig.message.replace(/[^a-zA-Z0-9]/g, '_')}`);
        }
      });
    });

    return names;
  }

  /**
   * 收集所有时间更新回调实现
   */
  private collectTimeUpdateCallbackImpls(): string[] {
    const impls: string[] = [];

    this.components.forEach(component => {
      if (component.type === 'hg_label' && component.data?.timeFormat) {
        const timeFormat = component.data.timeFormat;
        const impl = this.generateTimeUpdateCallback(component.id, timeFormat);
        impls.push(impl);
      }
    });

    return impls;
  }

  /**
   * 收集所有时间更新回调函数名
   */
  private collectTimeUpdateCallbackNames(): string[] {
    const names: string[] = [];

    this.components.forEach(component => {
      if (component.type === 'hg_label' && component.data?.timeFormat) {
        names.push(`${component.id}_time_update_cb`);
      }
    });

    return names;
  }

  /**
   * 生成时间更新回调函数
   */
  private generateTimeUpdateCallback(componentId: string, timeFormat: string): string {
    let formatStr = '';
    let bufferSize = 32;

    switch (timeFormat) {
      case 'HH:mm:ss':
        formatStr = '%02d:%02d:%02d';
        bufferSize = 9;
        break;
      case 'HH:mm':
        formatStr = '%02d:%02d';
        bufferSize = 6;
        break;
      case 'YYYY-MM-DD':
        formatStr = '%04d-%02d-%02d';
        bufferSize = 11;
        break;
      case 'YYYY-MM-DD HH:mm:ss':
        formatStr = '%04d-%02d-%02d %02d:%02d:%02d';
        bufferSize = 20;
        break;
      case 'MM-DD HH:mm':
        formatStr = '%02d-%02d %02d:%02d';
        bufferSize = 15;
        break;
      default:
        formatStr = '%02d:%02d:%02d';
        bufferSize = 9;
    }

    let code = `void ${componentId}_time_update_cb(void *p)\n`;
    code += `{\n`;
    code += `    GUI_UNUSED(p);\n`;
    code += `    \n`;
    code += `    time_t now = time(NULL);\n`;
    code += `    struct tm *t = localtime(&now);\n`;
    code += `    static char time_str[${bufferSize}];\n`;
    code += `    \n`;

    // 根据格式生成不同的 sprintf 调用
    if (timeFormat === 'HH:mm:ss') {
      code += `    sprintf(time_str, "${formatStr}", t->tm_hour, t->tm_min, t->tm_sec);\n`;
    } else if (timeFormat === 'HH:mm') {
      code += `    sprintf(time_str, "${formatStr}", t->tm_hour, t->tm_min);\n`;
    } else if (timeFormat === 'YYYY-MM-DD') {
      code += `    sprintf(time_str, "${formatStr}", t->tm_year + 1900, t->tm_mon + 1, t->tm_mday);\n`;
    } else if (timeFormat === 'YYYY-MM-DD HH:mm:ss') {
      code += `    sprintf(time_str, "${formatStr}", t->tm_year + 1900, t->tm_mon + 1, t->tm_mday, t->tm_hour, t->tm_min, t->tm_sec);\n`;
    } else if (timeFormat === 'MM-DD HH:mm') {
      code += `    sprintf(time_str, "${formatStr}", t->tm_mon + 1, t->tm_mday, t->tm_hour, t->tm_min);\n`;
    }

    code += `    \n`;
    code += `    gui_text_content_set((gui_text_t *)${componentId}, (void *)time_str, strlen(time_str));\n`;
    code += `}`;

    return code;
  }
}
