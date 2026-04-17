/**
 * LVGL font resource converter
 * Converts project TTF fonts to LVGL C format
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { Component } from '../../../hml/types';
import { normalizeFontKey, buildFontVarName } from '../LvglUtils';

interface CharacterSetSource {
  type: 'range' | 'string' | 'file' | 'codepage';
  value: string;
}

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

    const fontConfigs = this.collectFontConfigs(components, projectRoot);
    if (fontConfigs.length === 0) {
      return;
    }

    const fontOutputDir = path.join(lvglDir, 'fonts');
    if (!fs.existsSync(fontOutputDir)) {
      fs.mkdirSync(fontOutputDir, { recursive: true });
    }

    for (const config of fontConfigs) {
      console.log(`[LvglFontConverter] Font: ${config.fontFile}, size: ${config.fontSize}, chars(${config.characters.length}): "${config.characters.substring(0, 80)}${config.characters.length > 80 ? '...' : ''}"`);
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
   * Collect font configurations used by all label components
   * (hg_label, hg_time_label, hg_timer_label)
   * Includes text characters + additional character sets (range, string, file, codepage)
   */
  private collectFontConfigs(components: Component[], projectRoot: string): Array<{ fontFile: string; fontSize: number; characters: string }> {
    const fontExts = new Set(['.ttf', '.otf', '.woff', '.woff2']);
    const labelTypes = new Set(['hg_label', 'hg_time_label', 'hg_timer_label']);
    const seen = new Map<string, {
      fontFile: string;
      fontSize: number;
      characters: Set<string>;
      additionalCharSets: Set<string>; // JSON-serialized for dedup
    }>();

    for (const component of components) {
      if (!labelTypes.has(component.type)) {
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
        // Merge additional character sets
        const charSets = (component.data as any)?.characterSets;
        if (Array.isArray(charSets)) {
          for (const cs of charSets) {
            existing.additionalCharSets.add(JSON.stringify(cs));
          }
        }
      } else {
        const additionalCharSets = new Set<string>();
        const charSets = (component.data as any)?.characterSets;
        if (Array.isArray(charSets)) {
          for (const cs of charSets) {
            additionalCharSets.add(JSON.stringify(cs));
          }
        }
        seen.set(key, {
          fontFile: fontFileStr,
          fontSize,
          characters: new Set(text),
          additionalCharSets
        });
      }
    }

    return Array.from(seen.values()).map(config => {
      // Resolve additional character sets into code points
      const extraChars = this.resolveAdditionalCharSets(
        Array.from(config.additionalCharSets).map(s => JSON.parse(s)),
        projectRoot
      );
      // Merge text characters + additional characters
      const allChars = new Set<string>(config.characters);
      for (const cp of extraChars) {
        allChars.add(String.fromCodePoint(cp));
      }
      return {
        fontFile: config.fontFile,
        fontSize: config.fontSize,
        characters: this.buildCharacterSet(allChars)
      };
    });
  }

  /**
   * Resolve additional character set sources into code points
   */
  private resolveAdditionalCharSets(charSets: CharacterSetSource[], projectRoot: string): number[] {
    const result = new Set<number>();

    for (const cs of charSets) {
      if (!cs.value) {
        continue;
      }

      try {
        switch (cs.type) {
          case 'range': {
            // Parse "0xXXXX-0xYYYY" format
            const match = cs.value.trim().match(/^(0x)?([0-9a-fA-F]+)\s*-\s*(0x)?([0-9a-fA-F]+)$/);
            if (match) {
              const start = parseInt(match[2], 16);
              const end = parseInt(match[4], 16);
              if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let i = start; i <= end; i++) {
                  result.add(i);
                }
              }
            }
            break;
          }
          case 'string': {
            // Extract characters from string
            for (const char of cs.value) {
              const cp = char.codePointAt(0);
              if (cp !== undefined) {
                result.add(cp);
              }
            }
            break;
          }
          case 'file': {
            // Read .cst binary file (uint16_t little-endian)
            const filePath = path.isAbsolute(cs.value)
              ? cs.value
              : path.resolve(projectRoot, cs.value);
            if (fs.existsSync(filePath)) {
              const data = fs.readFileSync(filePath);
              if (data.length % 2 === 0) {
                for (let i = 0; i < data.length / 2; i++) {
                  result.add(data.readUInt16LE(i * 2));
                }
              }
            } else {
              console.warn(`Character set file not found: ${filePath}`);
            }
            break;
          }
          case 'codepage': {
            // CodePage files - try to find and parse
            const cpPath = path.isAbsolute(cs.value)
              ? cs.value
              : path.resolve(projectRoot, cs.value);
            if (fs.existsSync(cpPath)) {
              const data = fs.readFileSync(cpPath);
              if (data.length % 2 === 0) {
                for (let i = 0; i < data.length / 2; i++) {
                  result.add(data.readUInt16LE(i * 2));
                }
              }
            } else {
              console.warn(`CodePage file not found: ${cpPath}`);
            }
            break;
          }
        }
      } catch (error) {
        console.warn(`Failed to resolve character set (${cs.type}: ${cs.value}): ${error}`);
      }
    }

    return Array.from(result);
  }

  /**
   * Build character set: only include user-used characters + space
   * Space (0x20) is always included as it's essential for text rendering and costs minimal ROM.
   */
  private buildCharacterSet(userChars: Set<string>): string {
    const chars = new Set<string>(userChars);
    chars.add(' '); // always include space
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

      // Build lv_font_conv arguments
      // Use --range for individual code points to avoid shell escaping issues with --symbols
      // (space and other special chars get eaten by shell when using --symbols with shell: true)
      const codePoints = Array.from(new Set(characters))
        .map(ch => ch.codePointAt(0)!)
        .filter(cp => cp !== undefined)
        .sort((a, b) => a - b);

      const ranges = this.compactRanges(codePoints);

      const args = [
        'lv_font_conv',
        '--font', inputPath,
        '--size', String(fontSize),
        '--format', 'lvgl',
        '--output', outputFile,
        '--bpp', '4',
      ];

      for (const range of ranges) {
        args.push('--range', range);
      }

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

  /**
   * Compact sorted code points into range strings for lv_font_conv --range
   * e.g. [0x20, 0x21, 0x22, 0x41, 0x43] => ['0x20-0x22', '0x41', '0x43']
   */
  private compactRanges(sortedCodePoints: number[]): string[] {
    if (sortedCodePoints.length === 0) {
      return ['0x20']; // fallback: at least space
    }

    const ranges: string[] = [];
    let start = sortedCodePoints[0];
    let end = start;

    for (let i = 1; i < sortedCodePoints.length; i++) {
      if (sortedCodePoints[i] === end + 1) {
        end = sortedCodePoints[i];
      } else {
        ranges.push(start === end ? `0x${start.toString(16)}` : `0x${start.toString(16)}-0x${end.toString(16)}`);
        start = sortedCodePoints[i];
        end = start;
      }
    }
    ranges.push(start === end ? `0x${start.toString(16)}` : `0x${start.toString(16)}-0x${end.toString(16)}`);

    return ranges;
  }
}
