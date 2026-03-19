/**
 * LVGL C代码生成器
 * 从组件树生成调用LVGL API的C代码
 *
 * 架构说明：
 * - 主生成器只负责文件输出和调度
 * - 各组件的代码生成逻辑在 components/ 目录下
 * - 资源转换逻辑在 resources/ 目录下
 * - 工具函数在 LvglUtils.ts 中
 */

import * as fs from 'fs';
import * as path from 'path';
import { Component } from '../../hml/types';
import { ICodeGenerator, CodeGenOptions, CodeGenResult } from '../ICodeGenerator';
import { LvglGeneratorContext } from './LvglComponentGenerator';
import { LvglResourceManager } from './LvglResourceManager';
import { LvglHeaderFileGenerator } from './files/LvglHeaderFileGenerator';
import { LvglSourceFileGenerator } from './files/LvglSourceFileGenerator';
import { LvglEntryFileGenerator } from './files/LvglEntryFileGenerator';
import { LvglCallbackFileGenerator, CallbackImpl } from './files/LvglCallbackFileGenerator';
import { LvglProtectedAreaMerger } from './files/LvglProtectedAreaMerger';
import { LvglComponentGeneratorFactory } from './components';
import { LvglEventGeneratorFactory } from './events';

export class LvglCCodeGenerator implements ICodeGenerator {
  private components: Component[];
  private options: CodeGenOptions;
  private componentMap: Map<string, Component>;
  private resourceManager: LvglResourceManager;

  constructor(components: Component[], options: CodeGenOptions) {
    this.components = components;
    this.options = options;
    this.componentMap = new Map(components.map(c => [c.id, c]));
    this.resourceManager = new LvglResourceManager();
  }

  // 文件生成器
  private headerFileGenerator = new LvglHeaderFileGenerator();
  private sourceFileGenerator = new LvglSourceFileGenerator();
  private entryFileGenerator = new LvglEntryFileGenerator();
  private callbackFileGenerator = new LvglCallbackFileGenerator();

