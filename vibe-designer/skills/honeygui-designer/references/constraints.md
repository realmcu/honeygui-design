# HML 关键约束

生成 HML 时必须严格遵守以下规则，违反这些规则会导致验证失败或运行时错误。

## 目录

1. [hg_view 嵌套规则](#1-hg_view-嵌套规则-)
2. [资源路径格式](#2-资源路径格式-)
3. [字体文件约束](#3-字体文件约束-)
4. [组件嵌套规则](#4-组件嵌套规则-)
5. [Entry View 约束](#5-entry-view-约束-)
6. [组件 ID 约束](#6-组件-id-约束-)
7. [事件处理函数约束](#7-事件处理函数约束-)
8. [文档结构约束](#8-文档结构约束-)

---

## 1. hg_view 嵌套规则 ⚠️

**规则**：`hg_view` 不能嵌套在另一个 `hg_view` 中

```xml
<!-- ❌ 错误：hg_view 嵌套 -->
<hg_view id="view_main">
  <hg_view id="view_inner">  <!-- 错误！不能嵌套 -->
  </hg_view>
</hg_view>

<!-- ✅ 正确：多个平级的 hg_view -->
<view>
  <hg_view id="view_home" x="0" y="0">...</hg_view>
  <hg_view id="view_settings" x="454" y="0">...</hg_view>
</view>
```

**说明**：
- hg_view 不能有父子关系
- hg_view 的 x/y 坐标只在设计器画布上有意义，在实际 GUI 上会忽略
- 多个视图可以通过调整 x/y 位置在设计器中形成网格布局

---

## 2. 资源路径格式 ⚠️

**规则**：所有资源文件路径必须以 `/` 开头

```xml
<!-- ❌ 错误：相对路径 -->
<hg_image src="logo.bin" />
<hg_label fontFile="font.ttf" />

<!-- ✅ 正确：绝对路径（从 assets 文件夹开始） -->
<hg_image src="/logo.bin" />
<hg_label fontFile="/NotoSansSC-Bold.ttf" />
```

**格式**：`'/' + '从 assets 文件夹开始的相对路径'`

**示例**：
- `/logo.bin` → 对应 `assets/logo.bin`
- `/fonts/NotoSansSC-Bold.ttf` → 对应 `assets/fonts/NotoSansSC-Bold.ttf`
- `/images/icon.png` → 对应 `assets/images/icon.png`

---

## 3. 字体文件约束 ⚠️

**规则**：
1. **hg_label 必须设置 fontFile 属性**
2. **字体文件必须位于 assets 文件夹中**

```xml
<!-- ❌ 错误：缺少 fontFile -->
<hg_label id="lbl1" text="Hello" />

<!-- ✅ 正确：包含 fontFile -->
<hg_label id="lbl1" text="Hello" fontFile="/NotoSansSC-Bold.ttf" />
```

**回退方案**：
- 如果 assets 文件夹中没有字体文件，从 fallback 文件夹复制字体到 assets
- 常用回退字体：`/NotoSansSC-Bold.ttf`

**注意**：
- 字体文件必须真实存在于 assets 文件夹
- 不能使用不存在的字体文件路径
- 字体文件名区分大小写

---

## 4. 组件嵌套规则 ⚠️

**容器组件**（可以包含子组件）：
- `hg_view`
- `hg_window`
- `hg_list`
- `hg_list_item`
- `hg_menu_cellular`

**非容器组件**（不能包含子组件）：
- `hg_label`、`hg_time_label`、`hg_image`
- `hg_button`、`hg_switch`、`hg_slider`、`hg_progressbar`
- `hg_arc`、`hg_circle`、`hg_rect`
- 等所有其他组件

```xml
<!-- ❌ 错误：非容器组件包含子组件 -->
<hg_label id="lbl1">
  <hg_image id="img1" />  <!-- 错误！label 不能有子组件 -->
</hg_label>

<!-- ✅ 正确：容器组件包含子组件 -->
<hg_view id="view1">
  <hg_label id="lbl1" />
  <hg_image id="img1" />
</hg_view>
```

**特殊规则**：
- `hg_list` 的子元素应该是 `hg_list_item`
- `hg_list_item` 可以包含任何非容器控件
- 非容器控件必须是容器的子元素，不能直接作为 `<view>` 的子元素

---

## 5. Entry View 约束 ⚠️

**规则**：必须有且仅有一个 `hg_view` 设置 `entry="true"`

```xml
<!-- ❌ 错误：没有 entry view -->
<view>
  <hg_view id="view1">...</hg_view>
  <hg_view id="view2">...</hg_view>
</view>

<!-- ❌ 错误：多个 entry view -->
<view>
  <hg_view id="view1" entry="true">...</hg_view>
  <hg_view id="view2" entry="true">...</hg_view>  <!-- 错误！ -->
</view>

<!-- ✅ 正确：恰好一个 entry view -->
<view>
  <hg_view id="view_main" entry="true">...</hg_view>
  <hg_view id="view_settings">...</hg_view>
</view>
```

**说明**：
- Entry view 是应用启动时显示的第一个屏幕
- 只能有一个 entry view
- 通常第一个/主要的视图设置为 entry view

---

## 6. 组件 ID 约束 ⚠️

**规则**：
1. ID 必须全局唯一
2. ID 必须符合 C 标识符命名规则（小写字母、数字、下划线）
3. ID 必须以字母开头

```xml
<!-- ❌ 错误：ID 重复 -->
<hg_button id="btn1" />
<hg_label id="btn1" />  <!-- 错误！ID 重复 -->

<!-- ❌ 错误：ID 格式不正确 -->
<hg_button id="1btn" />         <!-- 不能以数字开头 -->
<hg_button id="btn-confirm" />  <!-- 不能包含连字符 -->
<hg_button id="btn.confirm" />  <!-- 不能包含点号 -->
<hg_button id="btnConfirm" />   <!-- 不推荐：应使用小写+下划线 -->

<!-- ✅ 正确：唯一且格式正确的 ID -->
<hg_button id="btn_confirm" />
<hg_label id="lbl_title" />
```

**推荐命名约定**：
- 按钮：`btn_*`（如 `btn_confirm`、`btn_cancel`）
- 标签：`lbl_*`（如 `lbl_title`、`lbl_time`）
- 图片：`img_*`（如 `img_logo`、`img_bg`）
- 视图：`view_*`（如 `view_main`、`view_settings`）
- 滑块：`slider_*`（如 `slider_volume`）
- 开关：`switch_*`（如 `switch_wifi`）

**ID 格式要求**：
- 只能包含小写字母（a-z）、数字（0-9）、下划线（_）
- 必须以小写字母开头
- 长度建议：3-32 字符
- 使用描述性名称，避免 `btn1`、`label1` 等通用名称

---

## 7. 事件处理函数约束 ⚠️

**规则**：如果事件需要调用 C 函数，必须在 `src/user` 文件夹中定义

```c
// ✅ 正确：在 src/user/ProjectName_user.c 中定义
void on_button_click(void *obj, void *event) {
    (void)obj;
    (void)event;
    gui_log("Button clicked\n");
}
```

**要点**：
- 函数必须写在 `src/user/` 文件夹中
- 函数签名：`void func_name(void *obj, void *event)`
- 函数内部可以为空或只打印日志（用于模拟器编译通过）
- **不要在其他文件夹中写代码** — 其他文件夹的 C 文件是自动生成的

**文件位置**：
- 函数定义：`src/user/<ProjectName>_user.c`
- 函数声明：`src/user/<ProjectName>_user.h`

**示例**：

HML 中引用函数：
```xml
<hg_button id="btn_start" onClick="on_start_click" />
```

在 `src/user/MyProject_user.c` 中定义：
```c
void on_start_click(void *obj, void *event) {
    (void)obj;
    (void)event;
    gui_log("Start button clicked\n");
    // 添加实际逻辑
}
```

在 `src/user/MyProject_user.h` 中声明：
```c
void on_start_click(void *obj, void *event);
```

---

## 8. 文档结构约束 ⚠️

**规则**：
1. 根元素必须是 `<hml>`
2. 必须包含 `<meta>` 和 `<view>`，按此顺序
3. 文件编码必须是 UTF-8
4. XML 声明：`<?xml version="1.0" encoding="UTF-8"?>`

```xml
<!-- ✅ 正确的文档结构 -->
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>My App</title>
    <project name="MyApp" resolution="454x454" />
  </meta>
  <view>
    <hg_view id="view_main" entry="true">
      <!-- 组件 -->
    </hg_view>
  </view>
</hml>
```

**文档结构检查清单**：
- [ ] XML 声明在第一行
- [ ] 根元素是 `<hml>`
- [ ] `<meta>` 在 `<view>` 之前
- [ ] `<meta>` 包含基本项目信息
- [ ] `<view>` 包含至少一个 `hg_view`
- [ ] 文件编码为 UTF-8（无 BOM）

---

## 验证这些约束

使用 Extension HTTP API 验证 HML 是否符合所有约束：

```bash
curl -X POST http://localhost:38912/api/validate-hml \
  -H "Content-Type: application/json" \
  -d '{"filePath":"ui/main.hml"}'
```

验证器会检查上述所有 8 项约束，并返回详细的错误信息。

---

## 相关文档

- **完整 HML 规范**：`docs/HML-Spec-zh.md`
- **组件文档**：`references/components.md`
- **HML 语法**：`references/hml-syntax.md`
- **HTTP API 文档**：`references/http-api.md`
