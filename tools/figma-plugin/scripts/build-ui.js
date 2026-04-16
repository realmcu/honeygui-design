/**
 * UI 构建脚本
 * 将 src/ui.html 复制到 dist/ui.html
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'ui.html');
const dist = path.join(__dirname, '..', 'dist');
const destFile = path.join(dist, 'ui.html');

if (!fs.existsSync(dist)) {
    fs.mkdirSync(dist, { recursive: true });
}

fs.copyFileSync(src, destFile);
console.log('UI built: dist/ui.html');

// 简单 watch 模式
if (process.argv.includes('--watch')) {
    console.log('Watching src/ui.html for changes...');
    fs.watchFile(src, { interval: 1000 }, () => {
        fs.copyFileSync(src, destFile);
        console.log('UI rebuilt: dist/ui.html');
    });
}
