/**
 * LVGL font resource converter
 * Converts project TTF fonts to LVGL C format
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { Component } from '../../../hml/types';
import { normalizeFontKey, buildFontVarName } from '../LvglUtils';

export class LvglFontConverter {
  private builtinFontVarMap: Map<string, string> = new Map();
  private builtinFontVars: string[] = [];

  /** Get converted font variable name */
  getBuiltinFontVar(fontFile: string, fontSize: number): string | null {
    const key = normalizeFontKey(fontFile, fontSize);
    return this.builtinFontVarMap.get(key) || null;
  }

  /** Get list of all built-in font variable names */
  getBuiltinFontVarList(): string[] {
    return this.builtinFontVars;
  }

  /**
   * Prepare built-in font resources
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
        console.warn(`Font file not found, skipping: ${config.fontFile}`);
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
   * Collect font configurations used by all hg_label components
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
   * Build character set: merge characters from user text with basic ASCII characters
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
   * Resolve absolute path for a font file
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
   * Convert font to LVGL C format using lv_font_conv
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
        console.log(`Font conversion succeeded: ${varName}`);
        return true;
      } else {
        console.warn(`Font conversion failed ${varName}: ${result.stderr || result.error}`);
        return false;
      }
    } catch (error) {
      console.warn(`Font conversion error ${varName}: ${error}`);
      return false;
    }
  }
}
