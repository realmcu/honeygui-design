/**
 * hg_video 组件代码生成器
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class VideoGenerator implements ComponentCodeGenerator {

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    const src = component.data?.src || '';
    const frameRate = component.data?.frameRate || 30;
    const autoPlay = component.data?.autoPlay !== false;
    const loop = component.data?.loop === true;
    const format = component.data?.format || 'mjpeg';

    // 根据格式替换扩展名
    let videoSrc = src;
    if (format === 'mjpeg') {
      videoSrc = src.replace(/\.[^.]+$/i, '.mjpeg');
    } else if (format === 'avi') {
      videoSrc = src.replace(/\.[^.]+$/i, '.avi');
    } else if (format === 'h264') {
      videoSrc = src.replace(/\.[^.]+$/i, '.h264');
    }

    // 去掉 assets/ 前缀，确保路径以 / 开头
    videoSrc = videoSrc.replace(/^assets\//, '');
    if (!videoSrc.startsWith('/')) {
      videoSrc = '/' + videoSrc;
    }

    let code = `${indentStr}${component.id} = (gui_obj_t *)gui_video_create_from_fs(${parentRef}, "${component.name}", "${videoSrc}", ${x}, ${y}, ${width}, ${height});\n`;
    code += `${indentStr}gui_video_set_frame_rate((gui_video_t *)${component.id}, ${frameRate}.f);\n`;

    if (loop) {
      code += `${indentStr}gui_video_set_repeat_count((gui_video_t *)${component.id}, GUI_VIDEO_REPEAT_INFINITE);\n`;
    }

    if (autoPlay) {
      code += `${indentStr}gui_video_set_state((gui_video_t *)${component.id}, GUI_VIDEO_STATE_PLAYING);\n`;
    }

    return code;
  }

  generatePropertySetters(component: Component, indent: number, context: GeneratorContext): string {
    let code = '';
    const indentStr = '    '.repeat(indent);

    if (component.visible !== undefined) {
      code += `${indentStr}gui_obj_show(${component.id}, ${component.visible ? 'true' : 'false'});\n`;
    }

    return code;
  }
}
