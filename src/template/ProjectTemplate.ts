import * as fs from 'fs';
import * as path from 'path';

/**
 * 简化的项目模板类
 * 直接复制模板目录，然后替换关键字段
 */
export class ProjectTemplate {
  private templateDir: string;
  private templateName: string;

  constructor(templateDir: string) {
    this.templateDir = templateDir;
    this.templateName = path.basename(templateDir);
  }

  /**
   * 获取模板名称
   */
  public getName(): string {
    return this.templateName;
  }

  /**
   * 生成项目
   * @param outputDir 输出目录
   * @param projectName 项目名称
   */
  public async generate(outputDir: string, projectName: string): Promise<void> {
    // 复制整个模板目录
    await this.copyDirectory(this.templateDir, outputDir);

    // 修改 project.json
    const projectJsonPath = path.join(outputDir, 'project.json');
    if (fs.existsSync(projectJsonPath)) {
      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
      projectJson.name = projectName;
      projectJson.appId = `com.honeygui.${projectName.toLowerCase()}`;
      projectJson.created = new Date().toISOString().split('T')[0];
      fs.writeFileSync(projectJsonPath, JSON.stringify(projectJson, null, 2), 'utf8');
    }

    // 删除 build 目录（如果存在）
    const buildDir = path.join(outputDir, 'build');
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true });
    }
  }

  /**
   * 递归复制目录
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    // 跳过 build 目录
    if (path.basename(src) === 'build') {
      return;
    }

    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * 从目录加载模板
   */
  public static async loadFromDir(templateDir: string): Promise<ProjectTemplate> {
    if (!fs.existsSync(templateDir)) {
      throw new Error(`模板目录不存在: ${templateDir}`);
    }

    const projectJsonPath = path.join(templateDir, 'project.json');
    if (!fs.existsSync(projectJsonPath)) {
      throw new Error(`模板缺少 project.json: ${templateDir}`);
    }

    return new ProjectTemplate(templateDir);
  }

  /**
   * 获取模板信息
   */
  public getInfo(): { name: string; description: string } {
    const projectJsonPath = path.join(this.templateDir, 'project.json');
    if (fs.existsSync(projectJsonPath)) {
      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
      return {
        name: this.templateName,
        description: projectJson.description || `${this.templateName} 模板项目`
      };
    }
    return {
      name: this.templateName,
      description: `${this.templateName} 模板项目`
    };
  }
}
