/**
 * LVGL 统一资源管理器
 * 封装 LvglImageConverter 和 LvglFontConverter，提供统一的资源查询接口
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

  /** 调用内部转换器的 prepare 方法 */
  prepare(components: Component[], srcDir: string, lvglDir: string): void {
    this.imageConverter.prepare(components, srcDir, lvglDir);
    this.fontConverter.prepare(components, srcDir, lvglDir);
  }

  /** 获取已转换图片的 C 变量名 */
  getImageVar(source: string): string | undefined {
    return this.imageConverter.getBuiltinImageVar(source);
  }

  /** 获取已转换字体的 C 变量名 */
  getFontVar(fontFile: string, fontSize: number): string | null {
    return this.fontConverter.getBuiltinFontVar(fontFile, fontSize);
  }

  /** 获取所有已转换图片的变量名列表 */
  getImageVarList(): string[] {
    return this.imageConverter.getBuiltinImageVarList();
  }

  /** 获取所有已转换字体的变量名列表 */
  getFontVarList(): string[] {
    return this.fontConverter.getBuiltinFontVarList();
  }
}
