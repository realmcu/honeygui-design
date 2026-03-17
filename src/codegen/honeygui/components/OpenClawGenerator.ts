/**
 * hg_openclaw 组件代码生成器
 *
 * API: gui_openclaw_create_from_mem
 * 依赖库: lib/gui_openclaw（代码生成时自动拷贝到输出目录）
 *
 * 使用说明:
 *   - Font File (.ttf) 通过 VFS 文件系统加载
 *   - 运行时使用 gui_vfs_open / gui_vfs_read 读取文件内容
 *   - 使用 gui_lower_malloc 申请 buffer 存放字体数据
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';

/**
 * 将文件路径转换为 C 变量名后缀
 * 例: "NotoSansSC-Medium.ttf" → "notosanssc_medium_ttf"
 */
function filePathToVarSuffix(filePath: string): string {
  const basename = filePath.split('/').pop() || filePath;
  return basename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

export class OpenClawGenerator implements ComponentCodeGenerator {
  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    const fontFile = (component.data?.fontFile as string) || '';
    const senderId = (component.data?.senderId as string) || 'user1';

    // 生成 VFS 路径（以 / 开头的绝对路径）
    const fontVfsPath = fontFile.startsWith('/') ? fontFile : `/${fontFile}`;

    // 为每个组件生成唯一的变量名
    const fontVarSuffix = filePathToVarSuffix(fontFile) || 'font';
    const compIdSafe = component.id.replace(/[^a-zA-Z0-9_]/g, '_');

    let code = '';

    // 声明变量
    code += `${indentStr}// Load font file via VFS for ${component.id}\n`;
    code += `${indentStr}uint8_t *${compIdSafe}_ttf_addr = NULL;\n`;
    code += `${indentStr}size_t ${compIdSafe}_ttf_size = 0;\n`;

    // 加载字体文件到新申请的 buffer
    if (fontFile) {
      code += `${indentStr}{\n`;
      code += `${indentStr}    const char *src_path = "${fontVfsPath}";\n`;
      code += `${indentStr}    gui_vfs_file_t *f = gui_vfs_open(src_path, GUI_VFS_READ);\n`;
      code += `${indentStr}    if (f)\n`;
      code += `${indentStr}    {\n`;
      code += `${indentStr}        ${compIdSafe}_ttf_size = gui_vfs_seek(f, 0, GUI_VFS_SEEK_END);\n`;
      code += `${indentStr}        gui_vfs_seek(f, 0, GUI_VFS_SEEK_SET);\n`;
      code += `${indentStr}        ${compIdSafe}_ttf_addr = (uint8_t *)gui_lower_malloc(${compIdSafe}_ttf_size);\n`;
      code += `${indentStr}        if (${compIdSafe}_ttf_addr)\n`;
      code += `${indentStr}        {\n`;
      code += `${indentStr}            gui_vfs_read(f, ${compIdSafe}_ttf_addr, ${compIdSafe}_ttf_size);\n`;
      code += `${indentStr}        }\n`;
      code += `${indentStr}        gui_vfs_close(f);\n`;
      code += `${indentStr}    }\n`;
      code += `${indentStr}}\n`;
    }

    // 创建 OpenClaw 控件
    code += `${indentStr}${component.id} = gui_openclaw_create_from_mem(${parentRef}, "${component.name}",\n`;
    code += `${indentStr}    ${compIdSafe}_ttf_addr, ${compIdSafe}_ttf_size,\n`;
    code += `${indentStr}    "${senderId}",\n`;
    code += `${indentStr}    ${x}, ${y}, ${width}, ${height});\n`;

    return code;
  }

  generatePropertySetters(component: Component, indent: number, _context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // 可见性
    if (component.visible === false) {
      code += `${indentStr}gui_obj_hidden_set((gui_obj_t *)${component.id}, true);\n`;
    }

    return code;
  }

  /**
   * 收集本组件所需的额外 #include（由 HoneyGuiCCodeGenerator 调用）
   * OpenClaw 组件需要 VFS 和 openclaw 头文件
   */
  getExtraIncludes(_component: Component): string[] {
    return [
      '#include "gui_vfs.h"',
      '#include "gui_openclaw.h"'
    ];
  }
}
