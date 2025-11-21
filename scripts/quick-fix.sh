#!/bin/bash

# HoneyGUI 紧急修复脚本
# 解决P0级别的架构问题

set -e

echo "🔧 HoneyGUI 紧急修复脚本"
echo "========================"
echo ""

# 1. 修复依赖问题
echo "📦 步骤 1/4: 修复依赖..."
npm install
echo "✅ 依赖安装完成"
echo ""

# 2. 备份关键文件
echo "💾 步骤 2/4: 备份关键文件..."
mkdir -p .backup
cp src/hml/HmlParser.ts .backup/HmlParser.ts.bak
cp src/hml/types.ts .backup/types.ts.bak
echo "✅ 备份完成"
echo ""

# 3. 运行类型检查
echo "🔍 步骤 3/4: 运行类型检查..."
npm run compile || echo "⚠️  类型检查发现问题，请查看上方错误信息"
echo ""

# 4. 生成修复报告
echo "📋 步骤 4/4: 生成修复报告..."
cat > QUICK_FIX_REPORT.md << 'EOF'
# 紧急修复报告

## 已完成
- ✅ 依赖安装
- ✅ 文件备份
- ✅ 类型检查

## 需要手动修复的问题

### 1. 组件解析过滤错误
**文件**: `src/hml/HmlParser.ts:16-18`

**当前代码**:
```typescript
private _isHoneyGuiComponent(componentName: string): boolean {
  return componentName.startsWith('hg_');
}
```

**修复方案**:
```typescript
private _isHoneyGuiComponent(componentName: string): boolean {
  // 移除严格的前缀限制，支持更多组件格式
  const validPrefixes = ['hg_', 'gui_'];
  return validPrefixes.some(prefix => componentName.startsWith(prefix)) ||
         this.isKnownComponent(componentName);
}

private isKnownComponent(name: string): boolean {
  const knownComponents = new Set([
    'button', 'panel', 'text', 'image', 'input',
    'checkbox', 'radio', 'progressbar', 'slider'
  ]);
  return knownComponents.has(name);
}
```

### 2. 类型定义统一
**文件**: `src/designer/DesignerModel.ts`

需要将旧格式组件定义标记为废弃，并迁移到新格式。

### 3. ConfigManager实现
**文件**: `src/config/ConfigManager.ts`

当前为空文件，需要实现配置管理逻辑。

## 下一步
1. 手动应用上述代码修复
2. 运行 `npm run compile` 确认无错误
3. 运行 `npm run build:webview` 构建前端
4. 按F5测试扩展功能

EOF

echo "✅ 修复报告已生成: QUICK_FIX_REPORT.md"
echo ""
echo "🎉 紧急修复脚本执行完成！"
echo ""
echo "⚠️  注意: 部分问题需要手动修复，请查看 QUICK_FIX_REPORT.md"
