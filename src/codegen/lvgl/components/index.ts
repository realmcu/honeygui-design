/**
 * LVGL 组件代码生成器工厂
 */
import { LvglComponentCodeGenerator } from '../LvglComponentGenerator';
import { LvglViewGenerator } from './LvglViewGenerator';
import { LvglWindowGenerator } from './LvglWindowGenerator';
import { LvglImageGenerator } from './LvglImageGenerator';
import { LvglLabelGenerator } from './LvglLabelGenerator';
import { LvglButtonGenerator } from './LvglButtonGenerator';
import { LvglInputGenerator } from './LvglInputGenerator';
import { LvglCheckboxGenerator } from './LvglCheckboxGenerator';
import { LvglRadioGenerator } from './LvglRadioGenerator';
import { LvglArcGenerator } from './LvglArcGenerator';
import { LvglRectGenerator } from './LvglRectGenerator';
import { LvglCircleGenerator } from './LvglCircleGenerator';
import { LvglVideoGenerator } from './LvglVideoGenerator';
import { LvglLottieGenerator } from './LvglLottieGenerator';
import { Lvgl3DGenerator } from './Lvgl3DGenerator';
import { LvglDefaultGenerator } from './LvglDefaultGenerator';

export class LvglComponentGeneratorFactory {
  private static generators: Map<string, LvglComponentCodeGenerator> = new Map();
  private static defaultGenerator = new LvglDefaultGenerator();

  static {
    // 容器组件
    this.generators.set('hg_view', new LvglViewGenerator());
    this.generators.set('hg_window', new LvglWindowGenerator());

    // 基础控件
    this.generators.set('hg_image', new LvglImageGenerator());
    this.generators.set('hg_label', new LvglLabelGenerator());
    this.generators.set('hg_button', new LvglButtonGenerator());
    this.generators.set('hg_input', new LvglInputGenerator());
    this.generators.set('hg_checkbox', new LvglCheckboxGenerator());
    this.generators.set('hg_radio', new LvglRadioGenerator());

    // 图形控件
    this.generators.set('hg_arc', new LvglArcGenerator());
    this.generators.set('hg_rect', new LvglRectGenerator());
    this.generators.set('hg_circle', new LvglCircleGenerator());

    // 多媒体控件
    this.generators.set('hg_video', new LvglVideoGenerator());
    this.generators.set('hg_lottie', new LvglLottieGenerator());
    this.generators.set('hg_3d', new Lvgl3DGenerator());
  }

  static getGenerator(componentType: string): LvglComponentCodeGenerator {
    return this.generators.get(componentType) || this.defaultGenerator;
  }

  /**
   * 获取所有已注册的生成器（用于批量生成事件回调和全局定义）
   */
  static getAllGenerators(): Map<string, LvglComponentCodeGenerator> {
    return this.generators;
  }
}

export { LvglComponentCodeGenerator, LvglGeneratorContext } from '../LvglComponentGenerator';
