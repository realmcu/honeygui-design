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
      const callbackHeaderFile = path.join(callbacksDir, `${designName}_callbacks.h`);
      const callbackImplFile = path.join(callbacksDir, `${designName}_callbacks.c`);
      
      // 回调头文件：只生成一次
      if (!fs.existsSync(callbackHeaderFile)) {
        fs.writeFileSync(callbackHeaderFile, this.generateCallbackHeader(designName));
        files.push(callbackHeaderFile);
      }
      
      // 回调实现文件：保护区合并
      if (!fs.existsSync(callbackImplFile)) {
        fs.writeFileSync(callbackImplFile, this.generateCallbackImplementation(designName));
        files.push(callbackImplFile);
      } else if (this.options.enableProtectedAreas) {
        const existing = fs.readFileSync(callbackImplFile, 'utf-8');
        const merged = this.mergeProtectedAreas(existing, this.generateCallbackImplementation(designName));
        fs.writeFileSync(callbackImplFile, merged);
        files.push(callbackImplFile);
      }

      // === 用户代码（只生成一次）===
      const userHeaderFile = path.join(userDir, `${designName}.h`);
      const userImplFile = path.join(userDir, `${designName}.c`);

      if (!fs.existsSync(userHeaderFile)) {
        fs.writeFileSync(userHeaderFile, this.generateUserHeader(designName));
        files.push(userHeaderFile);
      }

      if (!fs.existsSync(userImplFile)) {
        fs.writeFileSync(userImplFile, this.generateUserImplementation(designName));
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
   * 生成用户头文件模板
   */
  private generateUserHeader(baseName: string): string {
    const guardName = `${baseName.toUpperCase()}_USER_H`;
    return `#ifndef ${guardName}
#define ${guardName}

/**
 * ${baseName} 用户代码
 * 此文件只生成一次，后续不会被覆盖
 * 可以在此添加自定义逻辑、状态管理等
 */

#include "../ui/${baseName}_ui.h"

// 用户自定义函数声明
void ${baseName}_init_user(void);
void ${baseName}_update_user(void);

#endif // ${guardName}
`;
  }

  /**
   * 生成用户实现文件模板
   */
  private generateUserImplementation(baseName: string): string {
    return `#include "${baseName}.h"
#include <stdio.h>

/**
 * ${baseName} 用户代码实现
 * 此文件只生成一次，后续不会被覆盖
 */

// 用户初始化（在UI创建后调用）
void ${baseName}_init_user(void) {
    // TODO: 添加初始化逻辑
}

// 用户更新（可用于周期性更新UI）
void ${baseName}_update_user(void) {
    // TODO: 添加更新逻辑
}

// 在下方添加更多自定义函数...
`;
  }

  /**
   * 生成UI头文件（每次覆盖）
   */
  private generateUiHeader(baseName: string): string {
    const guardName = `${baseName.toUpperCase()}_UI_H`;
    const componentTypes = [...new Set(this.components.map(c => c.type))];
    const headers = this.apiMapper.getRequiredHeaders(componentTypes);
    const hasView = componentTypes.includes('hg_view');

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

    headers.forEach(header => {
      if (header !== 'gui_view.h') {
        code += `#include "${header}"\n`;
      }
    });

    code += `\n// 组件句柄声明\n`;

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
      if (comp.type !== 'hg_view') {
        code += `gui_obj_t *${comp.id} = NULL;\n`;
      }
    });

    code += `\n`;

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

    // hg_view 使用 GUI_VIEW_INSTANCE 宏，子组件在 switch_in 中创建
    if (component.type === 'hg_view') {
      code += this.generateViewInstance(component, indent);
      return code;
    }

    // 普通组件：生成创建代码
    code += this.generateComponentCreation(component, indent);

    // 生成属性设置代码
    code += this.generatePropertySetters(component, indent);

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
    const indentStr = '    '.repeat(indent);
    const mapping = this.apiMapper.getMapping(component.type);

    if (!mapping) {
      return `${indentStr}// 警告: 未找到${component.type}的API映射\n`;
    }

    // 确定父组件引用
    let parentRef = 'NULL';
    if (component.parent) {
      const parentComp = this.componentMap.get(component.parent);
      if (parentComp) {
        if (parentComp.type === 'hg_view') {
          // 父组件是 view，使用 switch_in 函数的 view 参数
          parentRef = '(gui_obj_t *)view';
        } else {
          parentRef = component.parent;
        }
      }
    }

    const { x, y, width, height } = component.position;

    // 特殊处理图片组件，直接在创建时传入路径
    if (component.type === 'hg_image') {
        const src = component.data?.src || '';
        // 将图片扩展名替换为 .bin
        let binSrc = src.replace(/\.(png|jpe?g|bmp|gif|tiff?|webp)$/i, '.bin');
        // 去掉 assets/ 前缀（因为 mkromfs 打包的是 assets 目录本身）
        binSrc = binSrc.replace(/^assets\//, '');
        // 确保路径以 / 开头（VFS 绝对路径）
        if (!binSrc.startsWith('/')) {
            binSrc = '/' + binSrc;
        }
        // gui_img_create_from_fs 返回 gui_img_t*，需要强制转换
        return `${indentStr}${component.id} = (gui_obj_t *)gui_img_create_from_fs(${parentRef}, "${component.name}", "${binSrc}", ${x}, ${y}, ${width}, ${height});\n`;
    }

    // 特殊处理视频组件
    if (component.type === 'hg_video') {
        const src = component.data?.src || '';
        const frameRate = component.data?.frameRate || 30;
        const autoPlay = component.data?.autoPlay !== false; // 默认自动播放
        
        // 将视频扩展名替换为转换后的格式
        let videoSrc = src;
        const format = component.data?.format || 'mjpeg';
        
        // 根据格式替换扩展名
        if (format === 'mjpeg') {
            videoSrc = src.replace(/\.[^.]+$/i, '.mjpeg');
        } else if (format === 'avi') {
            videoSrc = src.replace(/\.[^.]+$/i, '.avi');
        } else if (format === 'h264') {
            videoSrc = src.replace(/\.[^.]+$/i, '.h264');  // H.264 原始流格式
        }
        
        // 去掉 assets/ 前缀（因为 mkromfs 打包的是 assets 目录本身）
        videoSrc = videoSrc.replace(/^assets\//, '');
        // 确保路径以 / 开头（VFS 绝对路径）
        if (!videoSrc.startsWith('/')) {
            videoSrc = '/' + videoSrc;
        }
        
        // 生成视频组件创建代码
        let code = `${indentStr}${component.id} = (gui_obj_t *)gui_video_create_from_fs(${parentRef}, "${component.name}", "${videoSrc}", ${x}, ${y}, ${width}, ${height});\n`;
        
        // 设置帧率
        code += `${indentStr}gui_video_set_frame_rate((gui_video_t *)${component.id}, ${frameRate}.f);\n`;
        
        // 设置播放状态
        if (autoPlay) {
            code += `${indentStr}gui_video_set_state((gui_video_t *)${component.id}, GUI_VIDEO_STATE_PLAYING);\n`;
        }
        
        return code;
    }

    // 特殊处理3D模型组件
    if (component.type === 'hg_3d') {
        const modelPath = component.data?.modelPath || '';
        const ext = modelPath.split('.').pop()?.toLowerCase();
        
        // 去掉 assets/ 前缀
        let vfsPath = modelPath.replace(/^assets\//, '');
        // 确保路径以 / 开头（VFS 绝对路径）
        if (!vfsPath.startsWith('/')) {
            vfsPath = '/' + vfsPath;
        }

        let createFunc = '';
        if (ext === 'obj') {
            createFunc = 'l3_create_obj_model';
        } else if (ext === 'gltf' || ext === 'glb') {
            createFunc = 'l3_create_gltf_model';
        } else {
            return `${indentStr}// 警告: 不支持的3D模型格式: ${ext}\n`;
        }

        return `${indentStr}${component.id} = (gui_obj_t *)gui_3d_create(${parentRef}, "${component.name}", ${createFunc}("${vfsPath}"), ${x}, ${y}, ${width}, ${height});\n`;
    }

    return `${indentStr}${component.id} = ${mapping.createFunction}(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  /**
   * 生成 hg_view 的 GUI_VIEW_INSTANCE 代码
   * 包括：
   * 1. switch_out 回调（空实现）
   * 2. switch_in 回调（注册视图切换事件 + 创建子组件）
   * 3. GUI_VIEW_INSTANCE 宏调用
   */
  private generateViewInstance(component: Component, indent: number): string {
    const indentStr = '    '.repeat(indent);
    const name = component.name;

    let code = '';
    
    // 生成 switch_out 回调
    code += `${indentStr}static void ${name}_switch_out(gui_view_t *view)\n`;
    code += `${indentStr}{\n`;
    code += `${indentStr}    GUI_UNUSED(view);\n`;
    code += `${indentStr}}\n\n`;
    
    // 生成 switch_in 回调
    code += `${indentStr}static void ${name}_switch_in(gui_view_t *view)\n`;
    code += `${indentStr}{\n`;
    
    // 1. 注册视图切换事件
    if (component.view_switch && component.view_switch.length > 0) {
      component.view_switch.forEach(switchEvent => {
        const targetComponent = this.componentMap.get(switchEvent.target);
        const targetName = targetComponent?.name || switchEvent.target;
        code += `${indentStr}    gui_view_switch_on_event(view, "${targetName}", ${switchEvent.switch_out_style}, ${switchEvent.switch_in_style}, ${switchEvent.event});\n`;
      });
    } else {
      code += `${indentStr}    GUI_UNUSED(view);\n`;
    }
    
    // 2. 创建子组件
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
    
    // 3. GUI_VIEW_INSTANCE 宏调用
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

    // 不再生成回调函数模板（视图切换由 SDK 自动处理）

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
