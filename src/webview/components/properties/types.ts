import { Component } from '../../types';

export interface PropertyPanelProps {
  component: Component;
  onUpdate: (updates: Partial<Component>) => void;
}

export interface PropertyEditorProps {
  type: 'string' | 'number' | 'boolean' | 'color' | 'select';
  value: any;
  onChange: (value: any) => void;
  options?: string[];
  disabled?: boolean;
  title?: string;
}
