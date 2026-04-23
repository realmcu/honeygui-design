/**
 * Unified LVGL event generator
 *
 * Replaces per-component event generators with a single generic implementation.
 * All LVGL widgets use the same event registration API (lv_obj_add_event_cb),
 * so there's no need for separate generators per component type.
 *
 * Design:
 * - Only generates event callbacks when the component has eventConfigs
 *   (user-configured events in the designer)
 * - No default logging callbacks — if a component has no events configured,
 *   no callback is generated. Users can add custom logic in the USER CODE area.
 * - Gesture (swipe) events are handled with direction checks inside the callback
 * - Radio (mutual exclusion) is handled separately at parent container level
 *
 * Generated callback structure:
 *   void xxx_event_cb(lv_event_t * e) {
 *       lv_event_code_t code = lv_event_get_code(e);
 *       lv_obj_t * obj = lv_event_get_target(e);
 *       // auto-generated event handling (from eventConfigs)
 *       // USER CODE BEGIN / END (preserved on regeneration)
 *   }
 */
import { Component } from '../../../hml/types';
import { EventConfig } from '../../../hml/eventTypes';
import { LvglEventCodeGenerator } from './LvglEventCodeGenerator';
import { generateSwitchViewCode } from '../LvglSwitchViewMapper';

// ============ HML event type → LVGL event code mapping ============

const HML_TO_LVGL_EVENT: Record<string, string> = {
  'onClick': 'LV_EVENT_CLICKED',
  'onLongPress': 'LV_EVENT_LONG_PRESSED',
  'onTouchDown': 'LV_EVENT_PRESSED',
  'onTouchUp': 'LV_EVENT_RELEASED',
  'onValueChange': 'LV_EVENT_VALUE_CHANGED',
  'onCheckedChange': 'LV_EVENT_VALUE_CHANGED',
  // Swipe events all map to LV_EVENT_GESTURE (direction checked inside callback)
  'onSwipeLeft': 'LV_EVENT_GESTURE',
  'onSwipeRight': 'LV_EVENT_GESTURE',
  'onSwipeUp': 'LV_EVENT_GESTURE',
  'onSwipeDown': 'LV_EVENT_GESTURE',
};

/** HML swipe event → LVGL gesture direction constant */
const SWIPE_DIR_MAP: Record<string, string> = {
  'onSwipeLeft': 'LV_DIR_LEFT',
  'onSwipeRight': 'LV_DIR_RIGHT',
  'onSwipeUp': 'LV_DIR_TOP',
  'onSwipeDown': 'LV_DIR_BOTTOM',
};

// ============ Generator implementation ============

export class LvglGenericEventGenerator implements LvglEventCodeGenerator {

  generateEventBindings(component: Component): string {
    const eventConfigs: EventConfig[] = (component as any).eventConfigs || [];
    if (eventConfigs.length === 0) { return ''; }

    const cbName = `${component.id}_event_cb`;

    // Collect LVGL event codes that need binding
    const neededEvents = new Set<string>();
    for (const ec of eventConfigs) {
      if (ec.actions && ec.actions.length > 0) {
        const lvCode = HML_TO_LVGL_EVENT[ec.type];
        if (lvCode) {
          neededEvents.add(lvCode);
        }
      }
    }

    if (neededEvents.size === 0) { return ''; }

    // Register each event code separately for efficiency
    // (use LV_EVENT_ALL only if too many distinct codes)
    let code = '';
    if (neededEvents.size > 3) {
      code += `    lv_obj_add_event_cb(${component.id}, ${cbName}, LV_EVENT_ALL, NULL);\n`;
    } else {
      for (const eventCode of neededEvents) {
        code += `    lv_obj_add_event_cb(${component.id}, ${cbName}, ${eventCode}, NULL);\n`;
      }
    }
    return code;
  }

