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
    const hasExplicitScale = (transform?.scaleX !== undefined && transform.scaleX !== 1.0) || 
                             (transform?.scaleY !== undefined && transform.scaleY !== 1.0);
    const hasExplicitFocus = transform?.focusX !== undefined || transform?.focusY !== undefined;
    
    // 检查是否需要自动缩放（显示尺寸与原始图片尺寸不同）
    // GIF 暂不支持自动缩放，因为无法获取原始尺寸
    const needScale = hasExplicitScale;
    
    // 如果有旋转、缩放或显式设置了 focus，需要设置变换
    if (hasRotation || needScale || hasExplicitFocus) {
      // 1. 平移（translate）
      // 如果用户显式设置了非零的 translateX/translateY，使用设置值
      // 否则，如果有旋转或设置了 focus，自动设置为补偿 focus 点的偏移
      const tx = transform?.translateX ?? 0;
      const ty = transform?.translateY ?? 0;
      const hasNonZeroTranslate = tx !== 0 || ty !== 0;
      
      if (hasNonZeroTranslate) {
        // 用户设置了非零的平移值
        code += `${indentStr}gui_gif_translate((gui_gif_t *)${component.id}, ${tx.toFixed(1)}f, ${ty.toFixed(1)}f);\n`;
      } else if (hasRotation || hasExplicitFocus) {
        // 有旋转或设置了 focus，自动平移来补偿 focus 点
        if (hasExplicitFocus) {
          // 用户设置了 focus，平移到 focus 点
          const focusX = transform.focusX ?? 0;
          const focusY = transform.focusY ?? 0;
          if (needScale) {
            const scaleX = transform?.scaleX ?? 1.0;
            const scaleY = transform?.scaleY ?? 1.0;
            code += `${indentStr}gui_gif_translate((gui_gif_t *)${component.id}, ${focusX.toFixed(1)}f * ${scaleX.toFixed(6)}f, ${focusY.toFixed(1)}f * ${scaleY.toFixed(6)}f);\n`;
          } else {
            code += `${indentStr}gui_gif_translate((gui_gif_t *)${component.id}, ${focusX.toFixed(1)}f, ${focusY.toFixed(1)}f);\n`;
          }
        } else {
          // 没有设置 focus，平移到图片中心
          if (needScale) {
            const scaleX = transform?.scaleX ?? 1.0;
            const scaleY = transform?.scaleY ?? 1.0;
            code += `${indentStr}gui_gif_translate((gui_gif_t *)${component.id}, gui_gif_get_width((gui_gif_t *)${component.id}) / 2.0f * ${scaleX.toFixed(6)}f, gui_gif_get_height((gui_gif_t *)${component.id}) / 2.0f * ${scaleY.toFixed(6)}f);\n`;
          } else {
            code += `${indentStr}gui_gif_translate((gui_gif_t *)${component.id}, gui_gif_get_width((gui_gif_t *)${component.id}) / 2.0f, gui_gif_get_height((gui_gif_t *)${component.id}) / 2.0f);\n`;
          }
        }
      }

      // 2. 变换中心点（focus）
      // 如果用户显式设置了 focusX/focusY，使用设置值
      // 否则，如果有旋转，自动设置为图片中心
      
      if (hasExplicitFocus) {
        // 使用用户设置的 focus 值（未设置的维度使用 0）
        const focusX = (transform.focusX ?? 0).toFixed(1);
        const focusY = (transform.focusY ?? 0).toFixed(1);
        code += `${indentStr}gui_gif_set_focus((gui_gif_t *)${component.id}, ${focusX}f, ${focusY}f);\n`;
      } else if (hasRotation) {
        // 有旋转但没有设置 focus，自动设置为图片中心
        code += `${indentStr}gui_gif_set_focus((gui_gif_t *)${component.id}, gui_gif_get_width((gui_gif_t *)${component.id}) / 2.0f, gui_gif_get_height((gui_gif_t *)${component.id}) / 2.0f);\n`;
      }

      // 3. 旋转
      if (hasRotation) {
        code += `${indentStr}gui_gif_rotation((gui_gif_t *)${component.id}, ${transform!.rotation!.toFixed(1)}f);\n`;
      }

      // 4. 缩放
      if (needScale) {
        const scaleX = transform?.scaleX ?? 1.0;
        const scaleY = transform?.scaleY ?? 1.0;
        if (scaleX !== 1.0 || scaleY !== 1.0) {
          code += `${indentStr}gui_gif_scale((gui_gif_t *)${component.id}, ${scaleX.toFixed(6)}f, ${scaleY.toFixed(6)}f);\n`;
        }
      }
    } else if (transform?.translateX !== undefined || transform?.translateY !== undefined) {
      // 只有平移，没有旋转和缩放（只有非零时才生成代码）
      const tx = transform.translateX ?? 0;
      const ty = transform.translateY ?? 0;
      if (tx !== 0 || ty !== 0) {
        code += `${indentStr}gui_gif_translate((gui_gif_t *)${component.id}, ${tx.toFixed(1)}f, ${ty.toFixed(1)}f);\n`;
      }
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
