/**
 * hg_lottie event code generator.
 * TODO: Implement Lottie animation-specific event handling logic (e.g. onComplete).
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator } from './EventCodeGenerator';

export class LottieEventGenerator implements EventCodeGenerator {
  generateEventBindings(_component: Component, _indent: number, _componentMap: Map<string, Component>): string {
    // TODO: Implement Lottie event bindings
    return '';
  }

  collectCallbackFunctions(_component: Component): string[] {
    return [];
  }

  getSwitchViewCallbackImpl(_component: Component, _componentMap: Map<string, Component>): string[] {
    return [];
  }
}
