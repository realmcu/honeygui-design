/**
 * LVGL 事件生成器工厂
 * 注册各组件类型对应的事件生成器
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

  /** 获取指定组件类型的事件生成器，无则返回 undefined */
  static getGenerator(componentType: string): LvglEventCodeGenerator | undefined {
    return this.generators.get(componentType);
  }

  /** 获取所有已注册的事件生成器 */
  static getAllGenerators(): Map<string, LvglEventCodeGenerator> {
    return this.generators;
  }

  /** 判断组件类型是否有事件生成器 */
  static hasGenerator(componentType: string): boolean {
    return this.generators.has(componentType);
  }
}

export { LvglEventCodeGenerator } from './LvglEventCodeGenerator';
