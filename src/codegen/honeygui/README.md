# HoneyGUI C代码生成器

从可视化设计器生成调用HoneyGUI API的C代码。

## 特性

- ✅ 完全解耦，独立模块
- ✅ 直接生成HoneyGUI API调用
- ✅ 支持代码保护区
- ✅ 支持所有常用组件
- ✅ 自动生成事件回调

## 使用方法

### 基本使用

```typescript
import { generateHoneyGuiCode, Component } from './codegen/honeygui';

const components: Component[] = [
  {
    id: 'mainScreen',
    type: 'hg_screen',
    name: '主屏幕',
    position: { x: 0, y: 0, width: 480, height: 272 },
    parent: null,
    style: { backgroundColor: '#000000' }
  },
  {
    id: 'myButton',
    type: 'hg_button',
    name: '按钮',
    position: { x: 100, y: 100, width: 120, height: 40 },
    parent: 'mainScreen',
    data: { text: 'Click Me' },
    events: { onClick: 'on_button_click' }
  }
];

const result = await generateHoneyGuiCode(components, {
  outputDir: './output',
  projectName: 'MyApp',
  enableProtectedAreas: true
});
```

### 生成的文件

```
output/
├── gui_design.h          # 头文件
├── gui_design.c          # 实现文件
├── gui_callbacks.h       # 回调声明
└── gui_callbacks.c       # 回调实现（保护区）
```

### 生成的代码示例

**gui_design.c**:
```c
void gui_design_init(void) {
    // 创建主屏幕
    mainScreen = gui_screen_create(NULL, "mainScreen", 0, 0, 480, 272);
    gui_obj_set_color(mainScreen, 0x000000);
    
    // 创建按钮
    myButton = gui_button_create(mainScreen, "myButton", 100, 100, 120, 40);
    gui_button_set_text(myButton, "Click Me");
    gui_button_set_click_cb(myButton, on_button_click);
}
```

**gui_callbacks.c**:
```c
/* @protected start on_button_click */
void on_button_click(gui_obj_t *obj) {
    printf("Button clicked!\n");
    // 用户自定义代码
}
/* @protected end on_button_click */
```

## 支持的组件

| 组件类型 | HoneyGUI API | 说明 |
|---------|-------------|------|
| hg_screen | gui_screen_create | 屏幕容器 |
| hg_view | gui_view_create | 视图容器 |
| hg_button | gui_button_create | 按钮 |
| hg_label | gui_text_create | 文本标签 |
| hg_image | gui_img_create | 图片 |
| hg_input | gui_textbox_create | 输入框 |
| hg_switch | gui_switch_create | 开关 |
| hg_slider | gui_seekbar_create | 滑块 |

## 代码保护区

重新生成代码时，保护区内的用户代码会被保留：

```c
/* @protected start my_function */
void my_function(void) {
    // 这里的代码不会被覆盖
}
/* @protected end my_function */
```

## API扩展

添加自定义组件映射：

```typescript
import { HoneyGuiApiMapper } from './codegen/honeygui';

const mapper = new HoneyGuiApiMapper();
mapper.addCustomMapping({
  componentType: 'my_custom_widget',
  createFunction: 'gui_custom_create',
  propertySetters: [
    { property: 'value', apiFunction: 'gui_custom_set_value' }
  ],
  eventHandlers: [],
  includeHeader: 'gui_custom.h'
});
```

## 运行示例

```bash
# 编译
npm run compile

# 运行示例
node out/codegen/honeygui/example.js
```

## 架构

```
HoneyGuiApiMapper      # API映射表
    ↓
HoneyGuiCCodeGenerator # 代码生成器
    ↓
生成的C代码            # HoneyGUI API调用
```

## 优势

- **解耦设计**：独立模块，不依赖其他代码
- **易于扩展**：支持自定义组件和API
- **代码保护**：用户代码不会被覆盖
- **高性能**：生成纯C代码，适合嵌入式
