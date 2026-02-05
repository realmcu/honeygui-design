/**
 * HoneyGUI C代码生成器
 * 从组件树生成调用HoneyGUI API的C代码
 * 
 * 文件生成策略（Qt模式 + 保护区）：
 * - *_ui.h/c: 自动生成，每次覆盖（纯UI代码）
 * - *_callbacks.h/c: 只生成一次 + 保护区（事件回调）
 * - 用户代码目录: 只生成一次，用户完全控制
 */

import * as fs from 'fs';
import * as path from 'path';
import { HoneyGuiApiMapper } from './HoneyGuiApiMapper';
import { Component } from '../../hml/types';
import { SConscriptGenerator } from '../../simulation/SConscriptGenerator';
import { ICodeGenerator, CodeGenOptions, CodeGenResult } from '../ICodeGenerator';
import { EventGeneratorFactory } from './events';
import { ComponentGeneratorFactory, GeneratorContext } from './components';
import { ListGenerator } from './components/ListGenerator';
import { LabelGenerator } from './components/LabelGenerator';
import { ArcGenerator } from './components/ArcGenerator';
import { CallbackFileGenerator, UserFileGenerator, ProtectedAreaMerger } from './files';

// Re-export for backward compatibility
export { Component } from '../../hml/types';
export { CodeGenOptions, CodeGenResult } from '../ICodeGenerator';

export class HoneyGuiCCodeGenerator implements ICodeGenerator {
  private apiMapper: HoneyGuiApiMapper;
  private components: Component[];
  private options: CodeGenOptions;
  private componentMap: Map<string, Component>;

  constructor(components: Component[], options: CodeGenOptions) {
    this.apiMapper = new HoneyGuiApiMapper();
    this.components = components;
    this.options = options;
    this.componentMap = new Map(components.map(c => [c.id, c]));
  }

