#!/usr/bin/env node
/**
 * 从开发版文件生成模板版文件
 * 用法: node scripts/sync-template.js <template-name>
 * 例如: node scripts/sync-template.js dashboard
 */

const fs = require('fs');
const path = require('path');

const templateName = process.argv[2];
if (!templateName) {
    console.error('请指定模板名称，例如: node scripts/sync-template.js dashboard');
    process.exit(1);
}

const templateDir = path.join(__dirname, '..', 'template-projects', templateName);
if (!fs.existsSync(templateDir)) {
    console.error(`模板目录不存在: ${templateDir}`);
    process.exit(1);
}

// 需要同步的文件
const filesToSync = [
    'project.json',
    'ui/main/*.hml',
    'README.md'
];

// 替换规则
const replacements = {
    // 从开发版到模板版的替换
    [templateName.charAt(0).toUpperCase() + templateName.slice(1) + 'Template']: '{{PROJECT_NAME}}',
    [`com.honeygui.${templateName}`]: '{{APP_ID}}',
    '/home/howie_wang/.HoneyGUI-SDK': '{{SDK_PATH}}',
    '2025-12-11': '{{CREATED_TIME}}'
};

function syncFile(devFile, templateFile) {
    if (!fs.existsSync(devFile)) {
        console.log(`跳过不存在的文件: ${devFile}`);
        return;
    }

    let content = fs.readFileSync(devFile, 'utf8');
    
    // 执行替换
    for (const [from, to] of Object.entries(replacements)) {
        content = content.replace(new RegExp(from, 'g'), to);
    }
    
    fs.writeFileSync(templateFile, content, 'utf8');
    console.log(`✓ 已同步: ${path.basename(devFile)} -> ${path.basename(templateFile)}`);
}

// 同步 project.json
syncFile(
    path.join(templateDir, 'project.json'),
    path.join(templateDir, 'project.template.json')
);

// 同步 HML 文件
const hmlDir = path.join(templateDir, 'ui', 'main');
if (fs.existsSync(hmlDir)) {
    const hmlFiles = fs.readdirSync(hmlDir).filter(f => f.endsWith('.hml') && !f.includes('.template.'));
    hmlFiles.forEach(file => {
        const devFile = path.join(hmlDir, file);
        const templateFile = path.join(hmlDir, file.replace('.hml', '.template.hml'));
        syncFile(devFile, templateFile);
    });
}

// 同步 README.md
const readmePath = path.join(templateDir, 'README.md');
if (fs.existsSync(readmePath)) {
    syncFile(readmePath, path.join(templateDir, 'README.template.md'));
}

console.log('\n同步完成！');
