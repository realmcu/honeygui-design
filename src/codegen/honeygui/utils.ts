/**
 * 代码生成工具函数
 */

import * as path from 'path';

/**
 * 根据HML文件路径计算C代码输出目录
 * 规则：ui/xxx/ -> src/
 * 
 * @param hmlFilePath HML文件的完整路径
 * @param projectRoot 项目根目录
 * @returns 输出目录路径（src/）
 */
export function getOutputDir(hmlFilePath: string, projectRoot: string): string {
  return path.join(projectRoot, 'src');
}

/**
 * 从文件路径提取文件名（不含扩展名）
 * 
 * @param filePath 文件路径
 * @returns 文件名（不含扩展名）
 * 
 * @example
 * getBaseName('/path/to/main.hml') // 'main'
 */
export function getBaseName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

/**
 * 查找项目根目录
 * 向上查找包含 package.json 或 .git 的目录
 * 
 * @param startPath 起始路径
 * @returns 项目根目录，如果未找到则返回起始路径的父目录
 */
export function findProjectRoot(startPath: string): string {
  let currentPath = startPath;
  
  while (currentPath !== path.dirname(currentPath)) {
    if (
      require('fs').existsSync(path.join(currentPath, 'package.json')) ||
      require('fs').existsSync(path.join(currentPath, '.git'))
    ) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }
  
  return path.dirname(startPath);
}
