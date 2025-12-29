/**
 * hg_image 组件代码生成器
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';
import * as path from 'path';
import * as fs from 'fs';

export class ImageGenerator implements ComponentCodeGenerator {

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    const src = component.data?.src || '';
    // 将图片扩展名替换为 .bin
    let binSrc = src.replace(/\.(png|jpe?g|bmp|gif|tiff?|webp)$/i, '.bin');
    // 去掉 assets/ 前缀
    binSrc = binSrc.replace(/^assets\//, '');
    // 确保路径以 / 开头
    if (!binSrc.startsWith('/')) {
      binSrc = '/' + binSrc;
    }

    return `${indentStr}${component.id} = (gui_obj_t *)gui_img_create_from_fs(${parentRef}, "${component.name}", "${binSrc}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, context: GeneratorContext): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

    // 获取变换配置
    const transform = component.style?.transform;
    
    // 检查是否有显式的变换
    const hasRotation = transform?.rotation !== undefined && transform.rotation !== 0;
    const hasExplicitScale = (transform?.scaleX !== undefined && transform.scaleX !== 1.0) || 
                             (transform?.scaleY !== undefined && transform.scaleY !== 1.0);
    const hasFocusSet = transform?.focusX !== undefined && transform?.focusY !== undefined;
    
    // 检查是否需要自动缩放（显示尺寸与原始图片尺寸不同）
    let autoScaleX: number | undefined;
    let autoScaleY: number | undefined;
    const { width, height } = component.position;
    const imageSize = this.getImageSize(component, context);
    if (imageSize && (width !== imageSize.width || height !== imageSize.height)) {
      autoScaleX = width / imageSize.width;
      autoScaleY = height / imageSize.height;
    }
    
    const needScale = hasExplicitScale || (autoScaleX !== undefined && autoScaleY !== undefined);
    
    // 只有当有旋转时才需要设置 focus（缩放不需要 focus）
    if (hasRotation || hasFocusSet) {
      // 1. 先平移（用于围绕中心旋转的补偿）
      // 当有旋转时，必须添加平移到图片中心，这是实现中心旋转的技术要求
      if (hasRotation) {
        // 如果同时有缩放，需要调整平移值来补偿缩放的影响
        // 因为底层矩阵变换顺序是：translate(t) -> rotate -> scale -> translate(-f)
        // scale 会影响 translate(-f) 的效果，所以需要乘以缩放系数来补偿
        let translateCode = '';
        if (needScale) {
          const scaleX = transform?.scaleX ?? autoScaleX ?? 1.0;
          const scaleY = transform?.scaleY ?? autoScaleY ?? 1.0;
          // 补偿缩放影响：translate_actual = translate_desired * scale
          translateCode = `${indentStr}gui_img_translate((gui_img_t *)${component.id}, gui_img_get_width((gui_img_t *)${component.id}) / 2.0f * ${scaleX.toFixed(6)}f, gui_img_get_height((gui_img_t *)${component.id}) / 2.0f * ${scaleY.toFixed(6)}f);\n`;
        } else {
          // 没有缩放，直接平移到图片中心
          translateCode = `${indentStr}gui_img_translate((gui_img_t *)${component.id}, gui_img_get_width((gui_img_t *)${component.id}) / 2.0f, gui_img_get_height((gui_img_t *)${component.id}) / 2.0f);\n`;
        }
        code += translateCode;
      }

      // 2. 设置变换中心点（focus）
      if (hasFocusSet) {
        // 用户显式设置了变换中心
        code += `${indentStr}gui_img_set_focus((gui_img_t *)${component.id}, ${transform.focusX}f, ${transform.focusY}f);\n`;
      } else if (hasRotation) {
        // 有旋转但没有设置 focus，自动设置为图片中心
        code += `${indentStr}gui_img_set_focus((gui_img_t *)${component.id}, gui_img_get_width((gui_img_t *)${component.id}) / 2.0f, gui_img_get_height((gui_img_t *)${component.id}) / 2.0f);\n`;
      }

      // 3. 旋转
      if (hasRotation && transform?.rotation !== undefined) {
        code += `${indentStr}gui_img_rotation((gui_img_t *)${component.id}, ${transform.rotation.toFixed(1)}f);\n`;
      }

      // 4. 缩放
      if (needScale) {
        // 优先使用显式设置的缩放，否则使用自动计算的缩放
        const scaleX = transform?.scaleX ?? autoScaleX ?? 1.0;
        const scaleY = transform?.scaleY ?? autoScaleY ?? 1.0;
        if (scaleX !== 1.0 || scaleY !== 1.0) {
          code += `${indentStr}gui_img_scale((gui_img_t *)${component.id}, ${scaleX.toFixed(6)}f, ${scaleY.toFixed(6)}f);\n`;
        }
      }
      
      // 5. 用户自定义的额外平移（如果有）
      if (transform?.translateX !== undefined || transform?.translateY !== undefined) {
        const tx = transform.translateX ?? 0;
        const ty = transform.translateY ?? 0;
        if (tx !== 0 || ty !== 0) {
          code += `${indentStr}// 用户自定义平移\n`;
          code += `${indentStr}gui_img_translate((gui_img_t *)${component.id}, ${tx.toFixed(1)}f, ${ty.toFixed(1)}f);\n`;
        }
      }
    } else if (needScale) {
      // 只有缩放，不需要 focus
      const scaleX = transform?.scaleX ?? autoScaleX ?? 1.0;
      const scaleY = transform?.scaleY ?? autoScaleY ?? 1.0;
      if (scaleX !== 1.0 || scaleY !== 1.0) {
        code += `${indentStr}gui_img_scale((gui_img_t *)${component.id}, ${scaleX.toFixed(6)}f, ${scaleY.toFixed(6)}f);\n`;
      }
    } else if (transform?.translateX !== undefined || transform?.translateY !== undefined) {
      // 只有平移，没有旋转和缩放
      const tx = transform.translateX ?? 0;
      const ty = transform.translateY ?? 0;
      if (tx !== 0 || ty !== 0) {
        code += `${indentStr}gui_img_translate((gui_img_t *)${component.id}, ${tx.toFixed(1)}f, ${ty.toFixed(1)}f);\n`;
      }
    }

    // 5. 倾斜
    if (transform?.skewX !== undefined && transform.skewX !== 0) {
      code += `${indentStr}gui_img_skew_x((gui_img_t *)${component.id}, ${transform.skewX.toFixed(1)}f);\n`;
    }
    if (transform?.skewY !== undefined && transform.skewY !== 0) {
      code += `${indentStr}gui_img_skew_y((gui_img_t *)${component.id}, ${transform.skewY.toFixed(1)}f);\n`;
    }

    // 6. 透明度
    if (transform?.opacity !== undefined && transform.opacity !== 255) {
      code += `${indentStr}gui_img_set_opacity((gui_img_t *)${component.id}, ${Math.round(transform.opacity)});\n`;
    }

    // 可见性
    if (component.visible !== undefined) {
      code += `${indentStr}gui_obj_show(${component.id}, ${component.visible ? 'true' : 'false'});\n`;
    }

    return code;
  }

  /**
   * 获取图片的原始尺寸
   */
  private getImageSize(component: Component, context: GeneratorContext): { width: number; height: number } | null {
    const src = component.data?.src;
    if (!src) {
      return null;
    }

    // 从 context 中获取项目根目录
    let projectRoot = context.projectRoot;
    if (!projectRoot) {
      return null;
    }

    // 如果 projectRoot 是 .preview 目录，需要向上一级找到真正的项目根目录
    if (projectRoot.endsWith('.preview')) {
      projectRoot = path.dirname(projectRoot);
    }

    // 构建图片的完整路径
    const imagePath = path.join(projectRoot, src);
    
    // 检查文件是否存在
    if (!fs.existsSync(imagePath)) {
      return null;
    }

    try {
      // 读取图片文件的头部信息来获取尺寸
      const buffer = fs.readFileSync(imagePath);
      return this.parseImageSize(buffer, src);
    } catch (err) {
      console.error(`Failed to read image size for ${src}:`, err);
      return null;
    }
  }

  /**
   * 解析图片尺寸（支持 PNG, JPEG, BMP）
   */
  private parseImageSize(buffer: Buffer, filename: string): { width: number; height: number } | null {
    const ext = path.extname(filename).toLowerCase();

    if (ext === '.png') {
      // PNG: 读取 IHDR chunk
      if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
      }
    } else if (ext === '.jpg' || ext === '.jpeg') {
      // JPEG: 查找 SOF0 marker
      let offset = 2;
      while (offset < buffer.length - 9) {
        if (buffer[offset] === 0xFF) {
          const marker = buffer[offset + 1];
          if (marker >= 0xC0 && marker <= 0xC3) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            return { width, height };
          }
          offset += 2 + buffer.readUInt16BE(offset + 2);
        } else {
          offset++;
        }
      }
    } else if (ext === '.bmp') {
      // BMP: 读取 DIB header
      if (buffer.length >= 26 && buffer.toString('ascii', 0, 2) === 'BM') {
        const width = buffer.readInt32LE(18);
        const height = Math.abs(buffer.readInt32LE(22));
        return { width, height };
      }
    }

    return null;
  }
}
