# HoneyGUI C代码生成架构设计

## 概述

从HML设计器生成调用HoneyGUI API的C代码，实现可视化设计到嵌入式GUI代码的转换。

## 架构设计

### 1. 代码生成流程

```
HML文件 → 解析器 → 组件树 → C代码生成器 → HoneyGUI API调用代码
```

### 2. 核心模块

#### 2.1 代码生成规则

**文件命名规则**：
- 使用HML文件名作为生成文件的基础名称
- 例如：`main.hml` → `main.h`, `main.c`, `main_callbacks.h`, `main_callbacks.c`

**目录映射规则**：
- HML文件在 `ui/xxx/` 目录 → C代码生成到 `src/xxx/` 目录
- 每个HML文件有自己的二级目录
- 例如：`ui/main/main.hml` → `src/main/main.c`
- 例如：`ui/settings/settings.hml` → `src/settings/settings.c`
- 自动创建不存在的子目录

**多文件处理**：
- 每个HML文件独立生成，互不影响
- 支持项目中有多个HML文件

**生成文件结构**：
```
project/
├── ui/
│   ├── main/
│   │   └── main.hml
│   └── settings/
│       └── settings.hml
└── src/
    ├── main/
    │   ├── main.h                    # 主界面头文件
    │   ├── main.c                    # 主界面实现
    │   ├── main_callbacks.h          # 主界面回调声明
    │   └── main_callbacks.c          # 主界面回调实现
    └── settings/
        ├── settings.h
        ├── settings.c
        ├── settings_callbacks.h
        └── settings_callbacks.c
```

#### 2.2 HoneyGUI API映射器 (HoneyGuiApiMapper)

负责将设计器组件映射到HoneyGUI API调用。

```typescript
interface HoneyGuiApiMapping {
  componentType: string;        // 组件类型 (hg_view, hg_button等)
  createFunction: string;        // 创建函数名
  propertySetters: PropertySetter[];  // 属性设置函数
  eventHandlers: EventHandler[];      // 事件处理函数
}
```

#### 2.3 C代码生成器 (HoneyGuiCCodeGenerator)

生成标准C代码，调用HoneyGUI API。

**生成文件结构**（以main.hml为例）：
```
src/
├── main.h                # 头文件：函数声明、全局变量
├── main.c                # 实现文件：GUI初始化和组件创建
├── main_callbacks.h      # 回调函数声明
└── main_callbacks.c      # 回调函数实现（用户自定义代码保护区）
```

### 3. HoneyGUI API映射表

#### 3.1 容器组件

| 设计器组件 | HoneyGUI API | 说明 |
|-----------|-------------|------|
| hg_view | `GUI_VIEW_INSTANCE()` | 使用宏注册视图实例 |
| hg_window | `gui_window_create()` | 创建窗口 |
| hg_panel  | `gui_obj_create()` | 创建面板对象 |

##### hg_view 特殊生成规则

hg_view 不使用传统的 `gui_view_create()` 函数，而是使用 `GUI_VIEW_INSTANCE` 宏注册视图实例。

**生成模板**：
```c
static void {name}_switch_out(gui_view_t *view)
{
    GUI_UNUSED(view);
}

static void {name}_switch_in(gui_view_t *view)
{
    GUI_UNUSED(view);
    
    // 在这里创建 hg_view 的子组件
    // button1 = gui_button_create(...);
    // label1 = gui_text_create(...);
}
GUI_VIEW_INSTANCE("{name}", false, {name}_switch_in, {name}_switch_out);
```

**替换规则**：
- `{name}` - 使用 HML 中 hg_view 的 `name` 属性值，保持原样，不做大小写转换
- 函数名格式：`{name}_switch_in` 和 `{name}_switch_out`
- 宏第一个参数：字符串 `"{name}"`
- 宏第三、四个参数：函数名（不带引号）

