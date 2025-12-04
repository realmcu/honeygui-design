# Requirements Document

## Introduction

本文档定义 HoneyGUI Design 项目的端到端测试框架完善需求。该框架基于现有的 `scripts/e2e-test.ts` 进行扩展和增强，提供更全面的测试覆盖、更好的错误报告和更灵活的测试配置，确保从 HML 生成到代码编译运行的完整流程正确性。

## Glossary

- **Testing Framework**: 本文档所指的端到端测试框架系统，负责执行测试、验证结果和生成报告
- **E2E Test**: 端到端测试，测试从 HML 生成到代码编译运行的完整工作流程
- **Test Suite**: 测试套件，一组相关的测试用例集合
- **Test Case**: 测试用例，单个测试场景的具体实现
- **Test Fixture**: 测试固件，测试所需的预设数据或环境配置
- **Test Assertion**: 测试断言，验证测试结果是否符合预期的检查点
- **HML Parser**: HML 解析器，将 HML 文本解析为组件对象
- **HML Serializer**: HML 序列化器，将组件对象序列化为 HML 文本
- **Code Generator**: 代码生成器，将组件对象生成为 C/C++ 代码
- **Build Core**: 编译核心，负责准备编译环境和执行编译的模块
- **Test Reporter**: 测试报告器，生成测试结果报告的工具
- **Test Artifact**: 测试工件，测试过程中生成的文件和数据
- **Developer**: 开发者，使用测试框架验证代码正确性的用户

## Requirements

### Requirement 1

**User Story:** 作为开发者，我希望 E2E 测试框架支持多种测试场景，以便验证不同组件类型和配置的正确性。

#### Acceptance Criteria

1. WHEN Developer invokes the E2E test command THEN THE Testing Framework SHALL execute all registered test cases
2. WHEN Developer defines a test case THEN THE Testing Framework SHALL accept configuration for component combinations and properties
3. WHEN THE Testing Framework executes test cases THEN THE Testing Framework SHALL run each test case sequentially and report individual results
4. WHEN a test case fails THEN THE Testing Framework SHALL continue executing remaining test cases
5. WHEN all test cases complete THEN THE Testing Framework SHALL generate a summary report containing pass count, fail count, and total count

### Requirement 2

**User Story:** 作为开发者，我希望测试框架提供详细的断言机制，以便精确验证每个测试步骤的结果。

#### Acceptance Criteria

1. WHEN THE Testing Framework validates HML generation THEN THE Testing Framework SHALL verify the generated HML file exists and contains valid XML format
2. WHEN THE Testing Framework validates HML parsing THEN THE Testing Framework SHALL verify the parsed component count and types match expected values
3. WHEN THE Testing Framework validates code generation THEN THE Testing Framework SHALL verify the generated C files contain expected functions and structures
4. WHEN THE Testing Framework validates compilation THEN THE Testing Framework SHALL verify the executable file is generated without compilation errors
5. WHEN an assertion fails THEN THE Testing Framework SHALL output an error message containing expected value, actual value, and assertion location

### Requirement 3

**User Story:** 作为开发者，我希望测试框架能够测试不同类型的组件，以便确保所有支持的组件都能正确生成代码。

#### Acceptance Criteria

1. WHEN THE Testing Framework tests container components THEN THE Testing Framework SHALL verify hg_view and hg_window generate correct C code
2. WHEN THE Testing Framework tests UI components THEN THE Testing Framework SHALL verify hg_button, hg_text, and hg_image generate correct C code
3. WHEN THE Testing Framework tests nested components THEN THE Testing Framework SHALL verify parent-child relationships are correctly represented in generated code
4. WHEN THE Testing Framework tests component properties THEN THE Testing Framework SHALL verify position, style, and data properties are correctly set in generated code
5. WHEN THE Testing Framework tests event bindings THEN THE Testing Framework SHALL verify event callback functions are correctly generated in code

### Requirement 4

**User Story:** 作为开发者，我希望测试框架能够处理测试失败情况，以便快速定位和调试问题。

#### Acceptance Criteria

