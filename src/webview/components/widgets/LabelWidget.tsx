import React from 'react';
import { WidgetProps } from './types';
import { useFontLoader } from '../../hooks/useFontLoader';
import { useFontGlyphCheck } from '../../hooks/useFontGlyphCheck';

export const LabelWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const fontPath = component.data?.fontFile;
  const { fontFamily, isLoading: fontLoading } = useFontLoader(fontPath);
  const text = component.data?.text || component.name;
  
  // 检测字体是否支持文本中的所有字符（传递 fontPath 给后端解析）
  const { supported, missingChars, isChecking } = useFontGlyphCheck(fontFamily, text, fontPath);
  
  // 只有在选择了自定义字体且检测完成时才显示警告
  const showWarning = fontPath && !fontLoading && !isChecking && !supported && missingChars.length > 0;

  // 合并字体样式
  const hAlign = component.style?.hAlign || 'LEFT';
  const vAlign = component.style?.vAlign || 'TOP';
  const wordWrap = component.style?.wordWrap || false;
  const wordBreak = component.style?.wordBreak || false;
  
  const labelStyle: React.CSSProperties = {
    ...style,
    fontFamily: fontFamily || 'inherit',
    fontSize: component.data?.fontSize || 16,
    color: component.style?.color || '#ffffff',
    letterSpacing: component.style?.letterSpacing || 0,
    lineHeight: component.style?.lineSpacing ? `${(component.style.lineSpacing as number) + 16}px` : 'normal',
    textAlign: hAlign.toLowerCase() as any,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: vAlign === 'MID' ? 'center' : 'flex-start',
    // 按词换行：word-break: keep-all 保持单词完整，break-all 允许任意位置断开
    wordBreak: wordBreak ? 'keep-all' : 'break-all',
    whiteSpace: wordWrap ? 'pre-wrap' : 'nowrap',
    overflow: 'hidden',
  };

  const warningStyle: React.CSSProperties = {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'system-ui, sans-serif',
    whiteSpace: 'normal',
    wordBreak: 'break-all',
    lineHeight: '1.4',
  };

  return (
    <div key={component.id} style={labelStyle} {...handlers}>
      {/* 如果字体不支持，隐藏文本；否则正常显示 */}
      {!showWarning && (
        <span style={{ fontFamily: fontFamily || 'inherit' }}>{text}</span>
      )}
      {/* 显示警告信息 */}
      {showWarning && (
        <span style={warningStyle}>
          ⚠️ 字体缺少字形: {missingChars.slice(0, 5).map(c => `"${c}"`).join(' ')}
          {missingChars.length > 5 && ` 等${missingChars.length}个字符`}
        </span>
      )}
    </div>
  );
};
