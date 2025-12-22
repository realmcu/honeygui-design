/**
 * hg_svg 事件代码生成器
 * TODO: 实现 SVG 特定的事件处理逻辑
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator } from './EventCodeGenerator';

export class SvgEventGenerator implements EventCodeGenerator {
  generateEventBindings(_component: Component, _indent: number, _componentMap: Map<string, Component>): string {
    // TODO: 实现 SVG 事件绑定
    return '';
  }

  collectCallbackFunctions(_component: Component): string[] {
    return [];
  }

  getSwitchViewCallbackImpl(_component: Component, _componentMap: Map<string, Component>): string[] {
    return [];
  }
}
