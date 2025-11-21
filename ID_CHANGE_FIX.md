# HML组件ID变更问题修复

## 问题描述

**现象**:
```xml
<!-- 初始加载 -->
<hg_screen id="mainScreen" x="50" y="50" width="480" height="272" />

<!-- 保存后变成 -->
<hg_screen id="hg_screen_1763715650463" x="50" y="50" width="800" height="480" />
```

组件ID从 `mainScreen` 变成了 `hg_screen_1763715650463`

---

## 根本原因

### 1. ✅ 解析器配置正确
```typescript
// fast-xml-parser配置
{
  ignoreAttributes: false,
  attributeNamePrefix: '',  // 属性直接放在元素对象上
  ...
}
```

测试验证：
```javascript
// 输入: <hg_screen id="mainScreen" x="50" y="50" />
// 输出: { id: "mainScreen", x: 50, y: 50 }
```

### 2. ✅ 序列化器逻辑正确
```typescript
// HmlSerializer._serializeComponent
let attributesStr = ' id="' + component.id + '"';  // 正确写入ID
```

### 3. ⚠️ 可能的问题点

#### A. 父子关系不一致
**问题**: 子组件有 `parent` 属性，但父组件的 `children` 数组为空

**后果**: 序列化时子组件不会被嵌套，可能被错误处理

**修复**: 在 `HmlController.prepareComponentsForFrontend` 中添加一致性检查

```typescript
private _ensureParentChildConsistency(components: Component[]): void {
    const componentMap = new Map<string, Component>();
    components.forEach(c => componentMap.set(c.id, c));
    
    components.forEach(component => {
        if (component.parent) {
            const parent = componentMap.get(component.parent);
            if (parent) {
                if (!parent.children) {
                    parent.children = [];
                }
                if (!parent.children.includes(component.id)) {
                    parent.children.push(component.id);
                }
            }
        }
    });
}
```

#### B. 前端组件创建时生成新ID
**位置**: `src/webview/store.ts:84`

```typescript
const createDefaultScreen = (resolution?: string): Component => {
  const generateSimpleId = (): string => `hg_screen_${Date.now()}`;  // ❌ 总是生成新ID
  return {
    id: generateSimpleId(),  // 问题所在
    ...
  };
};
```

**问题**: 如果前端在某个时机调用了 `createDefaultScreen`，会生成新ID

**检查点**: 
- `initializeWithProjectConfig` - ✅ 不创建默认screen
- `setProjectConfig` - ✅ 不创建默认screen
- 其他地方是否调用？

---

## 已实施的修复

### 修复1: 父子关系一致性检查 ✅

**文件**: `src/hml/HmlController.ts`

**修改**:
```typescript
public prepareComponentsForFrontend(document: HmlDocument): Component[] {
    const components = document.view.components || [];
    
    // 确保父子关系一致性
    this._ensureParentChildConsistency(components);
    
    return components;
}
```

**效果**: 确保父组件的 `children` 数组包含所有子组件ID

---

## 调试步骤

### 1. 添加详细日志

在 `HmlController.ts` 中添加：

```typescript
public prepareComponentsForFrontend(document: HmlDocument): Component[] {
    const components = document.view.components || [];
    
    // 调试日志
    console.log('[HmlController] prepareComponentsForFrontend - 组件数量:', components.length);
    components.forEach(c => {
        console.log(`  - ${c.type}(id=${c.id}, parent=${c.parent}, children=${c.children?.length || 0})`);
    });
    
    this._ensureParentChildConsistency(components);
    
    // 修复后的状态
    console.log('[HmlController] 修复后的组件状态:');
    components.forEach(c => {
        console.log(`  - ${c.type}(id=${c.id}, parent=${c.parent}, children=${c.children?.length || 0})`);
    });
    
    return components;
}
```

### 2. 检查前端接收

在 `App.tsx` 中添加：

```typescript
case 'loadHml':
  console.log('[Webview] 接收到的组件:');
  message.components?.forEach((c: any) => {
    console.log(`  - ${c.type}(id=${c.id}, parent=${c.parent}, children=${c.children?.length || 0})`);
  });
  setComponents(message.components);
  break;
```

### 3. 检查保存前状态

在 `HmlController.ts` 的 `save` 方法中添加：

```typescript
public async save(document: HmlDocument, filePath: string): Promise<void> {
    console.log('[HmlController] 保存前的组件状态:');
    document.view.components?.forEach(c => {
        console.log(`  - ${c.type}(id=${c.id}, parent=${c.parent}, children=${c.children?.length || 0})`);
    });
    
    // ... 原有保存逻辑
}
```

---

## 验证方法

### 测试用例1: 基本ID保持

1. 创建新项目，生成 `main.hml`:
```xml
<hg_screen id="mainScreen" x="50" y="50" width="480" height="272" />
```

2. 打开设计器，不做任何修改

3. 保存文件

4. **预期**: ID保持为 `mainScreen`

5. **实际**: 检查保存后的文件

### 测试用例2: 添加子组件

1. 打开 `main.hml`

2. 添加一个按钮到 screen 中

3. 保存文件

4. **预期**:
```xml
<hg_screen id="mainScreen" ...>
    <hg_button id="hg_button_xxx" ... />
</hg_screen>
```

5. **实际**: 检查保存后的文件

### 测试用例3: 重新打开

1. 关闭设计器

2. 重新打开 `main.hml`

3. **预期**: 所有组件ID保持不变

4. **实际**: 检查日志中的组件ID

---

## 可能的其他原因

### 1. 解析时属性提取错误

**检查**: `HmlParser._parseComponent` 中的ID提取逻辑

```typescript
const attributes = element._attributes || element;
const componentId = attributes.id || element.id || this._generateId(tagName);
```

**问题**: 如果 `attributes.id` 和 `element.id` 都不存在，会生成新ID

**解决**: 添加日志确认ID是否正确提取

```typescript
console.log('[HmlParser] 解析组件:', tagName);
console.log('  element:', JSON.stringify(element));
console.log('  attributes:', JSON.stringify(attributes));
console.log('  提取的ID:', componentId);
```

### 2. 前端修改了组件ID

**检查**: `store.ts` 中的 `addComponent`, `updateComponent` 等方法

**可能**: 某个操作触发了组件重新创建

### 3. 序列化前组件被修改

**检查**: `HmlController.save` 调用链

```
save() 
  -> _convertForSerialization() 
  -> HmlSerializer.serialize()
```

**可能**: 在转换过程中ID被修改

---

## 临时解决方案

如果问题持续，可以在序列化前强制保留原始ID：

```typescript
// HmlController.ts
private _preserveOriginalIds(components: Component[]): void {
    if (!this._originalIds) {
        this._originalIds = new Map();
        components.forEach(c => {
            this._originalIds.set(c.id, c.id);
        });
    } else {
        components.forEach(c => {
            const originalId = this._originalIds.get(c.id);
            if (originalId) {
                c.id = originalId;
            }
        });
    }
}
```

---

## 下一步

1. ✅ 已添加父子关系一致性检查
2. ✅ 重新编译代码
3. ⏳ 测试验证
4. ⏳ 如果问题持续，添加详细日志
5. ⏳ 根据日志定位具体原因

---

**更新时间**: 2025-11-21 17:04  
**状态**: 已实施修复，等待测试验证
