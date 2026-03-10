import React, { useRef, useEffect } from 'react';
import { PropertyEditorProps } from './types';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  marginTop: '4px',
  backgroundColor: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  borderRadius: '2px',
};

export const PropertyEditor: React.FC<PropertyEditorProps> = ({
  type,
  value,
  onChange,
  options,
  disabled,
  title,
  hint,
  min,
  max,
  placeholder
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const colorTextRef = useRef<HTMLInputElement>(null);
  const disabledStyle = disabled ? { opacity: 0.6, cursor: 'not-allowed' } : {};

  // 处理滚轮事件，防止在输入框聚焦时滚动面板
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // 阻止滚轮事件传播到父容器
      e.stopPropagation();
    };

    const elements = [inputRef.current, colorTextRef.current].filter(Boolean);
    
    elements.forEach(element => {
      if (element) {
        element.addEventListener('wheel', handleWheel, { passive: false });
      }
    });
    
    return () => {
      elements.forEach(element => {
        if (element) {
          element.removeEventListener('wheel', handleWheel);
        }
      });
    };
  }, [type]);

  // 辅助函数：标准化颜色值为 6 位 RGB 格式
  const normalizeColor = (color: string): string => {
    if (!color || !color.startsWith('#')) return color;
    const hex = color.slice(1).toUpperCase();
    
    // 8 位 RGBA -> 6 位 RGB（去掉 Alpha 通道）
    if (hex.length === 8) {
      return '#' + hex.slice(0, 6);
    }
    
    // 3 位 RGB -> 6 位 RGB
    if (hex.length === 3) {
      return '#' + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    // 6 位 RGB 保持不变
    if (hex.length === 6) {
      return '#' + hex;
    }
    
    return color;
  };

  switch (type) {
    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          style={{ marginTop: '4px' }}
        />
      );

    case 'number':
      return (
        <input
          ref={inputRef}
          type="number"
          value={value ?? ''}
          min={min}
          max={max}
          placeholder={placeholder}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '' || val === '-') {
              onChange('');
              return;
            }
            let num = parseFloat(val);
            if (!isNaN(num)) {
              // 在 onChange 时也应用 min/max 限制，防止输入超出范围的值
              if (min !== undefined && num < min) {
                num = min;
              }
              if (max !== undefined && num > max) {
                num = max;
              }
              onChange(num);
            }
          }}
          onBlur={(e) => {
            let val = parseFloat(e.target.value);
            
            // 空值或无效值处理
            if (isNaN(val) || e.target.value === '') {
              val = min !== undefined ? min : 0;
            }
            
            // 应用 min/max 限制
            if (min !== undefined && val < min) {
              val = min;
            }
            if (max !== undefined && val > max) {
              val = max;
            }
            
            // 更新值
            onChange(val);
          }}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          title={title}
          style={{ ...inputStyle, ...disabledStyle }}
        />
      );

    case 'color':
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="color"
              value={normalizeColor(value || '#000000')}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              style={{ width: '30px', height: '30px', padding: 0, border: 'none' }}
            />
            <input
              ref={colorTextRef}
              type="text"
              value={value || ''}
              onChange={(e) => {
                const input = e.target.value;
                // 允许空值或正在输入 # 开头
                if (input === '' || input === '#') {
                  onChange(input);
                  return;
                }
                // 验证格式：# + 最多6位十六进制字符
                if (/^#[0-9A-Fa-f]{0,6}$/.test(input)) {
                  onChange(input.toUpperCase());
                }
                // 如果输入超过7位（# + 6位），截断为7位
                else if (input.startsWith('#') && input.length > 7) {
                  onChange(input.slice(0, 7).toUpperCase());
                }
              }}
              onBlur={(e) => {
                // 失焦时自动标准化为 6 位 RGB 格式
                const normalized = normalizeColor(e.target.value);
                if (normalized !== e.target.value) {
                  onChange(normalized);
                }
              }}
              disabled={disabled}
              placeholder="#RRGGBB"
              maxLength={7}
              style={{ ...inputStyle, flex: 1, ...disabledStyle }}
            />
          </div>
          {hint && (
            <div style={{
              fontSize: '10px',
              color: 'var(--vscode-descriptionForeground)',
              marginTop: '4px',
              lineHeight: '1.4'
            }}>
              💡 {hint}
            </div>
          )}
        </div>
      );

    case 'select':
      return (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{ ...inputStyle, ...disabledStyle }}
        >
          {options?.map((option: string | { value: string; label: string }) => {
            const optionValue = typeof option === 'string' ? option : option.value;
            const optionLabel = typeof option === 'string' ? option : option.label;
            return (
              <option key={optionValue} value={optionValue}>
                {optionLabel}
              </option>
            );
          })}
        </select>
      );

    default:
      return (
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          title={title}
          style={{ ...inputStyle, ...disabledStyle }}
        />
      );
  }
};
