import React from 'react';
import { WidgetProps } from './types';
import { useDesignerStore } from '../../store';

export const InputWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Delete 键：删除整个控件
    if (e.key === 'Delete') {
      e.preventDefault();
      e.stopPropagation();
      const { removeComponent, selectComponent } = useDesignerStore.getState();
      removeComponent(component.id);
      selectComponent(null);
      return;
    }
    
    // Backspace 键：正常删除文字，阻止冒泡避免被全局快捷键拦截
    if (e.key === 'Backspace') {
      e.stopPropagation();
      return;
    }
    
    // 其他键：阻止冒泡
    e.stopPropagation();
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <input
      key={component.id}
      style={style}
      placeholder={component.data?.placeholder}
      defaultValue={component.data?.text || ''}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      {...handlers}
    />
  );
};
