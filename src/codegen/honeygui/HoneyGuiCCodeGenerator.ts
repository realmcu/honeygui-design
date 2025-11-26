/**
 * HoneyGUI C代码生成器
 * 从组件树生成调用HoneyGUI API的C代码
 */

import * as fs from 'fs';
import * as path from 'path';
import { HoneyGuiApiMapper } from './HoneyGuiApiMapper';

export interface Component {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number; width: number; height: number };
  parent: string | null;
  children?: string[];
  style?: { [key: string]: any };
  data?: { [key: string]: any };
  events?: { [key: string]: string };
  visible?: boolean;
}

export interface CodeGenOptions {
  outputDir: string;
  hmlFileName: string;  // HML文件名（不含扩展名）
  enableProtectedAreas?: boolean;
}

export interface CodeGenResult {
  success: boolean;
  files: string[];
  errors?: string[];
}

export class HoneyGuiCCodeGenerator {
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
      const baseName = this.options.hmlFileName;

      // 确保输出目录存在
      if (!fs.existsSync(this.options.outputDir)) {
        fs.mkdirSync(this.options.outputDir, { recursive: true });
      }

      // 生成头文件
      const headerFile = path.join(this.options.outputDir, `${baseName}.h`);
      fs.writeFileSync(headerFile, this.generateHeader(baseName));
      files.push(headerFile);

      // 生成实现文件
      const implFile = path.join(this.options.outputDir, `${baseName}.c`);
      fs.writeFileSync(implFile, this.generateImplementation(baseName));
      files.push(implFile);

      // 生成回调文件
      const callbackHeaderFile = path.join(this.options.outputDir, `${baseName}_callbacks.h`);
      const callbackImplFile = path.join(this.options.outputDir, `${baseName}_callbacks.c`);
      
      if (!fs.existsSync(callbackHeaderFile)) {
        fs.writeFileSync(callbackHeaderFile, this.generateCallbackHeader(baseName));
        files.push(callbackHeaderFile);
      }
      
      if (!fs.existsSync(callbackImplFile)) {
        fs.writeFileSync(callbackImplFile, this.generateCallbackImplementation(baseName));
        files.push(callbackImplFile);
      } else if (this.options.enableProtectedAreas) {
        // 合并保护区
        const existing = fs.readFileSync(callbackImplFile, 'utf-8');
        const merged = this.mergeProtectedAreas(existing, this.generateCallbackImplementation(baseName));
        fs.writeFileSync(callbackImplFile, merged);
        files.push(callbackImplFile);
      }

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
   * 生成头文件
   */
  private generateHeader(baseName: string): string {
    const guardName = `${baseName.toUpperCase()}_H`;
    const componentTypes = [...new Set(this.components.map(c => c.type))];
    const headers = this.apiMapper.getRequiredHeaders(componentTypes);
    const hasView = componentTypes.includes('hg_view');

    let code = `#ifndef ${guardName}
#define ${guardName}

#include "guidef.h"
#include "gui_obj.h"
`;

    // hg_view 需要额外的头文件
    if (hasView) {
      code += `#include "gui_components_init.h"\n`;
      code += `#include "gui_view.h"\n`;
      code += `#include "gui_view_instance.h"\n`;
    }

    // 包含其他组件的头文件
    headers.forEach(header => {
      if (header !== 'gui_view.h') {  // gui_view.h 已经包含
        code += `#include "${header}"\n`;
      }
    });

    code += `
// 组件句柄声明
`;

    // 声明所有非 view 组件的句柄
    this.components.forEach(comp => {
      if (comp.type !== 'hg_view') {
        code += `extern gui_obj_t *${comp.id};\n`;
      }
    });

    code += `
#endif // ${guardName}
`;

    return code;
  }

