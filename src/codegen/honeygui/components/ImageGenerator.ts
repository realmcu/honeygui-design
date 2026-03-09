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
    let binSrc = src.replace(/\.(png|jpe?g|bmp|tiff?|webp)$/i, '.bin');
    // 去掉 assets/ 前缀
    binSrc = binSrc.replace(/^assets\//, '');
    // 确保路径以 / 开头
    if (!binSrc.startsWith('/')) {
      binSrc = '/' + binSrc;
    }

    return `${indentStr}${component.id} = gui_img_create_from_fs(${parentRef}, "${component.name}", "${binSrc}", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, context: GeneratorContext): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

    // 1. 渲染模式设置
    const blendMode = component.data?.blendMode;
    if (blendMode && blendMode !== 'IMG_FILTER_BLACK') {
      code += `${indentStr}gui_img_set_mode((gui_img_t *)${component.id}, ${blendMode});\n`;
    }

    // 2. A8 图片颜色设置
    if (blendMode === 'IMG_2D_SW_FIX_A8_FG' || blendMode === 'IMG_2D_SW_FIX_A8_BGFG') {
      const fgColor = component.data?.fgColor || '0xFFFFFFFF';
      code += `${indentStr}gui_img_a8_recolor((gui_img_t *)${component.id}, ${fgColor});\n`;
      
      if (blendMode === 'IMG_2D_SW_FIX_A8_BGFG') {
        const bgColor = component.data?.bgColor || '0xFFFFFFFF';
        code += `${indentStr}gui_img_a8_fix_bg((gui_img_t *)${component.id}, ${bgColor});\n`;
      }
    }

    // 3. 高质量渲染设置
    if (component.data?.highQuality === true) {
      code += `${indentStr}gui_img_set_quality((gui_img_t *)${component.id}, true);\n`;
    }

    // 4. 裁剪设置
    if (component.data?.needClip === true) {
      code += `${indentStr}((gui_img_t *)${component.id})->need_clip = true;\n`;
    }

    // 获取变换配置
    const transform = component.style?.transform;
    
    // 检查是否有显式的变换
    const hasRotation = transform?.rotation !== undefined && transform.rotation !== 0;
    const hasExplicitScale = (transform?.scaleX !== undefined && transform.scaleX !== 1.0) || 
                             (transform?.scaleY !== undefined && transform.scaleY !== 1.0);
    const hasExplicitFocus = transform?.focusX !== undefined || transform?.focusY !== undefined;
    
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
        code += `${indentStr}gui_img_translate((gui_img_t *)${component.id}, ${tx.toFixed(1)}f, ${ty.toFixed(1)}f);\n`;
      } else if (hasRotation || hasExplicitFocus) {
        // 有旋转或设置了 focus，自动平移来补偿 focus 点
        if (hasExplicitFocus) {
          // 用户设置了 focus，平移到 focus 点
          const focusX = transform.focusX ?? 0;
          const focusY = transform.focusY ?? 0;
          if (needScale) {
            const scaleX = transform?.scaleX ?? autoScaleX ?? 1.0;
            const scaleY = transform?.scaleY ?? autoScaleY ?? 1.0;
            code += `${indentStr}gui_img_translate((gui_img_t *)${component.id}, ${focusX.toFixed(1)}f * ${scaleX.toFixed(6)}f, ${focusY.toFixed(1)}f * ${scaleY.toFixed(6)}f);\n`;
          } else {
            code += `${indentStr}gui_img_translate((gui_img_t *)${component.id}, ${focusX.toFixed(1)}f, ${focusY.toFixed(1)}f);\n`;
          }
        } else {
          // 没有设置 focus，平移到图片中心
          if (needScale) {
            const scaleX = transform?.scaleX ?? autoScaleX ?? 1.0;
            const scaleY = transform?.scaleY ?? autoScaleY ?? 1.0;
            code += `${indentStr}gui_img_translate((gui_img_t *)${component.id}, gui_img_get_width((gui_img_t *)${component.id}) / 2.0f * ${scaleX.toFixed(6)}f, gui_img_get_height((gui_img_t *)${component.id}) / 2.0f * ${scaleY.toFixed(6)}f);\n`;
          } else {
            code += `${indentStr}gui_img_translate((gui_img_t *)${component.id}, gui_img_get_width((gui_img_t *)${component.id}) / 2.0f, gui_img_get_height((gui_img_t *)${component.id}) / 2.0f);\n`;
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
        code += `${indentStr}gui_img_set_focus((gui_img_t *)${component.id}, ${focusX}f, ${focusY}f);\n`;
      } else if (hasRotation) {
        // 有旋转但没有设置 focus，自动设置为图片中心
        code += `${indentStr}gui_img_set_focus((gui_img_t *)${component.id}, gui_img_get_width((gui_img_t *)${component.id}) / 2.0f, gui_img_get_height((gui_img_t *)${component.id}) / 2.0f);\n`;
      }

      // 3. 旋转
      if (hasRotation) {
        code += `${indentStr}gui_img_rotation((gui_img_t *)${component.id}, ${transform!.rotation!.toFixed(1)}f);\n`;
      }

      // 4. 缩放
      if (needScale) {
        const scaleX = transform?.scaleX ?? autoScaleX ?? 1.0;
        const scaleY = transform?.scaleY ?? autoScaleY ?? 1.0;
        if (scaleX !== 1.0 || scaleY !== 1.0) {
          code += `${indentStr}gui_img_scale((gui_img_t *)${component.id}, ${scaleX.toFixed(6)}f, ${scaleY.toFixed(6)}f);\n`;
        }
      }
    } else if (transform?.translateX !== undefined || transform?.translateY !== undefined) {
      // 只有平移，没有旋转和缩放（只有非零时才生成代码）
      const tx = transform.translateX ?? 0;
      const ty = transform.translateY ?? 0;
      if (tx !== 0 || ty !== 0) {
        code += `${indentStr}gui_img_translate((gui_img_t *)${component.id}, ${tx.toFixed(1)}f, ${ty.toFixed(1)}f);\n`;
      }
    }

    // 5. 透明度
    if (transform?.opacity !== undefined && transform.opacity !== 255) {
      code += `${indentStr}gui_img_set_opacity((gui_img_t *)${component.id}, ${Math.round(transform.opacity)});\n`;
    }

    // 可见性
    if (component.visible !== undefined) {
      code += `${indentStr}gui_obj_show((gui_obj_t *)${component.id}, ${component.visible ? 'true' : 'false'});\n`;
    }

    return code;
  }

  /**
   * 生成按键效果的事件绑定
   */
  generateEventBinding(component: Component, indent: number): string {
    const buttonMode = component.data?.buttonMode;
    if (!buttonMode || buttonMode === 'none') {
      return '';
    }

    const indentStr = '    '.repeat(indent);
    
    if (buttonMode === 'dual-state') {
      return `${indentStr}gui_obj_add_event_cb((gui_obj_t *)${component.id}, ${component.id}_button_cb, GUI_EVENT_TOUCH_CLICKED, NULL);\n`;
    } else if (buttonMode === 'blink') {
      let code = '';
      code += `${indentStr}gui_obj_add_event_cb((gui_obj_t *)${component.id}, ${component.id}_button_press_cb, GUI_EVENT_TOUCH_PRESSED, NULL);\n`;
      code += `${indentStr}gui_obj_add_event_cb((gui_obj_t *)${component.id}, ${component.id}_button_release_cb, GUI_EVENT_TOUCH_RELEASED, NULL);\n`;
      return code;
    }

    return '';
  }

  /**
   * 生成按键效果的回调函数
   */
  generateButtonCallback(component: Component): string {
    const buttonMode = component.data?.buttonMode;
    if (!buttonMode || buttonMode === 'none') {
      return '';
    }

    if (buttonMode === 'dual-state') {
      return this.generateDualStateCallback(component);
    } else if (buttonMode === 'blink') {
      return this.generateBlinkCallback(component);
    }

    return '';
  }

  private generateDualStateCallback(component: Component): string {
    const onImage = component.data?.buttonStateOnImage || '';
    const offImage = component.data?.buttonStateOffImage || '';
    const initialState = component.data?.buttonInitialState === 'on';

    const binOn = this.convertToBinPath(onImage);
    const binOff = this.convertToBinPath(offImage);

    return `
// ${component.id} 双态按键回调
static bool ${component.id}_state = ${initialState ? 'true' : 'false'};

void ${component.id}_button_cb(void *obj, gui_event_t *e)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(e);
    
    ${component.id}_state = !${component.id}_state;
    
    if (${component.id}_state) {
        gui_img_set_src((gui_img_t *)${component.id}, "${binOn}", IMG_SRC_FILESYS);
    } else {
        gui_img_set_src((gui_img_t *)${component.id}, "${binOff}", IMG_SRC_FILESYS);
    }
}

