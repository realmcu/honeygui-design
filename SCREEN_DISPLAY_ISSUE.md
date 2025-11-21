# Screen显示问题诊断

## 问题1: 初始不显示hg_screen

### 可能原因
1. **组件未加载到store** - loadHml消息处理失败
2. **React渲染延迟** - 组件加载了但UI未更新
3. **CSS问题** - screen被隐藏或透明

### 诊断步骤

**请按F5重启，然后复制以下日志**:

1. 打开HML文件时的日志：
```
========== [Webview App] loadHml 消息处理开始 ==========
[Webview App] 接收到的组件数量: ?
[Webview App] 接收到的组件详情: ?
[Webview App] 验证：当前store中的组件数量: ?
```

2. 如果组件数量为0，说明**loadHml消息未正确处理**
3. 如果组件数量>0但不显示，说明**渲染问题**

---

## 问题2: 尺寸800x480而不是项目配置

### 已修复

**位置**: `src/webview/App.tsx:handleCanvasDrop`

**修改**:
```typescript
// 优先使用canvasSize（已经解析过的），其次使用projectConfig.resolution
let width = canvasSize?.width || 800;
let height = canvasSize?.height || 480;

if (projectConfig?.resolution) {
  const parts = projectConfig.resolution.split('X');
  if (parts.length === 2) {
    width = parseInt(parts[0]) || width;
    height = parseInt(parts[1]) || height;
  }
}

console.log(`[拖放] 最终使用分辨率: ${width}x${height}`);
```

**日志验证**:
拖拽组件时查看日志：
```
[拖放] projectConfig: {...}
[拖放] canvasSize: {width: 480, height: 272}
[拖放] 最终使用分辨率: 480x272
```

---

## 测试步骤

### 测试1: 验证初始加载

1. 按F5重启调试
2. 打开 `NewProject/ui/main/main.hml`
3. **查看日志**，复制给我：
   - loadHml消息处理日志
   - 组件数量
   - 组件详情

### 测试2: 验证尺寸

1. 删除所有组件（如果有）
2. 拖拽一个按钮到画布
3. **查看日志**：
   - projectConfig
   - canvasSize
   - 最终使用分辨率

4. 保存后检查HML文件中screen的尺寸

---

## 预期结果

### 正常情况

**初始加载**:
```
[Webview App] 接收到的组件数量: 1
[Webview App] 接收到的组件详情: hg_screen(id=mainScreen)
[Webview App] 验证：当前store中的组件数量: 1
```

**拖拽组件**:
```
[拖放] 查找screen结果: 找到(id=mainScreen)
[拖放] 最终使用分辨率: 480x272
```

**保存后的HML**:
```xml
<hg_screen id="mainScreen" x="50" y="50" width="480" height="272" backgroundColor="#000000">
    <hg_button ... />
</hg_screen>
```

---

## 如果问题持续

### 问题1持续: screen不显示

**临时方案**: 拖拽任意组件，会触发screen创建并显示

**根本解决**: 需要查看完整日志定位问题

### 问题2持续: 尺寸错误

**检查**:
1. `project.json` 中的 `resolution` 字段
2. loadHml消息中的 `projectConfig`
3. store中的 `canvasSize`

**可能原因**:
- project.json格式错误
- loadHml消息未包含projectConfig
- canvasSize未正确设置

---

**请重新测试并复制日志给我！**