  /**
   * 生成实现文件
   */
  private generateImplementation(baseName: string): string {
    let code = `#include "${baseName}.h"
#include "${baseName}_callbacks.h"
#include <stddef.h>

// 组件句柄定义
`;

    // 定义所有非 view 组件的句柄
    this.components.forEach(comp => {
      if (comp.type !== 'hg_view') {
        code += `gui_obj_t *${comp.id} = NULL;\n`;
      }
    });

    code += `\n`;

    // 生成组件创建代码（按层级顺序，直接在全局作用域）
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

    // 生成创建代码
    code += this.generateComponentCreation(component, indent);

    // hg_view 的子组件已在 switch_in 中处理，不在这里递归
    if (component.type === 'hg_view') {
      return code;
    }

    // 生成属性设置代码
    code += this.generatePropertySetters(component, indent);

    // 生成事件绑定代码
    code += this.generateEventBindings(component, indent);

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
   * 生成组件创建代码
   */
  private generateComponentCreation(component: Component, indent: number): string {
    const indentStr = '    '.repeat(indent);
    const mapping = this.apiMapper.getMapping(component.type);

    if (!mapping) {
      return `${indentStr}// 警告: 未找到${component.type}的API映射\n`;
    }

    // hg_view 使用特殊的生成规则
    if (component.type === 'hg_view') {
      return this.generateViewInstance(component, indent);
    }

    // 确定父组件引用
    let parentRef = 'NULL';
    if (component.parent) {
      const parentComp = this.componentMap.get(component.parent);
      // 如果父组件是 hg_view，使用 NULL（因为 view 没有句柄）
      if (parentComp && parentComp.type !== 'hg_view') {
        parentRef = component.parent;
      }
    }

    const { x, y, width, height } = component.position;

    return `${indentStr}${component.id} = ${mapping.createFunction}(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  /**
   * 生成 hg_view 的 GUI_VIEW_INSTANCE 代码
   */
  private generateViewInstance(component: Component, indent: number): string {
    const indentStr = '    '.repeat(indent);
    const name = component.name;

    let code = '';
    code += `${indentStr}static void ${name}_switch_out(gui_view_t *view)\n`;
    code += `${indentStr}{\n`;
    code += `${indentStr}    GUI_UNUSED(view);\n`;
    code += `${indentStr}}\n\n`;
    code += `${indentStr}static void ${name}_switch_in(gui_view_t *view)\n`;
    code += `${indentStr}{\n`;
    code += `${indentStr}    GUI_UNUSED(view);\n`;
    
    // 在 switch_in 中创建子组件
    if (component.children && component.children.length > 0) {
      code += `\n`;
      component.children.forEach(childId => {
        const child = this.componentMap.get(childId);
        if (child) {
          code += this.generateComponentTree(child, indent + 1);
        }
      });
    }
    
    code += `${indentStr}}\n`;
    code += `${indentStr}GUI_VIEW_INSTANCE("${name}", false, ${name}_switch_in, ${name}_switch_out);\n`;

    return code;
  }

  /**
   * 生成属性设置代码
   */
  private generatePropertySetters(component: Component, indent: number): string {
    let code = '';
    const indentStr = '    '.repeat(indent);
    const mapping = this.apiMapper.getMapping(component.type);

    if (!mapping) return code;

    mapping.propertySetters.forEach(setter => {
      let value = null;

      // 从style或data中获取值
      if (component.style && setter.property in component.style) {
        value = component.style[setter.property];
      } else if (component.data && setter.property in component.data) {
        value = component.data[setter.property];
      }

      if (value !== null && value !== undefined) {
        // 应用值转换
        const transformedValue = setter.valueTransform 
          ? setter.valueTransform(value) 
          : (typeof value === 'string' ? `"${value}"` : value);

        code += `${indentStr}${setter.apiFunction}(${component.id}, ${transformedValue});\n`;
      }
    });

    // 可见性
    if (component.visible !== undefined) {
      code += `${indentStr}gui_obj_show(${component.id}, ${component.visible ? 'true' : 'false'});\n`;
    }

    return code;
  }

  /**
   * 生成事件绑定代码
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
   * 生成回调头文件
   */
  private generateCallbackHeader(baseName: string): string {
    const guardName = `${baseName.toUpperCase()}_CALLBACKS_H`;
    let code = `#ifndef ${guardName}
#define ${guardName}

#include "gui_api.h"

// 事件回调函数声明
`;

    // 收集所有事件回调
    this.components.forEach(comp => {
      if (comp.events) {
        Object.entries(comp.events).forEach(([event, callback]) => {
          code += `void ${callback}(gui_obj_t *obj);\n`;
        });
      }
    });

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
#include <stdio.h>

// 事件回调函数实现

`;

    // 为每个事件生成回调函数模板
    this.components.forEach(comp => {
      if (comp.events) {
        Object.entries(comp.events).forEach(([event, callback]) => {
          code += `/* @protected start ${callback} */
void ${callback}(gui_obj_t *obj) {
    printf("${comp.name} ${event} triggered\\n");
    // TODO: 实现事件处理逻辑
}
/* @protected end ${callback} */

`;
        });
      }
    });

    code += `/* @protected start custom_functions */
// 自定义函数
/* @protected end custom_functions */
`;

    return code;
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
