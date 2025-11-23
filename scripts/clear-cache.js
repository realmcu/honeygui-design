#!/usr/bin/env node

/**
 * 清理所有缓存文件和目录
 * 用于解决调试过程中的缓存问题
 */

const fs = require('fs');
const path = require('path');

// 需要清理的目录和文件列表
const cachePaths = [
  // Webpack 缓存
  '.webpack_cache',
  'node_modules/.cache',
  
  // TypeScript 构建信息
  '*.tsbuildinfo',
  'tsconfig.tsbuildinfo',
  
  // 输出目录
  'out',
  
  // ESLint 缓存
  '.eslintcache',
  
  // Stylelint 缓存
  '.stylelintcache',
  
  // 通用缓存目录
  '.cache',
  
  // VS Code 测试缓存
  '.vscode-test',
];

/**
 * 递归删除目录
 */
function removeDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return false;
  }

  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`✓ 已删除: ${dirPath}`);
    return true;
  } catch (error) {
    console.error(`✗ 删除失败: ${dirPath}`, error.message);
    return false;
  }
}

/**
 * 删除文件
 */
function removeFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    fs.unlinkSync(filePath);
    console.log(`✓ 已删除: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`✗ 删除失败: ${filePath}`, error.message);
    return false;
  }
}

/**
 * 处理通配符路径
 */
function handleGlobPattern(pattern) {
  const dir = path.dirname(pattern);
  const filename = path.basename(pattern);
  
  if (!filename.includes('*')) {
    // 不是通配符，直接处理
    const fullPath = path.resolve(process.cwd(), pattern);
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        return removeDir(fullPath);
      } else {
        return removeFile(fullPath);
      }
    }
    return false;
  }

  // 处理通配符
  const regex = new RegExp('^' + filename.replace(/\*/g, '.*') + '$');
  const searchDir = dir === '.' ? process.cwd() : path.resolve(process.cwd(), dir);
  
  if (!fs.existsSync(searchDir)) {
    return false;
  }

  let removed = false;
  const files = fs.readdirSync(searchDir);
  
  files.forEach(file => {
    if (regex.test(file)) {
      const fullPath = path.join(searchDir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        removed = removeDir(fullPath) || removed;
      } else {
        removed = removeFile(fullPath) || removed;
      }
    }
  });
  
  return removed;
}

// 主函数
function main() {
  console.log('========================================');
  console.log('开始清理缓存...');
  console.log('========================================\n');

  let totalRemoved = 0;

  cachePaths.forEach(cachePath => {
    if (handleGlobPattern(cachePath)) {
      totalRemoved++;
    }
  });

  console.log('\n========================================');
  if (totalRemoved > 0) {
    console.log(`✓ 清理完成！共删除 ${totalRemoved} 个缓存项`);
  } else {
    console.log('✓ 没有发现需要清理的缓存');
  }
  console.log('========================================');
  console.log('\n建议执行以下命令重新构建:');
  console.log('  npm run compile');
  console.log('  npm run build:webview');
}

// 执行
main();
