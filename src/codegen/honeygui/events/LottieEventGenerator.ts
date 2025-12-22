/**
 * hg_lottie 事件代码生成器
 * TODO: 实现 Lottie 动画特定的事件处理逻辑（如 onComplete 等）
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator } from './EventCodeGenerator';

export class LottieEventGenerator implements EventCodeGenerator {
  generateEventBindings(_component: Component, _indent: number, _componentMap: Map<string, Component>): string {
    // TODO: 实现 Lottie 事件绑定
    return '';
  }

  collectCallbackFunctions(_component: Component): string[] {
    return [];
  }

  getSwitchViewCallbackImpl(_component: Component, _componentMap: Map<string, Component>): string[] {
    return [];
  }
}
