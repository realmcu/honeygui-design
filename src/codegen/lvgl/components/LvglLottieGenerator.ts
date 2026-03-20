/**
 * hg_lottie component LVGL code generator
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { escapeCString, normalizeVideoSource } from '../LvglUtils';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglLottieGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { x, y, width, height } = component.position;
    const posX = Math.round(x);
    const posY = Math.round(y);
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

    const srcRaw = component.data?.src || '';
    const src = normalizeVideoSource(String(srcRaw));

    const autoPlayRaw = component.data?.autoPlay ?? component.data?.autoplay;
    const autoPlay = autoPlayRaw !== false && autoPlayRaw !== 'false';
    const loopRaw = component.data?.loop;
    const loop = loopRaw !== false && loopRaw !== 'false';

    const bufVarName = `${component.id}_lottie_buf`;

    let code = `    ${component.id} = lv_lottie_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${posX}, ${posY});\n`;
    code += `    lv_obj_set_size(${component.id}, ${w}, ${h});\n`;

    code += `    static uint8_t ${bufVarName}[${w} * ${h} * 4];\n`;
    code += `    lv_lottie_set_buffer(${component.id}, ${w}, ${h}, ${bufVarName});\n`;

    if (srcRaw) {
      code += `    lv_lottie_set_src_file(${component.id}, "${escapeCString(src)}");\n`;
    } else {
      code += `    /* TODO(lvgl): hg_lottie src not set, need to specify Lottie JSON file path */\n`;
    }

    code += `    {\n`;
    code += `        lv_anim_t * anim = lv_lottie_get_anim(${component.id});\n`;
    code += `        if(anim != NULL) {\n`;
    if (loop) {
      code += `            lv_anim_set_repeat_count(anim, LV_ANIM_REPEAT_INFINITE);\n`;
    } else {
      code += `            lv_anim_set_repeat_count(anim, 1); /* Play once only */\n`;
    }
    code += `            lv_anim_set_duration(anim, 2000); /* Unit: ms, duration for one animation cycle */\n`;
    if (!autoPlay) {
      code += `            lv_anim_pause(anim); /* autoPlay=false: paused, call lv_anim_resume() to start manually */\n`;
    }
    code += `        }\n`;
    code += `    }\n`;

    return code;
  }
}
