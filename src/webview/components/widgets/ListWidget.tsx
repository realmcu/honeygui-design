import React, { useEffect } from 'react';
import { WidgetProps } from './types';
import { useDesignerStore } from '../../store';
import { Component } from '../../types';

export const ListWidget: React.FC<WidgetProps> = ({ component, style, handlers, children }) => {
  const { components, updateComponent, addComponent } = useDesignerStore();
  
  // 自动生成列表项子组件
  useEffect(() => {
    const noteNum = (component.data?.noteNum as number) || 5;
    const noteLength = (component.data?.noteLength as number) || 100;
    const space = (component.data?.space as number) || 0;
    const direction = (component.data?.direction as string) || 'VERTICAL';
    
    const currentChildren = component.children || [];
    const isVertical = direction === 'VERTICAL';
    
    // 需要的子组件ID列表
    const targetChildren: string[] = [];
    
    for (let i = 0; i < noteNum; i++) {
      const itemId = `${component.id}_item_${i + 1}`;
      targetChildren.push(itemId);
      
      // 检查子组件是否已存在
      const existingItem = components.find(c => c.id === itemId);
      const offset = i * (noteLength + space);
      
      if (!existingItem) {
        // 创建新的列表项
        const newItem: Component = {
          id: itemId,
          type: 'hg_view',
          name: `列表项 ${i + 1}`,
          position: {
            x: isVertical ? 0 : offset,
            y: isVertical ? offset : 0,
            width: isVertical ? component.position.width : noteLength,
            height: isVertical ? noteLength : component.position.height,
          },
          visible: true,
          enabled: true,
          locked: true,  // 锁定列表项，禁止单独拖拽
          zIndex: 1,
          children: [],
          parent: component.id,
          style: {},
          data: {},
        };
        addComponent(newItem);
      } else {
        // 更新现有列表项的位置和锁定状态
        updateComponent(itemId, {
          position: {
            x: isVertical ? 0 : offset,
            y: isVertical ? offset : 0,
            width: isVertical ? component.position.width : noteLength,
            height: isVertical ? noteLength : component.position.height,
          },
          locked: true  // 确保列表项始终锁定
        });
      }
    }
    
    // 更新列表的 children
    if (JSON.stringify(currentChildren.sort()) !== JSON.stringify(targetChildren.sort())) {
      updateComponent(component.id, { children: targetChildren });
    }
    
    // 删除多余的子组件
    currentChildren.forEach(childId => {
      if (!targetChildren.includes(childId)) {
        const childToRemove = components.find(c => c.id === childId);
        if (childToRemove) {
          // 通过消息删除
          window.vscodeAPI?.postMessage({
            command: 'removeComponent',
            componentId: childId
          });
        }
      }
    });
  }, [component.id, component.data?.noteNum, component.data?.noteLength, component.data?.space, component.data?.direction, component.position.width, component.position.height]);
  
  return (
    <div key={component.id} style={style} {...handlers}>
      {children}
    </div>
  );
};
