# Design Document

## Overview

本设计文档描述 HoneyGUI Design 项目的端到端测试框架增强方案。该框架基于现有的 `scripts/e2e-test.ts` 进行重构和扩展，提供模块化、可扩展的测试架构，支持多种测试场景、详细的断言机制和清晰的测试报告。

**核心目标：**
- 将单一测试脚本重构为模块化测试框架
- 支持多测试用例并行和顺序执行
- 提供丰富的断言库用于验证各个测试步骤
- 实现 HML 序列化/解析的往返一致性测试
- 生成清晰的测试报告和失败诊断信息

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Test Runner                              │
│  - 测试套件管理                                               │
│  - 测试用例调度                                               │
│  - 结果汇总报告                                               │
└────────────┬────────────────────────────────────────────────┘
             │
             ├──────────────┬──────────────┬──────────────┐
             │              │              │              │
┌────────────▼────┐ ┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
│  Test Case 1    │ │ Test Case 2 │ │   ...    │ │ Test Case N │
│  - 组件定义     │ │             │ │          │ │             │
│  - 验证规则     │ │             │ │          │ │             │
└────────┬────────┘ └──────┬──────┘ └────┬─────┘ └──────┬──────┘
         │                 │              │              │
         └─────────────────┴──────────────┴──────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
┌────────▼────────┐              ┌──────────▼──────────┐
│  Test Executor  │              │  Assertion Library  │
│  - 环境准备     │              │  - HML 验证         │
│  - 步骤执行     │              │  - 代码验证         │
│  - 清理管理     │              │  - 编译验证         │
└────────┬────────┘              │  - 往返一致性验证   │
         │                       └─────────────────────┘
         │
┌────────▼────────────────────────────────────────────┐
│              Test Pipeline                          │
│  1. 项目创建                                        │
│  2. HML 生成 (HmlSerializer)                        │
│  3. HML 解析 (HmlParser)                            │
│  4. 代码生成 (HoneyGuiCCodeGenerator)               │
│  5. 编译 (BuildCore)                                │
│  6. 运行仿真 (可选)                                 │
└─────────────────────────────────────────────────────┘
```

### 模块职责

**TestRunner（测试运行器）**
- 管理测试套件和测试用例
- 调度测试执行（顺序/并行）
- 收集测试结果并生成报告
- 处理测试失败和继续执行逻辑

**TestCase（测试用例）**
- 定义测试场景（组件配置、项目配置）
- 指定验证规则和断言
- 提供测试元数据（名称、描述、标签）

**TestExecutor（测试执行器）**
- 执行测试管道的各个步骤
- 管理临时测试环境
- 调用断言库进行验证
- 处理测试清理

**AssertionLibrary（断言库）**
- 提供各种断言方法
- 生成详细的错误信息
- 支持自定义断言扩展

**TestReporter（测试报告器）**
- 实时输出测试进度
- 生成汇总报告
- 格式化错误信息
- 支持多种输出格式（控制台、JSON、HTML）

## Components and Interfaces

### 1. TestRunner

```typescript
interface TestRunner {
  // 添加测试用例
  addTestCase(testCase: TestCase): void;
  
  // 添加测试套件
  addTestSuite(suite: TestSuite): void;
  
  // 运行所有测试
  runAll(): Promise<TestResult>;
  
  // 运行特定测试
  runTest(testId: string): Promise<TestResult>;
  
  // 配置运行器
  configure(config: RunnerConfig): void;
}

interface RunnerConfig {
  // 执行模式：sequential | parallel
  executionMode: 'sequential' | 'parallel';
  
  // 失败时是否继续
  continueOnFailure: boolean;
  
  // 超时时间（毫秒）
  timeout: number;
  
  // 是否清理临时文件
  cleanup: boolean;
  
  // SDK 路径
  sdkPath: string;
  
  // 是否跳过编译
  skipCompilation?: boolean;
  
  // 是否跳过仿真
  skipSimulation?: boolean;
}
```

### 2. TestCase

```typescript
interface TestCase {
  // 测试用例 ID
  id: string;
  
  // 测试名称
  name: string;
  
  // 测试描述
  description: string;
  
  // 测试标签
  tags: string[];
  
  // 组件定义
  components: Component[];
  
  // 项目配置
  projectConfig: ProjectConfig;
  
  // 验证规则
  assertions: Assertion[];
  
  // 执行测试
  execute(executor: TestExecutor): Promise<TestCaseResult>;
}

interface TestCaseResult {
  // 测试用例 ID
  testId: string;
  
  // 是否通过
  passed: boolean;
  
  // 执行时间（毫秒）
  duration: number;
  
  // 断言结果
  assertionResults: AssertionResult[];
  
  // 错误信息
  errors: string[];
  
  // 测试工件路径
  artifacts: TestArtifacts;
}
```

### 3. TestExecutor

```typescript
interface TestExecutor {
  // 创建测试环境
  setupEnvironment(testCase: TestCase): Promise<TestEnvironment>;
  