  collectCallbackFunctions(component: Component): string[] {
    const eventConfigs: EventConfig[] = (component as any).eventConfigs || [];
    if (eventConfigs.length === 0) { return []; }

    // Check if any event has actions with a mappable LVGL event code
    const hasActions = eventConfigs.some(ec =>
      ec.actions && ec.actions.length > 0 && HML_TO_LVGL_EVENT[ec.type]
    );
    return hasActions ? [`${component.id}_event_cb`] : [];
  }

  getEventCallbackImpl(component: Component): string[] {
    const eventConfigs: EventConfig[] = (component as any).eventConfigs || [];
    if (eventConfigs.length === 0) { return []; }

    // Build event blocks from eventConfigs
    const eventBlocks = new Map<string, {
      actionLines: string[];
      isGesture: boolean;
      gestureBlocks: Array<{ dir: string; lines: string[] }>;
    }>();

    const getOrCreate = (eventCode: string) => {
      if (!eventBlocks.has(eventCode)) {
        eventBlocks.set(eventCode, { actionLines: [], isGesture: false, gestureBlocks: [] });
      }
      return eventBlocks.get(eventCode)!;
    };

    for (const ec of eventConfigs) {
      if (!ec.actions || ec.actions.length === 0) { continue; }

      const lvCode = HML_TO_LVGL_EVENT[ec.type];
      if (!lvCode) { continue; }

      const block = getOrCreate(lvCode);

      // Swipe events need gesture direction check
      const swipeDir = SWIPE_DIR_MAP[ec.type];
      if (swipeDir) {
        block.isGesture = true;
        const gestureLines: string[] = [];
        for (const action of ec.actions) {
          const actionCode = this.generateActionCode(action, '            ');
          if (actionCode) { gestureLines.push(actionCode); }
        }
        if (gestureLines.length > 0) {
          block.gestureBlocks.push({ dir: swipeDir, lines: gestureLines });
        }
      } else {
        // Non-gesture events: generate action code directly
        for (const action of ec.actions) {
          const actionCode = this.generateActionCode(action, '        ');
          if (actionCode) { block.actionLines.push(actionCode); }
        }
      }
    }

    // Skip if no event blocks were created
    if (eventBlocks.size === 0) { return []; }

    // Build callback function
    const cbName = `${component.id}_event_cb`;
    let code = `static void ${cbName}(lv_event_t * e)\n`;
    code += `{\n`;
    code += `    lv_event_code_t code = lv_event_get_code(e);\n`;
    code += `    lv_obj_t * obj = lv_event_get_target(e);\n`;
    code += `    (void)obj; // Avoid unused warning\n`;

    for (const [eventCode, block] of eventBlocks) {
      code += `\n`;

      if (block.isGesture && block.gestureBlocks.length > 0) {
        code += `    if(code == ${eventCode}) {\n`;
        code += `        lv_dir_t dir = lv_indev_get_gesture_dir(lv_indev_active());\n`;
        for (const gb of block.gestureBlocks) {
          code += `        if(dir == ${gb.dir}) {\n`;
          for (const line of gb.lines) {
            code += line;
          }
          code += `        }\n`;
        }
        code += `    }\n`;
      } else {
        code += `    if(code == ${eventCode}) {\n`;
        for (const line of block.actionLines) {
          code += line;
        }
        code += `    }\n`;
      }
    }

    code += `}\n`;
    return [code];
  }

  /**
   * Generate C code for a single action
   */
  private generateActionCode(action: any, indent: string): string {
    if (action.type === 'switchView' && action.target) {
      return generateSwitchViewCode(action.target, action.switchInStyle, action.switchOutStyle, indent);
    }
    if (action.type === 'callFunction' && action.functionName) {
      return `${indent}${action.functionName}(e);\n`;
    }
    if (action.type === 'sendMessage' && action.message) {
      return `${indent}// TODO: sendMessage("${action.message}") - LVGL has no built-in message bus\n`;
    }
    return '';
  }
}
