/**
 * LVGL 保护区合并工具
 * 在代码重新生成时保留用户自定义代码
 *
 * 保护区标记格式：
 *   /* USER CODE BEGIN {name} *\/
 *   ... 用户代码 ...
 *   /* USER CODE END {name} *\/
 */

export class LvglProtectedAreaMerger {
  /**
   * 合并保护区代码：从 existing 中提取用户代码，合并到 generated 的对应保护区位置
   * @param existing 现有文件内容（包含用户自定义代码）
   * @param generated 新生成的文件内容（保护区为空）
   * @returns 合并后的内容
   */
  static merge(existing: string, generated: string): string {
    // 提取现有文件中所有保护区的用户代码
    const protectedAreas = new Map<string, string>();
    const extractRegex = /\/\* USER CODE BEGIN ([\w]+) \*\/([\s\S]*?)\/\* USER CODE END \1 \*\//g;
    let match;

    while ((match = extractRegex.exec(existing)) !== null) {
      const name = match[1];
      const content = match[2];
      // 名称冲突时保留第一个
      if (!protectedAreas.has(name)) {
        protectedAreas.set(name, content);
      }
    }

    // 将用户代码合并到新生成文件的对应保护区
    let result = generated;
    protectedAreas.forEach((content, name) => {
      const replaceRegex = new RegExp(
        `\\/\\* USER CODE BEGIN ${name} \\*\\/[\\s\\S]*?\\/\\* USER CODE END ${name} \\*\\/`,
        'g'
      );
      result = result.replace(
        replaceRegex,
        `/* USER CODE BEGIN ${name} */${content}/* USER CODE END ${name} */`
      );
    });

    return result;
  }
}
