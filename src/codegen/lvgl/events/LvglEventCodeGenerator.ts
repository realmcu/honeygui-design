/**
 * LVGL event code generator interface
 * Defines event callback generation specification for each component type
 */
import { Component } from '../../../hml/types';

export interface LvglEventCodeGenerator {
  /** Generate event binding code (inside ui_create function body, called by component generator) */
  generateEventBindings(component: Component): string;

  /** Collect list of callback function names to generate */
  collectCallbackFunctions(component: Component): string[];

  /** Get callback function implementation code (static void format, parsed into CallbackImpl) */
  getEventCallbackImpl(component: Component): string[];
}
