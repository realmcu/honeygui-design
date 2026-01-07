import React, { useState } from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { BaseProperties } from './BaseProperties';
import { EventsPanel } from './EventsPanel';

export const HgViewProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate, components }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');

  // 计算默认动画步长（屏幕高度的 1/10）
  const defaultAnimateStep = Math.round(component.position.height / 10);

  const handleStyleChange = (property: string, value: any) => {
    onUpdate({
      style: {
        ...component.style,
        [property]: value,
      },
    });
  };

  const handleDataChange = (property: string, value: any) => {
    onUpdate({
      data: {
        ...component.data,
        [property]: value,
      },
    });
  };

  return (
    <>
      <div className="properties-tabs">
        <button
          className={activeTab === 'properties' ? 'active' : ''}
          onClick={() => setActiveTab('properties')}
        >
          属性
        </button>
        <button
          className={activeTab === 'events' ? 'active' : ''}
          onClick={() => setActiveTab('events')}
        >
          事件
        </button>
      </div>

      <div className="properties-content">
        {activeTab === 'properties' && (
          <>
            <BaseProperties 
              component={component} 
              onUpdate={onUpdate}
              components={components}
              disableSize={true}
              sizeTooltip="hg_view 的宽高由项目分辨率决定，不可修改"
              hideParent={true}
            />

            {/* Style Properties */}
            <div className="property-group">
              <div className="property-group-title">样式</div>
              <div className="property-item">
                <label>背景色</label>
                <PropertyEditor
                  type="color"
                  value={component.style?.backgroundColor}
                  onChange={(value) => handleStyleChange('backgroundColor', value)}
                />
              </div>
            </div>

            {/* View Specific Properties */}
            <div className="property-group">
              <div className="property-group-title">视图属性</div>
              <div className="property-item">
                <label>常驻内存</label>
                <PropertyEditor
                  type="boolean"
                  value={component.data?.residentMemory || false}
                  onChange={(value) => handleDataChange('residentMemory', value)}
                />
              </div>
              <div className="property-item">
                <label>动画步长</label>
                <PropertyEditor
                  type="number"
                  value={component.data?.animateStep ?? defaultAnimateStep}
                  onChange={(value) => handleDataChange('animateStep', value)}
                />
              </div>
              <div className="property-item">
                <label>透明度 (0-255)</label>
                <PropertyEditor
                  type="number"
                  value={component.data?.opacity ?? 255}
                  onChange={(value) => handleDataChange('opacity', value)}
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'events' && (
          <EventsPanel component={component} onUpdate={onUpdate} />
        )}
      </div>
    </>
  );
};
