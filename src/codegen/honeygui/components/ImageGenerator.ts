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

    // 图片缩放：如果设置的尺寸与原始图片尺寸不同，需要缩放
    const { width, height } = component.position;
    const imageSize = this.getImageSize(component, context);
    
    if (imageSize && (width !== imageSize.width || height !== imageSize.height)) {
      const scaleX = width / imageSize.width;
      const scaleY = height / imageSize.height;
      code += `${indentStr}gui_img_scale((gui_img_t *)${component.id}, ${scaleX.toFixed(6)}f, ${scaleY.toFixed(6)}f);\n`;
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