bool ${component.id}_get_state(void) { return ${component.id}_state; }
void ${component.id}_set_state(bool state) {
    if (${component.id}_state != state) {
        ${component.id}_state = state;
        gui_img_set_src((gui_img_t *)${component.id}, state ? "${binOn}" : "${binOff}", IMG_SRC_FILESYS);
    }
}
`;
  }

  private generateBlinkCallback(component: Component): string {
    const minOpacity = component.data?.buttonBlinkOpacityMin || 50;
    const maxOpacity = component.data?.buttonBlinkOpacityMax || 255;

    return `
// ${component.id} 闪烁按键回调

void ${component.id}_button_press_cb(void *obj, gui_event_t *e)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(e);
    
    gui_img_set_opacity((gui_img_t *)${component.id}, ${minOpacity});
}

void ${component.id}_button_release_cb(void *obj, gui_event_t *e)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(e);
    
    gui_img_set_opacity((gui_img_t *)${component.id}, ${maxOpacity});
}
`;
  }

  /**
   * 转换图片路径为 .bin 格式
   */
  private convertToBinPath(src: string): string {
    if (!src) return '';
    
    // 将图片扩展名替换为 .bin
    let binSrc = src.replace(/\.(png|jpe?g|bmp|tiff?|webp)$/i, '.bin');
    // 去掉 assets/ 前缀
    binSrc = binSrc.replace(/^assets\//, '');
    // 确保路径以 / 开头
    if (!binSrc.startsWith('/')) {
      binSrc = '/' + binSrc;
    }
    
    return binSrc;
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
