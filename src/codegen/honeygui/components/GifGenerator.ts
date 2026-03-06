/**
 * hg_gif 组件代码生成器
 * GIF 动画控件，使用 gui_gif_create_from_fs 创建
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class GifGenerator implements ComponentCodeGenerator {

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    const src = component.data?.src || '';
    // GIF 文件会被转换成 .bin 格式
    let binPath = src.replace(/\.gif$/i, '.bin');
    // 去掉 assets/ 前缀
    binPath = binPath.replace(/^assets\//, '');
    // 确保路径以 / 开头
    if (!binPath.startsWith('/')) {
      binPath = '/' + binPath;
    }

    return `${indentStr}${component.id} = gui_gif_create_from_fs(${parentRef}, "${component.name}", "${binPath}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, context: GeneratorContext): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

    // 1. 高质量渲染设置
    if (component.data?.highQuality === true) {
      code += `${indentStr}gui_gif_set_quality((gui_gif_t *)${component.id}, true);\n`;
    }

    // 2. 变换属性
    const transform = component.style?.transform;
    
    // 检查是否有显式的变换
    const hasRotation = transform?.rotation !== undefined && transform.rotation !== 0;
    const hasScale = (transform?.scaleX !== undefined && transform.scaleX !== 1.0) || 
                     (transform?.scaleY !== undefined && transform.scaleY !== 1.0);
    const hasTranslate = (transform?.translateX !== undefined && transform.translateX !== 0) || 
                         (transform?.translateY !== undefined && transform.translateY !== 0);
    const hasFocusX = transform?.focusX !== undefined;
    const hasFocusY = transform?.focusY !== undefined;
    const hasFocusSet = hasFocusX || hasFocusY;
    
    // 只有当有旋转时才需要 focus 相关处理（单独设置 focus 没有意义）
    if (hasRotation) {
      // 确定 focus 点
      const { width, height } = component.position;
      const focusX = hasFocusX ? transform.focusX! : width / 2;
      const focusY = hasFocusY ? transform.focusY! : height / 2;
      
      // 1. 先平移（补偿 focus 导致的偏移）
      if (hasScale) {
        const scaleX = transform?.scaleX ?? 1.0;
        const scaleY = transform?.scaleY ?? 1.0;
        code += `${indentStr}gui_gif_translate((gui_gif_t *)${component.id}, ${focusX.toFixed(1)}f * ${scaleX.toFixed(6)}f, ${focusY.toFixed(1)}f * ${scaleY.toFixed(6)}f);\n`;
      } else {
        code += `${indentStr}gui_gif_translate((gui_gif_t *)${component.id}, ${focusX.toFixed(1)}f, ${focusY.toFixed(1)}f);\n`;
      }

      // 2. 设置变换中心点（focus）
      if (hasFocusSet) {
        // 用户设置了变换中心（至少一个轴）
        const focusXValue = hasFocusX 
          ? `${transform.focusX!.toFixed(1)}f` 
          : 'gui_gif_get_width((gui_gif_t *)' + component.id + ') / 2.0f';
        const focusYValue = hasFocusY 
          ? `${transform.focusY!.toFixed(1)}f` 
          : 'gui_gif_get_height((gui_gif_t *)' + component.id + ') / 2.0f';
        code += `${indentStr}gui_gif_set_focus((gui_gif_t *)${component.id}, ${focusXValue}, ${focusYValue});\n`;
      } else {
        code += `${indentStr}gui_gif_set_focus((gui_gif_t *)${component.id}, gui_gif_get_width((gui_gif_t *)${component.id}) / 2.0f, gui_gif_get_height((gui_gif_t *)${component.id}) / 2.0f);\n`;
      }

      // 3. 旋转（只有非 0 时才生成）
      if (hasRotation) {
        code += `${indentStr}gui_gif_rotation((gui_gif_t *)${component.id}, ${transform.rotation!.toFixed(1)}f);\n`;
      }

      // 4. 缩放
      if (hasScale) {
        const scaleX = transform?.scaleX ?? 1.0;
        const scaleY = transform?.scaleY ?? 1.0;
        code += `${indentStr}gui_gif_scale((gui_gif_t *)${component.id}, ${scaleX.toFixed(6)}f, ${scaleY.toFixed(6)}f);\n`;
      }
      
      // 5. 用户自定义的额外平移（只有非 0 时才生成）
      if (hasTranslate) {
        const tx = transform?.translateX ?? 0;
        const ty = transform?.translateY ?? 0;
        if (tx !== 0 || ty !== 0) {
          code += `${indentStr}gui_gif_translate((gui_gif_t *)${component.id}, ${tx.toFixed(1)}f, ${ty.toFixed(1)}f);\n`;
        }
      }
    } else if (hasScale) {
      // 只有缩放（可能还有平移），不需要 focus
      const scaleX = transform?.scaleX ?? 1.0;
      const scaleY = transform?.scaleY ?? 1.0;
      code += `${indentStr}gui_gif_scale((gui_gif_t *)${component.id}, ${scaleX.toFixed(6)}f, ${scaleY.toFixed(6)}f);\n`;
      
      // 如果还有平移，也要生成
      if (hasTranslate) {
        const tx = transform?.translateX ?? 0;
        const ty = transform?.translateY ?? 0;
        code += `${indentStr}gui_gif_translate((gui_gif_t *)${component.id}, ${tx.toFixed(1)}f, ${ty.toFixed(1)}f);\n`;
      }
    } else if (hasTranslate) {
      // 只有平移，没有旋转和缩放
      const tx = transform?.translateX ?? 0;
      const ty = transform?.translateY ?? 0;
      code += `${indentStr}gui_gif_translate((gui_gif_t *)${component.id}, ${tx.toFixed(1)}f, ${ty.toFixed(1)}f);\n`;
    }

    // 3. 透明度
    if (transform?.opacity !== undefined && transform.opacity !== 255) {
      code += `${indentStr}gui_gif_set_opacity((gui_gif_t *)${component.id}, ${Math.round(transform.opacity)});\n`;
    }

    // 4. 混合模式
    const blendMode = component.data?.blendMode;
    if (blendMode && blendMode !== 'IMG_FILTER_BLACK') {
      code += `${indentStr}gui_gif_set_mode((gui_gif_t *)${component.id}, ${blendMode});\n`;
    }

    // 5. 可见性
    if (component.visible !== undefined) {
      code += `${indentStr}gui_obj_show((gui_obj_t *)${component.id}, ${component.visible ? 'true' : 'false'});\n`;
    }

    return code;
  }
}
