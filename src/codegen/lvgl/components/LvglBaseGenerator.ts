/**
 * LVGL 组件代码生成器抽象基类
 * 封装位置计算、尺寸解析等公共逻辑，消除各组件生成器中的重复代码
 */
import { Component } from '../../../hml/types';
import { LvglComponentCodeGenerator, LvglGeneratorContext } from '../LvglComponentGenerator';

export abstract class LvglBaseGenerator implements LvglComponentCodeGenerator {
  /**
   * 从 Component 解析最终位置（含 transform.translateX/translateY 偏移）
   */
  protected resolvePosition(component: Component): { x: number; y: number } {
    const tx = Number(component.style?.transform?.translateX || 0);
    const ty = Number(component.style?.transform?.translateY || 0);
    return {
      x: Math.round(component.position.x + tx),
      y: Math.round(component.position.y + ty),
    };
  }

  /**
   * 从 Component 解析尺寸（最小值 1）
   */
  protected resolveSize(component: Component): { width: number; height: number } {
    return {
      width: Math.max(1, Math.round(component.position.width)),
      height: Math.max(1, Math.round(component.position.height)),
    };
  }

  /**
   * 生成 lv_obj_set_pos + lv_obj_set_size 两行代码
   */
  protected generatePositionAndSize(component: Component): string {
    const { x, y } = this.resolvePosition(component);
    const { width, height } = this.resolveSize(component);
    let code = `    lv_obj_set_pos(${component.id}, ${x}, ${y});\n`;
    code += `    lv_obj_set_size(${component.id}, ${width}, ${height});\n`;
    return code;
  }

  /** 子类必须实现：生成组件创建 + 属性设置代码 */
  abstract generateCreation(
    component: Component, parentRef: string, ctx: LvglGeneratorContext
  ): string;

  /** 可选：生成事件回调函数代码 */
  generateEventCallbacks?(components: Component[]): string;

  /** 可选：生成全局样式/变量定义 */
  generateGlobalDefinitions?(components: Component[]): string;
}
