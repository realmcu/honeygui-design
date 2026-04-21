# HML 常见错误和修复方法

生成 HML 时经常遇到的错误、错误原因和解决方案。

## 目录

- [1. 约束违反错误](#1-约束违反错误)
- [2. 语法错误](#2-语法错误)
- [3. 属性错误](#3-属性错误)
- [4. 布局错误](#4-布局错误)
- [5. 验证错误](#5-验证错误)

---

## 1. 约束违反错误

### ❌ 错误 1.1：hg_view 嵌套

**错误代码**：
```xml
<hg_view id="view_main" entry="true">
  <hg_view id="view_inner">  <!-- ❌ 错误！ -->
    <hg_label id="lbl1" text="Hello" fontFile="/font.ttf" />
  </hg_view>
</hg_view>
```

**错误原因**：
- `hg_view` 不能嵌套在另一个 `hg_view` 中
- 违反 HML 约束规则第 1 条

**修复方法**：
```xml
<!-- 方法 1：使用 hg_container 作为容器 -->
<hg_view id="view_main" entry="true">
  <hg_container id="cnt_inner">
    <hg_label id="lbl1" text="Hello" fontFile="/font.ttf" />
  </hg_container>
</hg_view>

<!-- 方法 2：多个平级的 hg_view -->
<view>
  <hg_view id="view_main" entry="true" x="0" y="0">...</hg_view>
  <hg_view id="view_settings" x="454" y="0">...</hg_view>
</view>
```

---

### ❌ 错误 1.2：资源路径缺少 `/` 前缀

**错误代码**：
```xml
<hg_image id="img1" src="logo.bin" />
<hg_label id="lbl1" text="Hello" fontFile="font.ttf" />
```

**错误原因**：
- 资源路径必须以 `/` 开头（从 assets 文件夹开始）
- 违反 HML 约束规则第 2 条

**修复方法**：
```xml
<hg_image id="img1" src="/logo.bin" />
<hg_label id="lbl1" text="Hello" fontFile="/font.ttf" />
```

---

### ❌ 错误 1.3：hg_label 缺少 fontFile 属性

**错误代码**：
```xml
<hg_label id="lbl_title" text="Dashboard" fontSize="26" color="#FFFFFF" />
```

**错误原因**：
- `hg_label` 必须设置 `fontFile` 属性
- 违反 HML 约束规则第 3 条

**修复方法**：
```xml
<hg_label id="lbl_title" 
          text="Dashboard" 
          fontSize="26" 
          color="#FFFFFF"
          fontFile="/NotoSansSC-Bold.ttf" />
```

**回退方案**：
- 如果 assets 文件夹中没有字体文件，使用 `/NotoSansSC-Bold.ttf` 作为默认字体

---

### ❌ 错误 1.4：非容器组件包含子元素

**错误代码**：
```xml
<hg_label id="lbl1" text="Title" fontFile="/font.ttf">
  <hg_image id="img1" src="/icon.bin" />  <!-- ❌ 错误！ -->
</hg_label>
```

**错误原因**：
- `hg_label` 是非容器组件，不能包含子元素
- 违反 HML 约束规则第 4 条

**修复方法**：
```xml
<hg_view id="view_container">
  <hg_label id="lbl1" text="Title" fontFile="/font.ttf" x="0" y="0" w="100" h="30" />
  <hg_image id="img1" src="/icon.bin" x="110" y="0" w="30" h="30" />
</hg_view>
```

**容器组件**（可以包含子元素）：
- `hg_view`, `hg_window`, `hg_container`
- `hg_list`, `hg_list_item`, `hg_menu_cellular`

**非容器组件**（不能包含子元素）：
- `hg_label`, `hg_image`, `hg_button`, `hg_slider`, `hg_switch` 等所有其他组件

---

### ❌ 错误 1.5：缺少 Entry View

**错误代码**：
```xml
<view>
  <hg_view id="view_home">...</hg_view>
  <hg_view id="view_settings">...</hg_view>
</view>
```

**错误原因**：
- 必须有且仅有一个 `hg_view` 设置 `entry="true"`
- 违反 HML 约束规则第 5 条

**修复方法**：
```xml
<view>
  <hg_view id="view_home" entry="true">...</hg_view>  <!-- ✅ 设置 entry="true" -->
  <hg_view id="view_settings">...</hg_view>
</view>
```

---

### ❌ 错误 1.6：组件 ID 格式不正确

**错误代码**：
```xml
<hg_button id="1btn" />           <!-- ❌ 不能以数字开头 -->
<hg_button id="btn-confirm" />    <!-- ❌ 不能包含连字符 -->
<hg_button id="btnConfirm" />     <!-- ❌ 不推荐驼峰命名 -->
```

**错误原因**：
- ID 必须符合 C 标识符命名规则
- 违反 HML 约束规则第 6 条

**修复方法**：
```xml
<hg_button id="btn_confirm" />    <!-- ✅ 小写字母 + 下划线 -->
<hg_button id="btn_1" />          <!-- ✅ 字母开头 + 数字 -->
```

**ID 命名规则**：
- 只能包含小写字母（a-z）、数字（0-9）、下划线（_）
- 必须以小写字母开头
- 推荐命名约定：`btn_*`, `lbl_*`, `img_*`, `view_*`

---

### ❌ 错误 1.7：组件 ID 重复

**错误代码**：
```xml
<hg_button id="btn_action" text="Confirm" />
<hg_button id="btn_action" text="Cancel" />  <!-- ❌ ID 重复 -->
```

**错误原因**：
- 组件 ID 必须全局唯一
- 违反 HML 约束规则第 6 条

**修复方法**：
```xml
<hg_button id="btn_confirm" text="Confirm" />
<hg_button id="btn_cancel" text="Cancel" />
```

---

### ❌ 错误 1.8：文档结构不完整

**错误代码**：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <view>  <!-- ❌ 缺少 <meta> -->
    <hg_view id="view_main" entry="true">...</hg_view>
  </view>
</hml>
```

**错误原因**：
- 必须包含 `<meta>` 和 `<view>` 两个部分
- 违反 HML 约束规则第 8 条

**修复方法**：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>My App</title>
    <project>
      <resolution>454x454</resolution>
    </project>
  </meta>
  <view>
    <hg_view id="view_main" entry="true">...</hg_view>
  </view>
</hml>
```

---

## 2. 语法错误

### ❌ 错误 2.1：XML 标签未闭合

**错误代码**：
```xml
<hg_button id="btn1" x="0" y="0" w="100" h="50" text="Click"  <!-- ❌ 缺少 /> -->
```

**修复方法**：
```xml
<hg_button id="btn1" x="0" y="0" w="100" h="50" text="Click" />
```

---

### ❌ 错误 2.2：属性值缺少引号

**错误代码**：
```xml
<hg_label id=lbl1 text="Hello" fontFile="/font.ttf" />  <!-- ❌ id 缺少引号 -->
```

**修复方法**：
```xml
<hg_label id="lbl1" text="Hello" fontFile="/font.ttf" />
```

---

### ❌ 错误 2.3：特殊字符未转义

**错误代码**：
```xml
<hg_label id="lbl1" text="Price: $100 & Free Shipping" fontFile="/font.ttf" />
                                        <!-- ❌ & 需要转义 -->
```

**修复方法**：
```xml
<hg_label id="lbl1" text="Price: $100 &amp; Free Shipping" fontFile="/font.ttf" />
```

**常见转义字符**：
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&apos;`

---

## 3. 属性错误

### ❌ 错误 3.1：坐标或尺寸为负数

**错误代码**：
```xml
<hg_button id="btn1" x="-10" y="20" w="100" h="50" />
```

**错误原因**：
- 坐标和尺寸应该为非负整数

**修复方法**：
```xml
<hg_button id="btn1" x="0" y="20" w="100" h="50" />
```

---

### ❌ 错误 3.2：颜色格式错误

**错误代码**：
```xml
<hg_label id="lbl1" text="Title" color="red" fontFile="/font.ttf" />
                                      <!-- ❌ 不支持颜色名称 -->
```

**修复方法**：
```xml
<hg_label id="lbl1" text="Title" color="#FF0000" fontFile="/font.ttf" />
```

**支持的颜色格式**：
- 6 位十六进制：`#RRGGBB`（如 `#FF0000`）
- 8 位十六进制：`#RRGGBBAA`（如 `#FF0000FF`，包含透明度）

---

### ❌ 错误 3.3：滑块范围错误

**错误代码**：
```xml
<hg_slider id="slider1" min="100" max="0" value="50" />
                            <!-- ❌ min > max -->
```

**修复方法**：
```xml
<hg_slider id="slider1" min="0" max="100" value="50" />
```

---

### ❌ 错误 3.4：时间格式字符串错误

**错误代码**：
```xml
<hg_label id="lbl_time" timeFormat="HH:mm:ss" fontFile="/font.ttf" />
                                   <!-- ❌ 小写 mm 表示月份 -->
```

**修复方法**：
```xml
<hg_label id="lbl_time" timeFormat="HH:MM:SS" fontFile="/font.ttf" />
```

**时间格式占位符**：
- `HH` - 小时（24 小时制）
- `MM` - 分钟
- `SS` - 秒
- `YYYY` - 年份
- `MM` - 月份（上下文相关）
- `DD` - 日期
- `dddd` - 星期（完整名称）

---

## 4. 布局错误

### ❌ 错误 4.1：组件超出屏幕边界

**错误代码**：
```xml
<!-- 454x454 屏幕 -->
<hg_button id="btn1" x="400" y="400" w="100" h="100" />
                      <!-- ❌ x + w = 500 > 454 -->
```

**修复方法**：
```xml
<hg_button id="btn1" x="354" y="354" w="100" h="100" />
                      <!-- ✅ x + w = 454 -->
```

---

### ❌ 错误 4.2：触摸目标过小

**错误代码**：
```xml
<hg_button id="btn1" x="100" y="100" w="30" h="30" />
                                    <!-- ❌ 小于 44x44px -->
```

**修复方法**：
```xml
<hg_button id="btn1" x="100" y="100" w="50" h="50" />
                                    <!-- ✅ 满足最小触摸目标 -->
```

**触摸目标尺寸指南**：
- 最小尺寸：44x44px
- 推荐尺寸：50x50px
- 重要按钮：60x60px 或更大

---

### ❌ 错误 4.3：文字过长溢出

**错误代码**：
```xml
<hg_label id="lbl1" 
          text="This is a very long text that will overflow" 
          x="100" y="100" w="100" h="30" 
          fontFile="/font.ttf" />
          <!-- ❌ 文字宽度超过容器宽度 -->
```

**修复方法**：
```xml
<!-- 方法 1：增加容器宽度 -->
<hg_label id="lbl1" 
          text="This is a very long text that will overflow" 
          x="50" y="100" w="350" h="30" 
          fontFile="/font.ttf" />

<!-- 方法 2：缩短文字 -->
<hg_label id="lbl1" 
          text="Long text..." 
          x="100" y="100" w="100" h="30" 
          fontFile="/font.ttf" />

<!-- 方法 3：使用多行 -->
<hg_label id="lbl1" 
          text="This is a very&#10;long text" 
          x="100" y="100" w="200" h="60" 
          fontFile="/font.ttf" />
```

---

## 5. 验证错误

### ❌ 错误 5.1：未调用验证 API

**问题**：
- 生成 HML 后直接保存，没有验证

**解决方法**：
```bash
# 始终在生成 HML 后调用验证 API
curl -X POST http://localhost:38912/api/validate-hml \
  -H "Content-Type: application/json" \
  -d '{"hmlContent":"<?xml version=\"1.0\"?><hml>...</hml>"}'
```

---

### ❌ 错误 5.2：忽略验证警告

**问题**：
- 验证 API 返回警告（warnings），但被忽略

**解决方法**：
- 检查所有警告信息
- 警告通常指出潜在问题（如性能、可读性）
- 虽然不会阻止编译，但应该修复

---

## 相关文档

- **完整约束清单**：`references/constraints.md`
- **HTTP API 文档**：`references/http-api.md`
- **组件文档**：`references/components.md`
- **设计原则**：`references/design-principles.md`
