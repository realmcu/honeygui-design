/**
 * 组件代码生成器接口
 */
import { Component } from '../../../hml/types';

export interface ComponentCodeGenerator {
  /**
   * 生成组件创建代码
   */
  generateCreation(component: Component, indent: number, context: GeneratorContext): string;

  /**
   * 生成属性设置代码
   */
  generatePropertySetters(component: Component, indent: number, context: GeneratorContext): string;
}

/**
 * 生成器上下文
 */
export interface GeneratorContext {
  componentMap: Map<string, Component>;
  getParentRef(component: Component): string;
  projectRoot?: string;  // 项目根目录，用于读取资源文件
}
