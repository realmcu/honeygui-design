# 代码生成模块架构说明

## 目录结构

```
src/codegen/
├── ICodeGenerator.ts              # 代码生成器接口（公共）
├── CodeGeneratorFactory.ts        # 代码生成器工厂（公共）
├── EntryFileGenerator.ts          # 入口文件生成器（公共）
│
└── honeygui/                      # HoneyGUI 代码生成
    ├── HoneyGuiCCodeGenerator.ts  # 主协调器（核心）
    ├── HoneyGuiApiMapper.ts       # API 映射（配置）
    ├── index.ts                   # 模块导出
    ├── utils.ts                   # 工具函数
    │
    ├── components/                # 组件代码生成（按组件类型拆分）
    │   ├── ComponentGenerator.ts  # 接口定义
    │   ├── index.ts               # 工厂 + 导出
    │   ├── DefaultGenerator.ts    # 默认/通用组件
    │   ├── ViewGenerator.ts       # hg_view, hg_window
    │   ├── ButtonGenerator.ts     # hg_button (TODO)
    │   ├── LabelGenerator.ts      # hg_label
    │   ├── ImageGenerator.ts      # hg_image
    │   ├── InputGenerator.ts      # hg_input (TODO)
    │   ├── CheckboxGenerator.ts   # hg_checkbox (TODO)
    │   ├── RadioGenerator.ts      # hg_radio (TODO)
    │   ├── CanvasGenerator.ts     # hg_canvas (TODO)
    │   ├── ListGenerator.ts       # hg_list (TODO)
    │   ├── VideoGenerator.ts      # hg_video
    │   ├── Model3DGenerator.ts    # hg_3d
    │   ├── LottieGenerator.ts     # hg_lottie (TODO)
    │   ├── ArcGenerator.ts        # hg_arc (TODO)
    │   ├── CircleGenerator.ts     # hg_circle (TODO)
    │   ├── RectGenerator.ts       # hg_rect (TODO)
    │   └── SvgGenerator.ts        # hg_svg (TODO)
    │
    ├── events/                    # 事件代码生成（按组件类型拆分）
    │   ├── EventCodeGenerator.ts  # 接口定义 + 事件常量
    │   ├── index.ts               # 工厂 + 导出
    │   ├── DefaultEventGenerator.ts  # 默认事件处理
    │   ├── ViewEventGenerator.ts     # hg_view 事件
    │   ├── ImageEventGenerator.ts    # hg_image 事件
    │   ├── ButtonEventGenerator.ts   # hg_button 事件
    │   ├── LabelEventGenerator.ts    # hg_label 事件
    │   ├── VideoEventGenerator.ts    # hg_video 事件 (TODO)
    │   └── ListEventGenerator.ts     # hg_list 事件 (TODO)
    │
    └── files/                     # 文件生成（待拆分）
        ├── UiFileGenerator.ts     # ui.h/c 生成
        ├── CallbackFileGenerator.ts  # callbacks.h/c 生成
        └── UserFileGenerator.ts   # user.h/c 生成
```

## 开发规范

### 1. 添加新组件支持

**步骤**：
1. 在 `components/` 创建 `XxxGenerator.ts`
2. 在 `events/` 创建 `XxxEventGenerator.ts`（如需特殊事件处理）
3. 在对应的 `index.ts` 工厂中注册

**示例**：添加 `hg_button` 支持
```typescript
// components/ButtonGenerator.ts
export class ButtonGenerator implements ComponentCodeGenerator {
  generateCreation(...) { ... }
  generatePropertySetters(...) { ... }
}

// components/index.ts
this.generators.set('hg_button', new ButtonGenerator());
```

### 2. 修改现有组件

- **只修改对应的 Generator 文件**
- **不要修改 HoneyGuiCCodeGenerator.ts**（除非是架构级改动）

### 3. 文件职责划分

| 文件 | 职责 | 修改频率 |
|------|------|---------|
| `HoneyGuiCCodeGenerator.ts` | 协调各模块，文件写入 | 低（架构级） |
| `HoneyGuiApiMapper.ts` | API 映射配置 | 中（新增组件） |
| `components/*.ts` | 组件创建代码 | 高（独立修改） |
| `events/*.ts` | 事件处理代码 | 高（独立修改） |

### 4. 避免冲突的原则

1. **单一职责**：每个文件只负责一个组件或一类功能
2. **接口隔离**：通过接口定义交互，减少直接依赖
3. **工厂模式**：新增组件只需注册，不修改核心代码
4. **独立测试**：每个 Generator 可独立测试

## 接口定义

### ComponentCodeGenerator（组件代码生成器）

```typescript
interface ComponentCodeGenerator {
  // 生成组件创建代码
  generateCreation(component, indent, context): string;
  
  // 生成属性设置代码
  generatePropertySetters(component, indent, context): string;
}
```

### EventCodeGenerator（事件代码生成器）

```typescript
interface EventCodeGenerator {
  // 生成事件绑定代码
  generateEventBindings(component, indent, componentMap): string;
  
  // 收集需要生成的回调函数名
  collectCallbackFunctions(component): string[];
  
  // 获取 switchView 回调实现（可选）
  getSwitchViewCallbackImpl?(component, componentMap): string[];
}
```

### GeneratorContext（生成器上下文）

```typescript
interface GeneratorContext {
  componentMap: Map<string, Component>;
  getParentRef(component): string;
}
```

## 事件类型映射

在 `events/EventCodeGenerator.ts` 中定义：

```typescript
export const EVENT_TYPE_TO_GUI_EVENT = {
  'onClick': 'GUI_EVENT_TOUCH_CLICKED',
  'onLongPress': 'GUI_EVENT_TOUCH_LONG',
  'onTouchDown': 'GUI_EVENT_TOUCH_PRESSED',
  'onTouchUp': 'GUI_EVENT_TOUCH_RELEASED',
  'onSwipeLeft': 'GUI_EVENT_TOUCH_MOVE_LEFT',
  'onSwipeRight': 'GUI_EVENT_TOUCH_MOVE_RIGHT',
  'onSwipeUp': 'GUI_EVENT_TOUCH_MOVE_UP',
  'onSwipeDown': 'GUI_EVENT_TOUCH_MOVE_DOWN',
};
```

## 代码生成流程

```
HoneyGuiCCodeGenerator.generate()
    │
    ├─► generateUiHeader()
    ├─► generateUiImplementation()
    │       │
    │       └─► generateComponentTree()
    │               │
    │               ├─► ComponentGeneratorFactory.getGenerator(type)
    │               │       └─► generator.generateCreation()
    │               │       └─► generator.generatePropertySetters()
    │               │
    │               └─► EventGeneratorFactory.getGenerator(type)
    │                       └─► generator.generateEventBindings()
    │
    ├─► generateCallbackHeader()
    │       └─► collectCallbackFunctions()
    │
    └─► generateCallbackImplementation()
            ├─► collectSwitchViewCallbackImpls()
            └─► collectCallbackFunctions()
```

## 注意事项

1. **不要在 HoneyGuiCCodeGenerator.ts 中添加组件特定逻辑**
2. **新增组件时，优先复用 DefaultGenerator**
3. **事件处理如果与默认行为相同，不需要创建新的 EventGenerator**
4. **修改前先确认影响范围，避免影响其他组件**
