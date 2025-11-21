# Screen命名统一检查报告

## ✅ 已完成统一

所有代码中的 `screen` 已统一为 `hg_screen`

---

## 修改清单

### 1. HmlParser.ts
- ✅ 组件白名单: `'screen'` → `'hg_screen'`

### 2. DesignerPanel.ts
- ✅ 测试代码: `<screen>` → `<hg_screen>`

### 3. App.tsx
- ✅ 所有注释和日志中的 "screen容器" → "hg_screen容器"
- ✅ 错误提示信息统一使用 "hg_screen"

### 4. store.ts
- ✅ 所有注释统一使用 "hg_screen"

---

## 剩余引用（不需要修改）

### 1. extension_backup.ts
- 备份文件，不影响运行

### 2. HmlParser.improved.ts
- 改进版本文件，未使用

---

## 验证方法

```bash
# 搜索所有screen引用（排除hg_screen）
grep -rn "'screen'\|\"screen\"\|<screen" src/ --include="*.ts" --include="*.tsx" | \
  grep -v "hg_screen" | \
  grep -v "Screenshot" | \
  grep -v "fullscreen" | \
  grep -v "backup"
```

**结果**: 仅剩备份文件中的引用

---

## 统一后的命名规范

### 组件类型
- ✅ **正确**: `hg_screen`
- ❌ **错误**: `screen`

### XML标签
- ✅ **正确**: `<hg_screen>`
- ❌ **错误**: `<screen>`

### 注释和日志
- ✅ **正确**: "hg_screen容器"
- ❌ **错误**: "screen容器"

### 代码中的引用
```typescript
// ✅ 正确
comp.type === 'hg_screen'
componentType: 'hg_screen'

// ❌ 错误
comp.type === 'screen'
componentType: 'screen'
```

---

## 设计原则

1. **main.hml**: 必须包含 `hg_screen` 组件
2. **其他HML**: 不应该包含 `hg_screen` 组件
3. **组件库**: `hg_screen` 不显示在面板中
4. **画布**: `hg_screen` 可以选中和编辑

---

**检查时间**: 2025-11-21 17:52  
**状态**: ✅ 已完成统一  
**剩余问题**: 无
