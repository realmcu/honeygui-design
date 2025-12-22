/**
 * 保护区合并工具
 * 用于合并用户代码和生成代码
 */

export class ProtectedAreaMerger {

  /**
   * 合并保护区代码
   * @param existing 现有文件内容
   * @param generated 新生成的内容
   * @returns 合并后的内容
   */
  static merge(existing: string, generated: string): string {
    const protectedAreas = new Map<string, string>();

    // 提取现有文件中的保护区
    const regex = /\/\* @protected start (\w+) \*\/([\s\S]*?)\/\* @protected end \1 \*\//g;
    let match;

    while ((match = regex.exec(existing)) !== null) {
      protectedAreas.set(match[1], match[2]);
    }

    // 替换生成代码中的保护区
    let result = generated;
    protectedAreas.forEach((content, id) => {
      const pattern = new RegExp(
        `\\/\\* @protected start ${id} \\*\\/[\\s\\S]*?\\/\\* @protected end ${id} \\*\\/`,
        'g'
      );
      result = result.replace(
        pattern,
        `/* @protected start ${id} */${content}/* @protected end ${id} */`
      );
    });

    return result;
  }
}
