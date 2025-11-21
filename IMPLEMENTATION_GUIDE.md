# HoneyGUI 架构优化实施指南

本文档提供详细的步骤指导，帮助团队逐步实施架构优化。

---

## 快速开始

### 1. 运行紧急修复脚本

```bash
cd /home/howie_wang/workspace/honeygui-design
./scripts/quick-fix.sh
```

这将自动完成：
- ✅ 安装所有依赖
- ✅ 备份关键文件
- ✅ 运行类型检查
- ✅ 生成修复报告

---

## Phase 1: 紧急修复 (1-2周)

### 任务 1.1: 修复组件解析器 (2小时)

**目标**: 移除严格的`hg_`前缀限制，支持更多组件格式

**步骤**:

1. **备份原文件**
```bash
cp src/hml/HmlParser.ts src/hml/HmlParser.backup.ts
```

2. **替换解析器实现**
```bash
# 方案A: 使用改进版本
cp src/hml/HmlParser.improved.ts src/hml/HmlParser.ts

# 方案B: 手动修改
# 编辑 src/hml/HmlParser.ts
```

3. **手动修改方案** (如果选择方案B):

在 `src/hml/HmlParser.ts` 中：

```typescript
// 在类顶部添加组件白名单
private readonly VALID_COMPONENTS = new Set([
  'hg_button', 'hg_panel', 'hg_text', 'hg_image', 'hg_input',
  'hg_checkbox', 'hg_radio', 'hg_progressbar', 'hg_slider',
  'button', 'panel', 'text', 'image', 'input',
  'checkbox', 'radio', 'progressbar', 'slider',
  'screen', 'window', 'dialog', 'container'
]);

// 修改 _isHoneyGuiComponent 方法
private _isHoneyGuiComponent(componentName: string): boolean {
  // 检查白名单
  if (this.VALID_COMPONENTS.has(componentName)) {
    return true;
  }
  
  // 检查有效前缀
  const validPrefixes = ['hg_', 'gui_', 'custom_'];
  return validPrefixes.some(prefix => componentName.startsWith(prefix));
}
```

4. **测试修复**
```bash
npm run compile
# 检查是否有编译错误
```

5. **创建测试HML文件**
```xml
<!-- test.hml -->
<hml>
  <meta title="Test"/>
  <view>
    <hg_button id="btn1" x="10" y="10" width="100" height="40"/>
    <button id="btn2" x="120" y="10" width="100" height="40"/>
    <gui_panel id="panel1" x="10" y="60" width="200" height="100"/>
  </view>
</hml>
```

6. **验证**
- 在VSCode中打开test.hml
- 确认所有三种格式的组件都能正确显示

---

### 任务 1.2: 实现ConfigManager (1小时)

**步骤**:

1. **替换空实现**
```bash
cp src/config/ConfigManager.improved.ts src/config/ConfigManager.ts
```

2. **更新导入**

在需要使用配置的文件中：

```typescript
// 旧代码
const config = vscode.workspace.getConfiguration('honeygui');
const language = config.get('codegen.language', 'cpp');

// 新代码
import { ConfigManager } from '../config/ConfigManager';

const configManager = ConfigManager.getInstance();
const language = configManager.get('codegen.language', 'cpp');
```

3. **在ExtensionManager中初始化**

编辑 `src/core/ExtensionManager.ts`:

```typescript
import { ConfigManager } from '../config/ConfigManager';

export class ExtensionManager {
  private configManager: ConfigManager;
  
  constructor(private context: vscode.ExtensionContext) {
    this.configManager = ConfigManager.getInstance();
    // ...
  }
  
  async initialize(): Promise<void> {
    // 验证配置
    const validation = this.configManager.validate();
    if (!validation.valid) {
      logger.warn('配置验证失败:', validation.errors);
    }
    
    // 监听配置变更
    this.disposables.push(
      this.configManager.onDidChange(event => {
        logger.info(`配置变更: ${event.key} = ${event.newValue}`);
      })
    );
    
    // ...
  }
}
```

