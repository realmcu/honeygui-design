# Screen 分辨率动态设置 - 修复总结

## Bug 描述

**问题**: Screen 容器的大小硬编码为 1024x768，而不是根据项目配置的实际分辨率动态设置。

**影响**:
- 项目配置为 480x272，但 Screen 显示为 1024x768
- 拖放的组件位置计算基于错误的分辨率
- 生成的代码在实际设备上布局错乱

## 修复方案

### 1. 修改 createDefaultScreen 函数

**文件**: `src/webview/store.ts` (第60-93行)

**修改前**:
```typescript
const createDefaultScreen = (): Component => {
  return {
    position: {
      x: 50,
      y: 50,
      width: 1024,  // ❌ 硬编码
      height: 768   // ❌ 硬编码
    }
  };
};
```

**修改后**:
```typescript
const createDefaultScreen = (resolution?: string): Component => {
  // 解析分辨率，默认 1024x768
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
    position: {
      x: 50,
      y: 50,
      width: size.width,    // ✓ 根据配置动态设置
      height: size.height   // ✓ 根据配置动态设置
    }
  };
};
```

### 2. 添加项目配置支持到 Store

**文件**: `src/webview/types.ts` (第102行)

```typescript
export interface DesignerState {
  // ...
  projectConfig?: any; // Project configuration (resolution, etc.)
}
```

**文件**: `src/webview/store.ts` (第56-59, 97-98, 319-347行)

```typescript
export interface DesignerStore extends DesignerState {
  // ...
  // Project configuration
  setProjectConfig: (config: any) => void;
  initializeWithProjectConfig: (config: any) => void;
}

export const useDesignerStore = create<DesignerStore>((set, get) => ({
  // State
  components: [createDefaultScreen()],
  projectConfig: null as any, // 项目配置（分辨率等）

  // Actions
  // ...

  // Project configuration
  setProjectConfig: (config) => {
    set({ projectConfig: config });
    // 根据项目分辨率重新创建 screen
    if (config?.resolution) {
      const components = [createDefaultScreen(config.resolution)];
      set({ components });
    }
  },

  // Initialize with project config
  initializeWithProjectConfig: (config) => {
    const resolution = config?.resolution;
    const components = [createDefaultScreen(resolution)];
    set({
      components,
      projectConfig: config,
      selectedComponent: null,
      hoveredComponent: null,
      draggedComponent: null,
      zoom: 1,
      gridSize: 8,
      snapToGrid: true,
      canvasOffset: { x: 0, y: 0 },
      canvasSize: { width: 1024, height: 768 },
      canvasBackgroundColor: '#f0f0f0',
      editingMode: 'select',
    });
  },
}));
```

### 3. 在 App.tsx 中处理项目配置

**文件**: `src/webview/App.tsx` (第21, 56-65行)

```typescript
const App: React.FC = () => {
  const {
    setVSCodeAPI,
    setComponents,
    selectComponent,
    addComponent,
    initializeWithProjectConfig, // ✓ 添加此方法
  } = useDesignerStore();

  // ...

  useEffect(() => {
    // ...
    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.command) {
        case 'loadHml':
          if (message.components) {
            setComponents(message.components);
          }
          if (message.projectConfig) {
            // ✓ 初始化项目配置（包括分辨率）
            initializeWithProjectConfig(message.projectConfig);
          }
          break;
        // ...
      }
    });
  }, [setVSCodeAPI, setComponents, initializeWithProjectConfig]);
```

### 4. DesignerPanel 传递项目配置

**文件**: `src/designer/DesignerPanel.ts` (第452-457行)

DesignerPanel 已经传递了 projectConfig，无需修改：

```typescript
this._panel.webview.postMessage({
  command: 'loadHml',
  content: hmlContent,
  document: document,
  projectConfig: projectConfig  // ✓ 已传递
});
```

## 使用流程

### 场景 1: 新项目 (480x272)

```json
// project.json
{
  "resolution": "480X272"
}
```

**流程**:
```typescript
1. DesignerPanel 读取 project.json
2. 发送 projectConfig 到 Webview
3. initializeWithProjectConfig({ resolution: "480X272" })
4. createDefaultScreen("480X272")
5. Screen 大小: 480x272 ✓
```

### 场景 2: 新项目 (800x480)

