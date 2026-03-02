import React from 'react';
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
  max
}) => {
  const disabledStyle = disabled ? { opacity: 0.6, cursor: 'not-allowed' } : {};

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
          type="number"
          value={value ?? ''}
          min={min}
          max={max}
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
              value={value || '#000000'}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              style={{ width: '30px', height: '30px', padding: 0, border: 'none' }}
            />
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
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
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          title={title}
          style={{ ...inputStyle, ...disabledStyle }}
        />
      );
  }
};
