/**
 * 组件代码生成器工厂
 */
import { ComponentCodeGenerator } from './ComponentGenerator';
import { ImageGenerator } from './ImageGenerator';
import { VideoGenerator } from './VideoGenerator';
import { Model3DGenerator } from './Model3DGenerator';
import { LabelGenerator } from './LabelGenerator';
import { DefaultGenerator } from './DefaultGenerator';

export class ComponentGeneratorFactory {
  private static generators: Map<string, ComponentCodeGenerator> = new Map();
  private static defaultGenerator = new DefaultGenerator();

  static {
    this.generators.set('hg_image', new ImageGenerator());
    this.generators.set('hg_video', new VideoGenerator());
    this.generators.set('hg_3d', new Model3DGenerator());
    this.generators.set('hg_label', new LabelGenerator());
  }

  static getGenerator(componentType: string): ComponentCodeGenerator {
    return this.generators.get(componentType) || this.defaultGenerator;
  }
}

export { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';
