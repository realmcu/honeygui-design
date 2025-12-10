# 项目模板系统

## 目录结构

```
templates/
├── ITemplate.ts              # 模板接口定义
├── BaseTemplate.ts           # 模板基类
├── index.ts                  # 模板注册中心
├── wearable/                 # 可穿戴设备模板
│   └── smartwatch/
│       ├── SmartWatchTemplate.ts
│       ├── template.hml      # HML 模板文件 ⭐
│       └── assets/           # 模板资源（未来）
├── utility/                  # 工具类模板
│   ├── settings/
│   │   ├── SettingsTemplate.ts
│   │   ├── template.hml      # HML 模板文件 ⭐
│   │   └── assets/
│   └── dashboard/
│       ├── DashboardTemplate.ts
│       ├── template.hml      # HML 模板文件 ⭐
│       └── assets/
└── README.md                 # 本文件
```

## 模板文件方式

### 为什么使用模板文件？

✅ **直观** - 直接编辑 XML，有语法高亮  
✅ **易维护** - 复杂模板不需要字符串拼接  
✅ **可复用** - 通过变量替换支持不同配置  

### 模板文件示例

```xml
<!-- template.hml -->
<?xml version="1.0" encoding="UTF-8"?>
<hg_screen id="{{projectName}}Screen"
    xmlns:hg="http://honeygui.com/hml"
    appId="{{appId}}"
    minSdk="{{minSdk}}"
    pixelMode="{{pixelMode}}"
    screenWidth="{{width}}"
    screenHeight="{{height}}">
    <hg_view id="mainView" x="0" y="0" w="{{width}}" h="{{height}}">
        <hg_text id="title" x="{{titleX}}" y="{{titleY}}" w="200" h="40" 
                 text="Hello" fontSize="24" color="#FFFFFF" />
    </hg_view>
</hg_screen>
```

### TypeScript 类实现

```typescript
import * as path from 'path';
import { BaseTemplate } from '../../BaseTemplate';
import { TemplateConfig } from '../../ITemplate';

export class MyTemplate extends BaseTemplate {
    id = 'my-template';
    name = 'My Template';
    description = 'Template description';
    category = 'My Category';
    recommendedResolution = '480X272';
    
    generateHml(config: TemplateConfig): string {
        const { width, height } = this.parseResolution(config.resolution);
        
        // 定义变量
        const variables = {
            projectName: config.projectName,
            appId: config.appId,
            minSdk: config.minSdk,
            pixelMode: config.pixelMode,
            width: width,
            height: height,
            titleX: Math.floor(width / 2 - 100),
            titleY: Math.floor(height / 2 - 20)
        };
        
        // 加载模板并替换变量
        const templatePath = path.join(__dirname, 'template.hml');
        return this.loadTemplate(templatePath, variables);
    }
}
```

## 添加新模板

### 1. 创建目录和文件

```bash
mkdir -p src/template/templates/entertainment/music-player
cd src/template/templates/entertainment/music-player
```

创建以下文件：
- `MusicPlayerTemplate.ts` - TypeScript 类
- `template.hml` - HML 模板文件
- `assets/` - 资源目录（可选）

### 2. 编写 HML 模板

```xml
<!-- template.hml -->
<?xml version="1.0" encoding="UTF-8"?>
<hg_screen id="{{projectName}}Screen"
    xmlns:hg="http://honeygui.com/hml"
    appId="{{appId}}"
    minSdk="{{minSdk}}"
    pixelMode="{{pixelMode}}"
    screenWidth="{{width}}"
    screenHeight="{{height}}">
    <hg_view id="playerView" x="0" y="0" w="{{width}}" h="{{height}}">
        <!-- 你的组件 -->
    </hg_view>
</hg_screen>
```

### 3. 实现 TypeScript 类

```typescript
// MusicPlayerTemplate.ts
import * as path from 'path';
import { BaseTemplate } from '../../BaseTemplate';
import { TemplateConfig } from '../../ITemplate';

export class MusicPlayerTemplate extends BaseTemplate {
    id = 'music-player';
    name = 'Music Player';
    description = 'Music player with playback controls';
    category = 'Entertainment';
    recommendedResolution = '800X480';
    
    generateHml(config: TemplateConfig): string {
        const { width, height } = this.parseResolution(config.resolution);
        
        const variables = {
            projectName: config.projectName,
            appId: config.appId,
            minSdk: config.minSdk,
            pixelMode: config.pixelMode,
            width: width,
            height: height,
            // 添加你的计算变量
        };
        
        const templatePath = path.join(__dirname, 'template.hml');
        return this.loadTemplate(templatePath, variables);
    }
}
```

### 4. 注册模板

在 `index.ts` 中：

```typescript
import { MusicPlayerTemplate } from './entertainment/music-player/MusicPlayerTemplate';

export const TEMPLATE_REGISTRY: ITemplate[] = [
    new SmartWatchTemplate(),
    new SettingsTemplate(),
    new DashboardTemplate(),
    new MusicPlayerTemplate(),  // 添加新模板
];
```

### 5. 编译

```bash
npm run compile
```

编译脚本会自动：
1. 编译 TypeScript 代码
2. 拷贝 `.hml` 文件到 `out/` 目录

## 模板分类

当前支持的分类：
- **Wearable** - 可穿戴设备
- **Navigation** - 导航类
- **Data Display** - 数据展示
- **Entertainment** - 娱乐类（未来）
- **Utility** - 工具类（未来）
- **Smart Home** - 智能家居（未来）

## 最佳实践

1. **命名规范**
   - 模板 ID：小写字母 + 连字符（如 `music-player`）
   - 类名：PascalCase + Template 后缀（如 `MusicPlayerTemplate`）
   - 文件名：与类名一致

2. **分辨率适配**
   - 使用 `parseResolution()` 获取宽高
   - 组件位置使用计算值，支持不同分辨率
   - 设置合理的推荐分辨率

3. **资源管理**
   - 资源文件放在模板的 `assets/` 目录
   - 使用相对路径引用
   - 在 `getAssets()` 中声明所有资源

4. **代码质量**
   - 继承 `BaseTemplate` 基类
   - 添加详细的注释
   - 组件 ID 使用有意义的名称

## 未来计划

- [ ] 支持模板预览图显示
- [ ] 支持模板搜索和过滤
- [ ] 支持模板版本管理
- [ ] 支持用户自定义模板
- [ ] 支持模板市场（可选）
