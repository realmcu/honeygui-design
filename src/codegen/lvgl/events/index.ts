/**
 * LVGL event generator factory
 * Registers event generators for each component type
 */
import { LvglEventCodeGenerator } from './LvglEventCodeGenerator';
import { LvglButtonEventGenerator } from './LvglButtonEventGenerator';
import { LvglArcEventGenerator } from './LvglArcEventGenerator';
import { LvglCheckboxEventGenerator } from './LvglCheckboxEventGenerator';
import { LvglInputEventGenerator } from './LvglInputEventGenerator';
import { LvglRadioEventGenerator } from './LvglRadioEventGenerator';

export class LvglEventGeneratorFactory {
  private static generators: Map<string, LvglEventCodeGenerator> = new Map();

  static {
    this.generators.set('hg_button', new LvglButtonEventGenerator());
    this.generators.set('hg_arc', new LvglArcEventGenerator());
    this.generators.set('hg_checkbox', new LvglCheckboxEventGenerator());
    this.generators.set('hg_input', new LvglInputEventGenerator());
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