4. **测试**
```bash
npm run compile
# 按F5启动调试
# 修改VSCode设置中的honeygui配置项
# 检查日志输出
```

---

### 任务 1.3: 统一组件类型定义 (3小时)

**步骤**:

1. **标记旧格式为废弃**

编辑 `src/designer/DesignerModel.ts`:

```typescript
/**
 * @deprecated 使用 Component from '../hml/types' 替代
 * 此接口将在v2.0中移除
 */
export interface LegacyComponent {
  x: number;
  y: number;
  width: number;
  height: number;
  children: LegacyComponent[];
}
```

2. **创建迁移工具**

创建 `src/utils/ComponentMigration.ts`:

```typescript
import { Component, ComponentPosition } from '../hml/types';

export interface LegacyComponent {
  x: number;
  y: number;
  width: number;
  height: number;
  children?: LegacyComponent[];
  [key: string]: any;
}

export class ComponentMigration {
  static isLegacyFormat(obj: any): obj is LegacyComponent {
    return (
      typeof obj === 'object' &&
      'x' in obj &&
      'y' in obj &&
      !('position' in obj)
    );
  }
  
  static migrate(legacy: LegacyComponent): Component {
    const position: ComponentPosition = {
      x: legacy.x,
      y: legacy.y,
      width: legacy.width,
      height: legacy.height
    };
    
    const component: Component = {
      id: legacy.id || this.generateId(),
      type: legacy.type || 'unknown',
      name: legacy.name || legacy.id || 'unnamed',
      position,
      style: legacy.style || {},
      data: legacy.data || {},
      events: legacy.events || {},
      children: [],
      parent: null,
      visible: legacy.visible !== false,
      enabled: legacy.enabled !== false,
      locked: legacy.locked === true,
      zIndex: legacy.zIndex || 0
    };
    
    // 迁移子组件
    if (legacy.children && Array.isArray(legacy.children)) {
      component.children = legacy.children.map(child => {
        const migratedChild = this.migrate(child);
        return migratedChild.id;
      });
    }
    
    return component;
  }
  
  private static generateId(): string {
    return `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  static migrateDocument(doc: any): any {
    if (!doc.view || !doc.view.components) {
      return doc;
    }
    
    const migratedComponents = doc.view.components.map((comp: any) => {
      if (this.isLegacyFormat(comp)) {
        return this.migrate(comp);
      }
      return comp;
    });
    
    return {
      ...doc,
      view: {
        ...doc.view,
        components: migratedComponents
      }
    };
  }
}
```

3. **在HmlParser中使用迁移工具**

编辑 `src/hml/HmlParser.ts`:

```typescript
import { ComponentMigration } from '../utils/ComponentMigration';

export class HmlParser {
  parse(content: string): Document {
    const doc = this._parseInternal(content);
    
    // 自动迁移旧格式
    return ComponentMigration.migrateDocument(doc);
  }
}
```

4. **测试迁移**
```bash
# 创建包含旧格式的测试文件
# 打开并验证自动迁移
npm run compile
```

---

### 任务 1.4: 修复依赖问题 (30分钟)

**步骤**:

1. **清理node_modules**
```bash
rm -rf node_modules package-lock.json
```

2. **重新安装**
```bash
npm install
```

3. **验证安装**
```bash
npm list --depth=0
# 确认没有UNMET DEPENDENCY
```

4. **如果仍有问题，检查package.json**

确保依赖正确分类：

```json
{
  "dependencies": {
    "chokidar": "^3.6.0",
    "fast-xml-parser": "^4.3.2",
    "xml-js": "^1.6.11",
    "zustand": "^5.0.8",
    "lucide-react": "^0.553.0"
  },
  "devDependencies": {
    "@types/node": "^20.19.25",
    "@types/react": "^19.2.4",
    "@types/react-dom": "^19.2.3",
    "@types/vscode": "^1.80.0",
    "typescript": "^5.3.0",
    "webpack": "^5.102.1"
  }
}
```

---

## Phase 2: 架构重构 (2-3周)

### 任务 2.1: 引入分层架构 (1周)

**目录结构**:

```
src/
├── presentation/        # 表示层
│   ├── commands/
│   ├── views/
│   └── panels/
├── application/         # 应用层
│   ├── services/
│   └── usecases/
├── domain/             # 领域层
│   ├── models/
│   ├── parsers/
│   └── generators/
└── infrastructure/     # 基础设施层
    ├── filesystem/
    ├── logging/
    └── config/
