/**
 * hg_view event generator
 *
 * Handles view-level events, primarily swipe gestures for screen switching.
 * Maps HML onSwipeLeft/Right/Up/Down + switchView action to
 * LVGL LV_EVENT_GESTURE + lv_screen_load_anim().
 */
import { Component } from '../../../hml/types';
import { LvglEventCodeGenerator } from './LvglEventCodeGenerator';
import { generateSwitchViewCode } from '../LvglSwitchViewMapper';

/** HML swipe event → LVGL gesture direction */
const SWIPE_DIR_MAP: Record<string, string> = {
  'onSwipeLeft': 'LV_DIR_LEFT',
  'onSwipeRight': 'LV_DIR_RIGHT',
  'onSwipeUp': 'LV_DIR_TOP',
  'onSwipeDown': 'LV_DIR_BOTTOM',
};

/** HML event type → LVGL event code */
const EVENT_CODE_MAP: Record<string, string> = {
  'onClick': 'LV_EVENT_CLICKED',
  'onLongPress': 'LV_EVENT_LONG_PRESSED',
  'onSwipeLeft': 'LV_EVENT_GESTURE',
  'onSwipeRight': 'LV_EVENT_GESTURE',
  'onSwipeUp': 'LV_EVENT_GESTURE',
  'onSwipeDown': 'LV_EVENT_GESTURE',
};

export class LvglViewEventGenerator implements LvglEventCodeGenerator {
  generateEventBindings(component: Component): string {
    const eventConfigs = (component as any).eventConfigs || [];
    if (eventConfigs.length === 0) { return ''; }

    const cbName = `${component.id}_event_cb`;
    const neededEvents = new Set<string>();

    for (const ec of eventConfigs) {
      if (ec.actions && ec.actions.length > 0) {
        const lvCode = EVENT_CODE_MAP[ec.type];
        if (lvCode) { neededEvents.add(lvCode); }
      }
    }

    if (neededEvents.size === 0) { return ''; }

    let code = '';
    for (const eventCode of neededEvents) {
      code += `    lv_obj_add_event_cb(${component.id}, ${cbName}, ${eventCode}, NULL);\n`;
    }
    return code;
  }

  collectCallbackFunctions(component: Component): string[] {
    const eventConfigs = (component as any).eventConfigs || [];
    if (eventConfigs.length === 0) { return []; }

    const hasActions = eventConfigs.some((ec: any) =>
      ec.actions && ec.actions.length > 0 && EVENT_CODE_MAP[ec.type]
    );
    return hasActions ? [`${component.id}_event_cb`] : [];
  }

  getEventCallbackImpl(component: Component): string[] {
    const eventConfigs = (component as any).eventConfigs || [];
    if (eventConfigs.length === 0) { return []; }

    const swipeConfigs: Array<{ dir: string; actions: any[] }> = [];
    const clickActions: any[] = [];
    const longPressActions: any[] = [];

    for (const ec of eventConfigs) {
      if (!ec.actions || ec.actions.length === 0) { continue; }
      const dir = SWIPE_DIR_MAP[ec.type];
      if (dir) {
        swipeConfigs.push({ dir, actions: ec.actions });
      } else if (ec.type === 'onClick') {
        clickActions.push(...ec.actions);
      } else if (ec.type === 'onLongPress') {
        longPressActions.push(...ec.actions);
      }
    }

    if (swipeConfigs.length === 0 && clickActions.length === 0 && longPressActions.length === 0) {
      return [];
    }

    const cbName = `${component.id}_event_cb`;
    let code = `static void ${cbName}(lv_event_t * e)\n`;
    code += `{\n`;
    code += `    lv_event_code_t code = lv_event_get_code(e);\n`;

    // Gesture handling for swipe events
    if (swipeConfigs.length > 0) {
      code += `\n    if(code == LV_EVENT_GESTURE) {\n`;
      code += `        lv_dir_t dir = lv_indev_get_gesture_dir(lv_indev_active());\n`;
      for (const sc of swipeConfigs) {
        code += `        if(dir == ${sc.dir}) {\n`;
        for (const action of sc.actions) {
          code += this.generateActionCode(action, '            ');
        }
        code += `        }\n`;
      }
      code += `    }\n`;
    }

    // Click handling
    if (clickActions.length > 0) {
      code += `\n    if(code == LV_EVENT_CLICKED) {\n`;
      for (const action of clickActions) {
        code += this.generateActionCode(action, '        ');
      }
      code += `    }\n`;
    }

    // Long press handling
    if (longPressActions.length > 0) {
      code += `\n    if(code == LV_EVENT_LONG_PRESSED) {\n`;
      for (const action of longPressActions) {
        code += this.generateActionCode(action, '        ');
      }
      code += `    }\n`;
    }

    code += `}\n`;
    return [code];
  }

  private generateActionCode(action: any, indent: string): string {
    if (action.type === 'switchView' && action.target) {
      return generateSwitchViewCode(action.target, action.switchInStyle, action.switchOutStyle, indent);
    }
    if (action.type === 'callFunction' && action.functionName) {
      return `${indent}${action.functionName}(e);\n`;
    }
    return '';
  }
}
