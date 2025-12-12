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
  title
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
              onChange(0);
            } else {
              const num = parseFloat(val);
              onChange(isNaN(num) ? 0 : num);
            }
          }}
          onBlur={(e) => {
            // 失焦时确保是有效数字
            const val = e.target.value;
            if (val === '' || val === '-') {
              onChange(0);
            }
          }}
          disabled={disabled}
          title={title}
          style={{ ...inputStyle, ...disabledStyle }}
        />
      );

    case 'color':
      return (
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
      );

    case 'select':
      return (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{ ...inputStyle, ...disabledStyle }}
        >
          {options?.map((option: string) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
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
