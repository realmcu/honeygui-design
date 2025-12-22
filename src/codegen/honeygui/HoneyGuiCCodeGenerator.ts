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
      
      // 回调头文件：每次覆盖（只包含函数声明，不影响用户代码）
      fs.writeFileSync(callbackHeaderFile, callbackGenerator.generateHeader(designName));
      files.push(callbackHeaderFile);
      
      // 回调实现文件：保护区合并
      if (!fs.existsSync(callbackImplFile)) {
        fs.writeFileSync(callbackImplFile, callbackGenerator.generateImplementation(designName));
        files.push(callbackImplFile);
      } else if (this.options.enableProtectedAreas) {
        const existing = fs.readFileSync(callbackImplFile, 'utf-8');
        const merged = ProtectedAreaMerger.merge(existing, callbackGenerator.generateImplementation(designName));
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
    const has3D = componentTypes.includes('hg_3d');

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

    if (has3D) {
      code += `#include "gui_lite3d.h"\n`;
      code += `#include "gui_vfs.h"\n`;
    }

    headers.forEach(header => {
      if (header !== 'gui_view.h') {
        code += `#include "${header}"\n`;
      }
    });

    // 3D 模型不需要外部数据声明（使用 VFS 路径加载 bin 文件）

    code += `\n// 组件句柄声明\n`;

    this.components.forEach(comp => {
      if (comp.type !== 'hg_view' && comp.type !== 'hg_3d') {
        code += `extern gui_obj_t *${comp.id};\n`;
      }
    });

    code += `
#endif // ${guardName}
`;

    return code;
  }

  /**
   * 生成UI实现文件（每次覆盖）
   */
  private generateUiImplementation(baseName: string): string {
    let code = `/**
 * ${baseName} UI实现（自动生成，请勿手动修改）
 * 生成时间: ${new Date().toISOString()}
 */
#include "${baseName}_ui.h"
#include "../callbacks/${baseName}_callbacks.h"
#include <stddef.h>

// 组件句柄定义
`;

    this.components.forEach(comp => {
      if (comp.type !== 'hg_view' && comp.type !== 'hg_3d') {
        code += `gui_obj_t *${comp.id} = NULL;\n`;
      }
    });

    code += `\n`;

    // 生成所有 3D 模型的全局变换回调函数
    const has3DComponents = this.components.some(c => c.type === 'hg_3d');
    if (has3DComponents) {
      code += `// 3D 模型全局变换回调函数\n`;
      this.components.forEach(comp => {
        if (comp.type === 'hg_3d') {
          const worldX = comp.data?.worldX ?? 0;
          const worldY = comp.data?.worldY ?? 0;
          const worldZ = comp.data?.worldZ ?? 30;
          const rotationX = comp.data?.rotationX ?? 0;
          const rotationY = comp.data?.rotationY ?? 0;
          const rotationZ = comp.data?.rotationZ ?? 0;
          const scale = comp.data?.scale ?? 5;
          const cameraPosX = comp.data?.cameraPosX ?? 0;
          const cameraPosY = comp.data?.cameraPosY ?? 0;
          const cameraPosZ = comp.data?.cameraPosZ ?? 0;
          const cameraLookX = comp.data?.cameraLookX ?? 0;
          const cameraLookY = comp.data?.cameraLookY ?? 0;
          const cameraLookZ = comp.data?.cameraLookZ ?? 1;
          
          code += `static void ${comp.id}_global_cb(l3_model_base_t *this)\n`;
          code += `{\n`;
          code += `    l3_camera_UVN_initialize(&this->camera, l3_4d_point(${cameraPosX}, ${cameraPosY}, ${cameraPosZ}), l3_4d_point(${cameraLookX}, ${cameraLookY}, ${cameraLookZ}), 1, 32767, 90, this->viewPortWidth, this->viewPortHeight);\n`;
          code += `    l3_world_initialize(&this->world, ${worldX}, ${worldY}, ${worldZ}, ${rotationX}, ${rotationY}, ${rotationZ}, ${scale});\n`;
          code += `}\n\n`;
        }
      });
    }

    // 不再生成独立的 on_switch_in 回调函数，直接在 GUI_VIEW_INSTANCE 的 switch_in 中处理

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

    // 添加注释
    code += `\n${indentStr}// 创建${component.name} (${component.type})\n`;

    // hg_view/hg_window 使用 ViewGenerator
    if (component.type === 'hg_view' || component.type === 'hg_window') {
      code += this.generateViewComponent(component, indent);
      return code;
    }

    // 普通组件：生成创建代码
    code += this.generateComponentCreation(component, indent);

    // 生成属性设置代码
    code += this.generatePropertySetters(component, indent);

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
   * 使用 ViewGenerator 生成，并处理子组件
   */
  private generateViewComponent(component: Component, indent: number): string {
    const generator = ComponentGeneratorFactory.getGenerator(component.type);
    let code = generator.generateCreation(component, indent, this.createGeneratorContext());
    
    // 生成子组件代码
    let childrenCode = '';
    if (component.children && component.children.length > 0) {
      childrenCode += '\n';
      component.children.forEach(childId => {
        const child = this.componentMap.get(childId);
        if (child) {
          childrenCode += this.generateComponentTree(child, indent + 1);
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
    return {
      componentMap: this.componentMap,
      getParentRef: (component: Component) => {
        if (!component.parent) return 'NULL';
        const parentComp = this.componentMap.get(component.parent);
        if (parentComp?.type === 'hg_view') {
          return '(gui_obj_t *)view';
        }
        return component.parent;
      }
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
}