```json
// project.json
{
  "resolution": "800X480"
}
```

**流程**: Screen 大小: 800x480 ✓

### 场景 3: 打开现有 HML 文件

```typescript
// HML 文件可能不包含 project.json
// 默认使用 1024x768，或从当前工作区查找 project.json
```

## 测试验证

### 测试 1: 480x272 分辨率

```bash
# 创建测试项目
cd /home/howie_wang/workspace
mkdir TestProject_480x272
cd TestProject_480x272
cat > project.json <<EOF
{
  "name": "TestProject",
  "resolution": "480X272"
}
EOF

# 在 VS Code 中打开
# 按 F5 启动扩展
# 运行: "HoneyGUI: Open Designer"
```

**预期结果**:
- Screen 容器大小: 480x272
- 画布显示区域匹配分辨率
- 拖放组件位置正确

### 测试 2: 800x480 分辨率

```bash
# 同样的步骤，但修改 project.json
{
  "resolution": "800X480"
}
```

**预期结果**:
- Screen 容器大小: 800x480

### 测试 3: 1024x600 分辨率

```bash
# 同样的步骤，但修改 project.json
{
  "resolution": "1024X600"
}
```

**预期结果**:
- Screen 容器大小: 1024x600

## 坐标系统说明

```
画布 (Canvas: 1200x800, 灰色背景)
│
├── Screen #0 (项目分辨率大小)
│   │ 位置: (50, 50) 相对于画布左上角
│   │ 大小: 根据 project.json resolution
│   │
│   ├── UI 组件 (位置相对于 Screen)
│   │   │ Button 在 (100, 100)
│   │   │    = Screen 左上角 (50,50) + 相对位置 (100,100)
│   │   │    = 画布上的绝对位置 (150, 150)
│   │
│   └── View 子容器
│       │ 位置相对于 Screen
│       └── 孙组件 (位置相对于 View)
│
└── 独立 View 容器 (位置相对于画布)
```

**关键规则**:
- **Screen/View/Window** 等容器组件：位置相对于画布
- **UI 组件** (Button/Label/Input)：位置相对于父容器
- 多层嵌套时，位置逐级相对计算

## 修改的文件清单

1. ✅ `src/webview/types.ts` - 添加 projectConfig 字段
2. ✅ `src/webview/store.ts` - 动态创建 screen，根据分辨率
3. ✅ `src/webview/App.tsx` - 处理项目配置消息

**未修改的文件**:
- `src/designer/DesignerPanel.ts` - 已经正确传递 projectConfig

## 构建和部署

### 编译和构建

```bash
# 1. 编译扩展代码
npm run compile

# 2. 构建 Webview
npm run build:webview

# 3. 验证输出
ls -lh out/designer/webview/
```

### 测试步骤

```bash
# 1. 在 VS Code 中按 F5 启动扩展调试

# 2. 创建测试项目
mkdir -p /tmp/test_480x272
cd /tmp/test_480x272
echo '{"resolution":"480X272"}' > project.json

# 3. 在 VS Code 中打开项目
# 4. 运行命令: "HoneyGUI: Open Designer"

# 5. 验证:
#    - Screen 容器大小应为 480x272
#    - 拖放组件正常
#    - 属性面板显示正确分辨率
```

## 性能影响

**无性能影响**，纯逻辑修改

## 后续优化建议

### 短期
- [ ] 在属性面板显示当前分辨率
- [ ] 添加分辨率切换功能（无需重新打开设计器）
- [ ] 支持多种预设分辨率（下拉框选择）

### 中期
- [ ] 响应式设计预览（不同分辨率切换）
- [ ] 自动缩放以适应画布
- [ ] 分辨率不匹配警告

### 长期
- [ ] 支持多分辨率适配（一套设计，多设备）
- [ ] 分辨率相关的约束和验证
- [ ] 设备模拟器（显示实际设备外观）

## Bug 修复总结

**状态**: ✅ 已完成

**修复日期**: 2025-11-17

**影响范围**: 所有新项目创建和 HML 文件加载

**向后兼容性**: ✓ 如果找不到 projectConfig，使用默认值 1024x768

---

**关键改进**: Screen 大小现在根据项目配置动态设置，确保设计时看到的与实际设备一致！
