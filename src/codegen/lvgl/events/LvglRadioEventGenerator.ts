/**
 * hg_radio event generator
 *
 * Radio mutual exclusion is handled by the parent container's LV_EVENT_CLICKED callback
 * (generated in LvglRadioGenerator.generateGlobalDefinitions).
 * Individual radio buttons use LV_OBJ_FLAG_EVENT_BUBBLE to propagate clicks to the parent.
 *
 * This generator produces the event binding on the parent container (not on each radio),
 * and provides an empty per-radio callback since the logic is centralized.
 */
import { Component } from '../../../hml/types';
import { LvglEventCodeGenerator } from './LvglEventCodeGenerator';

export class LvglRadioEventGenerator implements LvglEventCodeGenerator {
  /**
   * Radio event binding is handled at the parent container level via
   * radio_event_handler, not per-radio. Return empty string here.
   */
  generateEventBindings(_component: Component): string {
    return '';
  }

  collectCallbackFunctions(_component: Component): string[] {
    return [];
  }

  getEventCallbackImpl(_component: Component): string[] {
    return [];
  }
}
