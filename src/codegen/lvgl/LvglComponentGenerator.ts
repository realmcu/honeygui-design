/**
 * LVGL 组件代码生成器接口
 */
import { Component } from '../../hml/types';
import { LvglResourceManager } from './LvglResourceManager';

/**
 * 生成器上下文：提供组件间共享的状态和工具方法
 */
export interface LvglGeneratorContext {
  /** 组件 ID → Component 映射 */
  componentMap: Map<string, Component>;
  /** 获取父组件引用变量名 */
  getParentRef(component: Component): string;
  /** 统一资源管理器 */
  resources: LvglResourceManager;
  /** 获取内置图片变量名（已转换为 C 数组的图片）- 向后兼容，内部委托给 resources */
  getBuiltinImageVar(source: string): string | undefined;
  /** 获取内置字体变量名（已转换为 LVGL 格式的字体）- 向后兼容，内部委托给 resources */
  getBuiltinFontVar(fontFile: string, fontSize: number): string | null;
  /** 向上查找祖先容器的背景色 */
  getAncestorBackgroundColor(component: Component): string | null;
}

/**
 * LVGL 组件代码生成器接口
 * 每种组件类型实现此接口
 */
export interface LvglComponentCodeGenerator {
  /**
   * 生成组件创建 + 属性设置代码（在 ui_create 函数体内）
   * 返回的代码已包含缩进（4 空格）
   */
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string;

  /**
   * 生成事件回调函数代码（在 ui_create 函数体外，文件顶部）
   * 可选实现，默认不生成
   */
  generateEventCallbacks?(components: Component[]): string;

  /**
   * 生成全局样式/变量定义（在 ui_create 函数体外）
   * 可选实现，默认不生成
   */
  generateGlobalDefinitions?(components: Component[]): string;
}
