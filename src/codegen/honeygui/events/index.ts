/**
 * 事件代码生成器工厂
 */
import { EventCodeGenerator } from './EventCodeGenerator';
import { ViewEventGenerator } from './ViewEventGenerator';
import { ImageEventGenerator } from './ImageEventGenerator';
import { DefaultEventGenerator } from './DefaultEventGenerator';

export class EventGeneratorFactory {
  private static generators: Map<string, EventCodeGenerator> = new Map();
  private static defaultGenerator = new DefaultEventGenerator();

  static {
    // 注册组件特定的事件生成器
    this.generators.set('hg_view', new ViewEventGenerator());
    this.generators.set('hg_window', new ViewEventGenerator());
    this.generators.set('hg_image', new ImageEventGenerator());
    // 其他组件使用默认生成器
  }

  static getGenerator(componentType: string): EventCodeGenerator {
    return this.generators.get(componentType) || this.defaultGenerator;
  }

  static getViewEventGenerator(): ViewEventGenerator {
    return this.generators.get('hg_view') as ViewEventGenerator;
  }
}
