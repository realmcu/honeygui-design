import React, { useState } from 'react';
import { PropertyPanelProps } from './types';
import { BaseProperties } from './BaseProperties';
import { PropertyEditor } from './PropertyEditor';
import { EventsPanel } from './EventsPanel';

export const HgWindowProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate, components }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');
  const enableBlur = component.data?.enableBlur ?? false;
  const blurDegree = component.data?.blurDegree ?? 225;
  const backgroundColor = component.style?.backgroundColor ?? '#000000';

  const handleStyleChange = (property: string, value: any) => {
    onUpdate({
      style: {
        ...component.style,
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
            />

            {/* 样式属性 */}
            <div className="property-group">
              <div className="property-group-title">样式</div>
              <div className="property-item">
                <label>背景色</label>
                <PropertyEditor
                  type="color"
                  value={backgroundColor}
                  onChange={(value) => handleStyleChange('backgroundColor', value)}
                />
              </div>
            </div>

            {/* Blur 效果 */}
            <div className="property-group">
              <div className="property-group-title">模糊效果</div>
              
              <div className="property-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>启用模糊</label>
                  <PropertyEditor
                    type="boolean"
                    value={enableBlur}
                    onChange={(value) => onUpdate({ data: { ...component.data, enableBlur: value } })}
                  />
                </div>
              </div>

              {enableBlur && (
                <div className="property-item">
                  <label>模糊程度 (0-255)</label>
                  <PropertyEditor
                    type="number"
                    value={blurDegree}
                    onChange={(value) => {
                      const clampedValue = Math.max(0, Math.min(255, value));
                      onUpdate({ data: { ...component.data, blurDegree: clampedValue } });
                    }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                    默认值: 225
                  </div>
                </div>
              )}
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
