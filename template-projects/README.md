# 模板项目目录

这个目录存放所有项目模板。每个模板都是一个完整的、可运行的 HoneyGUI 项目。

## 目录结构

```
template-projects/
├── smartwatch/          # 智能手表模板（410X502）
├── settings/            # 设置菜单模板（480X272）
├── dashboard/           # 仪表盘模板（800X480）
├── chatbot/             # 聊天机器人模板（480X320）
├── rotary/              # 旋钮屏模板（480X480）
└── README.md            # 本文件
```

## 使用方式

### 方式1：直接在模板中开发

```bash
# 在 VSCode 中打开模板项目
cd template-projects/smartwatch
code .

# 正常开发：
# - 编辑 HML
# - 添加资源到 assets/
# - 生成代码
# - 编译测试
```

### 方式2：从模板创建新项目

```bash
# 在 VSCode 中
Ctrl+Shift+P → HoneyGUI: New Project
→ Create template project
→ 选择模板
→ 输入项目名和保存位置

# 模板会被拷贝到指定位置，项目名自动替换
```

## 模板文件说明

每个模板包含：

```
smartwatch/
├── ui/main/
│   └── SmartWatchMain.hml     # HML 文件（包含 {{PROJECT_NAME}} 占位符）
├── assets/                    # 资源文件（图片、字体等）
├── src/                       # 空目录（用户代码）
├── project.json               # 项目配置（包含变量占位符）
└── README.md                  # 项目说明
```

### 变量占位符

模板文件中使用以下占位符，创建项目时会自动替换：

- `{{PROJECT_NAME}}` - 项目名称
- `{{APP_ID}}` - APP ID
- `{{SDK_PATH}}` - SDK 路径
- `{{CREATED_TIME}}` - 创建时间

## 添加新模板

### 1. 创建模板项目

```bash
cd template-projects
mkdir my-template
cd my-template

# 创建项目结构
mkdir -p ui/main assets src
```

### 2. 创建文件

创建 `ui/main/MyTemplateMain.hml`：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<hg_screen id="{{PROJECT_NAME}}Screen"
    xmlns:hg="http://honeygui.com/hml"
    appId="{{APP_ID}}"
    ...>
    <!-- 你的组件 -->
</hg_screen>
```

创建 `project.json`：
```json
{
  "name": "{{PROJECT_NAME}}",
  "appId": "{{APP_ID}}",
  "resolution": "480X272",
  ...
}
```

### 3. 创建模板类

在 `src/template/templates/` 创建模板类：

```typescript
// src/template/templates/my-category/my-template/MyTemplate.ts
import * as path from 'path';
import { BaseTemplate } from '../../BaseTemplate';

export class MyTemplate extends BaseTemplate {
    id = 'my-template';
    name = 'My Template';
    description = 'Template description';
    category = 'My Category';
    recommendedResolution = '480X272';
    
    protected getTemplateProjectPath(): string {
        return path.join(__dirname, '..', '..', '..', '..', '..', 'template-projects', 'my-template');
    }
}
```

### 4. 注册模板

在 `src/template/templates/index.ts` 中注册：

```typescript
import { MyTemplate } from './my-category/my-template/MyTemplate';

export const TEMPLATE_REGISTRY: ITemplate[] = [
    // ...
    new MyTemplate(),
];
```

### 5. 编译

```bash
npm run compile
```

## 开发建议

### ✅ 应该做的

- 使用有意义的组件 ID
- 添加 XML 注释说明
- 提供示例数据
- 测试不同分辨率
- 编写清晰的 README

### ❌ 不应该做的

- 不要包含生成的代码（`src/autogen/`, `src/user/`）
- 不要包含编译输出（`build/`）
- 不要使用绝对路径
- 不要包含过大的资源文件

## 版本控制

`template-projects/` 目录应该被 Git 跟踪，但排除：

- `*/src/autogen/` - 生成的代码
- `*/src/user/` - 用户代码
- `*/build/` - 编译输出
- `*/.vscode/` - 编辑器配置

已在 `.gitignore` 中配置。

## 工作流程

```
1. 在 template-projects/smartwatch/ 中开发
   ↓
2. 编译扩展：npm run compile
   ↓
3. 重新加载 VSCode
   ↓
4. 测试：创建新项目验证模板
```

简单！不需要同步脚本。
