/**
 * hg_button 组件代码生成器
 * 使用 gui_img 控件实现双态图片按钮
 * 通过 gui_img_set_src 切换图片实现状态转换
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';
import * as path from 'path';
import * as fs from 'fs';

export class ButtonGenerator implements ComponentCodeGenerator {

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    // 检查是否是双态模式（兼容 boolean 和字符串 "true"）
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    
    if (toggleMode) {
      // 双态模式：使用 gui_img 创建图片按钮
      const imageOn = component.data?.imageOn || '';
      const imageOff = component.data?.imageOff || '';
      const initialState = component.data?.initialState === 'on';
      const initialImage = initialState ? imageOn : imageOff;
      const binSrc = this.convertToBinPath(initialImage);
      
      return `${indentStr}${component.id} = gui_img_create_from_fs(${parentRef}, "${component.name}", "${binSrc}", ${x}, ${y}, ${width}, ${height});\n`;
    }

    // 普通模式：也使用 gui_img（SDK 没有 gui_button）
    // 如果有文本，可以考虑用 gui_text 叠加
    return `${indentStr}// Normal button not supported, please use toggle mode\n${indentStr}// ${component.id} = gui_img_create_from_fs(${parentRef}, "${component.name}", "", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // 检查是否是双态模式
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    if (!toggleMode) {
      return code;
    }

    // 自动缩放：如果按钮尺寸与图片原始尺寸不同，添加缩放代码
    const { width, height } = component.position;
    const imageSize = this.getImageSize(component, context);
    
    if (imageSize && (width !== imageSize.width || height !== imageSize.height)) {
      const scaleX = width / imageSize.width;
      const scaleY = height / imageSize.height;
      code += `${indentStr}gui_img_scale((gui_img_t *)${component.id}, ${scaleX.toFixed(6)}f, ${scaleY.toFixed(6)}f);\n`;
    }

    return code;
  }

  /**
   * 获取图片的原始尺寸
   * 从资源配置中读取图片尺寸信息
   */
  private getImageSize(component: Component, context: GeneratorContext): { width: number; height: number } | null {
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    if (!toggleMode) {
      return null;
    }

    // 获取初始状态对应的图片路径
    const initialState = component.data?.initialState === 'on';
    const imageOn = component.data?.imageOn || '';
    const imageOff = component.data?.imageOff || '';
    const imagePath = initialState ? imageOn : imageOff;

    if (!imagePath) {
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
    const fullImagePath = path.join(projectRoot, imagePath);
    
    // 检查文件是否存在
    if (!fs.existsSync(fullImagePath)) {
      return null;
    }

    try {
      // 读取图片文件的头部信息来获取尺寸
      const buffer = fs.readFileSync(fullImagePath);
      return this.parseImageSize(buffer, imagePath);
    } catch (err) {
      console.error(`Failed to read image size for ${imagePath}:`, err);
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
          // SOF0, SOF1, SOF2
          if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            return { width, height };
          }
          // 跳过这个 segment
          const segmentLength = buffer.readUInt16BE(offset + 2);
          offset += 2 + segmentLength;
        } else {
          offset++;
        }
      }
    } else if (ext === '.bmp') {
      // BMP: 读取 DIB header
      if (buffer.length >= 26) {
        const width = buffer.readInt32LE(18);
        const height = Math.abs(buffer.readInt32LE(22));
        return { width, height };
      }
    }

    return null;
  }

  /**
   * 生成双态按钮的回调函数
   * 使用 gui_img_set_src 切换图片，并将 onClick 事件的 actions 合并在同一个回调中执行
   */
  generateToggleCallback(component: Component): string {
    // 检查是否是双态模式（兼容 boolean 和字符串 "true"）
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    if (!toggleMode) {
      return '';
    }

    const imageOn = component.data?.imageOn || '';
    const imageOff = component.data?.imageOff || '';
    const binOn = this.convertToBinPath(imageOn);
    const binOff = this.convertToBinPath(imageOff);

    // 收集 onClick 事件的 actions，合并到 toggle_cb 中
    const onClickActions = (component.eventConfigs || [])
      .filter(e => e.type === 'onClick')
      .flatMap(e => e.actions || []);

    const extraCode = onClickActions.length > 0
      ? this.generateOnClickActionsCode(onClickActions, component)
      : '';

    return `
// ${component.id} 双态按钮回调
static bool ${component.id}_state = ${component.data?.initialState === 'on' ? 'true' : 'false'};

void ${component.id}_toggle_cb(void *obj, gui_event_t *e)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(e);
    
    // 切换状态
    ${component.id}_state = !${component.id}_state;
    
    // 根据状态切换图片并调用对应回调
    if (${component.id}_state) {
        gui_img_set_src((gui_img_t *)${component.id}, "${binOn}", IMG_SRC_FILESYS);
        ${component.id}_on_callback();
    } else {
        gui_img_set_src((gui_img_t *)${component.id}, "${binOff}", IMG_SRC_FILESYS);
        ${component.id}_off_callback();
    }
${extraCode}}

// 获取当前状态
bool ${component.id}_get_state(void)
{
    return ${component.id}_state;
}

// 设置状态（外部调用）
void ${component.id}_set_state(bool state)
{
    if (${component.id}_state != state) {
        ${component.id}_state = state;
        
        if (state) {
            gui_img_set_src((gui_img_t *)${component.id}, "${binOn}", IMG_SRC_FILESYS);
            ${component.id}_on_callback();
        } else {
            gui_img_set_src((gui_img_t *)${component.id}, "${binOff}", IMG_SRC_FILESYS);
            ${component.id}_off_callback();
        }
    }
}
`;
  }

  /**
   * 将 onClick actions 生成为内联代码（合并进 toggle_cb）
   */
  private generateOnClickActionsCode(actions: any[], component: Component): string {
    let code = `\n    // onClick 事件动作\n`;
    actions.forEach(action => {
      if (action.type === 'callFunction' && action.functionName) {
        code += `    ${action.functionName}(obj, e);\n`;
      } else if (action.type === 'switchView' && action.target) {
        const switchOutStyle = action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION';
        const switchInStyle = action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION';
        code += `    gui_view_switch_direct(gui_view_get_current(), "${action.target}", ${switchOutStyle}, ${switchInStyle});\n`;
      } else if (action.type === 'sendMessage' && action.message) {
        code += `    gui_msg_publish("${action.message}", NULL, 0);\n`;
      }
    });
    return code;
  }

  /**
   * 生成双态按钮的状态回调函数声明（用于头文件）
   */
  generateCallbackDeclarations(component: Component): string {
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    if (!toggleMode) {
      return '';
    }

    return `// ${component.id} 状态回调函数
void ${component.id}_on_callback(void);
void ${component.id}_off_callback(void);
`;
  }

  /**
   * 生成双态按钮的状态回调函数实现（用于 callbacks.c）
   */
  generateCallbackImplementations(component: Component): string {
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    if (!toggleMode) {
      return '';
    }

    return `
/* USER CODE BEGIN ${component.id}_on_callback */
/**
 * ${component.id} 开启状态回调
 * 当按钮切换到开启状态时调用
 */
void ${component.id}_on_callback(void)
{
    // TODO: 实现开启状态的业务逻辑
    // 例如：music_player_play();
}
/* USER CODE END ${component.id}_on_callback */

/* USER CODE BEGIN ${component.id}_off_callback */
/**
 * ${component.id} 关闭状态回调
 * 当按钮切换到关闭状态时调用
 */
void ${component.id}_off_callback(void)
{
    // TODO: 实现关闭状态的业务逻辑
    // 例如：music_player_pause();
}
/* USER CODE END ${component.id}_off_callback */
`;
  }

  /**
   * 生成双态按钮的事件绑定
   */
  generateEventBinding(component: Component, indent: number): string {
    // 检查是否是双态模式（兼容 boolean 和字符串 "true"）
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    if (!toggleMode) {
      return '';
    }
    
    const indentStr = '    '.repeat(indent);
    return `${indentStr}gui_obj_add_event_cb((gui_obj_t *)${component.id}, ${component.id}_toggle_cb, GUI_EVENT_TOUCH_CLICKED, NULL);\n`;
  }

  /**
   * 转换图片路径为 .bin 格式
   */
  private convertToBinPath(src: string): string {
    if (!src) return '';
    
    // 将图片扩展名替换为 .bin
    let binSrc = src.replace(/\.(png|jpe?g|bmp|gif|tiff?|webp)$/i, '.bin');
    // 去掉 assets/ 前缀
    binSrc = binSrc.replace(/^assets\//, '');
    // 确保路径以 / 开头
    if (!binSrc.startsWith('/')) {
      binSrc = '/' + binSrc;
    }
    
    return binSrc;
  }
}