1. WHEN a test case fails THEN THE Testing Framework SHALL preserve test artifacts including generated HML files, C code files, and compilation logs
2. WHEN a test case fails THEN THE Testing Framework SHALL output detailed error information and the failed step to the console
3. WHEN a test case fails THEN THE Testing Framework SHALL mark the test case as failed and continue executing subsequent test cases
4. WHEN environment validation fails THEN THE Testing Framework SHALL output clear environment configuration guidance
5. WHEN compilation fails THEN THE Testing Framework SHALL output complete compilation error messages

### Requirement 5

**User Story:** 作为开发者，我希望测试框架支持灵活的配置，以便适应不同的测试需求和环境。

#### Acceptance Criteria

1. WHEN Developer configures test cases THEN THE Testing Framework SHALL accept test scenario definitions from configuration files
2. WHEN Developer configures test environment THEN THE Testing Framework SHALL accept parameters including SDK path and screen resolution
3. WHEN Developer configures test behavior THEN THE Testing Framework SHALL accept options including timeout duration and temporary file cleanup preference
4. WHERE SDK is not installed THEN THE Testing Framework SHALL allow skipping compilation steps and test only code generation
5. WHERE graphical interface is not available THEN THE Testing Framework SHALL skip simulation execution steps

### Requirement 6

**User Story:** 作为开发者，我希望测试框架提供清晰的测试报告，以便快速了解测试结果和问题。

#### Acceptance Criteria

1. WHEN test execution begins THEN THE Testing Framework SHALL output the test suite name and list of test cases
2. WHEN THE Testing Framework executes tests THEN THE Testing Framework SHALL output real-time progress for each test step
3. WHEN test execution completes THEN THE Testing Framework SHALL output a summary report containing total count, pass count, fail count, and elapsed time
4. WHEN a test case passes THEN THE Testing Framework SHALL display success information with green color markers
5. WHEN a test case fails THEN THE Testing Framework SHALL display failure information with red color markers and detailed error messages

### Requirement 7

**User Story:** 作为开发者，我希望测试框架能够验证 HML 序列化和解析的往返一致性，以便确保数据不丢失。

#### Acceptance Criteria

1. WHEN THE Testing Framework serializes component objects to HML THEN THE Testing Framework SHALL verify the generated HML text has valid format
2. WHEN THE Testing Framework parses HML text to component objects THEN THE Testing Framework SHALL verify the parsed object structure is complete
3. WHEN THE Testing Framework performs serialize-then-parse operation THEN THE Testing Framework SHALL verify component count, types, and properties match the original objects
4. WHEN THE Testing Framework performs parse-then-serialize operation THEN THE Testing Framework SHALL verify the generated HML is semantically equivalent to the original HML
5. WHEN THE Testing Framework tests round-trip conversion THEN THE Testing Framework SHALL verify all component properties including position, style, and data remain unchanged

### Requirement 8

**User Story:** 作为开发者，我希望测试框架能够清理测试环境，以便避免测试之间的相互影响。

#### Acceptance Criteria

1. WHEN test execution begins THEN THE Testing Framework SHALL create an isolated temporary directory for test execution
2. WHEN test execution completes THEN THE Testing Framework SHALL provide options to clean up or preserve test artifacts
3. WHILE cleanup mode is enabled THEN THE Testing Framework SHALL delete all temporary files and directories after test completion
4. WHILE preserve mode is enabled THEN THE Testing Framework SHALL retain test artifacts and output their storage path
5. WHEN a test case fails THEN THE Testing Framework SHALL preserve test artifacts by default for debugging purposes

### Requirement 9

**User Story:** 作为开发者，我希望测试框架易于扩展，以便添加新的测试用例。

#### Acceptance Criteria

1. WHEN Developer adds a new test case THEN THE Testing Framework SHALL provide a simple test case definition interface
2. WHEN Developer defines a test case THEN THE Testing Framework SHALL accept specifications for component list, project configuration, and validation rules
3. WHEN Developer registers a test case THEN THE Testing Framework SHALL automatically add the new case to the test suite
4. WHEN THE Testing Framework executes a test case THEN THE Testing Framework SHALL provide an isolated test environment for that case
5. WHEN a test case fails THEN THE Testing Framework SHALL output the test case name and failure reason
