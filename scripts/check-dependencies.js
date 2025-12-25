#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 检查 .vscodeignore 中是否包含所有运行时依赖
 */
function checkDependencies() {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const vscodeignorePath = path.join(__dirname, '..', '.vscodeignore');
    
    // 读取 package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = Object.keys(packageJson.dependencies || {});
    
    // 读取 .vscodeignore
    const vscodeignoreContent = fs.readFileSync(vscodeignorePath, 'utf8');
    
    // 检查缺失的依赖
    const missingDeps = dependencies.filter(dep => {
        const pattern = `!node_modules/${dep}/**`;
        return !vscodeignoreContent.includes(pattern);
    });
    
    if (missingDeps.length > 0) {
        console.error('❌ 以下依赖未在 .vscodeignore 中包含:');
        missingDeps.forEach(dep => console.error(`  - ${dep}`));
        console.error('\n请在 .vscodeignore 的 "# 核心依赖" 部分添加:');
        missingDeps.forEach(dep => console.error(`!node_modules/${dep}/**`));
        process.exit(1);
    } else {
        console.log('✅ 所有运行时依赖都已正确包含在 .vscodeignore 中');
    }
}

checkDependencies();
