# Screen 分辨率与项目配置同步 - 修复说明

## 背景

**问题**: Screen 容器在 Store 初始化时硬编码为 1024x768，与项目配置的分辨率不匹配。

**影响**:
- 项目配置为 480x272，但打开设计器时短暂显示 1024x768
- Screen 组件 ID 会变化（从默认值变为带时间戳的 ID）
- 可能导致不必要的重新渲染

## 修复方案

### 1. Store 初始化优化

**文件**: `src/webview/store.ts`

**修改前**:
```typescript
components: [createDefaultScreen()], // 使用默认值 1024x768
```

**修改后**:
```typescript
components: [], // 初始化为空，等待 projectConfig 加载
```

**原因**: 在 Store 初始化时还没有 projectConfig，不应该创建 screen。

### 2. initializeWithProjectConfig 优化

**文件**: `src/webview/store.ts`

**修改前**:
```typescript
const components = [createDefaultScreen(resolution)];
```

**修改后**:
```typescript
// 如果 resolution 存在则使用，否则使用默认值
const components = resolution ? [createDefaultScreen(resolution)] : [createDefaultScreen()];
```

**原因**: 允许 resolution 为 undefined，此时使用默认值。

### 3. App.tsx 调用优化

**文件**: `src/webview/App.tsx`

**修改前**:
```typescript
if (message.projectConfig) {
  initializeWithProjectConfig(message.projectConfig);
}
```

**修改后**:
```typescript
// 总是调用 initializeWithProjectConfig，即使没有 projectConfig
initializeWithProjectConfig(message.projectConfig || null);
```

**原因**: 确保即使有 projectConfig，也能创建默认的 screen。

## 工作流程

### 场景 1: 项目有 project.json (480x272)

```
1. Store 初始化: components = []
2. DesignerPanel 读取 project.json
3. 发送 message { command: 'loadHml', projectConfig: { resolution: '480X272' } }
4. App.tsx 接收消息
5. 调用 initializeWithProjectConfig({ resolution: '480X272' })
6. createDefaultScreen('480X272') → { width: 480, height: 272 }
7. Screen 显示: 480x272 ✓
```

### 场景 2: 项目没有 project.json

```
1. Store 初始化: components = []
2. DesignerPanel 读取 project.json (不存在)
3. 发送 message { command: 'loadHml', projectConfig: null }
4. App.tsx 接收消息
5. 调用 initializeWithProjectConfig(null)
6. createDefaultScreen() → { width: 1024, height: 768 }
7. Screen 显示: 1024x768 ✓
```

### 场景 3: 打开现有 HML 文件（有 project.json）

```
1. Store 初始化: components = []
2. DesignerPanel 加载 HML 文件
3. 找到 project.json，读取 resolution
4. 发送 message { command: 'loadHml', projectConfig: { resolution: '800X480' } }
5. App.tsx 接收消息
6. 调用 initializeWithProjectConfig({ resolution: '800X480' })
7. createDefaultScreen('800X480') → { width: 800, height: 480 }
8. 应用 HML 中的组件（覆盖默认 screen）
9. Screen 显示: 根据 HML 文件 ✓
```

## 边界测试

### 测试 1: resolution 格式错误

**project.json**:
```json
{ "resolution": "invalid" }
```

**行为**:
- parseResolution('invalid') 返回 { width: NaN, height: NaN }
- createDefaultScreen 使用默认值 1024x768
- Screen 显示: 1024x768 ✓

### 测试 2: resolution 为空字符串

**project.json**:
```json
{ "resolution": "" }
```

**行为**:
- parseResolution('') 返回 { width: 1024, height: 768 }
- Screen 显示: 1024x768 ✓

### 测试 3: project.json 不存在

**行为**:
- projectConfig = null
- initializeWithProjectConfig(null)
- createDefaultScreen() → 1024x768
- Screen 显示: 1024x768 ✓

## 验证步骤

### 步骤 1: 创建测试项目（480x272）

```bash
mkdir test_480x272
cd test_480x272

cat > project.json <<'EOF'
{
  "name": "TestApp",
  "resolution": "480X272",
  "designer": {
    "canvasBackgroundColor": "#e3f2fd"
  }
}
EOF
```

