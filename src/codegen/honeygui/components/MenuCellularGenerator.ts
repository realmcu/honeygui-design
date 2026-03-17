/**
 * hg_menu_cellular 组件代码生成器
 * 生成蜂窝菜单控件的 C 代码
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

interface IconAction {
  target?: string;
  switchOutStyle?: string;
  switchInStyle?: string;
}

export class MenuCellularGenerator implements ComponentCodeGenerator {

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const iconSize = component.data?.iconSize ?? 64;
    const offsetX = component.data?.offsetX ?? 0;
    const offsetY = component.data?.offsetY ?? 0;

    const iconImages: string[] = Array.isArray(component.data?.iconImages)
      ? component.data.iconImages
      : [];

    const iconActions: IconAction[] = Array.isArray(component.data?.iconActions)
      ? component.data.iconActions
      : [];

    let code = '';

    if (iconImages.length !== 0) {
      // 生成字符串路径数组
      code += `${indentStr}const void *${component.id}_icons[] = {\n`;
      iconImages.forEach((iconPath, index) => {
        const binPath = this.convertToBinPath(iconPath);
        const comma = index < iconImages.length - 1 ? ',' : '';
        code += `${indentStr}    "${binPath}"${comma}\n`;
      });
      code += `${indentStr}};\n`;

      code += `${indentStr}${component.id} = gui_menu_cellular_create(${parentRef}, ${iconSize}, ${component.id}_icons, ${iconImages.length}, IMG_SRC_FILESYS);\n`;
    }

    // 偏移量条件生成
    if (offsetX !== 0 || offsetY !== 0) {
      code += `${indentStr}gui_menu_cellular_offset(${component.id}, ${offsetX}, ${offsetY});\n`;
    }

    // 生成 gui_menu_cellular_on_click（仅当至少有一个 target 配置时）
    const hasAnyAction = iconActions.some(a => a && a.target && a.target.trim() !== '');
    if (hasAnyAction && iconImages.length > 0) {
      const count = iconImages.length;
      code += `${indentStr}static struct gui_menu_cellular_gesture_parameter ${component.id}_params[] = {\n`;
      for (let i = 0; i < count; i++) {
        const action = iconActions[i];
        const comma = i < count - 1 ? ',' : '';
        if (action && action.target && action.target.trim() !== '') {
          const cbName = this.getSwitchViewCallbackName(component.id, i);
          code += `${indentStr}    { ${cbName}, NULL }${comma}\n`;
        } else {
          code += `${indentStr}    { NULL, NULL }${comma}\n`;
        }
      }
      code += `${indentStr}};\n`;
      code += `${indentStr}gui_menu_cellular_on_click(${component.id}, ${component.id}_params, ${count});\n`;
    }

    return code;
  }

  generatePropertySetters(_component: Component, _indent: number, _context: GeneratorContext): string {
    return '';
  }

  /**
   * 生成 switch_view 回调函数（写入 *_ui.c）
   * 每个配置了跳转目标的图标生成一个独立的回调函数
   */
  generateSwitchViewCallbacks(component: Component): string {
    const iconActions: IconAction[] = Array.isArray(component.data?.iconActions)
      ? component.data.iconActions
      : [];

    const hasAnyAction = iconActions.some(a => a && a.target && a.target.trim() !== '');
    if (!hasAnyAction) {
      return '';
    }

    let code = `// ${component.id} menu cellular icon switch view callbacks\n`;

    iconActions.forEach((action, index) => {
      if (!action || !action.target || action.target.trim() === '') {
        return;
      }
      const cbName = this.getSwitchViewCallbackName(component.id, index);
      const switchOut = action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION';
      const switchIn = action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION';

      code += `void ${cbName}(void *obj, gui_event_t *e)\n`;
      code += `{\n`;
      code += `    GUI_UNUSED(obj);\n`;
      code += `    GUI_UNUSED(e);\n`;
      code += `    gui_view_switch_direct(gui_view_get_current(), "${action.target}", ${switchOut}, ${switchIn});\n`;
      code += `}\n\n`;
    });

    return code;
  }

  /**
   * 获取图标 switch_view 回调函数名
   */
  getSwitchViewCallbackName(componentId: string, iconIndex: number): string {
    return `${componentId}_icon_${iconIndex}_switch_view_cb`;
  }

  /**
   * 将图片路径转换为 .bin 路径
   * 规则：扩展名替换为 .bin，去除 assets/ 前缀，路径以 / 开头
   */
  convertToBinPath(src: string): string {
    if (!src) { return ''; }
    let binSrc = src.replace(/\.(png|jpe?g|bmp|gif|tiff?|webp)$/i, '.bin');
    binSrc = binSrc.replace(/^assets\//, '');
    if (!binSrc.startsWith('/')) {
      binSrc = '/' + binSrc;
    }
    return binSrc;
  }
}
