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
}
