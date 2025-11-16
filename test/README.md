# HoneyGUI 测试文档

本文档详细介绍了HoneyGUI扩展的测试框架、测试类型、运行方法以及最佳实践。

## 测试框架

HoneyGUI扩展使用以下测试框架和工具：

- **Jest**: 主要的测试运行器，用于单元测试和集成测试
- **VSCode Testing API**: 用于端到端测试，允许在真实的VSCode环境中测试扩展
- **TypeScript**: 所有测试都使用TypeScript编写，确保类型安全

## 测试目录结构

```
test/
├── unit/            # 单元测试
├── integration/     # 集成测试
├── e2e/             # 端到端测试
├── setup-vscode-mocks.ts  # VSCode API模拟配置
└── README.md        # 本测试文档
```

- **unit/**: 包含所有单元测试，测试独立的组件和功能
- **integration/**: 包含集成测试，测试多个组件协同工作的功能
- **e2e/**: 包含端到端测试，测试在真实VSCode环境中的完整功能
- **setup-vscode-mocks.ts**: 配置VSCode API的模拟，用于单元测试

## 运行测试

### 运行所有测试

```bash
npm test
```

### 运行特定类型的测试

#### 单元测试

```bash
npm test
# 或指定单元测试目录
npm test -- test/unit
```

#### 集成测试

```bash
npm run test:integration
```

#### 端到端测试

```bash
npm run test:e2e
```

### 运行测试并查看覆盖率

```bash
npm run test:coverage
```

覆盖率报告将生成在 `coverage/` 目录中，包含HTML、JSON和文本格式的报告。

### 监视模式运行测试

```bash
npm run test:watch
```

这将在监视模式下运行测试，当文件更改时自动重新运行测试。

## 测试类型详解

### 1. 单元测试

单元测试专注于测试最小的代码单元，如函数、类或组件。在HoneyGUI中，我们测试：

- 核心功能类（如`CreateProjectPanel`）
- 工具函数
- VSCode扩展API交互

### 2. 集成测试

集成测试测试多个组件如何协同工作。我们测试：

- 命令注册和执行
- 扩展激活流程
- 基本的文件处理功能

### 3. 端到端测试

端到端测试在真实的VSCode环境中运行，测试完整的用户场景。我们测试：

- 扩展的完整功能流程
- 用户界面交互
- 实际的项目创建和管理功能

## 编写新测试

### 编写单元测试

1. 在 `test/unit/` 目录下创建新的测试文件，命名为 `[component].test.ts`
2. 使用Jest的测试API编写测试用例
3. 使用模拟来替代VSCode API和其他依赖

示例：

```typescript
import { MyComponent } from '../../src/path/to/MyComponent';

describe('MyComponent', () => {
  beforeEach(() => {
    // 设置测试环境
  });
  
  it('should do something', () => {
    // 测试逻辑
  });
});
```

### 编写集成测试

1. 在 `test/integration/` 目录下创建新的测试文件
2. 测试多个组件的交互
3. 可以使用真实的VSCode API或模拟

### 编写端到端测试

1. 在 `test/e2e/` 目录下创建新的测试文件
2. 确保测试可以通过VSCode测试API运行
3. 编写完整的用户场景测试

## VSCode API模拟

我们在 `setup-vscode-mocks.ts` 中提供了VSCode API的模拟实现，用于单元测试。这些模拟允许我们测试扩展的功能，而不需要实际的VSCode环境。

主要模拟的API包括：

- `vscode.window`
- `vscode.workspace`
- `vscode.commands`
- `vscode.extensions`

## 代码覆盖率

我们使用Jest的覆盖率收集功能来监控测试覆盖率。当前的覆盖率目标是：

- 分支覆盖率：50%
- 函数覆盖率：50%
- 行覆盖率：50%
- 语句覆盖率：50%

覆盖率报告将生成在 `coverage/` 目录中，包括：

- HTML报告：`coverage/index.html`
- JSON报告：`coverage/coverage-final.json`
- JUnit报告：`coverage/junit.xml`

## 测试最佳实践

1. **隔离测试**：每个测试应该独立运行，不依赖其他测试的状态
2. **模拟外部依赖**：使用模拟来替代外部依赖，使测试更加可靠
3. **测试边界条件**：测试正常情况、边界情况和错误情况
4. **保持测试简洁**：每个测试应该只测试一个功能点
5. **使用描述性的测试名称**：测试名称应该清晰地描述测试的目的
6. **定期运行测试**：在开发过程中定期运行测试，确保代码质量

## 故障排除

### 测试失败

1. 检查错误消息，了解失败的原因
2. 确保所有依赖都已正确安装
3. 检查是否有模拟未正确配置

### VSCode API相关错误

1. 确保在测试中正确模拟了VSCode API
2. 检查是否正确导入了模拟的API
3. 对于端到端测试，确保VSCode版本兼容

### 覆盖率问题

1. 检查未覆盖的代码，考虑添加相应的测试
2. 对于无法测试的代码，可以在覆盖率配置中排除

## 结论

良好的测试实践对于保持扩展的质量和稳定性至关重要。通过遵循本文档中的指南，我们可以确保HoneyGUI扩展的代码质量和功能正确性。