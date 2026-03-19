/**
 * hg_3d 组件 LVGL 代码生成器
 */
import { Component } from '../../../hml/types';
import { LvglGeneratorContext } from '../LvglComponentGenerator';
import { LvglStyleGenerator } from '../LvglStyleGenerator';
import { parseColorHex, escapeCString, normalizeVideoSource, toFiniteNumber } from '../LvglUtils';
import { LvglBaseGenerator } from './LvglBaseGenerator';

export class Lvgl3DGenerator extends LvglBaseGenerator {
  generateCreation(component: Component, parentRef: string, ctx: LvglGeneratorContext): string {
    const { x, y, width, height } = component.position;
    const posX = Math.round(x);
    const posY = Math.round(y);
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

    const bgColor = String(component.style?.backgroundColor || '#000000');
    const bgColorHex = parseColorHex(bgColor);
    const modelPathRaw = component.data?.modelPath || component.data?.src || '';
    const modelPath = normalizeVideoSource(String(modelPathRaw));

    const fov = Number(toFiniteNumber(component.data?.fov, 45.0).toFixed(3));
    const distance = Number(toFiniteNumber(component.data?.distance, 1.8).toFixed(3));

    const bgMode = String(component.data?.backgroundMode || component.data?.bgMode || 'solid').toLowerCase();
    const aaMode = String(component.data?.antialiasingMode || component.data?.aaMode || 'on').toLowerCase();

    const lvBgMode = bgMode === 'environment' || bgMode === 'env'
      ? 'LV_GLTF_BG_MODE_ENVIRONMENT'
      : 'LV_GLTF_BG_MODE_SOLID';

    let lvAaMode = 'LV_GLTF_AA_MODE_ON';
    if (aaMode === 'off') {
      lvAaMode = 'LV_GLTF_AA_MODE_OFF';
    } else if (aaMode === 'dynamic') {
      lvAaMode = 'LV_GLTF_AA_MODE_DYNAMIC';
    }

    let code = `    ${component.id} = lv_gltf_create(${parentRef});\n`;
    code += `    lv_obj_set_pos(${component.id}, ${posX}, ${posY});\n`;
    code += `    lv_obj_set_size(${component.id}, ${w}, ${h});\n`;
    code += `    lv_obj_set_style_bg_color(${component.id}, lv_color_hex(0x${bgColorHex}), LV_PART_MAIN);\n`;
    code += `    lv_obj_set_style_bg_opa(${component.id}, LV_OPA_COVER, LV_PART_MAIN);\n`;
    code += LvglStyleGenerator.generateBorderWidth(component.id, 0);
    code += LvglStyleGenerator.generatePadding(component.id, 0);
    code += `    lv_gltf_set_background_mode(${component.id}, ${lvBgMode});\n`;
    code += `    lv_gltf_set_antialiasing_mode(${component.id}, ${lvAaMode});\n`;
    code += `    lv_gltf_set_fov(${component.id}, ${fov.toFixed(3)}f);\n`;
    code += `    lv_gltf_set_distance(${component.id}, ${distance.toFixed(3)}f);\n`;

    if (modelPathRaw) {
      code += `    if(lv_gltf_load_model_from_file(${component.id}, "${escapeCString(modelPath)}") == NULL) {\n`;
      code += `        LV_LOG_WARN("GLB load failed: ${escapeCString(modelPath)}");\n`;
      code += `    }\n`;
    } else {
      code += `    /* TODO(lvgl): hg_3d modelPath/src not set, cannot load model */\n`;
    }

    return code;
  }
}
