/**
 * hg_canvas event code generator.
 * TODO: Implement canvas-specific event handling logic.
 */
import { Component } from '../../../hml/types';
import { EventCodeGenerator } from './EventCodeGenerator';

export class CanvasEventGenerator implements EventCodeGenerator {
  generateEventBindings(_component: Component, _indent: number, _componentMap: Map<string, Component>): string {
    // TODO: Implement canvas event bindings
    return '';
  }

  collectCallbackFunctions(_component: Component): string[] {
    return [];
  }

  getSwitchViewCallbackImpl(_component: Component, _componentMap: Map<string, Component>): string[] {
    return [];
  }
}
