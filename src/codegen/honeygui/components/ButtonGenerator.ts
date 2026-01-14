/**
 * hg_button 组件代码生成器
 * 使用 gui_img 控件实现双态图片按钮
 * 通过 gui_img_set_image_data 切换图片实现状态转换
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

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
      
      return `${indentStr}${component.id} = (gui_obj_t *)gui_img_create_from_fs(${parentRef}, "${component.name}", "${binSrc}", ${x}, ${y}, ${width}, ${height});\n`;
    }

    // 普通模式：也使用 gui_img（SDK 没有 gui_button）
    // 如果有文本，可以考虑用 gui_text 叠加
    return `${indentStr}// 普通按钮暂不支持，请使用双态模式\n${indentStr}// ${component.id} = gui_img_create_from_fs(${parentRef}, "${component.name}", "", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    return '';
  }

  /**
   * 生成双态按钮的回调函数
   * 使用 gui_img_set_image_data 切换图片
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

    return `
// ${component.id} 双态按钮回调
static bool ${component.id}_state = ${component.data?.initialState === 'on' ? 'true' : 'false'};

void ${component.id}_toggle_cb(void *obj, gui_event_t event, void *param)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(event);
    GUI_UNUSED(param);
    
    // 切换状态
    ${component.id}_state = !${component.id}_state;
    
    // 根据状态切换图片并调用对应回调
    if (${component.id}_state) {
        gui_img_set_image_data((gui_img_t *)${component.id}, "${binOn}");
        ${component.id}_on_callback();
    } else {
        gui_img_set_image_data((gui_img_t *)${component.id}, "${binOff}");
        ${component.id}_off_callback();
    }
}

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
            gui_img_set_image_data((gui_img_t *)${component.id}, "${binOn}");
            ${component.id}_on_callback();
        } else {
            gui_img_set_image_data((gui_img_t *)${component.id}, "${binOff}");
            ${component.id}_off_callback();
        }
    }
}
`;
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
    return `${indentStr}gui_obj_add_event_cb(${component.id}, ${component.id}_toggle_cb, GUI_EVENT_TOUCH_CLICKED, NULL);\n`;
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
