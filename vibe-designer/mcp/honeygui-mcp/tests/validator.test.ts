import { describe, it, expect } from 'vitest';
import { HmlValidator } from '../src/validators/hml-validator';

describe('HmlValidator', () => {
  const validator = new HmlValidator();

  describe('XML 语法校验', () => {
    it('应该通过有效的 HML', () => {
      const validHml = `<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>Test</title>
  </meta>
  <view id="main_view" name="Main" x="0" y="0" w="454" h="454">
    <hg_button id="btn_click" name="Click" x="10" y="10" w="100" h="44" text="Click" />
  </view>
</hml>`;
      
      const result = validator.validate(validHml);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝无效的 XML 语法', () => {
      const invalidHml = `<hml>
  <view id="main" x="0" y="0">
    <hg_button id="btn" 
  </view>
</hml>`;
      
      const result = validator.validate(invalidHml);
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('syntax');
    });

    it('应该拒绝缺少根元素的 HML', () => {
      const invalidHml = `<view id="main"></view>`;
      
      const result = validator.validate(invalidHml);
      expect(result.valid).toBe(false);
    });
  });

  describe('结构校验', () => {
    it('应该拒绝缺少 view 的 HML', () => {
      const noViewHml = `<hml>
  <meta>
    <title>Test</title>
  </meta>
</hml>`;
      
      const result = validator.validate(noViewHml);
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('structure');
    });
  });

  describe('组件校验', () => {
    it('应该拒绝未知组件类型', () => {
      const unknownComponentHml = `<hml>
  <view id="view_main" name="Main" x="0" y="0" w="454" h="454">
    <hg_unknown id="unknown1" name="Unknown" x="0" y="0" w="100" h="100" />
  </view>
</hml>`;
      
      const result = validator.validate(unknownComponentHml);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('未知组件类型'))).toBe(true);
    });

    it('应该拒绝缺少必需属性的组件', () => {
      const missingPropsHml = `<hml>
  <view id="view_main" name="Main" x="0" y="0" w="454" h="454">
    <hg_button id="btn_click" name="Click" x="10" y="10" />
  </view>
</hml>`;
      
      const result = validator.validate(missingPropsHml);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('缺少必需属性'))).toBe(true);
    });

    it('应该拒绝重复的 ID', () => {
      const duplicateIdHml = `<hml>
  <view id="view_main" name="Main" x="0" y="0" w="454" h="454">
    <hg_button id="btn_click" name="Click1" x="10" y="10" w="100" h="44" />
    <hg_button id="btn_click" name="Click2" x="120" y="10" w="100" h="44" />
  </view>
</hml>`;
      
      const result = validator.validate(duplicateIdHml);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('ID 重复'))).toBe(true);
    });

    it('应该拒绝负数坐标', () => {
      const negativeCoordHml = `<hml>
  <view id="view_main" name="Main" x="0" y="0" w="454" h="454">
    <hg_button id="btn_click" name="Click" x="-10" y="10" w="100" h="44" />
  </view>
</hml>`;
      
      const result = validator.validate(negativeCoordHml);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('不能为负数'))).toBe(true);
    });

    it('应该拒绝无效的颜色格式', () => {
      const invalidColorHml = `<hml>
  <view id="view_main" name="Main" x="0" y="0" w="454" h="454">
    <hg_button id="btn_click" name="Click" x="10" y="10" w="100" h="44" color="invalid" />
  </view>
</hml>`;
      
      const result = validator.validate(invalidColorHml);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('颜色格式无效'))).toBe(true);
    });
  });

  describe('警告检查', () => {
    it('应该警告按钮尺寸过小', () => {
      const smallButtonHml = `<hml>
  <view id="view_main" name="Main" x="0" y="0" w="454" h="454">
    <hg_button id="btn_click" name="Click" x="10" y="10" w="30" h="30" />
  </view>
</hml>`;
      
      const result = validator.validate(smallButtonHml);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.message.includes('尺寸建议不小于'))).toBe(true);
    });

    it('应该警告字体大小过小', () => {
      const smallFontHml = `<hml>
  <view id="view_main" name="Main" x="0" y="0" w="454" h="454">
    <hg_label id="lbl_text" name="Text" x="10" y="10" w="100" h="20" fontSize="8" />
  </view>
</hml>`;
      
      const result = validator.validate(smallFontHml);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.message.includes('字体大小建议'))).toBe(true);
    });

    it('应该警告 ID 前缀不匹配', () => {
      const wrongPrefixHml = `<hml>
  <view id="view_main" name="Main" x="0" y="0" w="454" h="454">
    <hg_button id="label_text" name="Click" x="10" y="10" w="100" h="44" />
  </view>
</hml>`;
      
      const result = validator.validate(wrongPrefixHml);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.message.includes('建议使用'))).toBe(true);
    });
  });

  describe('统计信息', () => {
    it('应该返回正确的组件统计', () => {
      const hml = `<hml>
  <view id="view_main" name="Main" x="0" y="0" w="454" h="454">
    <hg_button id="btn1" name="B1" x="0" y="0" w="44" h="44" />
    <hg_label id="lbl1" name="L1" x="50" y="0" w="100" h="20" />
    <hg_image id="img1" name="I1" x="0" y="50" w="100" h="100" src="test.bin" />
  </view>
</hml>`;
      
      const result = validator.validate(hml);
      expect(result.stats).toBeDefined();
      expect(result.stats!.componentCount).toBe(4);
      expect(result.stats!.containerCount).toBe(1);
    });
  });
});