import React, { useEffect } from 'react';
import { WidgetProps } from './types';
import { useDesignerStore } from '../../store';
import { Component } from '../../types';

/**
 * 计算列表项的位置
 * 根据 direction、itemWidth、itemHeight 和 space 计算每个 list_item 的位置
 */
const calculateItemPosition = (
  index: number,
  itemWidth: number,
  itemHeight: number,
  space: number,
  isVertical: boolean
) => {
  return {
    x: isVertical ? 0 : index * (itemWidth + space),
    y: isVertical ? index * (itemHeight + space) : 0,
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
    const space = (component.style?.space as number) || 0;
    const direction = (component.style?.direction as string) || 'VERTICAL';
    const isVertical = direction === 'VERTICAL';
    const currentChildren = component.children || [];
    
    // 只同步垂直/水平方向上与项尺寸相关的维度
    // 垂直方向：列表宽度 = 项宽度（高度由用户手动设置）
    // 水平方向：列表高度 = 项高度（宽度由用户手动设置）
    const positionUpdates: Partial<typeof component.position> = {};
    if (isVertical && component.position.width !== itemWidth) {
      positionUpdates.width = itemWidth;
    } else if (!isVertical && component.position.height !== itemHeight) {
      positionUpdates.height = itemHeight;
    }
    
    // 如果有尺寸变化，更新列表尺寸
    if (Object.keys(positionUpdates).length > 0) {
      updateComponent(component.id, {
        position: {
          ...component.position,
          ...positionUpdates,
        },
      });
    }
    
    // 生成目标子组件列表
    const targetChildren: string[] = [];
    
    for (let i = 0; i < noteNum; i++) {
      const itemId = `${component.id}_item_${i + 1}`;
      targetChildren.push(itemId);
      
      const position = calculateItemPosition(
        i, itemWidth, itemHeight, space, isVertical
      );
      
      const existingItem = components.find(c => c.id === itemId);
      
      if (!existingItem) {
        // 创建新列表项
        const newItem: Component = {
          id: itemId,
          type: 'hg_list_item',
          name: `List Item ${i + 1}`,
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
    component.style?.space,
    component.style?.direction
  ]);
  
  return (
    <div key={component.id} style={style} {...handlers}>
      {children}
    </div>
  );
};
