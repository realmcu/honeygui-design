# 离线开发模式配置

## 背景说明

项目目前处于开发阶段，尚未定义 Runner 服务器地址。为了避免调试时出现网络访问失败的问题，已将自动下载功能默认禁用。

## 配置变更

### 1. package.json

```json
"honeygui.preview.autoDownload": {
  "type": "boolean",
  "default": false,  // 已改为 false（原为 true）
  "description": "自动下载Runner（开发阶段：默认禁用，避免网络访问失败）"
}
```

**变更点**:
- `default`: `true` → `false`
- 添加了说明："开发阶段：默认禁用，避免网络访问失败"

### 2. PreviewRunner.ts

修改了 `start()` 方法中的错误提示：

```typescript
if (!this.isRunnerInstalled()) {
  if (this.autoDownload) {
    // 注意：开发阶段默认禁用自动下载，避免网络访问失败
    await this.downloadRunner();
  } else {
    throw new Error(
      `HoneyGUI Runner未找到: ${this.runnerPath}\n\n` +
      '请确保Runner已手动安装到以下位置之一:\n' +
      '1. 在VS Code设置中配置 honeygui.preview.runnerPath\n' +
      '2. 将Runner安装到: ~/.honeygui/runner/\n\n' +
      '当前为离线模式（预览自动下载已禁用）。\n' +
      '如需启用自动下载，请在设置中将 "honeygui.preview.autoDownload" 设为 true。'
    );
  }
}
```

**说明**:
- 添加了注释说明这是开发阶段的临时设置
- 错误提示明确告知用户当前为离线模式
- 提供解决方案和启用自动下载的方法

### 3. PreviewService.ts

增强了错误检查逻辑：

```typescript
if (!status.isInstalled) {
  const config = vscode.workspace.getConfiguration('honeygui.preview');
  const autoDownload = config.get<boolean>('autoDownload', false);

  if (autoDownload) {
    vscode.window.showErrorMessage(
      'HoneyGUI Runner未安装',
      '尝试自动下载Runner...（开发阶段默认禁用自动下载）'
    );
  } else {
    vscode.window.showErrorMessage(
      'HoneyGUI Runner未找到',
      `Runner未在以下位置找到:\n${status.runnerPath}\n\n` +
      '解决方案:\n' +
      '1. 在VS Code设置中配置 honeygui.preview.runnerPath\n' +
      '2. 将Runner安装到: ~/.honeygui/runner/\n\n' +
      '当前为离线开发模式（自动下载已禁用）。'
    );
  }
  return;
}
```

**修复了逻辑错误**:
- 原代码：`if (!status.isInstalled && status.isRunning)` - 条件判断错误
- 新代码：`if (!status.isInstalled)` - 正确检查是否安装

## 当前行为

### 启动预览时的流程

1. **检查 Runner 是否已安装**
   - ✅ 已安装 → 正常启动预览
   - ❌ 未安装 → 进入步骤 2

2. **检查 autoDownload 设置**
   - ⚠️ `autoDownload = true` → 尝试下载（开发阶段不推荐）
   - ❌ `autoDownload = false` → 显示错误提示，告知用户手动安装

### 错误提示示例

当 Runner 未找到且 `autoDownload = false` 时：

```
HoneyGUI Runner未找到: /home/user/.honeygui/runner/runner

请确保Runner已手动安装到以下位置之一:
1. 在VS Code设置中配置 honeygui.preview.runnerPath
2. 将Runner安装到: ~/.honeygui/runner/

当前为离线模式（预览自动下载已禁用）。
如需启用自动下载，请在设置中将 "honeygui.preview.autoDownload" 设为 true。
```

## 开发建议

### 选项 1: 手动安装 Runner（推荐）

在开发阶段，建议手动安装 Runner 到本地：

```bash
# 创建目录
mkdir -p ~/.honeygui/runner/

# 复制或创建占位 Runner 文件（即使是个空文件或脚本）
touch ~/.honeygui/runner/runner
chmod +x ~/.honeygui/runner/runner  # Linux/macOS
```

这样可以在不完全实现 Runner 的情况下测试预览功能。

### 选项 2: 启用自动下载（不推荐用于当前开发阶段）

如果需要测试自动下载功能：

1. 在 VS Code 设置中：
```json
{
  "honeygui.preview.autoDownload": true
}
```

2. 在代码中修改 `PreviewRunner.ts` 的 `getRunnerDownloadInfo()` 方法，提供真实的服务器地址

**注意**: 目前下载 URL 为示例地址（`https://example.com/...`），实际会下载失败

### 选项 3: 使用 Mock Runner

创建一个简单的 mock Runner 脚本用于开发测试：

```bash
#!/bin/bash
# ~/.honeygui/runner/runner

echo "Mock Runner: $*"
echo "Preview server started"

# 保持运行
while true; do sleep 1; done
```

```powershell
# Windows: ~/.honeygui/runner/runner.bat
@echo off
echo Mock Runner: %*
echo Preview server started

rem 保持运行
:loop
timeout /t 1 >nul
goto loop
```

## 未来计划

当 Runner 服务器地址确定后，可以：

1. 更新 `getRunnerDownloadInfo()` 中的 URL
2. 将 `autoDownload` 的默认值改回 `true`
3. 删除错误提示中的"开发阶段"说明
4. 更新本文档，说明自动下载功能已启用

## 代码保留说明

所有网络下载相关的代码都已保留：

- ✅ `downloadRunner()` - 下载并安装 Runner
- ✅ `downloadFile()` - 文件下载核心逻辑
- ✅ `getRunnerDownloadInfo()` - 获取下载 URL
- ✅ `unzipFile()` - ZIP 解压
- ✅ `autoDownload` 配置项

这些代码只是默认不执行（`autoDownload = false`），可以在需要时通过设置启用。

## 总结

**目标**: 在开发阶段避免网络访问失败

**方案**: 将 `autoDownload` 默认值设为 `false`

**优势**:
- ✅ 保留了所有下载代码
- ✅ 默认不执行网络操作
- ✅ 调试时不会出现网络错误
- ✅ 未来启用自动下载只需改默认值
- ✅ 用户仍可通过设置启用下载功能

**编译状态**: ✅ 编译成功

---

**配置日期**: 2025-11-18
**配置状态**: 离线开发模式（自动下载已禁用）
**推荐设置**: 保持 `autoDownload: false` 直到 Runner 服务器地址确定
