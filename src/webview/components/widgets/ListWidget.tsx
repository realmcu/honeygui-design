import React, { useEffect } from 'react';
import { WidgetProps } from './types';
import { useDesignerStore } from '../../store';
import { Component } from '../../types';

/**
 * 计算列表项的位置
 */
const calculateItemPosition = (
  index: number,
  noteLength: number,
  space: number,
  isVertical: boolean,
  listWidth: number,
  listHeight: number
) => {
  const offset = index * (noteLength + space);
  return {
    x: isVertical ? 0 : offset,
    y: isVertical ? offset : 0,
    width: isVertical ? listWidth : noteLength,
    height: isVertical ? noteLength : listHeight,
  };
};

/**
 * 列表控件
 * 自动管理子列表项的创建、更新和删除
 */
export const ListWidget: React.FC<WidgetProps> = ({ component, style, handlers, children }) => {
  const { components, updateComponent, addComponent } = useDesignerStore();
  
  useEffect(() => {
    const noteNum = (component.data?.noteNum as number) || 5;
    const noteLength = (component.data?.noteLength as number) || 100;
    const space = (component.data?.space as number) || 0;
    const direction = (component.data?.direction as string) || 'VERTICAL';
    const isVertical = direction === 'VERTICAL';
    const currentChildren = component.children || [];
    
    // 生成目标子组件列表
    const targetChildren: string[] = [];
    
    for (let i = 0; i < noteNum; i++) {
      const itemId = `${component.id}_item_${i + 1}`;
      targetChildren.push(itemId);
      
      const position = calculateItemPosition(
        i, noteLength, space, isVertical,
        component.position.width, component.position.height
      );
      
      const existingItem = components.find(c => c.id === itemId);
      
      if (!existingItem) {
        // 创建新列表项
        const newItem: Component = {
          id: itemId,
          type: 'hg_list_item',
          name: `列表项 ${i + 1}`,
          position,
          visible: true,
          enabled: true,
          locked: true,
          zIndex: 1,
          children: [],
          parent: component.id,
          style: {},
          data: { index: i },
        };
        addComponent(newItem);
      } else {
        // 更新现有列表项
        updateComponent(itemId, { position, locked: true });
      }
    }
    
    // 更新列表的 children
    if (JSON.stringify(currentChildren.sort()) !== JSON.stringify(targetChildren.sort())) {
      updateComponent(component.id, { children: targetChildren });
    }
    
    // 删除多余的子组件
    currentChildren
      .filter(childId => !targetChildren.includes(childId))
      .forEach(childId => {
        window.vscodeAPI?.postMessage({
          command: 'removeComponent',
          componentId: childId
        });
      });
  }, [
    component.id,
    component.data?.noteNum,
    component.data?.noteLength,
    component.data?.space,
    component.data?.direction,
    component.position.width,
    component.position.height
  ]);
  
  return (
    <div key={component.id} style={style} {...handlers}>
      {children}
    </div>
  );
};
