/**
 * Protected area merger utility
 * Merges user code with generated code
 */

export class ProtectedAreaMerger {

  /**
   * Merge protected area code
   * @param existing Existing file content
   * @param generated Newly generated content
   * @returns Merged content
   */
  static merge(existing: string, generated: string): string {
    const protectedAreas = new Map<string, string>();

    // Extract protected areas from existing file
    const regex = /\/\* @protected start (\w+) \*\/([\s\S]*?)\/\* @protected end \1 \*\//g;
    let match;

    while ((match = regex.exec(existing)) !== null) {
      protectedAreas.set(match[1], match[2]);
    }

    // Replace protected areas in generated code
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