```

**实施步骤**:

1. **创建目录结构**
```bash
mkdir -p src/presentation/{commands,views,panels}
mkdir -p src/application/{services,usecases}
mkdir -p src/domain/{models,parsers,generators}
mkdir -p src/infrastructure/{filesystem,logging,config}
```

2. **迁移现有代码**
```bash
# 示例：迁移HmlParser到domain层
mv src/hml/HmlParser.ts src/domain/parsers/
mv src/hml/HmlSerializer.ts src/domain/parsers/

# 迁移Logger到infrastructure层
mv src/utils/Logger.ts src/infrastructure/logging/

# 迁移ConfigManager到infrastructure层
mv src/config/ConfigManager.ts src/infrastructure/config/
```

3. **更新导入路径**

使用VSCode的重构功能或手动更新所有导入。

4. **创建服务层**

创建 `src/application/services/DesignerService.ts`:

```typescript
import { HmlParser } from '../../domain/parsers/HmlParser';
import { HmlSerializer } from '../../domain/parsers/HmlSerializer';
import { Document } from '../../domain/models/types';
import { FileSystemService } from '../../infrastructure/filesystem/FileSystemService';
import { Logger } from '../../infrastructure/logging/Logger';

export class DesignerService {
  constructor(
    private parser: HmlParser,
    private serializer: HmlSerializer,
    private fileSystem: FileSystemService,
    private logger: Logger
  ) {}
  
  async openDesign(filePath: string): Promise<Document> {
    this.logger.info(`Opening design: ${filePath}`);
    const content = await this.fileSystem.readFile(filePath);
    return this.parser.parse(content);
  }
  
  async saveDesign(filePath: string, document: Document): Promise<void> {
    this.logger.info(`Saving design: ${filePath}`);
    const content = await this.serializer.serialize(document, filePath);
    await this.fileSystem.writeFile(filePath, content);
  }
  
  async validateDesign(document: Document): Promise<{ valid: boolean; errors: string[] }> {
    // 实现验证逻辑
    return { valid: true, errors: [] };
  }
}
```

---

### 任务 2.2: 实现依赖注入 (3天)

**步骤**:

1. **创建DI容器**

创建 `src/core/Container.ts`:

```typescript
export type Factory<T> = () => T;
export type AsyncFactory<T> = () => Promise<T>;

export class Container {
  private singletons = new Map<string, any>();
  private factories = new Map<string, Factory<any>>();
  
  registerSingleton<T>(key: string, factory: Factory<T>): void {
    this.factories.set(key, factory);
  }
  
  registerTransient<T>(key: string, factory: Factory<T>): void {
    this.factories.set(key, factory);
  }
  