  /**
   * 生成所有代码文件
   */
  async generate(): Promise<CodeGenResult> {
    try {
      const files: string[] = [];
      const designName = this.options.designName;
      const srcDir = this.options.srcDir;

      // 创建目录结构
      const uiDir = path.join(srcDir, 'ui');
      const callbacksDir = path.join(srcDir, 'callbacks');
      const userDir = path.join(srcDir, 'user');

      [uiDir, callbacksDir, userDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      // === UI 代码（每次覆盖）===
      const uiHeaderFile = path.join(uiDir, `${designName}_ui.h`);
      fs.writeFileSync(uiHeaderFile, this.generateUiHeader(designName));
      files.push(uiHeaderFile);

      const uiImplFile = path.join(uiDir, `${designName}_ui.c`);
      fs.writeFileSync(uiImplFile, this.generateUiImplementation(designName));
      files.push(uiImplFile);

      // === 回调代码（保护区）===
      const callbackGenerator = new CallbackFileGenerator(this.components);
      const callbackHeaderFile = path.join(callbacksDir, `${designName}_callbacks.h`);
      const callbackImplFile = path.join(callbacksDir, `${designName}_callbacks.c`);
      
      // 读取现有的 callbacks.c 内容（如果存在）
      let existingCallbacksC: string | undefined;
      if (fs.existsSync(callbackImplFile)) {
        existingCallbacksC = fs.readFileSync(callbackImplFile, 'utf-8');
      }
      
      // 回调头文件：每次覆盖，自动从 callbacks.c 提取自定义函数声明
      fs.writeFileSync(callbackHeaderFile, callbackGenerator.generateHeader(designName, existingCallbacksC));
      files.push(callbackHeaderFile);
      
      // 回调实现文件：保护区合并
      if (!fs.existsSync(callbackImplFile)) {
        fs.writeFileSync(callbackImplFile, callbackGenerator.generateImplementation(designName));
        files.push(callbackImplFile);
      } else if (this.options.enableProtectedAreas) {
        const existing = fs.readFileSync(callbackImplFile, 'utf-8');
        // 传入现有内容，用于检查已存在的函数
        const merged = ProtectedAreaMerger.merge(existing, callbackGenerator.generateImplementation(designName, existing));
        fs.writeFileSync(callbackImplFile, merged);
        files.push(callbackImplFile);
      }

      // === 用户代码（只生成一次）===
      const userGenerator = new UserFileGenerator();
      const userHeaderFile = path.join(userDir, `${designName}_user.h`);
      const userImplFile = path.join(userDir, `${designName}_user.c`);

      if (!fs.existsSync(userHeaderFile)) {
        fs.writeFileSync(userHeaderFile, userGenerator.generateHeader(designName));
        files.push(userHeaderFile);
      }

      if (!fs.existsSync(userImplFile)) {
        fs.writeFileSync(userImplFile, userGenerator.generateImplementation(designName));
        files.push(userImplFile);
      }

      // 生成 SConscript
      SConscriptGenerator.generate(srcDir);
      files.push(path.join(srcDir, 'SConscript'));

      return { success: true, files };
    } catch (error) {
      return {
        success: false,
        files: [],
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * 生成UI头文件（每次覆盖）
   */
  private generateUiHeader(baseName: string): string {
    const guardName = `${baseName.toUpperCase()}_UI_H`;
    const componentTypes = [...new Set(this.components.map(c => c.type))];
    const headers = this.apiMapper.getRequiredHeaders(componentTypes);
    const hasView = componentTypes.includes('hg_view');
    const hasWindow = componentTypes.includes('hg_window');
    const has3D = componentTypes.includes('hg_3d');
    const hasLabel = componentTypes.includes('hg_label');
    const hasArc = componentTypes.includes('hg_arc');
    
    // 检查是否有 arc group
    const hasArcGroup = this.components.some(c => c.type === 'hg_arc' && c.data?.arcGroup);

    let code = `/**
 * ${baseName} UI定义（自动生成，请勿手动修改）
 * 生成时间: ${new Date().toISOString()}
 */
#ifndef ${guardName}
#define ${guardName}

#include "guidef.h"
#include "gui_obj.h"
`;

    if (hasView) {
      code += `#include "gui_components_init.h"\n`;
      code += `#include "gui_view.h"\n`;
      code += `#include "gui_view_instance.h"\n`;
    }

    if (hasWindow) {
      code += `#include "gui_win.h"\n`;
    }

    // 检查是否有文本相关组件（label, time_label, scroll_text）
    const hasTextComponent = componentTypes.includes('hg_label') || 
                            componentTypes.includes('hg_time_label') || 
                            componentTypes.includes('hg_scroll_text');
    
    // 如果有文本组件，先包含字体相关头文件
    if (hasTextComponent) {
      code += `#include "draw_font.h"\n`;
      code += `#include "font_types.h"\n`;
    }

    // 检查是否有滚动文本
    const hasScrollText = this.components.some(c => c.type === 'hg_label' && (c.data?.enableScroll === true || c.data?.enableScroll === 'true'));
    if (hasScrollText) {
      code += `#include "gui_scroll_text.h"\n`;
    }

    if (has3D) {
      code += `#include "gui_lite3d.h"\n`;
      code += `#include "gui_vfs.h"\n`;
      
      // 检查是否有启用触摸交互的 3D 模型
      const hasTouchRotation = this.components.some(c => 
        c.type === 'hg_3d' && (c.data?.touchRotationEnabled as boolean)
      );
      if (hasTouchRotation) {
        code += `#include "tp_algo.h"\n`;
      }
    }
    
    // 如果有 arc group，添加头文件
    if (hasArcGroup) {
      code += `#include "gui_arc_group.h"\n`;
    }

    headers.forEach(header => {
      if (header !== 'gui_view.h' && header !== 'gui_win.h') {
        code += `#include "${header}"\n`;
      }
    });

    // 3D 模型不需要外部数据声明（使用 VFS 路径加载 bin 文件）

    code += `\n// 组件句柄声明\n`;

    this.components.forEach(comp => {
      // 跳过 hg_view、hg_3d 和 hg_list_item（list_item 由 note_design 回调处理）
      if (comp.type !== 'hg_view' && comp.type !== 'hg_3d' && comp.type !== 'hg_list_item') {
        // 根据组件类型使用正确的句柄类型
        const handleType = this.getComponentHandleType(comp);
        code += `extern ${handleType} *${comp.id};\n`;
        
        // 如果是拆分时间格式的时间标签，添加子组件声明
        if (comp.type === 'hg_time_label' && comp.data?.timeFormat === 'HH:mm-split') {
          code += `extern gui_text_t *${comp.id}_hour;\n`;
          code += `extern gui_text_t *${comp.id}_colon;\n`;
          code += `extern gui_text_t *${comp.id}_min;\n`;
        }
      }
    });

    // 双态按钮状态管理函数声明
    const toggleButtons = this.components.filter(c => c.type === 'hg_button' && (c.data?.toggleMode === true || c.data?.toggleMode === 'true'));
    if (toggleButtons.length > 0) {
      code += `\n// 双态按钮状态管理函数声明\n`;
      toggleButtons.forEach(comp => {
        code += `extern bool ${comp.id}_get_state(void);\n`;
        code += `extern void ${comp.id}_set_state(bool state);\n`;
      });
    }

    code += `
#endif // ${guardName}
`;

    return code;
  }

  /**
   * 生成UI实现文件（每次覆盖）
   */
  private generateUiImplementation(baseName: string): string {
    // 收集所有时间标签和计时器标签
    const timeLabels = this.components.filter(c => c.type === 'hg_time_label');
    const timerLabels = this.components.filter(c => c.type === 'hg_label' && c.data?.isTimerLabel === true);
    
    let code = `/**
 * ${baseName} UI实现（自动生成，请勿手动修改）
 * 生成时间: ${new Date().toISOString()}
 */
#include "${baseName}_ui.h"
#include "../callbacks/${baseName}_callbacks.h"
#include <stddef.h>
`;

    // 如果有时间标签或计时器标签，添加必要的头文件
    if (timeLabels.length > 0) {
      code += `#include <time.h>\n`;
    }
    if (timerLabels.length > 0) {
      code += `#include <stdio.h>\n`;
      code += `#include <string.h>\n`;
    }

    code += `\n// 组件句柄定义\n`;

    this.components.forEach(comp => {
      // 跳过 hg_view、hg_3d 和 hg_list_item（list_item 由 note_design 回调处理）
      if (comp.type !== 'hg_view' && comp.type !== 'hg_3d' && comp.type !== 'hg_list_item') {
        // 根据组件类型使用正确的句柄类型
        const handleType = this.getComponentHandleType(comp);
        code += `${handleType} *${comp.id} = NULL;\n`;
        
        // 如果是拆分时间格式的时间标签，添加子组件定义
        if (comp.type === 'hg_time_label' && comp.data?.timeFormat === 'HH:mm-split') {
          code += `gui_text_t *${comp.id}_hour = NULL;\n`;
          code += `gui_text_t *${comp.id}_colon = NULL;\n`;
          code += `gui_text_t *${comp.id}_min = NULL;\n`;
        }
      }
    });

    // 为时间标签生成全局时间字符串变量
    if (timeLabels.length > 0) {
      code += `\n// 时间字符串全局变量\n`;
      timeLabels.forEach(label => {
        const bufferSize = this.getTimeBufferSize(label.data?.timeFormat);
        code += `char ${label.id}_time_str[${bufferSize}] = {0};\n`;
      });
    }

    // 为计时器标签生成全局计时器字符串变量和计时器值变量
    if (timerLabels.length > 0) {
      code += `\n// 计时器字符串全局变量\n`;
      timerLabels.forEach(label => {
        const bufferSize = this.getTimerBufferSize(label.data?.timerFormat);
        code += `char ${label.id}_timer_str[${bufferSize}] = {0};\n`;
        code += `int ${label.id}_timer_value = ${label.data?.timerInitialValue || 0}; // 计时器值（毫秒）\n`;
      });
    }

    code += `\n`;

    // 生成所有双态按钮的回调函数
    const hasToggleButtons = this.components.some(c => c.type === 'hg_button' && (c.data?.toggleMode === true || c.data?.toggleMode === 'true'));
    if (hasToggleButtons) {
      code += `// 双态按钮回调函数\n`;
      this.components.forEach(comp => {
        if (comp.type === 'hg_button' && (comp.data?.toggleMode === true || comp.data?.toggleMode === 'true')) {
          const generator = ComponentGeneratorFactory.getGenerator('hg_button');
          if ('generateToggleCallback' in generator) {
            code += (generator as any).generateToggleCallback(comp);
          }
        }
      });
    }

    // 生成按键效果的回调函数（rect、circle、image）
    const hasButtonEffects = this.components.some(c => 
      ['hg_rect', 'hg_circle', 'hg_image'].includes(c.type) && 
      c.data?.buttonMode && 
      c.data.buttonMode !== 'none'
    );
    if (hasButtonEffects) {
      code += `// 按键效果回调函数\n`;
      this.components.forEach(comp => {
        if (['hg_rect', 'hg_circle', 'hg_image'].includes(comp.type)) {
          const buttonMode = comp.data?.buttonMode;
          if (buttonMode && buttonMode !== 'none') {
            const generator = ComponentGeneratorFactory.getGenerator(comp.type);
            if ('generateButtonCallback' in generator) {
              code += (generator as any).generateButtonCallback(comp);
            }
          }
        }
      });
    }

    // 生成所有 3D 模型的回调函数（包括动画）
    const has3DComponents = this.components.some(c => c.type === 'hg_3d');
    if (has3DComponents) {
      code += `// 3D 模型回调函数\n`;
      this.components.forEach(comp => {
        if (comp.type === 'hg_3d') {
          const generator = ComponentGeneratorFactory.getGenerator('hg_3d');
          if ('generateCallbacks' in generator) {
            code += (generator as any).generateCallbacks(comp);
          }
        }
      });
    }

    // 不再生成独立的 on_switch_in 回调函数，直接在 GUI_VIEW_INSTANCE 的 switch_in 中处理

    // 生成所有 list 组件的 note_design 回调函数
    const hasListComponents = this.components.some(c => c.type === 'hg_list');
    if (hasListComponents) {
      code += `// List 组件的 note_design 回调函数\n`;
      this.components.forEach(comp => {
        if (comp.type === 'hg_list') {
          const generator = ComponentGeneratorFactory.getGenerator('hg_list');
          if (generator instanceof ListGenerator) {
            code += generator.generateNoteDesignCallback(
              comp, 
              this.createGeneratorContext(),
              (type: string) => ComponentGeneratorFactory.getGenerator(type)
            );
          }
        }
      });
    }

    // 生成拆分时间标签的回调函数
    const splitTimeLabels = this.components.filter(c => c.type === 'hg_time_label' && c.data?.timeFormat === 'HH:mm-split');
    if (splitTimeLabels.length > 0) {
      code += `// 拆分时间标签的回调函数\n`;
      splitTimeLabels.forEach(label => {
        code += this.generateSplitTimeCallbacks(label);
      });
    }

    const rootComponents = this.components.filter(c => c.parent === null);
    rootComponents.forEach(comp => {
      code += this.generateComponentTree(comp, 0);
    });

    return code;
  }

  /**
   * 递归生成组件树
   */
  private generateComponentTree(component: Component, indent: number): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

    // 跳过 hg_list_item 组件的生成（它们由 note_design 回调处理）
    if (component.type === 'hg_list_item') {
      return code;
    }

    // 添加注释
    code += `\n${indentStr}// 创建 ${component.id} (${component.type})\n`;

    // hg_view/hg_window 使用 ViewGenerator
    if (component.type === 'hg_view' || component.type === 'hg_window') {
      code += this.generateViewComponent(component, indent);
      return code;
    }

    // 普通组件：生成创建代码
    code += this.generateComponentCreation(component, indent);

    // 生成属性设置代码
    code += this.generatePropertySetters(component, indent);

    // 双态按钮：生成点击事件绑定
    if (component.type === 'hg_button' && (component.data?.toggleMode === true || component.data?.toggleMode === 'true')) {
      const generator = ComponentGeneratorFactory.getGenerator('hg_button');
      if ('generateEventBinding' in generator) {
        code += (generator as any).generateEventBinding(component, indent);
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

    // 生成定时器绑定代码
    code += this.generateTimerBindings(component, indent);

    // 生成事件绑定代码
    code += this.generateEventConfigBindings(component, indent);

    // 递归生成子组件
    if (component.children && component.children.length > 0) {
      component.children.forEach(childId => {
        const child = this.componentMap.get(childId);
        if (child) {
          code += this.generateComponentTree(child, indent);
        }
      });
    }

    return code;
  }

  /**
   * 生成组件创建代码（不包括 hg_view）
   */
  private generateComponentCreation(component: Component, indent: number): string {
    const generator = ComponentGeneratorFactory.getGenerator(component.type);
    return generator.generateCreation(component, indent, this.createGeneratorContext());
  }

  /**
   * 生成 hg_view/hg_window 组件代码
   * 使用对应的 Generator 生成，并处理子组件
   * 子组件按 children 数组顺序生成（即组件树的显示顺序）
   * 先创建的组件显示在底层，后创建的显示在上层
   */
  private generateViewComponent(component: Component, indent: number): string {
    const generator = ComponentGeneratorFactory.getGenerator(component.type);
    let code = generator.generateCreation(component, indent, this.createGeneratorContext());
    
    // 生成子组件代码（按 children 数组顺序，即组件树显示顺序）
    let childrenCode = '';
    if (component.children && component.children.length > 0) {
      childrenCode += '\n';
      
      // 收集 arc groups
      const childComponents = component.children
        .map(id => this.componentMap.get(id))
        .filter((c): c is Component => c !== undefined);
      
      const arcGroups = ArcGenerator.collectArcGroups(childComponents);
      const processedGroups = new Set<string>();
      
      // 直接使用 children 数组顺序，不做额外排序
      // 组件树中靠前的组件先创建（显示在底层），靠后的后创建（显示在上层）
      component.children.forEach(childId => {
        const child = this.componentMap.get(childId);
        if (child) {
          // 检查是否是 arc group 成员
          if (child.type === 'hg_arc' && child.data?.arcGroup) {
            const groupKey = `${component.id}_${child.data.arcGroup}`;
            // 只在第一次遇到该群组时生成群组代码
            if (!processedGroups.has(groupKey) && arcGroups.has(groupKey)) {
              const groupInfo = arcGroups.get(groupKey)!;
              const parentRef = component.type === 'hg_view' ? '(gui_obj_t *)view' : component.id;
              const childIndent = component.type === 'hg_window' ? indent : indent + 1;
              childrenCode += ArcGenerator.generateGroupCreation(groupKey, groupInfo, parentRef, childIndent);
              processedGroups.add(groupKey);
            }
            // 跳过群组成员的独立生成
            return;
          }
          
          // hg_window 的子组件缩进需要调整（因为没有 switch_in 回调包裹）
          const childIndent = component.type === 'hg_window' ? indent : indent + 1;
          childrenCode += this.generateComponentTree(child, childIndent);
        }
      });
    }
    
    // 替换占位符
    code = code.replace('__CHILDREN_PLACEHOLDER__', childrenCode);
    
    return code;
  }

  /**
   * 生成属性设置代码
   */
  private generatePropertySetters(component: Component, indent: number): string {
    const generator = ComponentGeneratorFactory.getGenerator(component.type);
    return generator.generatePropertySetters(component, indent, this.createGeneratorContext());
  }

  /**
   * 生成事件绑定代码（保留用于向后兼容）
   */
  private generateEventBindings(component: Component, indent: number): string {
    let code = '';
    const indentStr = '    '.repeat(indent);
    const mapping = this.apiMapper.getMapping(component.type);

    if (!mapping || !component.events) return code;

    mapping.eventHandlers.forEach(handler => {
      if (component.events && component.events[handler.event]) {
        const callbackName = component.events[handler.event] || `on_${component.id}_${handler.event}`;
        code += `${indentStr}${handler.apiFunction}(${component.id}, ${callbackName});\n`;
      }
    });

    return code;
  }

  /**
   * 创建生成器上下文
   */
  private createGeneratorContext(): GeneratorContext {
    // 从 srcDir 推导项目根目录（srcDir 的父目录）
    const projectRoot = path.dirname(this.options.srcDir);
    
    return {
      componentMap: this.componentMap,
      projectRoot,
      getParentRef: (component: Component) => {
        if (!component.parent) return 'NULL';
        const parentComp = this.componentMap.get(component.parent);
        if (parentComp?.type === 'hg_view') {
          return '(gui_obj_t *)view';
        }
        return component.parent;
      },
      generateTimerBindings: this.generateTimerBindings.bind(this)
    };
  }

  /**
   * 生成事件配置绑定代码（基于 eventConfigs）
   */
  private generateEventConfigBindings(component: Component, indent: number): string {
    const generator = EventGeneratorFactory.getGenerator(component.type);
    return generator.generateEventBindings(component, indent, this.componentMap);
  }

  /**
   * 生成定时器绑定代码
   */
  private generateTimerBindings(component: Component, indent: number): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // 支持新版 timers 数组
    if (component.data?.timers && Array.isArray(component.data.timers)) {
      const enabledTimers = component.data.timers.filter((timer: any) => timer.enabled === true);
      
      if (enabledTimers.length > 0) {
        enabledTimers.forEach((timer: any) => {
          let callback: string;
          // 预设动作模式：支持 segments（多段动画）或 actions（单段动画）
          if (timer.mode === 'preset' && ((timer.segments && timer.segments.length > 0) || (timer.actions && timer.actions.length > 0))) {
            // 预设动作模式：使用定时器 ID 生成回调函数名
            callback = `${component.id}_${timer.id}_cb`;
          } else if (timer.mode === 'custom' && timer.callback) {
            // 自定义函数模式
            callback = timer.callback;
          } else {
            return; // 跳过无效配置
          }
          
          const timerName = timer.name || timer.id;
          code += `${indentStr}// 绑定定时器: ${timerName}\n`;
          code += `${indentStr}gui_obj_create_timer((gui_obj_t *)${component.id}, ${timer.interval}, ${timer.reload !== false ? 'true' : 'false'}, ${callback});\n`;
          // 如果没有设置立即运行，则调用 gui_obj_start_timer
          if (!timer.runImmediately) {
            code += `${indentStr}gui_obj_start_timer((gui_obj_t *)${component.id});\n`;
          }
        });
      }
    }
    // 兼容旧版单定时器格式
    else if (component.data?.timerEnabled === true) {
      const timerMode = component.data.timerMode || 'custom';
      let callback: string;
      
      if (timerMode === 'preset' && component.data.timerActions && component.data.timerActions.length > 0) {
        // 预设动作模式：生成自动回调函数名
        callback = `${component.id}_preset_timer_cb`;
      } else if (timerMode === 'custom' && component.data.timerCallback) {
        // 自定义函数模式
        callback = component.data.timerCallback;
      } else {
        return code; // 无效配置
      }
      
      code += `${indentStr}// 绑定定时器\n`;
      code += `${indentStr}gui_obj_create_timer((gui_obj_t *)${component.id}, ${component.data.timerInterval || 1000}, ${component.data.timerReload !== false ? 'true' : 'false'}, ${callback});\n`;
      code += `${indentStr}gui_obj_start_timer((gui_obj_t *)${component.id});\n`;
    }

    return code;
  }

  /**
   * 生成回调头文件
   */
  private generateCallbackHeader(baseName: string): string {
    const guardName = `${baseName.toUpperCase()}_CALLBACKS_H`;
    let code = `#ifndef ${guardName}
#define ${guardName}

#include "gui_api.h"

// 事件回调函数声明
`;

    // 不再生成回调函数声明（视图切换由 SDK 自动处理）

    code += `
#endif // ${guardName}
`;

    return code;
  }

  /**
   * 生成回调实现文件
   */
  private generateCallbackImplementation(baseName: string): string {
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

    // 生成普通回调函数模板（排除已生成的 switchView 回调）
    const callbackFunctions = this.collectCallbackFunctions();
    const switchViewFuncNames = new Set(this.collectSwitchViewCallbackNames());
    
    callbackFunctions.forEach(funcName => {
      if (switchViewFuncNames.has(funcName)) return; // 跳过已生成的
      
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

  /**
   * 收集所有需要生成的回调函数名
   */
  private collectCallbackFunctions(): string[] {
    const functions = new Set<string>();

    this.components.forEach(component => {
      const generator = EventGeneratorFactory.getGenerator(component.type);
      generator.collectCallbackFunctions(component).forEach(fn => functions.add(fn));
    });

    return Array.from(functions).sort();
  }

  /**
   * 合并保护区代码
   */
  private mergeProtectedAreas(existing: string, generated: string): string {
    const protectedAreas = new Map<string, string>();

    // 提取现有文件中的保护区
    const regex = /\/\* @protected start (\w+) \*\/([\s\S]*?)\/\* @protected end \1 \*\//g;
    let match;

    while ((match = regex.exec(existing)) !== null) {
      protectedAreas.set(match[1], match[2]);
    }

    // 替换生成代码中的保护区
    let result = generated;
    protectedAreas.forEach((content, id) => {
      const pattern = new RegExp(
        `\\/\\* @protected start ${id} \\*\\/[\\s\\S]*?\\/\\* @protected end ${id} \\*\\/`,
        'g'
      );
      result = result.replace(pattern, `/* @protected start ${id} */${content}/* @protected end ${id} */`);
    });

    return result;
  }

  /**
   * 生成拆分时间标签的回调函数
   */
  private generateSplitTimeCallbacks(component: Component): string {
    const color = component.style?.color || '#ffffff';
    const rgb = this.colorToRgb(color);
    
    let code = `
// ${component.id} 拆分时间回调函数
static int8_t ${component.id}_breath_dir = -1;
static int16_t ${component.id}_current_alpha = 255;

static void ${component.id}_breath_anim_cb(void *p)
{
    gui_text_t *t_colon = (gui_text_t *)p;
    
    ${component.id}_current_alpha += (${component.id}_breath_dir * 15);

    if (${component.id}_current_alpha >= 255) {
        ${component.id}_current_alpha = 255;
        ${component.id}_breath_dir = -1;
    } else if (${component.id}_current_alpha <= 50) {
        ${component.id}_current_alpha = 50;
        ${component.id}_breath_dir = 1;
    }
    
    gui_color_t new_color = gui_rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, (uint8_t)${component.id}_current_alpha);
    gui_text_color_set(t_colon, new_color);
}

`;
    return code;
  }

  /**
   * 将颜色字符串转换为 RGB 对象
   */
  private colorToRgb(color: string): { r: number; g: number; b: number } {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
        };
      } else if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
        };
      }
    }
    return { r: 255, g: 255, b: 255 };  // 默认白色
  }

  /**
   * 获取时间格式对应的缓冲区大小
   */
  private getTimeBufferSize(timeFormat?: string): number {
    switch (timeFormat) {
      case 'HH:mm:ss': return 10;
      case 'HH:mm': return 10;
      case 'HH:mm-split': return 10;  // 拆分时间格式，需要访问 str+3，所以需要足够空间
      case 'YYYY-MM-DD': return 12;
      case 'YYYY-MM-DD HH:mm:ss': return 22;
      case 'MM-DD HH:mm': return 16;
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
   * 根据组件类型获取正确的句柄类型
   */
  private getComponentHandleType(comp: Component): string {
    // 检查是否启用滚动（滚动文本使用 gui_scroll_text_t）
    const enableScroll = comp.data?.enableScroll === true || comp.data?.enableScroll === 'true';
    
    switch (comp.type) {
      case 'hg_label':
        return enableScroll ? 'gui_scroll_text_t' : 'gui_text_t';
      case 'hg_time_label':
        return enableScroll ? 'gui_scroll_text_t' : 'gui_text_t';
      case 'hg_list':
        return 'gui_list_t';
      case 'hg_arc':
        return 'gui_arc_t';
      case 'hg_rect':
        return 'gui_rounded_rect_t';
      case 'hg_circle':
        return 'gui_circle_t';
      default:
        return 'gui_obj_t';
    }
  }
}
