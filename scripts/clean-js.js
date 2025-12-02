/**
 * 清理 src 目录下的所有 .js 文件
 * 跨平台兼容脚本
 */
const fs = require('fs');
const path = require('path');

function deleteJsFiles(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      deleteJsFiles(filePath);
    } else if (file.endsWith('.js')) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Deleted: ${filePath}`);
      } catch (err) {
        console.error(`Failed to delete ${filePath}:`, err.message);
      }
    }
  });
}

const srcDir = path.join(__dirname, '..', 'src');
console.log('Cleaning .js files in src directory...');
deleteJsFiles(srcDir);
console.log('Done.');
