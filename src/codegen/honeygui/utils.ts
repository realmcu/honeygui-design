/**
 * Code generation utility functions
 */

import * as path from 'path';

/**
 * Calculate C code output directory from HML file path
 * Rule: ui/xxx/ -> src/
 * 
 * @param hmlFilePath Full path of the HML file
 * @param projectRoot Project root directory
 * @returns Output directory path (src/)
 */
export function getOutputDir(hmlFilePath: string, projectRoot: string): string {
  return path.join(projectRoot, 'src');
}

/**
 * Extract filename (without extension) from a file path
 * 
 * @param filePath File path
 * @returns Filename without extension
 * 
 * @example
 * getBaseName('/path/to/main.hml') // 'main'
 */
export function getBaseName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

/**
 * Find project root directory
 * Traverse upward to find a directory containing package.json or .git
 * 
 * @param startPath Starting path
 * @returns Project root directory, or parent of startPath if not found
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