**子组件创建规则**：
- hg_view 的所有子组件在 `{name}_switch_in()` 函数中创建
- 按照控件树的层级顺序递归创建
- 子组件的父组件引用使用 NULL（因为 view 本身不是 gui_obj_t 指针）

**必需的头文件**：
```c
#include "guidef.h"
#include "gui_obj.h"
#include "gui_components_init.h"
#include "gui_view.h"
#include "gui_view_instance.h"
```

**示例**：

HML:
```xml
<hg_view id="mainView" name="mainView" x="0" y="0" width="480" height="272">
  <hg_button id="btn1" name="button1" x="100" y="100" width="120" height="40" text="Click" />
  <hg_label id="lbl1" name="label1" x="100" y="150" width="200" height="30" text="Hello" />
</hg_view>
```

生成代码:
```c
static void mainView_switch_out(gui_view_t *view)
{
    GUI_UNUSED(view);
}

static void mainView_switch_in(gui_view_t *view)
{
    GUI_UNUSED(view);
    
    // 创建button1 (hg_button)
    btn1 = gui_button_create(NULL, "btn1", 100, 100, 120, 40);
    gui_button_set_text(btn1, "Click");
    
    // 创建label1 (hg_label)
    lbl1 = gui_text_create(NULL, "lbl1", 100, 150, 200, 30);
    gui_text_set(lbl1, "Hello");
}
GUI_VIEW_INSTANCE("mainView", false, mainView_switch_in, mainView_switch_out);
```

**注意事项**：
1. hg_view 不生成句柄变量（不需要 `gui_obj_t *mainView`）
2. hg_view 不支持属性设置（如 backgroundColor）
3. 子组件的父组件参数使用 NULL
4. 子组件在 switch_in 中创建，在视图切换时初始化

#### 3.2 UI组件

| 设计器组件 | HoneyGUI API | 说明 |
|-----------|-------------|------|
| hg_button | `gui_button_create()` | 创建按钮 |
| hg_label  | `gui_text_create()` | 创建文本标签 |
| hg_image  | `gui_img_create()` | 创建图片 |
| hg_input  | `gui_textbox_create()` | 创建输入框 |
| hg_switch | `gui_switch_create()` | 创建开关 |
| hg_slider | `gui_seekbar_create()` | 创建滑块 |

#### 3.3 属性映射

| 设计器属性 | HoneyGUI API | 示例 |
|-----------|-------------|------|
| position.x, y | `gui_obj_set_pos()` | `gui_obj_set_pos(obj, x, y)` |
| position.width, height | `gui_obj_set_size()` | `gui_obj_set_size(obj, w, h)` |
| visible | `gui_obj_show()` / `gui_obj_hide()` | `gui_obj_show(obj, true)` |
| style.backgroundColor | `gui_obj_set_color()` | `gui_obj_set_color(obj, 0xFF0000)` |
| data.text | `gui_text_set()` | `gui_text_set(text, "Hello")` |

### 4. 代码生成模板

#### 4.1 头文件模板 (main.h)

```c
#ifndef MAIN_H
#define MAIN_H

#include "gui_api.h"

// 组件句柄声明
extern gui_obj_t *screen_main;
extern gui_obj_t *button_start;
extern gui_obj_t *label_title;

// 初始化函数
void main_init(void);

// 更新函数
void main_update(void);

#endif // MAIN_H
```

#### 4.2 实现文件模板 (main.c)

```c
#include "main.h"
#include "main_callbacks.h"

// 组件句柄定义
gui_obj_t *screen_main = NULL;
gui_obj_t *button_start = NULL;
gui_obj_t *label_title = NULL;

// 初始化GUI设计
void main_init(void) {
    // 创建主屏幕 (480x272)
    screen_main = gui_screen_create(NULL, "screen_main", 0, 0, 480, 272);
    gui_obj_set_color(screen_main, 0x000000);
    
    // 创建标题标签 (x:100, y:50, w:280, h:40)
    label_title = gui_text_create(screen_main, "label_title", 100, 50, 280, 40);
    gui_text_set(label_title, "HoneyGUI App");
    gui_text_set_font_size(label_title, 24);
    gui_text_set_color(label_title, 0xFFFFFF);
    
    // 创建启动按钮 (x:150, y:120, w:180, h:60)
    button_start = gui_button_create(screen_main, "button_start", 150, 120, 180, 60);
    gui_button_set_text(button_start, "Start");
    gui_button_set_color(button_start, 0x007ACC);
    
    // 绑定按钮点击事件
    gui_button_set_click_cb(button_start, on_button_start_click);
}

// 更新GUI（可选）
void main_update(void) {
    // 动态更新逻辑
}
```

