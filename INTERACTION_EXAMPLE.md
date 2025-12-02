# 交互功能使用示例

## 功能说明

HoneyGUI Design 现已支持为 `hg_view` 及其他组件添加交互功能，包括：
- **单击 (click)**
- **双击 (double-click)**
- **长按 (long-press)**
- **滑动 (swipe)** - 支持上/下/左/右四个方向

## 使用方法

### 1. 在设计器中添加交互

1. 选中 `hg_view` 组件
2. 切换到"交互"标签页
3. 点击"+ 添加单击/双击/长按/滑动"按钮
4. 配置交互参数：
   - **回调函数名**：自动生成，可手动修改
   - **滑动方向**：仅滑动交互需要配置
   - **长按时长**：仅长按交互需要配置（默认500ms）

### 2. HML 文件格式

```xml
<hg_view id="view1" x="0" y="0" width="480" height="272">
  <interactions>
    <interaction type="click" callback="on_view1_click" />
    <interaction type="swipe" direction="left" callback="on_view1_swipe_left" />
    <interaction type="swipe" direction="right" callback="on_view1_swipe_right" />
    <interaction type="long-press" duration="500" callback="on_view1_long_press" />
  </interactions>
</hg_view>
```

### 3. 生成的 C 代码

#### main_ui.c（自动生成，每次覆盖）
```c
void create_main_ui(void) {
    // 创建组件
    view1 = gui_view_create(NULL, "view1", 0, 0, 480, 272);
    
    // 绑定交互
    gui_obj_add_event_cb(view1, on_view1_click, GUI_EVENT_TOUCH_CLICKED, NULL);
    gui_obj_add_event_cb(view1, on_view1_swipe_left, GUI_EVENT_GESTURE_SWIPE_LEFT, NULL);
    gui_obj_add_event_cb(view1, on_view1_swipe_right, GUI_EVENT_GESTURE_SWIPE_RIGHT, NULL);
    gui_obj_add_event_cb(view1, on_view1_long_press, GUI_EVENT_TOUCH_LONG_PRESS, NULL);
}
```

#### main_callbacks.c（保护区机制）
```c
/* @protected start on_view1_click */
void on_view1_click(gui_obj_t *obj) {
    printf("view1 单击 triggered\n");
    // TODO: 实现交互处理逻辑
    // 用户可以在此添加自定义代码，重新生成时会保留
}
/* @protected end on_view1_click */

/* @protected start on_view1_swipe_left */
void on_view1_swipe_left(gui_obj_t *obj) {
    printf("view1 左滑 triggered\n");
    // TODO: 切换到下一页
}
/* @protected end on_view1_swipe_left */
```

## 典型应用场景

### 场景1：页面滑动切换（类似Android桌面）

```xml
<hg_view id="page1" x="0" y="0" width="480" height="272">
  <interactions>
    <interaction type="swipe" direction="left" callback="switch_to_page2" />
  </interactions>
</hg_view>

<hg_view id="page2" x="480" y="0" width="480" height="272">
  <interactions>
    <interaction type="swipe" direction="right" callback="switch_to_page1" />
  </interactions>
</hg_view>
```

回调实现：
```c
/* @protected start switch_to_page2 */
void switch_to_page2(gui_obj_t *obj) {
    gui_view_set_hidden(page1, true);
    gui_view_set_hidden(page2, false);
}
/* @protected end switch_to_page2 */
```

### 场景2：按钮多种交互

```xml
<hg_button id="btn1" x="100" y="100" width="120" height="40">
  <interactions>
    <interaction type="click" callback="on_btn_click" />
    <interaction type="long-press" duration="1000" callback="on_btn_long_press" />
  </interactions>
</hg_button>
```

### 场景3：下拉刷新

```xml
<hg_view id="content_view" x="0" y="0" width="480" height="272">
  <interactions>
    <interaction type="swipe" direction="down" callback="on_pull_refresh" />
  </interactions>
</hg_view>
```

## 属性 vs 交互的区别

| 类别 | 定义 | 示例 | 使用场景 |
|------|------|------|----------|
| **属性** | 组件的静态特征 | x, y, width, color | 描述组件"是什么" |
| **交互** | 用户操作的响应 | 单击、滑动、长按 | 描述组件"做什么" |

**设计理念**：
- 属性面板只有"属性"和"交互"两个标签页
- 不暴露底层"事件"（如TOUCH_DOWN/UP），避免混淆初学者
- 交互是高层封装，自动生成事件处理代码
- 高级用户可直接在生成的 `*_callbacks.c` 中手写底层事件处理

## 注意事项

1. **HoneyGUI SDK 支持**：确保 SDK 版本支持所需的手势事件类型
2. **事件冲突**：同一组件的单击和双击可能冲突，建议只使用其一
3. **仿真测试**：SDL2 环境下用鼠标模拟触摸，滑动需要拖拽
4. **代码保护**：回调函数内的用户代码会被保护区机制保留

## 后续扩展

未来可能支持的交互类型：
- 拖拽 (drag)
- 捏合缩放 (pinch)
- 旋转 (rotate)
- 多点触控 (multi-touch)
