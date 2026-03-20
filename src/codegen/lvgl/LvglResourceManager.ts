/**
 * LVGL unified resource manager
 * Wraps LvglImageConverter and LvglFontConverter, providing a unified resource query interface
 */
import { Component } from '../../hml/types';
import { LvglImageConverter } from './resources/LvglImageConverter';
import { LvglFontConverter } from './resources/LvglFontConverter';

export class LvglResourceManager {
  private imageConverter: LvglImageConverter;
  private fontConverter: LvglFontConverter;

  constructor() {
    this.imageConverter = new LvglImageConverter();
    this.fontConverter = new LvglFontConverter();
  }

  /** Call internal converters' prepare methods */
  prepare(components: Component[], srcDir: string, lvglDir: string): void {
    this.imageConverter.prepare(components, srcDir, lvglDir);
    this.fontConverter.prepare(components, srcDir, lvglDir);
  }

  /** Get C variable name for a converted image */
  getImageVar(source: string): string | undefined {
    return this.imageConverter.getBuiltinImageVar(source);
  }

  /** Get C variable name for a converted font */
  getFontVar(fontFile: string, fontSize: number): string | null {
    return this.fontConverter.getBuiltinFontVar(fontFile, fontSize);
  }

  /** Get list of all converted image variable names */
  getImageVarList(): string[] {
    return this.imageConverter.getBuiltinImageVarList();
  }

  /** Get list of all converted font variable names */
  getFontVarList(): string[] {
    return this.fontConverter.getBuiltinFontVarList();
  }
}
