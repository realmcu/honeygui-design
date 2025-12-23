import React, { useEffect } from 'react';
import { WidgetProps } from './types';
import { useDesignerStore } from '../../store';
import { Component } from '../../types';

/**
 * 计算列表项的位置
 */
const calculateItemPosition = (
  index: number,
  itemWidth: number,
  itemHeight: number,
  isVertical: boolean
) => {
  return {
    x: isVertical ? 0 : index * itemWidth,
    y: isVertical ? index * itemHeight : 0,
    width: itemWidth,
    height: itemHeight,
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
    const itemWidth = (component.style?.itemWidth as number) || 100;
    const itemHeight = (component.style?.itemHeight as number) || 100;
    const direction = (component.style?.direction as string) || 'VERTICAL';
    const isVertical = direction === 'VERTICAL';
    const currentChildren = component.children || [];
    
    // 计算列表的总尺寸
    const newWidth = isVertical ? itemWidth : noteNum * itemWidth;
    const newHeight = isVertical ? noteNum * itemHeight : itemHeight;
    
    // 如果尺寸变化，更新列表尺寸
    if (component.position.width !== newWidth || component.position.height !== newHeight) {
      updateComponent(component.id, {
        position: {
          ...component.position,
          width: newWidth,
          height: newHeight,
        },
      });
    }
    
    // 生成目标子组件列表
    const targetChildren: string[] = [];
    
    for (let i = 0; i < noteNum; i++) {
      const itemId = `${component.id}_item_${i + 1}`;
      targetChildren.push(itemId);
      
      const position = calculateItemPosition(
        i, itemWidth, itemHeight, isVertical
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
    component.style?.itemWidth,
    component.style?.itemHeight,
    component.style?.direction
  ]);
  
  return (
    <div key={component.id} style={style} {...handlers}>
      {children}
    </div>
  );
};
