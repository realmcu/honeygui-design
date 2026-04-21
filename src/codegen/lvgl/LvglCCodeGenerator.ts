/**
 * LVGL C code generator
 * Generates C code calling LVGL APIs from a component tree
 *
 * Architecture:
 * - Main generator handles file output and orchestration only
 * - Component code generation logic is in components/ directory
 * - Resource conversion logic is in resources/ directory
 * - Utility functions are in LvglUtils.ts
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

  // File generators
  private headerFileGenerator = new LvglHeaderFileGenerator();
  private sourceFileGenerator = new LvglSourceFileGenerator();
  private entryFileGenerator = new LvglEntryFileGenerator();
  private callbackFileGenerator = new LvglCallbackFileGenerator();

  /**
   * Generate all code files
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

      // Resource preprocessing
      this.resourceManager.prepare(this.components, srcDir, lvglDir);

      // Prepare shared data
      const orderedComponents = this.getCreationOrder();
      const ctx = this.createContext();
      const imageVars = this.resourceManager.getImageVarList();
      const fontVars = this.resourceManager.getFontVarList();

      // Generate content via file generators
      const headerFile = path.join(lvglDir, `${designName}_lvgl_ui.h`);
      const sourceFile = path.join(lvglDir, `${designName}_lvgl_ui.c`);
      const entryHeaderFile = path.join(lvglDir, 'lvgl_generated_ui.h');
      const entrySourceFile = path.join(lvglDir, 'lvgl_generated_ui.c');

      fs.writeFileSync(headerFile, this.headerFileGenerator.generate(designName, orderedComponents), 'utf-8');
      fs.writeFileSync(sourceFile, this.sourceFileGenerator.generate(designName, orderedComponents, ctx, imageVars, fontVars, (c) => this.getParentRef(c)), 'utf-8');
      fs.writeFileSync(entryHeaderFile, this.entryFileGenerator.generateHeader(), 'utf-8');
      fs.writeFileSync(entrySourceFile, this.entryFileGenerator.generateSource(designName), 'utf-8');

      files.push(headerFile, sourceFile, entryHeaderFile, entrySourceFile);

      // Generate callback files (with protected area mechanism)
      const callbackImpls = this.collectCallbackImpls(orderedComponents);
      if (callbackImpls.length > 0) {
        const callbackHeaderFile = path.join(lvglDir, `${designName}_lvgl_callbacks.h`);
        const callbackSourceFile = path.join(lvglDir, `${designName}_lvgl_callbacks.c`);
        const callbackNames = callbackImpls.map(impl => impl.name);

        const generatedHeader = this.callbackFileGenerator.generateHeader(designName, callbackNames);
        const generatedSource = this.callbackFileGenerator.generateImplementation(designName, callbackImpls);

        fs.writeFileSync(callbackHeaderFile, generatedHeader, 'utf-8');

        // Callback implementation file: merge protected areas to preserve user code if file exists
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
   * Create generator context (used by component generators)
   */
  private createContext(): LvglGeneratorContext {
    return {
      componentMap: this.componentMap,
      getParentRef: (component: Component) => this.getParentRef(component),
      resources: this.resourceManager,
      getBuiltinImageVar: (source: string) => this.resourceManager.getImageVar(source),
      getBuiltinFontVar: (fontFile: string, fontSize: number, bpp?: number) => this.resourceManager.getFontVar(fontFile, fontSize, bpp),
      getAncestorBackgroundColor: (component: Component) => this.getAncestorBackgroundColor(component),
    };
  }

  /**
   * Component creation order sorted by z-index (depth-first)
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

    // Ensure all components are included
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
   * Collect callback function implementations from event generator factory
   */
  private collectCallbackImpls(orderedComponents: Component[]): CallbackImpl[] {
    const impls: CallbackImpl[] = [];

    for (const component of orderedComponents) {
      const eventGenerator = LvglEventGeneratorFactory.getGenerator(component.type);
      if (!eventGenerator) { continue; }

      const callbackCodes = eventGenerator.getEventCallbackImpl(component);
      for (const callbackCode of callbackCodes) {
        // Parse static void xxx(lv_event_t * e) { ... } block
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
   * Look up ancestor container's background color
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
