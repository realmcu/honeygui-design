/**
 * hg_video 组件代码生成器
 */
import * as path from 'path';
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';
import { ConversionConfigService, VideoFormat } from '../../../services/ConversionConfigService';

export class VideoGenerator implements ComponentCodeGenerator {

  /**
   * 解析视频格式配置（处理继承）
   * @param assetPath 资源路径（可能包含 assets/ 前缀）
   * @param projectRoot 项目根目录
   * @returns 解析后的视频格式
   */
  private resolveVideoFormat(
    assetPath: string, 
    projectRoot: string
  ): 'mjpeg' | 'avi' | 'h264' {
    const configService = ConversionConfigService.getInstance();
    const config = configService.loadConfig(projectRoot);
    
    // 规范化路径：去掉 assets/ 前缀，统一使用 / 分隔符
    let normalizedPath = assetPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (normalizedPath.startsWith('assets/')) {
      normalizedPath = normalizedPath.substring(7); // 去掉 'assets/'
    }
    
    const itemSettings = config.items[normalizedPath];
    
    // 如果有明确配置且不是 inherit，直接使用
    if (itemSettings?.videoFormat && itemSettings.videoFormat !== 'inherit') {
      return itemSettings.videoFormat.toLowerCase() as 'mjpeg' | 'avi' | 'h264';
    }
    
    // 需要继承：查找父级配置
    const pathParts = normalizedPath.split('/');
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const parentPath = pathParts.slice(0, i).join('/');
      const parentSettings = parentPath ? config.items[parentPath] : undefined;
      
      if (parentSettings?.videoFormat && parentSettings.videoFormat !== 'inherit') {
        return parentSettings.videoFormat.toLowerCase() as 'mjpeg' | 'avi' | 'h264';
      }
    }
    
    // 默认返回 mjpeg
    return 'mjpeg';
  }

  /**
   * 获取视频输出扩展名
   */
  private getVideoOutputExtension(format: 'mjpeg' | 'avi' | 'h264'): string {
    switch (format) {
      case 'mjpeg': return '.mjpeg';
      case 'avi': return '.avi';
      case 'h264': return '.h264';
      default: return '.mjpeg';
    }
  }

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    const src = component.data?.src || '';
    const frameRate = component.data?.frameRate || 30;
    const autoPlay = component.data?.autoPlay !== false;
    const loop = component.data?.loop === true;

    // 从 conversion.json 读取视频格式（处理继承）
    const format = context.projectRoot 
      ? this.resolveVideoFormat(src, context.projectRoot)
      : 'mjpeg';

    // 根据格式替换扩展名
    const outputExt = this.getVideoOutputExtension(format);
    let videoSrc = src.replace(/\.[^.]+$/i, outputExt);

    // 去掉 assets/ 前缀，确保路径以 / 开头
    videoSrc = videoSrc.replace(/^assets\//, '');
    if (!videoSrc.startsWith('/')) {
      videoSrc = '/' + videoSrc;
    }

    let code = `${indentStr}${component.id} = gui_video_create_from_fs(${parentRef}, "${component.name}", "${videoSrc}", ${x}, ${y}, ${width}, ${height});\n`;
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
      code += `${indentStr}gui_obj_show((gui_obj_t *)${component.id}, ${component.visible ? 'true' : 'false'});\n`;
    }

    return code;
  }
}