  /**
   * 生成所有代码文件
   */
  async generate(): Promise<CodeGenResult> {
    try {
      const files: string[] = [];
      const srcDir = this.options.srcDir;
      const designName = this.options.designName;

      const lvglDir = path.join(srcDir, 'lvgl');
      if (!fs.existsSync(lvglDir)) {
        fs.mkdirSync(lvglDir, { recursive: true });
      }

      // 资源预处理
      this.resourceManager.prepare(this.components, srcDir, lvglDir);

      // 准备共享数据
      const orderedComponents = this.getCreationOrder();
      const ctx = this.createContext();
      const imageVars = this.resourceManager.getImageVarList();
      const fontVars = this.resourceManager.getFontVarList();

      // 通过文件生成器生成内容
      const headerFile = path.join(lvglDir, `${designName}_lvgl_ui.h`);
      const sourceFile = path.join(lvglDir, `${designName}_lvgl_ui.c`);
      const entryHeaderFile = path.join(lvglDir, 'lvgl_generated_ui.h');
      const entrySourceFile = path.join(lvglDir, 'lvgl_generated_ui.c');

      fs.writeFileSync(headerFile, this.headerFileGenerator.generate(designName, orderedComponents), 'utf-8');
      fs.writeFileSync(sourceFile, this.sourceFileGenerator.generate(designName, orderedComponents, ctx, imageVars, fontVars, (c) => this.getParentRef(c)), 'utf-8');
      fs.writeFileSync(entryHeaderFile, this.entryFileGenerator.generateHeader(), 'utf-8');
      fs.writeFileSync(entrySourceFile, this.entryFileGenerator.generateSource(designName), 'utf-8');

      files.push(headerFile, sourceFile, entryHeaderFile, entrySourceFile);

      // 生成回调文件（含保护区机制）
      const callbackImpls = this.collectCallbackImpls(orderedComponents);
      if (callbackImpls.length > 0) {
        const callbackHeaderFile = path.join(lvglDir, `${designName}_lvgl_callbacks.h`);
        const callbackSourceFile = path.join(lvglDir, `${designName}_lvgl_callbacks.c`);
        const callbackNames = callbackImpls.map(impl => impl.name);

        const generatedHeader = this.callbackFileGenerator.generateHeader(designName, callbackNames);
        const generatedSource = this.callbackFileGenerator.generateImplementation(designName, callbackImpls);

        fs.writeFileSync(callbackHeaderFile, generatedHeader, 'utf-8');

        // 回调实现文件：如果已存在则合并保护区，保留用户代码
        if (fs.existsSync(callbackSourceFile)) {
          try {
            const existing = fs.readFileSync(callbackSourceFile, 'utf-8');
            const merged = LvglProtectedAreaMerger.merge(existing, generatedSource);
            fs.writeFileSync(callbackSourceFile, merged, 'utf-8');
          } catch (e) {
            console.warn(`Failed to read existing callback file, overwriting: ${e}`);
            fs.writeFileSync(callbackSourceFile, generatedSource, 'utf-8');
          }
        } else {
          fs.writeFileSync(callbackSourceFile, generatedSource, 'utf-8');
        }

        files.push(callbackHeaderFile, callbackSourceFile);
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
   * 创建生成器上下文（供各组件生成器使用）
   */
  private createContext(): LvglGeneratorContext {
    return {
      componentMap: this.componentMap,
      getParentRef: (component: Component) => this.getParentRef(component),
      resources: this.resourceManager,
      getBuiltinImageVar: (source: string) => this.resourceManager.getImageVar(source),
      getBuiltinFontVar: (fontFile: string, fontSize: number) => this.resourceManager.getFontVar(fontFile, fontSize),
      getAncestorBackgroundColor: (component: Component) => this.getAncestorBackgroundColor(component),
    };
  }

  /**
   * 按 z-index 排序的组件创建顺序（深度优先）
   */
  private getCreationOrder(): Component[] {
    const childrenMap = new Map<string | null, Component[]>();

    const pushChild = (parentId: string | null, component: Component): void => {
      const list = childrenMap.get(parentId) || [];
      list.push(component);
      childrenMap.set(parentId, list);
    };

    this.components.forEach(component => {
      const parentId = component.parent || null;
      if (parentId && !this.componentMap.has(parentId)) {
        pushChild(null, component);
      } else {
        pushChild(parentId, component);
      }
    });

    const sortByZIndex = (list: Component[]): Component[] => {
      return list.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    };

    const ordered: Component[] = [];
    const visited = new Set<string>();

    const walk = (parentId: string | null): void => {
      const children = sortByZIndex(childrenMap.get(parentId) || []);
      children.forEach(child => {
        if (visited.has(child.id)) { return; }
        visited.add(child.id);
        ordered.push(child);
        walk(child.id);
      });
    };

    walk(null);

    // 确保所有组件都被包含
    this.components.forEach(component => {
      if (!visited.has(component.id)) {
        ordered.push(component);
      }
    });

    return ordered;
  }

  private getParentRef(component: Component): string {
    const parentId = component.parent;
    if (!parentId || !this.componentMap.has(parentId)) {
      return 'parent';
    }
    return parentId;
  }

  /**
   * 从事件生成器工厂收集回调函数实现信息
   */
  private collectCallbackImpls(orderedComponents: Component[]): CallbackImpl[] {
    const impls: CallbackImpl[] = [];

    for (const component of orderedComponents) {
      const eventGenerator = LvglEventGeneratorFactory.getGenerator(component.type);
      if (!eventGenerator) { continue; }

      const callbackCodes = eventGenerator.getEventCallbackImpl(component);
      for (const callbackCode of callbackCodes) {
        // 解析 static void xxx(lv_event_t * e) { ... } 块
        const funcRegex = /static void (\w+)\(lv_event_t \* e\)\n\{([\s\S]*?)\n\}\n?$/;
        const match = funcRegex.exec(callbackCode);
        if (match) {
          impls.push({
            name: match[1],
            signature: `void ${match[1]}(lv_event_t * e)`,
            body: match[2] + '\n',
          });
        }
      }
    }

    return impls;
  }

  /**
   * 向上查找祖先容器的背景色
   */
  private getAncestorBackgroundColor(component: Component): string | null {
    let current: Component | undefined = component;
    while (current) {
      const parentId = current.parent;
      if (!parentId) { break; }
      const parent = this.componentMap.get(parentId);
      if (!parent) { break; }
      const bgColor = parent.style?.backgroundColor;
      if (bgColor) {
        return String(bgColor);
      }
      current = parent;
    }
    return null;
  }
}
