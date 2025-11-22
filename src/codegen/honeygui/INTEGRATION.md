# HoneyGUI代码生成器集成指南

## 如何在设计器中集成

### 1. 在CommandManager中添加生成命令

```typescript
// src/core/CommandManager.ts

import { generateHoneyGuiCode } from '../codegen/honeygui';

// 在registerCommands()中添加
this.registerCommand('honeygui.generateCode', async () => {
    try {
        // 获取当前设计器的组件
        const components = this.getDesignerComponents();
        
        // 选择输出目录
        const outputDir = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            openLabel: '选择代码输出目录'
        });
        
        if (!outputDir || outputDir.length === 0) return;
        
        // 生成代码
        const result = await generateHoneyGuiCode(components, {
            outputDir: outputDir[0].fsPath,
            projectName: 'MyHoneyGuiApp',
            enableProtectedAreas: true
        });
        
        if (result.success) {
            vscode.window.showInformationMessage(
                `代码生成成功！生成了${result.files.length}个文件`
            );
        } else {
            vscode.window.showErrorMessage(
                `代码生成失败：${result.errors?.join(', ')}`
            );
        }
    } catch (error) {
        logger.error('代码生成失败', error);
    }
});
```

### 2. 从DesignerPanel获取组件数据

```typescript
// src/designer/DesignerPanel.ts

private getDesignerComponents() {
    // 将设计器的组件转换为代码生成器需要的格式
    return this.components.map(comp => ({
        id: comp.id,
        type: comp.type,
        name: comp.name,
        position: comp.position,
        parent: comp.parent,
        children: comp.children,
        style: comp.style,
        data: comp.data,
        events: comp.events,
        visible: comp.visible
    }));
}
```

### 3. 在Webview中添加生成按钮

```typescript
// src/webview/components/Toolbar.tsx

const handleGenerateCode = () => {
    window.vscodeAPI?.postMessage({
        command: 'generateCode'
    });
};

// 在工具栏中添加按钮
<button
    className="toolbar-button"
    onClick={handleGenerateCode}
    title="生成C代码"
>
    <Code size={16} />
    <span>生成代码</span>
</button>
```

### 4. 处理Webview消息

```typescript
// src/designer/DesignerPanel.ts

case 'generateCode':
    await vscode.commands.executeCommand('honeygui.generateCode');
    break;
```

## 完整集成示例

### 步骤1：添加命令到package.json

```json
{
  "contributes": {
    "commands": [
      {
        "command": "honeygui.generateCode",
        "title": "HoneyGUI: Generate C Code",
        "category": "HoneyGUI"
      }
    ]
  }
}
```

### 步骤2：创建代码生成服务

```typescript
// src/codegen/CodeGenService.ts

import { generateHoneyGuiCode, Component } from './honeygui';
import * as vscode from 'vscode';

export class CodeGenService {
    async generateFromDesigner(components: any[]): Promise<void> {
        // 转换组件格式
        const honeyguiComponents: Component[] = components.map(c => ({
            id: c.id,
            type: c.type,
            name: c.name || c.id,
            position: c.position,
            parent: c.parent,
            children: c.children,
            style: c.style,
            data: c.data,
            events: c.events,
            visible: c.visible !== false
        }));
        
        // 选择输出目录
        const uri = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            openLabel: '选择输出目录'
        });
        
        if (!uri || uri.length === 0) return;
        
        // 生成代码
        const result = await generateHoneyGuiCode(honeyguiComponents, {
            outputDir: uri[0].fsPath,
            projectName: 'HoneyGuiApp',
            enableProtectedAreas: true
        });
        
        if (result.success) {
            const action = await vscode.window.showInformationMessage(
                `成功生成${result.files.length}个文件`,
                '打开文件夹'
            );
            
            if (action === '打开文件夹') {
                vscode.commands.executeCommand('vscode.openFolder', uri[0]);
            }
        } else {
            vscode.window.showErrorMessage(
                `代码生成失败：${result.errors?.join(', ')}`
            );
        }
    }
}
```

### 步骤3：在扩展中注册服务

```typescript
// src/core/ExtensionManager.ts

import { CodeGenService } from '../codegen/CodeGenService';

export class ExtensionManager {
    private codeGenService: CodeGenService;
    
    constructor(private context: vscode.ExtensionContext) {
        this.codeGenService = new CodeGenService();
        // ...
    }
    
    async initialize(): Promise<void> {
        // 注册代码生成命令
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'honeygui.generateCode',
                async () => {
                    // 获取当前活动的设计器组件
                    const components = await this.getActiveDesignerComponents();
                    if (components) {
                        await this.codeGenService.generateFromDesigner(components);
                    }
                }
            )
        );
    }
}
```

## 测试集成

### 1. 独立测试

```bash
# 运行示例
node out/codegen/honeygui/example.js

# 检查生成的文件
ls -la output/
cat output/gui_design.c
```

### 2. 在设计器中测试

1. 打开HML文件
2. 在设计器中添加组件
3. 点击"生成代码"按钮
4. 选择输出目录
5. 检查生成的C代码

## 优势

- ✅ **完全解耦**：代码生成器独立于设计器
- ✅ **易于测试**：可以独立运行和测试
- ✅ **易于维护**：清晰的模块边界
- ✅ **易于扩展**：支持自定义组件和API

## 下一步

1. 在CommandManager中实现集成
2. 在Toolbar中添加生成按钮
3. 测试完整流程
4. 添加更多组件支持
