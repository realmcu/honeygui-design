import React, { useEffect, useRef } from 'react';
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
  const syncInProgress = useRef(false);
  const lastSyncKey = useRef('');
  
  // 直接从 store 获取方法（不订阅状态变化）
  const getState = useDesignerStore.getState;
  
  useEffect(() => {
    // 生成同步 key，只有关键属性变化时才同步
    const syncKey = JSON.stringify({
      id: component.id,
      noteNum: component.data?.noteNum,
      itemWidth: component.style?.itemWidth,
      itemHeight: component.style?.itemHeight,
      space: component.style?.space,
      direction: component.style?.direction,
    });
    
    // 如果 key 没变，跳过同步
    if (syncKey === lastSyncKey.current) return;
    lastSyncKey.current = syncKey;
    
    // 防止重复同步
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    
    try {
      const { components, updateComponent, addComponent } = getState();
      
      const noteNum = (component.data?.noteNum as number) || 5;
      const itemWidth = parseInt(String(component.style?.itemWidth)) || 100;
      const itemHeight = parseInt(String(component.style?.itemHeight)) || 100;
      const space = parseInt(String(component.style?.space)) || 0;
      const direction = (component.style?.direction as string) || 'VERTICAL';
      const isVertical = direction === 'VERTICAL';
      const currentChildren = component.children || [];
      
      // 调试日志：打印 list 的配置
      console.log(`[ListWidget] List config:`, {
        id: component.id,
        noteNum,
        itemWidth,
        itemHeight,
        space,
        direction,
        styleRaw: component.style
      });
      
      // 只同步垂直/水平方向上与项尺寸相关的维度
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
      
      // 查找已存在的 list_item 子组件（可能是从 HML 加载的）
      const existingListItems = components.filter(
        c => c.type === 'hg_list_item' && c.parent === component.id
      );
      
      // 如果已经有 list_item 子组件，处理数量变化和位置更新
      if (existingListItems.length > 0) {
        const currentCount = existingListItems.length;
        
        // 首先，更新所有已存在的 list_item 的位置和尺寸
        existingListItems.forEach((item, index) => {
          const newPosition = calculateItemPosition(
            index, itemWidth, itemHeight, space, isVertical
          );
          
          // 检查位置或尺寸是否有变化
          const hasPositionChange = 
            item.position.x !== newPosition.x ||
            item.position.y !== newPosition.y ||
            item.position.width !== newPosition.width ||
            item.position.height !== newPosition.height;
          
          if (hasPositionChange) {
            console.log(`[ListWidget] Updating item ${index} position:`, {
              old: item.position,
              new: newPosition
            });
            updateComponent(item.id, { position: newPosition });
          }
        });
        
        // 如果数量匹配，只更新位置，不处理数量
        if (currentCount === noteNum) {
          return;
        }
        
        // 数量增加：创建新的 list_item
        if (currentCount < noteNum) {
          const otherChildren = currentChildren.filter(childId => {
            const child = components.find(c => c.id === childId);
            return child && child.type !== 'hg_list_item';
          });
          
          const newChildren = [...currentChildren];
          
          for (let i = currentCount; i < noteNum; i++) {
            const itemId = `${component.id}_item_${i}`;  // 使用与 syncListItems 一致的格式
            
            // 调试日志
            console.log(`[ListWidget] Creating item ${i}: itemHeight=${itemHeight}, space=${space}, index=${i}`);
            
            const position = calculateItemPosition(
              i, itemWidth, itemHeight, space, isVertical
            );
            
            console.log(`[ListWidget] Calculated position for item ${i}:`, position);
            
            const newItem: Component = {
              id: itemId,
              type: 'hg_list_item',
              name: `List Item ${i + 1}`,
              position,
              visible: true,
              enabled: true,
              locked: true,
              zIndex: i,
              children: [],
              parent: component.id,
              style: {},
              data: { index: i },
            };
            addComponent(newItem);
            newChildren.push(itemId);
          }
          
          updateComponent(component.id, { children: newChildren });
        }
        
        // 数量减少：删除多余的 list_item
        if (currentCount > noteNum) {
          const { removeComponent } = getState();
          
          // 直接使用现有的 list_item 组件，按 index 排序后删除多余的
          const sortedItems = existingListItems.sort((a, b) => {
            const indexA = (a.data?.index as number) ?? 0;
            const indexB = (b.data?.index as number) ?? 0;
            return indexA - indexB;
          });
          
          const itemsToKeep = sortedItems.slice(0, noteNum);
          const itemsToDelete = sortedItems.slice(noteNum);
          
          itemsToDelete.forEach(item => {
            removeComponent(item.id, true); // 传递 fromListSync = true
          });
          
          // 保留其他类型的子组件
          const otherChildren = currentChildren.filter(childId => {
            const child = components.find(c => c.id === childId);
            return child && child.type !== 'hg_list_item';
          });
          
          updateComponent(component.id, { 
            children: [...itemsToKeep.map(item => item.id), ...otherChildren] 
          });
        }
        
        return;
      }
      
      // 没有 list_item 子组件，创建新的 list_item
      // 保留其他类型的子组件
      const otherChildren = currentChildren.filter(childId => {
        const child = components.find(c => c.id === childId);
        return child && child.type !== 'hg_list_item';
      });
      
      const targetChildren: string[] = [];
      
      for (let i = 0; i < noteNum; i++) {
        const itemId = `${component.id}_item_${i}`;  // 使用与 syncListItems 一致的格式
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
            zIndex: i,
            children: [],
            parent: component.id,
            style: {},
            data: { index: i },
          };
          addComponent(newItem);
        }
      }
      
      // 更新列表的 children：先放 list_item，再放其他子组件
      if (targetChildren.length > 0) {
        updateComponent(component.id, { children: [...targetChildren, ...otherChildren] });
      }
    } finally {
      syncInProgress.current = false;
    }
  }, [
    component.id,
    component.data?.noteNum,
    component.style?.itemWidth,
    component.style?.itemHeight,
    component.style?.space,
    component.style?.direction,
    component.position.width,
    component.position.height,
    component.children,
    getState
  ]);
  
  return (
    <div key={component.id} style={style} {...handlers}>
      {children}
    </div>
  );
};