#### 4.3 回调文件模板 (main_callbacks.c)

```c
#include "main_callbacks.h"
#include <stdio.h>

/* @protected start button_start_click */
// 按钮点击事件处理
void on_button_start_click(gui_obj_t *obj) {
    printf("Start button clicked!\n");
    // 用户自定义代码
}
/* @protected end button_start_click */

/* @protected start custom_code */
// 用户自定义函数
/* @protected end custom_code */
```

### 5. 代码生成器实现

#### 5.1 核心类结构

```typescript
class HoneyGuiCCodeGenerator extends CodeGenerator {
  private apiMapper: HoneyGuiApiMapper;
  
  // 生成主函数
  async generate(): Promise<CodeGenerationResult> {
    const components = this.model.getComponents();
    
    // 1. 生成头文件
    const headerCode = this.generateHeader(components);
    
    // 2. 生成实现文件
    const implCode = this.generateImplementation(components);
    
    // 3. 生成回调文件
    const callbackCode = this.generateCallbacks(components);
    
    // 4. 写入文件
    await this.writeFiles(headerCode, implCode, callbackCode);
    
    return { success: true, generatedFiles: [...] };
  }
  
  // 生成组件创建代码
  private generateComponentCreation(component: Component): string {
    const api = this.apiMapper.getApiForComponent(component.type);
    
    return `
    // 创建${component.name} (${component.type})
    ${component.id} = ${api.createFunction}(
        ${component.parent || 'NULL'},
        "${component.id}",
        ${component.position.x},
        ${component.position.y},
        ${component.position.width},
        ${component.position.height}
    );
    ${this.generatePropertySetters(component, api)}
    ${this.generateEventBindings(component, api)}
    `;
  }
  
  // 生成属性设置代码
  private generatePropertySetters(component: Component, api: ApiMapping): string {
    let code = '';
    
    // 背景色
    if (component.style?.backgroundColor) {
      const color = this.colorToHex(component.style.backgroundColor);
      code += `    gui_obj_set_color(${component.id}, ${color});\n`;
    }
    
    // 文本内容
    if (component.data?.text) {
      code += `    gui_text_set(${component.id}, "${component.data.text}");\n`;
    }
    
    // 可见性
    if (component.visible !== undefined) {
      code += `    gui_obj_show(${component.id}, ${component.visible});\n`;
    }
    
    return code;
  }
  
  // 生成事件绑定代码
  private generateEventBindings(component: Component, api: ApiMapping): string {
    let code = '';
    
    if (component.events?.onClick) {
      const callbackName = `on_${component.id}_click`;
      code += `    gui_button_set_click_cb(${component.id}, ${callbackName});\n`;
    }
    
    return code;
  }
}
```

#### 5.2 API映射器实现

