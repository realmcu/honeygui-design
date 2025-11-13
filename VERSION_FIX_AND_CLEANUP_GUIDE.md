# 🚨 版本号修复与彻底清理指南

## 问题诊断

### 根本原因

**package.json 中的版本号是 1.0.0**，但之前的 VSIX 文件名被手动指定为 1.1.x，导致 VSCode 始终显示 1.0.0。

### 错误信息分析

你看到的错误：
```
extensions/honeygui.honeygui-visual-designer-1.0.0/...
```

这表明安装的是 **1.0.0 版本**（从 package.json 读取），而不是文件名版本。

---

## ✅ 修复步骤（已完成）

### 1. 修复 package.json 版本号

**文件**: `package.json`
**更改**:
```diff
- "version": "1.0.0"
+ "version": "1.1.5"
```

**状态**: ✅ 已完成

### 2. 重新编译

```bash
npm run compile
# 输出: 版本 1.1.5
```

**状态**: ✅ 已完成

### 3. 重新打包 Webview

```bash
npm run build:webview
```

**状态**: ✅ 已完成

### 4. 创建正确的 VSIX

**新文件**: `honeygui-visual-designer-1.1.5.vsix`
**实际版本**: 1.1.5（从 package.json 读取）
**大小**: 76 MB

**状态**: ✅ 已完成

---

## 🧹 彻底卸载旧版本（关键步骤）

### 为什么必须彻底卸载？

VSCode 可能同时安装了多个版本，导致冲突。必须**完全清除**所有版本。

---

### 方法 1: 命令行卸载（推荐）

#### 步骤 1: 关闭所有 VSCode 窗口

```bash
# 确保 VSCode 完全关闭
taskkill /F /IM Code.exe 2>nul
```

#### 步骤 2: 删除扩展目录

```powershell
# 打开 PowerShell 作为管理员

# 删除全局扩展目录
Remove-Item -Path "$env:USERPROFILE\.vscode\extensions\honeygui.honeygui-visual-designer-*" -Recurse -Force -ErrorAction SilentlyContinue

# 删除已安装扩展列表
$file = "$env:USERPROFILE\.vscode\extensions\.obsolete"
if (Test-Path $file) {
    Clear-Content -Path $file -Force
}
```

#### 步骤 3: 清理 VSCode 缓存

```powershell
# 清理扩展缓存
Remove-Item -Path "$env:APPDATA\Code\CachedExtensionVSIXs\*honeygui*" -Force -ErrorAction SilentlyContinue

# 清理 Webview 缓存
Remove-Item -Path "$env:APPDATA\Code\Cache\*" -Recurse -Force -ErrorAction SilentlyContinue
```

#### 步骤 4: 验证清理

```powershell
# 检查是否还有残留
dir "$env:USERPROFILE\.vscode\extensions\honeygui*"
# 应该显示: 找不到文件
```

---

### 方法 2: 手动清理（图形界面）

#### 步骤 1: 完全关闭 VSCode
1. 关闭所有 VSCode 窗口
2. 在任务管理器中结束所有 Code.exe 进程

#### 步骤 2: 删除扩展文件夹

1. 打开文件资源管理器
2. 导航到: `%USERPROFILE%\.vscode\extensions\`
   - 地址栏输入: `%USERPROFILE%\.vscode\extensions\`
3. 删除所有 `honeygui.honeygui-visual-designer-` 开头的文件夹

#### 步骤 3: 清理缓存

1. 导航到: `%APPDATA%\Code\CachedExtensionVSIXs\`
2. 删除所有包含 `honeygui` 的文件

1. 导航到: `%APPDATA%\Code\Cache\`
2. 删除所有内容（或重命名 Cache 文件夹为 Cache.backup）

---

### 方法 3: 在 VSCode UI 中卸载

如果上述方法无法执行：

1. 打开 VSCode
2. 按 `Ctrl+Shift+X` 打开扩展面板
3. 在搜索框输入 `@installed` 或点击"已安装"
4. 找到所有 "HoneyGUI Visual Designer"
5. **逐个点击"卸载"**
6. **每次卸载后重启 VSCode**
7. 重复直到找不到任何 HoneyGUI 扩展

---

## 📥 安装新版本（1.1.5）

### 方法 1: 命令行安装（推荐）

```powershell
cd "C:\Users\howie_wang.RSDOMAIN\你的项目路径\honeygui-design"

code --install-extension honeygui-visual-designer-1.1.5.vsix

# 等待安装完成
# 重启 VSCode
code .
```

### 方法 2: UI 安装

1. 打开 VSCode
2. 按 `Ctrl+Shift+X` 打开扩展面板
3. 点击右上角的 "..." 菜单（三个点）
4. 选择 "从 VSIX 安装..."
5. 导航到扩展目录
6. 选择 `honeygui-visual-designer-1.1.5.vsix`
7. 点击 "安装"
8. 根据提示重启 VSCode

---

## ✅ 验证安装

### 检查版本号

#### 方法 1: 扩展面板

1. 打开扩展面板 (`Ctrl+Shift+X`)
2. 点击 "HoneyGUI Visual Designer"
3. 查看右下角显示版本号
4. **必须显示**: 1.1.5
   ```
   HoneyGUI Visual Designer
   v1.1.5
   ```

#### 方法 2: 命令行

```powershell
code --list-extensions --show-versions | findstr honeygui

