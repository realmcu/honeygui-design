/**
 * hg_button component LVGL code generator
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { escapeCString, normalizeLvglImageSource } from '../LvglUtils';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglButtonGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const hasImage = !!(component.data?.imageOn || component.data?.imageOff);
    let code: string;
    if (hasImage) {
      code = `    ${component.id} = lv_imagebutton_create(${parentRef});\n`;
    } else {
      code = `    ${component.id} = lv_button_create(${parentRef});\n`;
    }
    code += this.generateSetters(component, hasImage, ctx);
    return code;
  }

  private generateSetters(component: Component, hasImage: boolean, ctx: LvglGeneratorContext): string {
    const { x, y } = this.resolvePosition(component);
    const { width, height } = this.resolveSize(component);

    const text = component.data?.text || '';
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';

    let code = `    lv_obj_set_pos(${component.id}, ${x}, ${y});\n`;

    if (hasImage) {
      code += `    lv_obj_set_size(${component.id}, LV_SIZE_CONTENT, LV_SIZE_CONTENT);\n`;
      code += this.generateImageButtonSetters(component, toggleMode, ctx);
    } else {
      code += `    lv_obj_set_size(${component.id}, ${width}, ${height});\n`;
      code += `    lv_obj_remove_flag(${component.id}, LV_OBJ_FLAG_PRESS_LOCK);\n`;
      code += this.generatePlainButtonSetters(component, toggleMode);
    }

    if (text) {
      const labelId = `${component.id}_label`;
      code += `    lv_obj_t * ${labelId} = lv_label_create(${component.id});\n`;
      code += `    lv_label_set_text(${labelId}, "${escapeCString(String(text))}");\n`;
      code += `    lv_obj_center(${labelId});\n`;
    }

    return code;
  }

  private generateImageButtonSetters(component: Component, toggleMode: boolean, ctx: LvglGeneratorContext): string {
    const imageOn = String(component.data?.imageOn || '');
    const imageOff = String(component.data?.imageOff || '');
    const initialState = component.data?.initialState === 'on';
    const hasTwoImages = !!(imageOn && imageOff);

    const imageOnVar = ctx.getBuiltinImageVar(imageOn);
    const imageOffVar = ctx.getBuiltinImageVar(imageOff);

    let code = `    lv_obj_set_style_pad_all(${component.id}, 0, 0);\n`;

    if (!hasTwoImages) {
      code += `    lv_obj_set_style_image_recolor(${component.id}, lv_color_black(), LV_STATE_PRESSED);\n`;
      code += `    lv_obj_set_style_image_recolor_opa(${component.id}, LV_OPA_30, LV_STATE_PRESSED);\n`;
    }

    if (toggleMode) {
      code += this.setImageButtonSrc(component.id, 'LV_IMAGEBUTTON_STATE_RELEASED', imageOff, imageOffVar);
      code += this.setImageButtonSrc(component.id, 'LV_IMAGEBUTTON_STATE_CHECKED_RELEASED', imageOn, imageOnVar);
      code += `    lv_obj_add_flag(${component.id}, LV_OBJ_FLAG_CHECKABLE);\n`;
      if (initialState) {
        code += `    lv_obj_add_state(${component.id}, LV_STATE_CHECKED);\n`;
      }
    } else {
      if (imageOn) {
        code += this.setImageButtonSrc(component.id, 'LV_IMAGEBUTTON_STATE_RELEASED', imageOn, imageOnVar);
      } else if (imageOff) {
        code += this.setImageButtonSrc(component.id, 'LV_IMAGEBUTTON_STATE_RELEASED', imageOff, imageOffVar);
      }
      if (imageOn && imageOff) {
        code += this.setImageButtonSrc(component.id, 'LV_IMAGEBUTTON_STATE_PRESSED', imageOff, imageOffVar);
      }
    }

    return code;
  }

  private setImageButtonSrc(id: string, state: string, imgPath: string, builtinVar: string | undefined): string {
    if (builtinVar) {
      return `    lv_imagebutton_set_src(${id}, ${state}, NULL, &${builtinVar}, NULL);\n`;
    }
    if (imgPath) {
      const src = normalizeLvglImageSource(imgPath);
      return `    lv_imagebutton_set_src(${id}, ${state}, NULL, "${escapeCString(src)}", NULL);\n`;
    }
    return '';
  }

  private generatePlainButtonSetters(component: Component, toggleMode: boolean): string {
    let code = '';
    if (toggleMode) {
      code += `    lv_obj_add_flag(${component.id}, LV_OBJ_FLAG_CHECKABLE);\n`;
      code += `    lv_obj_set_height(${component.id}, LV_SIZE_CONTENT);\n`;
      const initialState = component.data?.initialState === 'on';
      if (initialState) {
        code += `    lv_obj_add_state(${component.id}, LV_STATE_CHECKED);\n`;
      }
    }
    return code;
  }
}