```typescript
class HoneyGuiApiMapper {
  private mappings: Map<string, HoneyGuiApiMapping>;
  
  constructor() {
    this.initMappings();
  }
  
  private initMappings() {
    this.mappings = new Map([
      ['hg_view', {
        createFunction: 'gui_screen_create',
        propertySetters: [
          { property: 'backgroundColor', api: 'gui_obj_set_color' }
        ],
        eventHandlers: []
      }],
      ['hg_button', {
        createFunction: 'gui_button_create',
        propertySetters: [
          { property: 'text', api: 'gui_button_set_text' },
          { property: 'backgroundColor', api: 'gui_button_set_color' }
        ],
        eventHandlers: [
          { event: 'onClick', api: 'gui_button_set_click_cb' }
        ]
      }],
      ['hg_label', {
        createFunction: 'gui_text_create',
        propertySetters: [
          { property: 'text', api: 'gui_text_set' },
          { property: 'fontSize', api: 'gui_text_set_font_size' },
          { property: 'color', api: 'gui_text_set_color' }
        ],
        eventHandlers: []
      }],
      // ... 更多组件映射
    ]);
  }
  
  getApiForComponent(type: string): HoneyGuiApiMapping {
    return this.mappings.get(type) || this.getDefaultMapping();
  }
}
```

### 6. 代码保护区机制

支持用户自定义代码保护，重新生成时不会覆盖：

```c
/* @protected start custom_init */
// 用户自定义初始化代码
void custom_init(void) {
    // 这里的代码在重新生成时会被保留
}
/* @protected end custom_init */
```

### 7. 生成示例

#### 输入 (HML设计)

```xml
<hg_view id="mainScreen" x="0" y="0" width="480" height="272" backgroundColor="#000000">
  <hg_label id="titleLabel" x="100" y="50" width="280" height="40" 
            text="Welcome" fontSize="24" color="#FFFFFF"/>
  <hg_button id="startButton" x="150" y="120" width="180" height="60" 
             text="Start" backgroundColor="#007ACC" onClick="handleStart"/>
</hg_view>
```

#### 输出 (C代码)

```c
// gui_design.c
void gui_design_init(void) {
    // 创建主屏幕
    mainScreen = gui_screen_create(NULL, "mainScreen", 0, 0, 480, 272);
    gui_obj_set_color(mainScreen, 0x000000);
    
    // 创建标题标签
    titleLabel = gui_text_create(mainScreen, "titleLabel", 100, 50, 280, 40);
    gui_text_set(titleLabel, "Welcome");
    gui_text_set_font_size(titleLabel, 24);
    gui_text_set_color(titleLabel, 0xFFFFFF);
    
    // 创建启动按钮
    startButton = gui_button_create(mainScreen, "startButton", 150, 120, 180, 60);
    gui_button_set_text(startButton, "Start");
    gui_button_set_color(startButton, 0x007ACC);
    gui_button_set_click_cb(startButton, handleStart);
}
```

### 8. 实施步骤

#### Phase 1: 基础架构 (1周)
- [ ] 创建 HoneyGuiApiMapper 类
- [ ] 实现基础组件映射表
- [ ] 创建 HoneyGuiCCodeGenerator 类框架

#### Phase 2: 核心功能 (2周)
- [ ] 实现组件创建代码生成
- [ ] 实现属性设置代码生成
- [ ] 实现事件绑定代码生成
- [ ] 实现代码保护区机制

#### Phase 3: 完善功能 (1周)
- [ ] 支持所有HoneyGUI组件
- [ ] 优化代码格式和注释
- [ ] 添加错误处理和验证
- [ ] 编写单元测试

#### Phase 4: 集成测试 (1周)
- [ ] 与设计器集成
- [ ] 生成示例项目测试
- [ ] 在真实硬件上验证
- [ ] 文档编写

### 9. 优势

1. **直接调用API** - 生成的代码直接调用HoneyGUI API，无需中间层
2. **高性能** - C代码编译后性能最优，适合嵌入式设备
3. **易于调试** - 生成的代码可读性强，便于调试和修改
4. **代码保护** - 支持用户自定义代码保护区
5. **可移植** - 标准C代码，跨平台兼容

### 10. 扩展性

- 支持自定义组件映射
- 支持插件式API扩展
- 支持多种HoneyGUI版本
- 支持代码模板自定义

## 总结

这个架构设计提供了从可视化设计到HoneyGUI C代码的完整转换方案，既保证了代码质量，又保持了灵活性和可扩展性。