  resolve<T>(key: string): T {
    // 检查是否已有单例实例
    if (this.singletons.has(key)) {
      return this.singletons.get(key);
    }
    
    // 获取工厂函数
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Service not registered: ${key}`);
    }
    
    // 创建实例
    const instance = factory();
    
    // 缓存单例
    this.singletons.set(key, instance);
    
    return instance;
  }
  
  clear(): void {
    this.singletons.clear();
    this.factories.clear();
  }
}
```

2. **创建服务注册表**

创建 `src/core/ServiceRegistry.ts`:

```typescript
import { Container } from './Container';
import { Logger } from '../infrastructure/logging/Logger';
import { ConfigManager } from '../infrastructure/config/ConfigManager';
import { HmlParser } from '../domain/parsers/HmlParser';
import { HmlSerializer } from '../domain/parsers/HmlSerializer';
import { DesignerService } from '../application/services/DesignerService';

export function registerServices(container: Container): void {
  // Infrastructure
  container.registerSingleton('logger', () => new Logger());
  container.registerSingleton('config', () => ConfigManager.getInstance());
  
  // Domain
  container.registerSingleton('hmlParser', () => new HmlParser());
  container.registerSingleton('hmlSerializer', () => new HmlSerializer());
  
  // Application Services
  container.registerSingleton('designerService', () => {
    return new DesignerService(
      container.resolve('hmlParser'),
      container.resolve('hmlSerializer'),
      container.resolve('fileSystem'),
      container.resolve('logger')
    );
  });
}
```

3. **更新ExtensionManager**

```typescript
import { Container } from './Container';
import { registerServices } from './ServiceRegistry';

export class ExtensionManager {
  private container: Container;
  
  constructor(private context: vscode.ExtensionContext) {
    this.container = new Container();
    registerServices(this.container);
  }
  
  async initialize(): Promise<void> {
    const logger = this.container.resolve<Logger>('logger');
    logger.info('Initializing extension...');
    
    // 使用服务
    const designerService = this.container.resolve<DesignerService>('designerService');
    // ...
  }
}
```

---

### 任务 2.3: 实现事件总线 (2天)

**步骤**:

1. **创建事件总线**

创建 `src/core/EventBus.ts`:

```typescript
export type EventHandler<T = any> = (data: T) => void | Promise<void>;

export interface EventSubscription {
  unsubscribe: () => void;
}

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private logger?: any;
  
  setLogger(logger: any): void {
    this.logger = logger;
  }
  
  on<T>(event: string, handler: EventHandler<T>): EventSubscription {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    
    this.handlers.get(event)!.add(handler);
    this.logger?.debug(`Event subscribed: ${event}`);
    
    return {
      unsubscribe: () => this.off(event, handler)
    };
  }
  
  off<T>(event: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      this.logger?.debug(`Event unsubscribed: ${event}`);
    }
  }
  
  async emit<T>(event: string, data: T): Promise<void> {
    const handlers = this.handlers.get(event);
    if (!handlers || handlers.size === 0) {
      return;
    }
    
    this.logger?.debug(`Event emitted: ${event}`, data);
    
    const promises = Array.from(handlers).map(handler => {
      try {
        return Promise.resolve(handler(data));
      } catch (error) {
        this.logger?.error(`Event handler error for ${event}:`, error);
        return Promise.resolve();
      }
    });
    
    await Promise.all(promises);
  }
  
  clear(): void {
    this.handlers.clear();
  }
}

// 全局事件总线实例
export const eventBus = new EventBus();
```

2. **定义事件类型**

创建 `src/core/Events.ts`:

```typescript
export interface DesignSavedEvent {
  filePath: string;
  content: string;
  timestamp: number;
}

export interface DesignOpenedEvent {
  filePath: string;
  document: any;
}

export interface ComponentAddedEvent {
  componentId: string;
  componentType: string;
}

export interface ComponentDeletedEvent {
  componentId: string;
}

export interface ConfigChangedEvent {
  key: string;
  value: any;
}

// 事件名称常量
export const Events = {
  DESIGN_SAVED: 'design:saved',
  DESIGN_OPENED: 'design:opened',
  COMPONENT_ADDED: 'component:added',
  COMPONENT_DELETED: 'component:deleted',
  CONFIG_CHANGED: 'config:changed'
} as const;
```

3. **使用事件总线**

在DesignerService中：

```typescript
import { eventBus } from '../../core/EventBus';
import { Events, DesignSavedEvent } from '../../core/Events';

export class DesignerService {
  async saveDesign(filePath: string, document: Document): Promise<void> {
    // 保存逻辑
    await this.fileSystem.writeFile(filePath, content);
    
    // 发布事件
    await eventBus.emit<DesignSavedEvent>(Events.DESIGN_SAVED, {
      filePath,
      content,
      timestamp: Date.now()
    });
  }
}
```

在PreviewService中：

```typescript
import { eventBus } from '../../core/EventBus';
import { Events, DesignSavedEvent } from '../../core/Events';

export class PreviewService {
  constructor() {
    // 订阅事件
    eventBus.on<DesignSavedEvent>(Events.DESIGN_SAVED, async (event) => {
      await this.reloadPreview(event.filePath);
    });
  }
}
```

---

## Phase 3: 测试与质量 (2-3周)

### 任务 3.1: 建立测试框架 (1天)

**步骤**:

1. **安装测试依赖**
```bash
npm install --save-dev jest @types/jest ts-jest
```

2. **配置Jest**

创建 `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/webview/**',
    '!src/**/__tests__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

3. **添加测试脚本**

在 `package.json` 中：

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

---

### 任务 3.2: 编写单元测试 (1周)

**示例测试**:

创建 `src/domain/parsers/__tests__/HmlParser.test.ts`:

```typescript
import { HmlParser } from '../HmlParser';

describe('HmlParser', () => {
  let parser: HmlParser;
  
  beforeEach(() => {
    parser = new HmlParser();
  });
  
  describe('parse', () => {
    it('should parse valid HML with hg_ prefix', () => {
      const xml = `
        <hml>
          <meta title="Test"/>
          <view>
            <hg_button id="btn1" x="10" y="20" width="100" height="40"/>
          </view>
        </hml>
      `;
      
      const doc = parser.parse(xml);
      
      expect(doc.meta.title).toBe('Test');
      expect(doc.view.components).toHaveLength(1);
      expect(doc.view.components[0].type).toBe('hg_button');
      expect(doc.view.components[0].position).toEqual({
        x: 10, y: 20, width: 100, height: 40
      });
    });
    
    it('should parse components without prefix', () => {
      const xml = `
        <hml>
          <meta title="Test"/>
          <view>
            <button id="btn1" x="10" y="20" width="100" height="40"/>
          </view>
        </hml>
      `;
      
      const doc = parser.parse(xml);
      
      expect(doc.view.components).toHaveLength(1);
      expect(doc.view.components[0].type).toBe('hg_button'); // 标准化后
    });
    
    it('should throw on invalid XML', () => {
      expect(() => parser.parse('<invalid')).toThrow();
    });
    
    it('should handle nested components', () => {
      const xml = `
        <hml>
          <meta title="Test"/>
          <view>
            <hg_panel id="panel1" x="0" y="0" width="200" height="200">
              <hg_button id="btn1" x="10" y="10" width="100" height="40"/>
            </hg_panel>
          </view>
        </hml>
      `;
      
      const doc = parser.parse(xml);
      
      const panel = doc.view.components.find(c => c.id === 'panel1');
      expect(panel).toBeDefined();
      expect(panel!.children).toHaveLength(1);
    });
  });
});
```

---

## 验证清单

完成每个阶段后，使用此清单验证：

### Phase 1 验证
- [ ] `npm install` 无错误
- [ ] `npm run compile` 无错误
- [ ] 所有组件格式都能正确解析
- [ ] ConfigManager正常工作
- [ ] 旧格式组件自动迁移

### Phase 2 验证
- [ ] 代码按层次组织
- [ ] 依赖注入正常工作
- [ ] 事件总线正常工作
- [ ] 无循环依赖

### Phase 3 验证
- [ ] 测试覆盖率 ≥70%
- [ ] 所有测试通过
- [ ] TypeScript严格模式无错误
- [ ] ESLint无错误

---

## 故障排除

### 问题: 编译错误

**解决方案**:
```bash
# 清理构建缓存
rm -rf out/
npm run compile
```

### 问题: 测试失败

**解决方案**:
```bash
# 运行单个测试
npm test -- HmlParser.test.ts

# 查看详细输出
npm test -- --verbose
```

### 问题: 依赖冲突

**解决方案**:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 获取帮助

- 查看 `ARCHITECTURE_ANALYSIS.md` 了解详细架构分析
- 查看 `DEVELOPMENT.md` 了解开发流程
- 查看 `CODE_AUDIT_REPORT.md` 了解已知问题

---

**最后更新**: 2025-11-21
