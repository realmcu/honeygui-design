import React, { useState } from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { EventsPanel } from './EventsPanel';

/**
 * hg_list_item 属性面板
 * 列表项的位置和大小由父列表自动管理，不可编辑
 */
export const ListItemProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate, components = [] }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');
  const parentComponent = components.find(c => c.id === component.parent);

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
            {/* 基本信息 */}
            <div className="property-group">
              <div className="property-item">
                <label>名称</label>
                <PropertyEditor
                  type="string"
                  value={component.name}
                  onChange={(value) => onUpdate({ name: value })}
                />
              </div>

              <div className="property-item">
                <label>ID</label>
                <PropertyEditor
                  type="string"
                  value={component.id}
                  onChange={() => {}}
                  disabled
                />
              </div>

              <div className="property-item">
                <label>父对象</label>
                <input
                  type="text"
                  value={parentComponent ? `${parentComponent.name} (${parentComponent.type})` : '无'}
                  disabled
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    opacity: 0.6,
                  }}
                />
              </div>

              <div className="property-item">
                <label>索引</label>
                <PropertyEditor
                  type="number"
                  value={component.data?.index ?? 0}
                  onChange={() => {}}
                  disabled
                />
              </div>
            </div>

            {/* 位置与大小（只读） */}
            <div className="property-group">
              <div className="property-item">
                <label>位置与大小</label>
                <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                  由父列表自动管理，不可修改
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  <div>
                    <label style={{ fontSize: '12px' }}>X</label>
                    <PropertyEditor type="number" value={component.position.x} onChange={() => {}} disabled />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>Y</label>
                    <PropertyEditor type="number" value={component.position.y} onChange={() => {}} disabled />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>宽度</label>
                    <PropertyEditor type="number" value={component.position.width} onChange={() => {}} disabled />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>高度</label>
                    <PropertyEditor type="number" value={component.position.height} onChange={() => {}} disabled />
                  </div>
                </div>
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
