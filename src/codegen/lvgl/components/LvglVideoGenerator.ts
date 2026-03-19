/**
 * hg_video 组件 LVGL 代码生成器
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { escapeCString, normalizeVideoSource } from '../LvglUtils';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class LvglVideoGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { x, y, width, height } = component.position;
    const posX = Math.round(x);
    const posY = Math.round(y);
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

    const src = component.data?.src || '';
    const autoplayRaw = component.data?.autoPlay ?? component.data?.autoplay;
    const autoplay = autoplayRaw === true || autoplayRaw === 'true';
    const loopRaw = component.data?.loop;
    const loop = loopRaw === true || loopRaw === 'true';

    let code = `    ${component.id} = lv_ffmpeg_player_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${posX}, ${posY});\n`;
    code += `    lv_obj_set_size(${component.id}, ${w}, ${h});\n`;

    if (src) {
      const videoSrc = normalizeVideoSource(String(src));
      code += `    lv_ffmpeg_player_set_src(${component.id}, "${escapeCString(videoSrc)}");\n`;
    }
    if (loop) {
      code += `    lv_ffmpeg_player_set_auto_restart(${component.id}, true);\n`;
    }
    if (autoplay) {
      code += `    lv_ffmpeg_player_set_cmd(${component.id}, LV_FFMPEG_PLAYER_CMD_START);\n`;
    }

    return code;
  }
}
