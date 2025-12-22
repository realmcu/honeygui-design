/**
 * hg_3d 组件代码生成器
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

export class Model3DGenerator implements ComponentCodeGenerator {

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    const modelPath = component.data?.modelPath || '';
    const drawType = component.data?.drawType || 'L3_DRAW_FRONT_AND_SORT';
    const ext = modelPath.split('.').pop()?.toLowerCase();

    // 去掉 assets/ 前缀，确保路径以 / 开头
    let vfsPath = modelPath.replace(/^assets\//, '');
    if (!vfsPath.startsWith('/')) {
      vfsPath = '/' + vfsPath;
    }

    let code = '';

    if (ext === 'obj' || ext === 'gltf') {
      const callbackName = `${component.id}_global_cb`;

      // 将模型文件路径转换为 bin 文件路径
      const pathParts = vfsPath.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const baseName = fileName.replace(/\.(obj|gltf)$/i, '');
      const dirPath = pathParts.slice(0, -1).join('/');

      const binFileName = ext === 'obj' ? `desc_${baseName}.bin` : `gltf_desc_${baseName}.bin`;
      const binPath = dirPath ? `${dirPath}/${binFileName}` : `/${binFileName}`;

      code += `${indentStr}void *${component.id}_addr = (void *)gui_vfs_get_file_address("${binPath}");\n`;
      code += `${indentStr}l3_model_base_t *${component.id}_model = l3_create_model(${component.id}_addr, ${drawType}, ${x}, ${y}, ${width}, ${height});\n`;
      code += `${indentStr}l3_set_global_transform(${component.id}_model, (l3_global_transform_cb)${callbackName});\n`;
      code += `${indentStr}gui_lite3d_t *${component.id} = gui_lite3d_create(${parentRef}, "${component.name}", ${component.id}_model, ${x}, ${y}, ${width}, ${height});\n`;
    } else {
      code += `${indentStr}// 警告: 不支持的3D模型格式: ${ext}\n`;
    }

    return code;
  }

  generatePropertySetters(component: Component, indent: number, context: GeneratorContext): string {
    return '';
  }
}
