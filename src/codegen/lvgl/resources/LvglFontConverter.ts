/**
 * LVGL 字体资源转换器
 * 将项目中使用的 TTF 字体转换为 LVGL C 格式
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { Component } from '../../../hml/types';
import { normalizeFontKey, buildFontVarName } from '../LvglUtils';

export class LvglFontConverter {
  private builtinFontVarMap: Map<string, string> = new Map();
  private builtinFontVars: string[] = [];

  /** 获取转换后的字体变量名 */
  getBuiltinFontVar(fontFile: string, fontSize: number): string | null {
    const key = normalizeFontKey(fontFile, fontSize);
    return this.builtinFontVarMap.get(key) || null;
  }

  /** 获取所有内置字体变量名列表 */
  getBuiltinFontVarList(): string[] {
    return this.builtinFontVars;
  }

  /**
   * 准备内置字体资源
   */
  prepare(components: Component[], srcDir: string, lvglDir: string): void {
    this.builtinFontVarMap.clear();
    this.builtinFontVars = [];

    const projectRoot = path.dirname(srcDir);
    const assetsDir = path.join(projectRoot, 'assets');

    const fontConfigs = this.collectFontConfigs(components);
    if (fontConfigs.length === 0) {
      return;
    }

    const fontOutputDir = path.join(lvglDir, 'fonts');
    if (!fs.existsSync(fontOutputDir)) {
      fs.mkdirSync(fontOutputDir, { recursive: true });
    }

    for (const config of fontConfigs) {
      const inputPath = this.resolveFontPath(projectRoot, assetsDir, config.fontFile);
      if (!inputPath) {
        console.warn(`字体文件不存在，跳过: ${config.fontFile}`);
        continue;
      }

      const varName = buildFontVarName(config.fontFile, config.fontSize);
      const success = this.convertFontToLvgl(inputPath, fontOutputDir, varName, config.fontSize, config.characters, srcDir);
      if (success) {
        const key = normalizeFontKey(config.fontFile, config.fontSize);
        this.builtinFontVarMap.set(key, varName);
        this.builtinFontVars.push(varName);
      }
    }
  }

  /**
   * 收集所有 hg_label 组件中使用的字体配置
   */
  private collectFontConfigs(components: Component[]): Array<{ fontFile: string; fontSize: number; characters: string }> {
    const fontExts = new Set(['.ttf', '.otf', '.woff', '.woff2']);
    const seen = new Map<string, { fontFile: string; fontSize: number; characters: Set<string> }>();

    for (const component of components) {
      if (component.type !== 'hg_label') {
        continue;
      }

      const fontFile = component.data?.fontFile;
      if (!fontFile) {
        continue;
      }

      const fontFileStr = String(fontFile).trim();
      const ext = path.extname(fontFileStr).toLowerCase();
      if (!fontExts.has(ext)) {
        continue;
      }

      const fontSize = Number(component.style?.fontSize || component.data?.fontSize || 16);
      const text = String(component.data?.text || '');
      const key = normalizeFontKey(fontFileStr, fontSize);

      if (seen.has(key)) {
        const existing = seen.get(key)!;
        for (const char of text) {
          existing.characters.add(char);
        }
      } else {
        seen.set(key, {
          fontFile: fontFileStr,
          fontSize,
          characters: new Set(text)
        });
      }
    }

    return Array.from(seen.values()).map(config => ({
      fontFile: config.fontFile,
      fontSize: config.fontSize,
      characters: this.buildCharacterSet(config.characters)
    }));
  }

  /**
   * 构建字符集：合并用户文本中的字符和基本 ASCII 字符
   */
  private buildCharacterSet(userChars: Set<string>): string {
    const chars = new Set<string>();
    for (let i = 0x20; i <= 0x7E; i++) {
      chars.add(String.fromCharCode(i));
    }
    for (const char of userChars) {
      chars.add(char);
    }
    return Array.from(chars).sort().join('');
  }

  /**
   * 解析字体文件的绝对路径
   */
  private resolveFontPath(projectRoot: string, assetsDir: string, fontFile: string): string | null {
    let normalized = fontFile.replace(/\\/g, '/').trim();
    normalized = normalized.replace(/^A:/i, '').replace(/^\/+/, '');

    const candidates = [
      path.join(assetsDir, normalized),
      path.join(assetsDir, 'font', path.basename(normalized)),
      path.join(projectRoot, normalized),
      path.join(projectRoot, 'assets', normalized),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * 使用 lv_font_conv 将字体转换为 LVGL C 格式
   */
  private convertFontToLvgl(
    inputPath: string,
    outputDir: string,
    varName: string,
    fontSize: number,
    characters: string,
    srcDir: string
  ): boolean {
    try {
      const outputFile = path.join(outputDir, `${varName}.c`);

      const args = [
        'lv_font_conv',
        '--font', inputPath,
        '--size', String(fontSize),
        '--format', 'lvgl',
        '--output', outputFile,
        '--bpp', '4',
        '--symbols', characters
      ];

      const result = spawnSync('npx', args, {
        encoding: 'utf-8',
        timeout: 60000,
        cwd: path.dirname(srcDir),
        shell: true
      });

      if (result.status === 0) {
        console.log(`字体转换成功: ${varName}`);
        return true;
      } else {
        console.warn(`字体转换失败 ${varName}: ${result.stderr || result.error}`);
        return false;
      }
    } catch (error) {
      console.warn(`字体转换异常 ${varName}: ${error}`);
      return false;
    }
  }
}
