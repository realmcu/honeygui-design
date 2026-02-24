import React from 'react';
import { WidgetProps } from './types';
import { useFontLoader } from '../../hooks/useFontLoader';
import { useFontGlyphCheck } from '../../hooks/useFontGlyphCheck';

export const LabelWidget: React.FC<WidgetProps> = ({ component, style, handlers, children }) => {
  const fontPath = component.data?.fontFile;
  const { fontFamily, isLoading: fontLoading } = useFontLoader(fontPath);
  const timeFormat = component.data?.timeFormat || '';
  const isSplitTime = timeFormat === 'HH:mm-split';
  
  // 计时器模式
  const isTimerLabel = component.data?.isTimerLabel === true;
  const timerType = component.data?.timerType || 'stopwatch';
  const timerInitialValue = Number(component.data?.timerInitialValue) || 0;
  const timerFormat = component.data?.timerFormat || 'HH:MM:SS';
  
  // 计时器状态（仅用于预览，单位：毫秒）
  const [timerValue, setTimerValue] = React.useState(timerInitialValue);
  
  // 计时器预览动画
  React.useEffect(() => {
    if (!isTimerLabel) return;
    
    // 根据格式决定更新间隔
    const updateInterval = timerFormat === 'MM:SS:MS' ? 10 : 1000;
    const incrementValue = timerFormat === 'MM:SS:MS' ? 10 : 1000;
    
    const interval = setInterval(() => {
      setTimerValue(prev => {
        if (timerType === 'stopwatch') {
          return prev + incrementValue;
        } else {
          // countdown
          return prev > 0 ? prev - incrementValue : 0;
        }
      });
    }, updateInterval);
    
    return () => clearInterval(interval);
  }, [isTimerLabel, timerType, timerFormat]);
  
  // 格式化计时器显示（输入单位：毫秒）
  const formatTimerValue = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const ms = Math.floor((milliseconds % 1000) / 10); // 百分之一秒（00-99）
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    switch (timerFormat) {
      case 'HH:MM:SS':
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
      case 'MM:SS':
        return `${pad(m)}:${pad(s)}`;
      case 'MM:SS:MS':
        return `${pad(m)}:${pad(s)}:${pad(ms)}`;
      case 'SS':
        return pad(s);
      default:
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
  };
  
  // 拆分时间模式下使用用户设置的文本，如果没有则使用默认示例
  let displayText = component.data?.text || component.name;
  
  // 如果启用了计时器模式，显示格式化的计时器值
  if (isTimerLabel) {
    displayText = formatTimerValue(timerValue);
  } else if (isSplitTime && !component.data?.text) {
    displayText = '12:34'; // 拆分时间的默认预览（仅当用户未设置文本时）
  }
  
  const text = displayText;
  const [fontMetrics, setFontMetrics] = React.useState<{ scaleFactor: number } | null>(null);
  
  // 滚动动画状态
  const [scrollOffset, setScrollOffset] = React.useState(0);
  const animationRef = React.useRef<number | null>(null);
  const startTimeRef = React.useRef<number | null>(null);
  
  // 检测字体是否支持文本中的所有字符（传递 fontPath 给后端解析）
  const { supported, missingChars, isChecking } = useFontGlyphCheck(fontFamily, text, fontPath);
  
  // 只有在选择了自定义字体且检测完成时才显示警告
  const showWarning = fontPath && !fontLoading && !isChecking && !supported && missingChars.length > 0;

  // 监听字体度量信息
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.command === 'fontMetricsLoaded' && event.data.fontPath === fontPath) {
        setFontMetrics({ scaleFactor: event.data.metrics.scaleFactor });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fontPath]);

  // 当字体文件改变时，请求字体度量信息
  React.useEffect(() => {
    if (fontPath) {
      window.vscodeAPI?.postMessage({
        command: 'getFontMetrics',
        fontPath: fontPath
      });
    } else {
      setFontMetrics(null);
    }
  }, [fontPath]);

  // 合并字体样式
  const hAlign = component.style?.hAlign || 'LEFT';
  const vAlign = component.style?.vAlign || 'TOP';
  
  // 滚动相关属性
  const enableScroll = component.data?.enableScroll === true || component.data?.enableScroll === 'true';
  const scrollPreview = component.data?.scrollPreview === true || component.data?.scrollPreview === 'true';
  const scrollDirection = component.data?.scrollDirection || 'horizontal';
  const scrollReverse = component.data?.scrollReverse === true || component.data?.scrollReverse === 'true';
  const scrollStartOffset = Number(component.data?.scrollStartOffset) || 0;
  const scrollEndOffset = Number(component.data?.scrollEndOffset) || 0;
  const scrollInterval = Number(component.data?.scrollInterval) || 3000;
  const scrollDuration = Number(component.data?.scrollDuration) || 0;
  
  // 换行设置：滚动时根据方向自动设置
  // - 横向滚动：强制不换行
  // - 纵向滚动：强制换行
  // - 非滚动：使用用户设置
  let wordWrap: boolean;
  if (enableScroll) {
    wordWrap = scrollDirection === 'vertical';
  } else {
    wordWrap = component.style?.wordWrap || false;
  }
  const wordBreak = component.style?.wordBreak || false;
  
  // 获取配置的字号（确保是数字类型）
  const configuredFontSize = Number(component.data?.fontSize) || 16;
  
  // 是否使用精确预览模式（默认开启）
  const useAccuratePreview = component.data?.useAccuratePreview ?? false;
  
  // 计算实际渲染字号
  let actualFontSize = configuredFontSize;
  if (useAccuratePreview && fontMetrics && fontMetrics.scaleFactor !== 1.0) {
    // 精确预览模式：模拟转换器的缩放效果
    actualFontSize = configuredFontSize * fontMetrics.scaleFactor;
  }
  
  // 计算垂直对齐的 padding
  // 关键：lineHeight 等于 fontSize 时，文本占用空间 = EM 矩形大小
  const lineSpacingNum = Number(component.style?.lineSpacing) || 0;
  const lineHeight = lineSpacingNum 
    ? actualFontSize + lineSpacingNum
    : actualFontSize;
  
  const containerHeight = typeof style?.height === 'number' ? style.height : 0;
  const containerWidth = typeof style?.width === 'number' ? style.width : 0;
  const verticalPadding = vAlign === 'MID' && containerHeight > 0 
    ? Math.max(0, (containerHeight - lineHeight) / 2) 
    : 0;

  // 滚动动画效果
  React.useEffect(() => {
    if (!enableScroll || !scrollPreview) {
      setScrollOffset(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      startTimeRef.current = null;
      return;
    }

    // 计算文本实际宽度/高度（估算）
    const letterSpacing = Number(component.style?.letterSpacing) || 0;
    const textLength = text.length;
    const estimatedTextWidth = textLength * actualFontSize * 0.6 + (textLength - 1) * letterSpacing;
    const estimatedTextHeight = wordWrap 
      ? Math.ceil(estimatedTextWidth / containerWidth) * lineHeight
      : lineHeight;
    
    // 计算滚动总距离
    const isHorizontal = scrollDirection === 'horizontal';
    const containerSize = isHorizontal ? containerWidth : containerHeight;
    const textSize = isHorizontal ? estimatedTextWidth : estimatedTextHeight;
    
    // 滚动距离 = 起始偏移 + 文本长度 + 结束偏移
    const totalScrollDistance = scrollStartOffset + textSize + scrollEndOffset;
    
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      
      const elapsed = timestamp - startTimeRef.current;
      
      // 检查是否超过总持续时间
      if (scrollDuration > 0 && elapsed >= scrollDuration) {
        setScrollOffset(0);
        startTimeRef.current = null;
        return;
      }
      
      // 计算当前循环内的进度
      const cycleProgress = (elapsed % scrollInterval) / scrollInterval;
      
      // 计算偏移量
      let offset = cycleProgress * totalScrollDistance - scrollStartOffset;
      
      // 反向滚动
      if (scrollReverse) {
        offset = -offset;
      }
      
      setScrollOffset(offset);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      startTimeRef.current = null;
    };
  }, [enableScroll, scrollPreview, scrollDirection, scrollReverse, scrollStartOffset, scrollEndOffset, scrollInterval, scrollDuration, text, actualFontSize, containerWidth, containerHeight, lineHeight, wordWrap, component.style?.letterSpacing]);

  const labelStyle: React.CSSProperties = {
    ...style,
    // 确保宽高从 style 中正确继承
    width: style?.width,
    height: style?.height,
    fontFamily: fontFamily || 'inherit',
    fontSize: actualFontSize,
    color: component.style?.color || '#ffffff',
    letterSpacing: Number(component.style?.letterSpacing) || 0,
    // 关键：lineHeight 必须等于 fontSize（或 fontSize + lineSpacing），确保文本占用空间 = EM 矩形
    lineHeight: `${lineHeight}px`,
    textAlign: hAlign.toLowerCase() as any,
    display: 'block',
    // 垂直对齐：基于 lineHeight（即 EM 矩形大小）
    paddingTop: `${verticalPadding}px`,
    // 按词换行
    wordBreak: wordBreak ? 'keep-all' : 'break-all',
    whiteSpace: wordWrap ? 'pre-wrap' : 'nowrap',
    overflow: 'hidden',
    // 确保不改变容器高度
    boxSizing: 'border-box',
    position: 'absolute',
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

  // 滚动文本的样式
  const scrollTextStyle: React.CSSProperties = {
    fontFamily: fontFamily || 'inherit',
    display: 'inline-block',
    transform: enableScroll && scrollPreview
      ? scrollDirection === 'horizontal'
        ? `translateX(${-scrollOffset}px)`
        : `translateY(${-scrollOffset}px)`
      : 'none',
    transition: 'none',
  };

  // 拆分时间的特殊渲染（仅在 HH:mm-split 格式且启用换行时）
  if (isSplitTime && wordWrap && text.includes(':')) {
    const parts = text.split(':');
    if (parts.length === 2) {
      const hour = parts[0];
      const minute = parts[1];
      
      // 参考 SDK 示例布局：
      // - 冒号宽度 = 字体大小 / 2
      // - 小时和分钟使用相同的 x 和宽度
      // - 都使用居中对齐
      const colonWidth = actualFontSize / 2;  // 冒号宽度 = 字体大小 / 2
      const numWidth = containerWidth - colonWidth;  // 数字部分宽度
      
      return (
        <div key={component.id} style={{...labelStyle, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: 0}} {...handlers}>
          {/* 第一行：小时（居中对齐） */}
          <div style={{ 
            fontFamily: fontFamily || 'inherit', 
            lineHeight: `${lineHeight}px`,
            width: `${numWidth}px`,
            marginLeft: `${colonWidth}px`,
            textAlign: 'center'
          }}>
            {hour}
          </div>
          {/* 第二行：冒号 + 分钟 */}
          <div style={{ 
            display: 'flex',
            width: '100%',
            lineHeight: `${lineHeight}px`
          }}>
            {/* 冒号（居中） */}
            <div style={{ 
              fontFamily: fontFamily || 'inherit',
              width: `${colonWidth}px`,
              textAlign: 'center'
            }}>
              :
            </div>
            {/* 分钟（居中对齐，与小时上下对齐） */}
            <div style={{ 
              fontFamily: fontFamily || 'inherit',
              width: `${numWidth}px`,
              textAlign: 'center'
            }}>
              {minute}
            </div>
          </div>
          {/* 显示警告信息 */}
          {showWarning && (
            <span style={warningStyle}>
              ⚠️ 字体缺少字形: {missingChars.slice(0, 5).map(c => `"${c}"`).join(' ')}
              {missingChars.length > 5 && ` 等${missingChars.length}个字符`}
            </span>
          )}
          {children}
        </div>
      );
    }
  }

  return (
    <div key={component.id} style={labelStyle} {...handlers}>
      {/* 如果字体不支持，隐藏文本；否则正常显示 */}
      {!showWarning && (
        <span style={scrollTextStyle}>{text}</span>
      )}
      {/* 显示警告信息 */}
      {showWarning && (
        <span style={warningStyle}>
          ⚠️ 字体缺少字形: {missingChars.slice(0, 5).map(c => `"${c}"`).join(' ')}
          {missingChars.length > 5 && ` 等${missingChars.length}个字符`}
        </span>
      )}
      {children}
    </div>
  );
};
