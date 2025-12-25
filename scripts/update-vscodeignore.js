#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 自动更新 .vscodeignore 中的依赖列表
 * 只包含扩展运行时真正需要的依赖
 */
function updateVscodeignore() {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const vscodeignorePath = path.join(__dirname, '..', '.vscodeignore');
    
    // 读取 package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const allDeps = Object.keys(packageJson.dependencies || {});
    
    // 扩展运行时真正需要的依赖（排除前端依赖）
    const runtimeDeps = allDeps.filter(dep => {
        // 排除前端依赖
        const frontendDeps = ['lucide-react', 'three', 'zustand'];
        return !frontendDeps.includes(dep);
    }).sort();
    
    // 读取 .vscodeignore
    let content = fs.readFileSync(vscodeignorePath, 'utf8');
    
    // 生成新的依赖列表
    const newDeps = runtimeDeps.map(dep => `!node_modules/${dep}/**`).join('\n');
    
    // 替换自动生成部分
    const startMarker = '# AUTO-GENERATED-DEPS-START';
    const endMarker = '# AUTO-GENERATED-DEPS-END';
    
    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker);
    
    if (startIndex !== -1 && endIndex !== -1) {
        const before = content.substring(0, startIndex + startMarker.length);
        const after = content.substring(endIndex);
        
        content = `${before}\n${newDeps}\n${after}`;
        
        fs.writeFileSync(vscodeignorePath, content, 'utf8');
        console.log('✅ .vscodeignore 已自动更新');
        console.log(`包含的运行时依赖: ${runtimeDeps.join(', ')}`);
        
        const excludedDeps = allDeps.filter(dep => !runtimeDeps.includes(dep));
        if (excludedDeps.length > 0) {
            console.log(`排除的前端依赖: ${excludedDeps.join(', ')}`);
        }
    } else {
        console.error('❌ 未找到自动生成标记，请检查 .vscodeignore 格式');
        process.exit(1);
    }
}

updateVscodeignore();
