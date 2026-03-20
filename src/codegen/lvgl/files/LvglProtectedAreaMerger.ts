/**
 * LVGL protected area merger
 * Preserves user-defined code during code regeneration
 *
 * Protected area marker format:
 *   /* USER CODE BEGIN {name} *\/
 *   ... user code ...
 *   /* USER CODE END {name} *\/
 */

export class LvglProtectedAreaMerger {
  /**
   * Merge protected area code: extract user code from existing, merge into corresponding protected areas in generated
   * @param existing Existing file content (containing user-defined code)
   * @param generated Newly generated file content (with empty protected areas)
   * @returns Merged content
   */
  static merge(existing: string, generated: string): string {
    // Extract user code from all protected areas in existing file
    const protectedAreas = new Map<string, string>();
    const extractRegex = /\/\* USER CODE BEGIN ([\w]+) \*\/([\s\S]*?)\/\* USER CODE END \1 \*\//g;
    let match;

    while ((match = extractRegex.exec(existing)) !== null) {
      const name = match[1];
      const content = match[2];
      // Keep first occurrence on name conflict
      if (!protectedAreas.has(name)) {
        protectedAreas.set(name, content);
      }
    }

    // Merge user code into corresponding protected areas in newly generated file
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
