import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProjectTemplate, TemplateVariables } from './ProjectTemplate';
import { promisify } from 'util';

/**
 * 模板管理器类，负责模板的发现、加载和应用
 */
export class TemplateManager {
  private templates: Map<string, ProjectTemplate> = new Map();
  private templateDirs: string[] = [];
  private context: vscode.ExtensionContext;

  /**
   * 构造函数
   * @param context VSCode扩展上下文
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.initializeTemplateDirs();
  }

  /**
   * 初始化模板目录
   */
  private initializeTemplateDirs(): void {
    // 获取内置模板目录
    const builtinTemplateDir = path.join(this.context.extensionPath, 'templates');
    this.templateDirs.push(builtinTemplateDir);

    // 获取用户自定义模板目录
    const config = vscode.workspace.getConfiguration('honeygui.templates');
    const customTemplateDir = config.get<string>('dir');
    if (customTemplateDir) {
      this.templateDirs.push(customTemplateDir);
    }

    // 获取用户主目录下的模板目录
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    const userTemplateDir = path.join(homeDir, '.honeygui', 'templates');
    this.templateDirs.push(userTemplateDir);
  }

  /**
   * 加载所有可用模板
   */
  public async loadTemplates(): Promise<void> {
    this.templates.clear();

    // 遍历所有模板目录
    for (const templateDir of this.templateDirs) {
      try {
        if (!fs.existsSync(templateDir)) {
          continue;
        }

        // 读取目录内容
        const entries = await promisify(fs.readdir)(templateDir, { withFileTypes: true });
        
        // 遍历每个子目录作为模板
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const currentTemplateDir = path.join(templateDir, entry.name);
            try {
              // 尝试加载模板
              const template = await ProjectTemplate.loadFromDir(currentTemplateDir);
              this.templates.set(template.getId(), template);
            } catch (error) {
              console.warn(`加载模板失败 (${currentTemplateDir}): ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      } catch (error) {
        console.warn(`扫描模板目录失败 (${templateDir}): ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 如果没有模板，加载默认模板
    if (this.templates.size === 0) {
      await this.loadDefaultTemplates();
    }
  }

  /**
   * 加载默认模板
   * 如果没有找到预定义模板，创建基本的默认模板
   */
  private async loadDefaultTemplates(): Promise<void> {
    // 创建默认模板目录
    const defaultTemplateDir = path.join(this.context.extensionPath, 'templates', 'default');
    if (!fs.existsSync(defaultTemplateDir)) {
      await this.createDefaultTemplate(defaultTemplateDir);
    }

    // 加载默认模板
    try {
      const template = await ProjectTemplate.loadFromDir(defaultTemplateDir);
      this.templates.set(template.getId(), template);
    } catch (error) {
      console.error('加载默认模板失败:', error);
    }
  }

  /**
   * 创建默认模板文件
   */
  private async createDefaultTemplate(templateDir: string): Promise<void> {
    // 确保目录存在
    fs.mkdirSync(templateDir, { recursive: true });

    // 创建模板配置文件
    const configContent = JSON.stringify({
      "id": "default",
      "name": "默认项目模板",
      "description": "一个基础的HoneyGUI项目模板",
      "version": "1.0.0",
      "author": "HoneyGUI Team",
      "defaultValues": {
        "projectName": "honeygui-app",
        "appTitle": "HoneyGUI Application",
        "description": "使用HoneyGUI创建的应用程序",
        "version": "1.0.0",
        "width": 360,
        "height": 640
      },
      "requiredFields": ["projectName"],
      "files": [
        {
          "source": "ui/main.hml",
          "target": "ui/{{projectName}}.hml",
          "isTemplate": true
        },
        {
          "source": "src/main.cpp",
          "target": "src/main.cpp",
          "isTemplate": true
        },
        {
          "source": ".vscode/tasks.json",
          "target": ".vscode/tasks.json",
          "isTemplate": true
        },
        {
          "source": "README.md",
          "target": "README.md",
          "isTemplate": true
        }
      ]
    }, null, 2);
    
    await promisify(fs.writeFile)(path.join(templateDir, 'template.json'), configContent, 'utf8');

    // 创建UI模板文件
    const uiDir = path.join(templateDir, 'ui');
    fs.mkdirSync(uiDir, { recursive: true });
    const uiContent = `<!-- {{projectName}} UI定义 -->
<hml page id="{{projectName}}" width="{{width}}" height="{{height}}">
  <container id="root" layout="column" padding="16">
    <text id="title" value="{{appTitle}}" fontSize="24" marginTop="16" align="center"/>
    <text id="subtitle" value="{{description}}" fontSize="14" marginTop="8" align="center"/>
    <button id="helloButton" text="点击我" marginTop="32" align="center" onClick="OnHelloButtonClick"/>
  </container>
</hml>`;
    await promisify(fs.writeFile)(path.join(uiDir, 'main.hml'), uiContent, 'utf8');

    // 创建源代码模板
    const srcDir = path.join(templateDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    const cppContent = `// {{projectName}} 主程序
// 版本: {{version}}

#include <iostream>

// <honeygui-protect-begin:handler>
void OnHelloButtonClick() {
    std::cout << "Hello, HoneyGUI!" << std::endl;
    // 在这里添加按钮点击逻辑
}
// <honeygui-protect-end:handler>

int main() {
    std::cout << "{{appTitle}} 启动中..." << std::endl;
    
    // 初始化代码将由HoneyGUI生成器自动生成
    
    return 0;
}`;
    await promisify(fs.writeFile)(path.join(srcDir, 'main.cpp'), cppContent, 'utf8');

    // 创建tasks.json模板
    const vscodeDir = path.join(templateDir, '.vscode');
    fs.mkdirSync(vscodeDir, { recursive: true });
    const tasksContent = `{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "HoneyGUI: Generate Code",
      "type": "shell",
      "command": "honeygui.codegen"
    },
    {
      "label": "HoneyGUI: Preview",
      "type": "shell",
      "command": "honeygui.preview"
    }
  ]
}`;
    await promisify(fs.writeFile)(path.join(vscodeDir, 'tasks.json'), tasksContent, 'utf8');

    // 创建README模板
    const readmeContent = `# {{projectName}}

{{description}}

## 项目信息

- 版本: {{version}}
- 基于: HoneyGUI

## 使用说明

1. 打开UI设计器: 运行命令 "HoneyGUI: Open Designer"
2. 生成代码: 运行命令 "HoneyGUI: Generate Code"
3. 预览UI: 运行命令 "HoneyGUI: Preview"

## 项目结构

- ui/: 存放HML界面文件
- src/: 存放源代码文件
- assets/: 存放资源文件

## 许可证

MIT License`;
    await promisify(fs.writeFile)(path.join(templateDir, 'README.md'), readmeContent, 'utf8');
  }

  /**
   * 获取所有模板
   */
  public async getTemplates(): Promise<ProjectTemplate[]> {
    if (this.templates.size === 0) {
      await this.loadTemplates();
    }
    return Array.from(this.templates.values());
  }

  /**
   * 根据ID获取模板
   * @param templateId 模板ID
   */
  public async getTemplateById(templateId: string): Promise<ProjectTemplate | undefined> {
    if (this.templates.size === 0) {
      await this.loadTemplates();
    }
    return this.templates.get(templateId);
  }

  /**
   * 获取模板选择列表
   */
  public async getTemplateQuickPickItems(): Promise<vscode.QuickPickItem[]> {
    const templates = await this.getTemplates();
    return templates.map(template => ({
      label: template.getName(),
      description: template.getDescription(),
      detail: `版本: ${template.getVersion()}${template.getAuthor() ? `, 作者: ${template.getAuthor()}` : ''}`,
      picked: template.getId() === 'default'
    }));
  }

  /**
   * 应用模板创建新项目
   * @param templateId 模板ID
   * @param outputDir 输出目录
   * @param variables 模板变量
   */
  public async applyTemplate(templateId: string, outputDir: string, variables: TemplateVariables): Promise<void> {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`模板不存在: ${templateId}`);
    }

    try {
      await template.generate(outputDir, variables);
    } catch (error) {
      throw new Error(`应用模板失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 刷新模板列表
   */
  public async refreshTemplates(): Promise<void> {
    await this.loadTemplates();
  }

  /**
   * 获取模板数量
   */
  public getTemplateCount(): number {
    return this.templates.size;
  }
}
