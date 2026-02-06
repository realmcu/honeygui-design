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
  hint
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
          onChange={(e) => {
            const val = e.target.value;
            if (val === '' || val === '-') {
              // 允许暂时为空，方便用户重新输入
              onChange(val === '-' ? 0 : '');
            } else {
              const num = parseFloat(val);
              onChange(isNaN(num) ? 0 : num);
            }
          }}
          onBlur={(e) => {
            // 失焦时确保是有效数字
            const val = e.target.value;
            if (val === '' || val === '-' || value === '') {
              onChange(0);
            }
          }}
          onFocus={(e) => {
            // 聚焦时选中所有文本，方便用户直接输入新值
            e.target.select();
          }}
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
