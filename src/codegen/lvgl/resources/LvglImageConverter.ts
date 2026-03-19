/**
 * LVGL 图片资源转换器
 * 将项目中使用的图片转换为 LVGL 内置 C 数组格式
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { Component } from '../../../hml/types';
import { normalizeImageKey, buildImageVarName } from '../LvglUtils';

export class LvglImageConverter {
  private builtinImageVarMap: Map<string, string> = new Map();
  private builtinImageVars: string[] = [];

  /** 获取内置图片变量名 */
  getBuiltinImageVar(source: string): string | undefined {
    return this.builtinImageVarMap.get(normalizeImageKey(source));
  }

  /** 获取所有内置图片变量名列表 */
  getBuiltinImageVarList(): string[] {
    return this.builtinImageVars;
  }

  /**
   * 准备内置图片资源：将项目中使用的图片转换为 LVGL 内置 C 数组格式
   */
  prepare(components: Component[], srcDir: string, lvglDir: string): void {
    this.builtinImageVarMap.clear();
    this.builtinImageVars = [];

    const toolPath = this.findLvglImageTool();
    if (!toolPath) {
      console.warn('LVGL 图片转换工具未找到，跳过图片内置转换');
      return;
    }

    const projectRoot = path.dirname(srcDir);
    const assetsDir = path.join(projectRoot, 'assets');
    if (!fs.existsSync(assetsDir)) {
      return;
    }

    const images = this.collectImageSources(components);
    if (images.length === 0) {
      return;
    }

    this.cleanupGeneratedImages(lvglDir);

    for (const imgSrc of images) {
      const inputPath = this.resolveImagePath(projectRoot, imgSrc);
      if (!inputPath) {
        console.warn(`图片文件不存在，跳过: ${imgSrc}`);
        continue;
      }

      const varName = buildImageVarName(imgSrc);
      const success = this.convertImageToLvgl(toolPath, inputPath, lvglDir, varName);
      if (success) {
        const key = normalizeImageKey(imgSrc);
        this.builtinImageVarMap.set(key, varName);
        this.builtinImageVars.push(varName);
      }
    }
  }

  /**
   * 收集所有组件中使用的图片源
   */
  private collectImageSources(components: Component[]): string[] {
    const imageExts = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.webp', '.gif']);
    const seen = new Set<string>();
    const result: string[] = [];

    const addImage = (src: string | undefined | null) => {
      if (!src) { return; }
      const srcText = String(src).trim();
      if (!srcText) { return; }
      const ext = path.extname(srcText).toLowerCase();
      if (!imageExts.has(ext)) { return; }
      const key = normalizeImageKey(srcText);
      if (seen.has(key)) { return; }
      seen.add(key);
      result.push(srcText);
    };

    for (const component of components) {
      if (component.type === 'hg_image') {
        addImage(component.data?.src);
      } else if (component.type === 'hg_button') {
        addImage(component.data?.imageOn);
        addImage(component.data?.imageOff);
      }
    }

    return result;
  }

  /**
   * 查找 LVGLImage.py 转换工具
   */
  private findLvglImageTool(): string | null {
    const candidates = [
      process.env.HONEYGUI_LVGL_IMAGE_TOOL,
      path.resolve(__dirname, '../../../../../lvgl-pc/lvgl-official-tools/scripts/LVGLImage.py'),
      path.join(process.cwd(), 'lvgl-pc', 'lvgl-official-tools', 'scripts', 'LVGLImage.py'),
    ].filter((c): c is string => !!c);

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  /**
   * 解析图片的绝对路径
   */
  private resolveImagePath(projectRoot: string, source: string): string | null {
    let normalized = source.replace(/\\/g, '/').trim();
    normalized = normalized.replace(/^A:/i, '').replace(/^\/+/, '');

    const relativePath = normalized.startsWith('assets/')
      ? normalized.substring('assets/'.length)
      : normalized;

    const fullPath = path.join(projectRoot, 'assets', relativePath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }

    const altPath = path.join(projectRoot, normalized);
    if (fs.existsSync(altPath)) {
      return altPath;
    }

    return null;
  }

  /**
   * 使用 LVGLImage.py 将图片转换为 LVGL C 数组
   */
  private convertImageToLvgl(
    toolPath: string,
    inputPath: string,
    outputDir: string,
    varName: string
  ): boolean {
    const ext = path.extname(inputPath).toLowerCase();

    let actualInputPath = inputPath;
    let tempPngPath: string | null = null;
    let colorFormat = 'ARGB8888';

    if (ext !== '.png') {
      tempPngPath = path.join(outputDir, `_temp_${varName}.png`);
      const convertSuccess = this.convertToPng(inputPath, tempPngPath);
      if (!convertSuccess) {
        console.warn(`图片格式转换失败: ${inputPath}`);
        return false;
      }
      actualInputPath = tempPngPath;
      colorFormat = 'RGB565';
    }

    const baseArgs = [toolPath, '--ofmt', 'C', '--cf', colorFormat, '-o', outputDir, '--name', varName, actualInputPath];

    const pythonCommands = ['python', 'python3', 'py'];
    let success = false;

    for (const pyCmd of pythonCommands) {
      const args = pyCmd === 'py' ? ['-3', ...baseArgs] : baseArgs;
      const result = spawnSync(pyCmd, args, { encoding: 'utf-8', windowsHide: true });

      if (result.status === 0) {
        const outputFile = path.join(outputDir, `${varName}.c`);
        if (fs.existsSync(outputFile)) {
          success = true;
          break;
        }
      }
    }

    if (tempPngPath && fs.existsSync(tempPngPath)) {
      try { fs.unlinkSync(tempPngPath); } catch { /* ignore */ }
    }

    if (!success) {
      console.warn(`图片转换失败: ${inputPath}`);
    }
    return success;
  }

  /**
   * 使用 Pillow 将图片转换为 PNG 格式
   */
  private convertToPng(inputPath: string, outputPath: string): boolean {
    const script = `from PIL import Image; img = Image.open(r'${inputPath.replace(/'/g, "\\'")}'); img.convert('RGBA').save(r'${outputPath.replace(/'/g, "\\'")}', 'PNG')`;

    const pythonCommands = ['python', 'python3', 'py'];

    for (const pyCmd of pythonCommands) {
      const args = pyCmd === 'py' ? ['-3', '-c', script] : ['-c', script];
      const result = spawnSync(pyCmd, args, { encoding: 'utf-8', windowsHide: true });

      if (result.status === 0 && fs.existsSync(outputPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 清理之前生成的图片 C 文件
   */
  private cleanupGeneratedImages(lvglDir: string): void {
    if (!fs.existsSync(lvglDir)) {
      return;
    }
    const prefix = 'img_';
    const files = fs.readdirSync(lvglDir);
    for (const file of files) {
      if (file.startsWith(prefix) && file.endsWith('.c')) {
        fs.unlinkSync(path.join(lvglDir, file));
      }
    }
  }
}
