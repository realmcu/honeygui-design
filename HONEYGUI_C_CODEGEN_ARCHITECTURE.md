# HoneyGUI C代码生成架构设计

## 概述

从HML设计器生成调用HoneyGUI API的C代码，实现可视化设计到嵌入式GUI代码的转换。

## 架构设计

### 1. 代码生成流程

```
HML文件 → 解析器 → 组件树 → C代码生成器 → HoneyGUI API调用代码
```

### 2. 核心模块

#### 2.1 HoneyGUI API映射器 (HoneyGuiApiMapper)

负责将设计器组件映射到HoneyGUI API调用。

```typescript
interface HoneyGuiApiMapping {
  componentType: string;        // 组件类型 (hg_view, hg_button等)
  createFunction: string;        // 创建函数名
  propertySetters: PropertySetter[];  // 属性设置函数
  eventHandlers: EventHandler[];      // 事件处理函数
}
```

#### 2.2 C代码生成器 (HoneyGuiCCodeGenerator)

生成标准C代码，调用HoneyGUI API。

**生成文件结构**：
```
output/
├── gui_design.h          # 头文件：函数声明、全局变量
├── gui_design.c          # 实现文件：GUI初始化和组件创建
├── gui_callbacks.h       # 回调函数声明
└── gui_callbacks.c       # 回调函数实现（用户自定义代码保护区）
```

### 3. HoneyGUI API映射表

#### 3.1 容器组件

| 设计器组件 | HoneyGUI API | 说明 |
|-----------|-------------|------|
| hg_view | `gui_screen_create()` | 创建屏幕容器 |
| hg_view   | `gui_view_create()` | 创建视图容器 |
| hg_window | `gui_window_create()` | 创建窗口 |
| hg_panel  | `gui_obj_create()` | 创建面板对象 |

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

#### 4.1 头文件模板 (gui_design.h)

```c
#ifndef GUI_DESIGN_H
#define GUI_DESIGN_H

#include "gui_api.h"

// 组件句柄声明
extern gui_obj_t *screen_main;
extern gui_obj_t *button_start;
extern gui_obj_t *label_title;

// 初始化函数
void gui_design_init(void);

// 更新函数
void gui_design_update(void);

#endif // GUI_DESIGN_H
```

#### 4.2 实现文件模板 (gui_design.c)

```c
#include "gui_design.h"
#include "gui_callbacks.h"

// 组件句柄定义
gui_obj_t *screen_main = NULL;
gui_obj_t *button_start = NULL;
gui_obj_t *label_title = NULL;

// 初始化GUI设计
void gui_design_init(void) {
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
void gui_design_update(void) {
    // 动态更新逻辑
}
```

#### 4.3 回调文件模板 (gui_callbacks.c)

```c
#include "gui_callbacks.h"
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
