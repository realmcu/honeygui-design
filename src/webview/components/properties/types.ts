import { Component } from '../../types';

export interface PropertyPanelProps {
  component: Component;
  onUpdate: (updates: Partial<Component>) => void;
  components?: Component[];  // 所有组件列表，用于父对象选择
}

export interface PropertyEditorProps {
  type: 'string' | 'number' | 'boolean' | 'color' | 'select';
  value: any;
  onChange: (value: any) => void;
  options?: (string | { value: string; label: string })[];
  disabled?: boolean;
  title?: string;
  hint?: string;  // 提示信息，显示在输入框下方
  min?: number;   // 数字类型的最小值
  max?: number;   // 数字类型的最大值
  step?: number;  // 数字类型的步进值
  placeholder?: string;  // 输入框占位符
}
