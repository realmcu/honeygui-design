/**
 * LVGL event generator factory
 *
 * Uses LvglGenericEventGenerator for all component types except:
 * - hg_view: has special gesture direction handling (uses LvglGenericEventGenerator too,
 *   since gesture support is built into the generic generator)
 * - hg_radio: mutual exclusion handled at parent container level, no per-component event
 */
import { LvglEventCodeGenerator } from './LvglEventCodeGenerator';
import { LvglRadioEventGenerator } from './LvglRadioEventGenerator';
import { LvglGenericEventGenerator } from './LvglGenericEventGenerator';

/** Singleton instance shared by all component types */
const genericGenerator = new LvglGenericEventGenerator();

export class LvglEventGeneratorFactory {
  private static generators: Map<string, LvglEventCodeGenerator> = new Map();

  static {
    // Generic generator handles all standard components including view (gesture support built-in)
    this.generators.set('hg_view', genericGenerator);
    this.generators.set('hg_button', genericGenerator);
    this.generators.set('hg_arc', genericGenerator);
    this.generators.set('hg_checkbox', genericGenerator);
    this.generators.set('hg_input', genericGenerator);
    this.generators.set('hg_switch', genericGenerator);
    this.generators.set('hg_slider', genericGenerator);
    // Radio: mutual exclusion at parent level, no per-component event callback
    this.generators.set('hg_radio', new LvglRadioEventGenerator());
  }

  /** Get event generator for the specified component type, or undefined if none */
  static getGenerator(componentType: string): LvglEventCodeGenerator | undefined {
    return this.generators.get(componentType);
  }

  /** Get all registered event generators */
  static getAllGenerators(): Map<string, LvglEventCodeGenerator> {
    return this.generators;
  }

  /** Check if a component type has an event generator */
  static hasGenerator(componentType: string): boolean {
    return this.generators.has(componentType);
  }
}

export { LvglEventCodeGenerator } from './LvglEventCodeGenerator';
