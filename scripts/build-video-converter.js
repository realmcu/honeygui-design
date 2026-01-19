/**
 * 构建 video-converter-ts 包并复制到 node_modules
 * 
 * 这个脚本解决了 Windows 上 npm 本地包符号链接的问题
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const videoConverterPath = path.join(__dirname, '..', 'tools', 'video-converter-ts');
const nodeModulesPath = path.join(__dirname, '..', 'node_modules', 'video-converter-ts');

console.log('Building video-converter-ts...');

try {
    // 1. 编译 video-converter-ts
    execSync('npm run build', {
        cwd: videoConverterPath,
        stdio: 'inherit'
    });

    console.log('Copying to node_modules...');

    // 2. 删除 node_modules 中的旧文件
    if (fs.existsSync(nodeModulesPath)) {
        fs.rmSync(nodeModulesPath, { recursive: true, force: true });
    }

    // 3. 创建目录
    fs.mkdirSync(nodeModulesPath, { recursive: true });

    // 4. 复制 dist 目录
    const distSrc = path.join(videoConverterPath, 'dist');
    const distDest = path.join(nodeModulesPath, 'dist');
    
    copyDir(distSrc, distDest);

    // 5. 复制 package.json
    fs.copyFileSync(
        path.join(videoConverterPath, 'package.json'),
        path.join(nodeModulesPath, 'package.json')
    );

    console.log('video-converter-ts build completed successfully!');
} catch (error) {
    console.error('Failed to build video-converter-ts:', error.message);
    process.exit(1);
}

/**
 * 递归复制目录
 */
function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
