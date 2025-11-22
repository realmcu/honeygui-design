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
  projectName: string;
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

      // 确保输出目录存在
      if (!fs.existsSync(this.options.outputDir)) {
        fs.mkdirSync(this.options.outputDir, { recursive: true });
      }

      // 生成头文件
      const headerFile = path.join(this.options.outputDir, 'gui_design.h');
      fs.writeFileSync(headerFile, this.generateHeader());
      files.push(headerFile);

      // 生成实现文件
      const implFile = path.join(this.options.outputDir, 'gui_design.c');
      fs.writeFileSync(implFile, this.generateImplementation());
      files.push(implFile);

      // 生成回调文件
      const callbackHeaderFile = path.join(this.options.outputDir, 'gui_callbacks.h');
      const callbackImplFile = path.join(this.options.outputDir, 'gui_callbacks.c');
      
      if (!fs.existsSync(callbackHeaderFile)) {
        fs.writeFileSync(callbackHeaderFile, this.generateCallbackHeader());
        files.push(callbackHeaderFile);
      }
      
      if (!fs.existsSync(callbackImplFile)) {
        fs.writeFileSync(callbackImplFile, this.generateCallbackImplementation());
        files.push(callbackImplFile);
      } else if (this.options.enableProtectedAreas) {
        // 合并保护区
        const existing = fs.readFileSync(callbackImplFile, 'utf-8');
        const merged = this.mergeProtectedAreas(existing, this.generateCallbackImplementation());
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
  private generateHeader(): string {
    const componentTypes = [...new Set(this.components.map(c => c.type))];
    const headers = this.apiMapper.getRequiredHeaders(componentTypes);

    let code = `#ifndef GUI_DESIGN_H
#define GUI_DESIGN_H

#include "gui_api.h"
`;

    // 包含必要的头文件
    headers.forEach(header => {
      code += `#include "${header}"\n`;
    });

    code += `
// 组件句柄声明
`;

    // 声明所有组件句柄
    this.components.forEach(comp => {
      code += `extern gui_obj_t *${comp.id};\n`;
    });

    code += `
// 初始化函数
void gui_design_init(void);

// 更新函数（可选）
void gui_design_update(void);

#endif // GUI_DESIGN_H
`;

    return code;
  }

  /**
   * 生成实现文件
   */
  private generateImplementation(): string {
    let code = `#include "gui_design.h"
#include "gui_callbacks.h"
#include <stddef.h>

// 组件句柄定义
`;

    // 定义所有组件句柄
    this.components.forEach(comp => {
      code += `gui_obj_t *${comp.id} = NULL;\n`;
    });

    code += `
/**
 * 初始化GUI设计
 * 此函数由HoneyGUI设计器自动生成
 */
void gui_design_init(void) {
`;

    // 生成组件创建代码（按层级顺序）
    const rootComponents = this.components.filter(c => c.parent === null);
    rootComponents.forEach(comp => {
      code += this.generateComponentTree(comp, 1);
    });

    code += `}

/**
 * 更新GUI（可选）
 */
void gui_design_update(void) {
    // 动态更新逻辑
}
`;

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

    const parentRef = component.parent || 'NULL';
    const { x, y, width, height } = component.position;

    return `${indentStr}${component.id} = ${mapping.createFunction}(${parentRef}, "${component.id}", ${x}, ${y}, ${width}, ${height});\n`;
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
  private generateCallbackHeader(): string {
    let code = `#ifndef GUI_CALLBACKS_H
#define GUI_CALLBACKS_H

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
#endif // GUI_CALLBACKS_H
`;

    return code;
  }

  /**
   * 生成回调实现文件
   */
  private generateCallbackImplementation(): string {
    let code = `#include "gui_callbacks.h"
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