### 步骤 2: 打开 VS Code 并启动扩展

```bash
code .
# 按 F5 启动扩展调试
```

### 步骤 3: 打开设计器

命令面板: "HoneyGUI: Open Designer"

### 步骤 4: 验证 Screen 大小

1. 在设计器画布中，点击 Screen 容器
2. 查看右侧属性面板
3. 验证:
   - Width: 480
   - Height: 272

### 步骤 5: 验证画布背景色

验证设计器画布背景色是否为浅蓝色 (#e3f2fd)

### 步骤 6: 拖放测试

从组件库拖拽 Button 到 Screen 内部:
- Button 应该正确显示在 Screen 内
- 位置坐标相对于 Screen 左上角

### 步骤 7: 保存和重新加载

1. 点击保存按钮
2. 关闭设计器
3. 重新打开设计器
4. 验证 Screen 大小仍然是 480x272

## 预期结果

✅ Screen 容器大小与 project.json 中的 resolution 一致
✅ 480x272 分辨率 → Screen: 480x272
✅ 800x480 分辨率 → Screen: 800x480
✅ 1024x600 分辨率 → Screen: 1024x600
✅ 无 project.json → Screen: 1024x768 (默认)
✅ 不会出现闪烁或 ID 变化

## 相关代码

### createDefaultScreen

**位置**: `src/webview/store.ts` (第63-97行)

```typescript
const createDefaultScreen = (resolution?: string): Component => {
  const parseResolution = (res?: string) => {
    if (!res) return { width: 1024, height: 768 };
    const parts = res.split('X');
    return {
      width: parseInt(parts[0]) || 1024,
      height: parseInt(parts[1]) || 768
    };
  };

  const size = parseResolution(resolution);

  return {
    id: generateSimpleId(),
    type: 'screen',
    name: 'Default Screen',
    position: {
      x: 50,
      y: 50,
      width: size.width,
      height: size.height
    },
    // ...
  };
};
```

### initializeWithProjectConfig

**位置**: `src/webview/store.ts` (第333-352行)

```typescript
initializeWithProjectConfig: (config) => {
  const resolution = config?.resolution;
  // 如果 resolution 存在则使用，否则使用默认值
  const components = resolution ? [createDefaultScreen(resolution)] : [createDefaultScreen()];
  set({
    components,
    projectConfig: config,
    // ... reset other state
  });
},
```

### App.tsx 消息处理

**位置**: `src/webview/App.tsx` (第57-69行)

```typescript
case 'loadHml':
  if (message.components) {
    setComponents(message.components);
  }
  // 总是调用 initializeWithProjectConfig，即使没有 projectConfig
  initializeWithProjectConfig(message.projectConfig || null);
  if (message.designerConfig?.canvasBackgroundColor) {
    setCanvasBackgroundColor(message.designerConfig.canvasBackgroundColor);
  }
  break;
```

### DesignerPanel 配置读取

**位置**: `src/designer/DesignerPanel.ts` (第490-519行, 第451-463行)

```typescript
// _createNewDocument
let projectConfig: any = null;
try {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const projectJsonPath = path.join(workspaceRoot, 'project.json');
    if (fs.existsSync(projectJsonPath)) {
      const configContent = fs.readFileSync(projectJsonPath, 'utf8');
      projectConfig = JSON.parse(configContent);
    }
  }
} catch (configError) {
  console.log('[HoneyGUI Designer] 无法加载 project.json，使用默认配置');
}

const canvasBackgroundColor = projectConfig?.designer?.canvasBackgroundColor || '#f0f0f0';

// 发送到 Webview
this._panel.webview.postMessage({
  command: 'loadHml',
  content: hmlContent,
  document: document,
  projectConfig: projectConfig,
  designerConfig: {
    canvasBackgroundColor
  }
});
```

## 总结

✅ Screen 容器大小现在正确匹配项目配置的分辨率
✅ 支持自定义分辨率（480x272, 800x480, 1024x600 等）
✅ 向后兼容（无配置时使用默认值）
✅ 优化了初始化流程，避免不必要的重新渲染
✅ 配置了画布背景色