# 输出应该显示:
# honeygui.honeygui-visual-designer@1.1.5
```

#### 方法 3: package.json

```powershell
cat "$env:USERPROFILE\.vscode\extensions\honeygui.honeygui-visual-designer-1.1.5\package.json" | Select-String '"version"'

# 输出:
#   "version": "1.1.5",
```

---

### 功能测试

#### 测试 1: 打开设计器

1. 按 `Ctrl+Shift+P`
2. 输入: "HoneyGUI: Open Designer"
3. 选择命令
4. **预期**: 设计器正常打开，没有错误

#### 测试 2: 检查控制台

1. 帮助 → 切换开发人员工具 (或 `Ctrl+Shift+I`)
2. 查看 Console 标签
3. **必须没有**: "An instance of the VS Code API has already been acquired"

#### 测试 3: 查看输出面板

1. 视图 → 输出 (或 `Ctrl+Shift+U`)
2. 下拉菜单选择 "扩展主机"
3. 搜索 "HoneyGUI"
4. **应该看到**:
   ```
   [info] ExtensionService#_doActivateExtension honeygui.honeygui-visual-designer
   [info] HoneyGUI Visual Designer 扩展已激活
   ```

---

## 🐛 如果仍然有问题

### 检查 1: 确认已安装正确版本

```powershell
# 列出所有 honeygui 扩展
dir "$env:USERPROFILE\.vscode\extensions\honeygui*"

# 应该只看到:
# honeygui.honeygui-visual-designer-1.1.5
```

如果看到多个版本，删除所有旧的。

### 检查 2: 清除 VSCode 全局状态

```powershell
# 删除全局存储
Remove-Item -Path "$env:APPDATA\Code\User\globalStorage\*honeygui*" -Force -ErrorAction SilentlyContinue

# 删除工作区存储
Remove-Item -Path "$env:APPDATA\Code\User\workspaceStorage\*" -Recurse -Force -ErrorAction SilentlyContinue
```

### 检查 3: 重新安装 VSCode（最后手段）

如果上述方法都失败：

1. 卸载 VSCode
2. 删除配置文件夹:
   - `%APPDATA%\Code\`
   - `%USERPROFILE%\.vscode\`
3. 重新安装 VSCode
4. 安装 `honeygui-visual-designer-1.1.5.vsix`

---

## 📋 安装清单

在继续前，请确认：

- [ ] 已完全关闭所有 VSCode 窗口
- [ ] 已删除 `~/.vscode/extensions/honeygui.honeygui-visual-designer-*`
- [ ] 已清理缓存文件夹
- [ ] 已删除所有旧版 VSIX 文件（可选）
- [ ] 下载了 `honeygui-visual-designer-1.1.5.vsix`
- [ ] 安装了 1.1.5 版本
- [ ] 重启了 VSCode
- [ ] 扩展面板显示版本为 1.1.5

---

## 🎉 成功标志

当一切正常时：

✅ 扩展面板显示: HoneyGUI Visual Designer v1.1.5
✅ 打开设计器无错误
✅ Console 没有 "An instance of the VS Code API has already been acquired"
✅ 看到三栏设计器界面
✅ 可以拖拽组件
✅ 可以编辑属性

---

## 📞 需要帮助？

如果仍然无法解决，请提供：

1. **安装输出**
   ```powershell
   code --list-extensions --show-versions
   ```

2. **目录列表**
   ```powershell
   dir "$env:USERPROFILE\.vscode\extensions\honeygui*"
   ```

3. **package.json 内容**
   ```powershell
   cat "$env:USERPROFILE\.vscode\extensions\honeygui.honeygui-visual-designer-*\package.json"
   ```

4. **VSCode 版本**: 帮助 → 关于
5. **操作系统**: Windows 版本
6. **错误截图**: 完整错误信息

---

## 📝 修复总结

| 步骤 | 操作 | 状态 |
|-----|------|------|
| 1 | 更新 package.json 版本到 1.1.5 | ✅ |
| 2 | 修复 acquireVsCodeApi() 重复调用 | ✅ |
| 3 | 移除 DesignerPanel.ts 旧 HTML | ✅ |
| 4 | 编译 TypeScript | ✅ |
| 5 | 打包 Webview | ✅ |
| 6 | 创建 VSIX 1.1.5 | ✅ |
| 7 | 用户卸载所有旧版本 | ⏳ 待执行 |
| 8 | 用户安装 1.1.5 | ⏳ 待执行 |
| 9 | 验证安装 | ⏳ 待验证 |

---

## 🎯 下一步

**请严格按照以下顺序执行：**

1. **阅读本指南完全部**
2. **卸载所有旧版本**（使用方法 1 或 2）
3. **重启电脑**（确保 VSCode 完全关闭）
4. **安装 1.1.5**
5. **验证版本号显示为 1.1.5**
6. **测试功能**

---

**文档版本**: 1.1.5
**最后更新**: 2025-11-13 14:30
**作者**: Claude Code 🤖