  // 执行测试管道
  executePipeline(env: TestEnvironment): Promise<PipelineResult>;
  
  // 清理测试环境
  cleanup(env: TestEnvironment, preserveArtifacts: boolean): Promise<void>;
  
  // 获取断言库
  getAssertions(): AssertionLibrary;
}

interface TestEnvironment {
  // 临时项目路径
  projectPath: string;
  
  // 测试用例
  testCase: TestCase;
  
  // 生成的文件路径
  generatedFiles: {
    hmlFile?: string;
    cFiles?: string[];
    executable?: string;
  };
  
  // 编译目录
  buildDir?: string;
}

interface PipelineResult {
  // 各步骤结果
  steps: {
    projectCreation: StepResult;
    hmlGeneration: StepResult;
    hmlParsing: StepResult;
    codeGeneration: StepResult;
    compilation?: StepResult;
    simulation?: StepResult;
  };
  
  // 整体是否成功
  success: boolean;
}

interface StepResult {
  // 步骤名称
  name: string;
  
  // 是否成功
  success: boolean;
  
  // 执行时间
  duration: number;
  
  // 错误信息
  error?: string;
  
  // 输出数据
  output?: any;
}
```

### 4. AssertionLibrary

```typescript
interface AssertionLibrary {
  // HML 文件断言
  assertHmlFileExists(filePath: string): AssertionResult;
  assertHmlValidFormat(content: string): AssertionResult;
  assertHmlComponentCount(content: string, expected: number): AssertionResult;
  
  // HML 解析断言
  assertParsedComponentTypes(components: Component[], expectedTypes: string[]): AssertionResult;
  assertParsedComponentProperties(component: Component, expectedProps: Record<string, any>): AssertionResult;
  
  // 代码生成断言
  assertCFileExists(filePath: string): AssertionResult;
  assertCFileContains(filePath: string, pattern: string | RegExp): AssertionResult;
  assertFunctionExists(cCode: string, functionName: string): AssertionResult;
  
  // 编译断言
  assertExecutableExists(exePath: string): AssertionResult;
  assertNoCompilationErrors(compileOutput: string): AssertionResult;
  
  // 往返一致性断言
  assertRoundTripConsistency(original: Component[], roundTripped: Component[]): AssertionResult;
  assertSerializeParseEquivalence(document: HmlDocument): AssertionResult;
  
  // 自定义断言
  assert(condition: boolean, message: string): AssertionResult;
}

interface AssertionResult {
  // 是否通过
  passed: boolean;
  
  // 断言名称
  name: string;
  
  // 错误信息
  message?: string;
  
  // 预期值
  expected?: any;
  
  // 实际值
  actual?: any;
  
  // 断言位置
  location?: string;
}
```

### 5. TestReporter

```typescript
interface TestReporter {
  // 报告测试开始
  reportStart(suite: TestSuite): void;
  
  // 报告测试用例开始
  reportTestStart(testCase: TestCase): void;
  
  // 报告测试步骤
  reportStep(step: string, status: 'running' | 'success' | 'failure'): void;
  
  // 报告测试用例完成
  reportTestComplete(result: TestCaseResult): void;
  
  // 报告测试套件完成
  reportComplete(results: TestResult): void;
  
  // 生成报告文件
  generateReport(results: TestResult, format: 'console' | 'json' | 'html'): string;
}

interface TestResult {
  // 总测试数
  total: number;
  
  // 通过数
  passed: number;
  
  // 失败数
  failed: number;
  
  // 跳过数
  skipped: number;
  
  // 总耗时
  duration: number;
  
  // 各测试用例结果
  testCaseResults: TestCaseResult[];
}
```

## Data Models

### TestSuite（测试套件）

```typescript
interface TestSuite {
  // 套件 ID
  id: string;
  
  // 套件名称
  name: string;
  
  // 套件描述
  description: string;
  
  // 测试用例列表
  testCases: TestCase[];
  
  // 套件配置
  config?: Partial<RunnerConfig>;
}
```

### TestArtifacts（测试工件）

```typescript
interface TestArtifacts {
  // 项目目录
  projectDir: string;
  
  // HML 文件
  hmlFile?: string;
  
  // 生成的 C 文件
  cFiles: string[];
  
  // 可执行文件
  executable?: string;
  
  // 编译日志
  compileLog?: string;
  
  // 仿真输出
  simulationOutput?: string;
}
```

### Assertion（断言定义）

```typescript
interface Assertion {
  // 断言类型
  type: 'hml' | 'parse' | 'codegen' | 'compile' | 'roundtrip' | 'custom';
  
  // 断言函数
  check: (context: TestContext) => AssertionResult;
  
  // 断言描述
  description: string;
}

interface TestContext {
  // 测试环境
  environment: TestEnvironment;
  
  // 管道结果
  pipelineResult: PipelineResult;
  
  // 断言库
  assertions: AssertionLibrary;
}
```

