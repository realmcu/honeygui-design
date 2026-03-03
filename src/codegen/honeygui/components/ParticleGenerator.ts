/**
 * hg_particle 粒子效果组件代码生成器
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class ParticleGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;
    const effectType = component.data?.particleEffect || 'snow';

    return `${indentStr}${component.id} = effect_${effectType}_create(${parentRef}, "${component.name}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(_component: Component, _indent: number, _context: GeneratorContext): string {
    // 粒子组件无额外属性设置
    return '';
  }
}
