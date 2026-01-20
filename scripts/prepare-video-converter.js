/**
 * 预处理 video-converter-ts 源码
 * 将 .js 扩展名的导入改为 .ts (用于 TypeScript 编译)
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../tools/video-converter-ts/src');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // 替换 .js 导入为无扩展名导入 (TypeScript 会自动解析)
    const newContent = content.replace(/from\s+['"](.+?)\.js['"]/g, (match, p1) => {
        modified = true;
        return `from '${p1}'`;
    });
    
    if (modified) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`✓ Processed: ${path.relative(process.cwd(), filePath)}`);
    }
}

function processDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            processDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
            processFile(fullPath);
        }
    }
}

console.log('Preparing video-converter-ts source files...');
processDirectory(srcDir);
console.log('Done!');
