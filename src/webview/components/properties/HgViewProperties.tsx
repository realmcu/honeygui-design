import React, { useState } from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { useDesignerStore } from '../../store';
import type { ViewSwitchEvent, ViewSwitchEventType } from '../../../hml/types';

export const HgViewProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'view_switch'>('properties');

  const handlePositionChange = (field: 'x' | 'y' | 'width' | 'height', value: number) => {
    onUpdate({
      position: {
        ...component.position,
        [field]: value,
      },
    });
  };

  const handleStyleChange = (property: string, value: any) => {
    onUpdate({
      style: {
        ...component.style,
        [property]: value,
      },
    });
  };

  const handleViewSwitchAdd = () => {
    const newSwitch: ViewSwitchEvent = {
      event: 'GUI_EVENT_TOUCH_MOVE_LEFT',
      target: '',
      switch_out_style: 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION',
      switch_in_style: 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION',
    };

    onUpdate({
      view_switch: [...(component.view_switch || []), newSwitch],
    });
  };

  const handleViewSwitchUpdate = (index: number, updates: Partial<ViewSwitchEvent>) => {
    if (!component.view_switch) return;

    const newSwitches = [...component.view_switch];
    newSwitches[index] = { ...newSwitches[index], ...updates };

    onUpdate({
      view_switch: newSwitches,
    });
  };

  const handleViewSwitchRemove = (index: number) => {
    if (!component.view_switch) return;

    onUpdate({
      view_switch: component.view_switch.filter((_, i) => i !== index),
    });
  };

  const getAvailableViews = () => {
    const state = useDesignerStore.getState();
    return state.components.filter(c => c.type === 'hg_view' && c.id !== component.id);
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
          className={activeTab === 'view_switch' ? 'active' : ''}
          onClick={() => setActiveTab('view_switch')}
        >
          视图切换
        </button>
      </div>

      <div className="properties-content">
        {activeTab === 'properties' && (
          <>
            {/* Name and ID */}
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
            </div>

            {/* Position and Size */}
            <div className="property-group">
              <div className="property-item">
                <label>位置与大小</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  <div>
                    <label style={{ fontSize: '12px' }}>X</label>
                    <PropertyEditor
                      type="number"
                      value={component.position.x}
                      onChange={(value) => handlePositionChange('x', value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>Y</label>
                    <PropertyEditor
                      type="number"
                      value={component.position.y}
                      onChange={(value) => handlePositionChange('y', value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>宽度</label>
                    <PropertyEditor
                      type="number"
                      value={component.position.width}
                      onChange={(value) => handlePositionChange('width', value)}
                      disabled
                      title="hg_view 的宽度由项目分辨率决定，不可修改"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>高度</label>
                    <PropertyEditor
                      type="number"
                      value={component.position.height}
                      onChange={(value) => handlePositionChange('height', value)}
                      disabled
                      title="hg_view 的高度由项目分辨率决定，不可修改"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Visibility and State */}
            <div className="property-group">
              <div className="property-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>可见</label>
                  <PropertyEditor
                    type="boolean"
                    value={component.visible}
                    onChange={(value) => onUpdate({ visible: value })}
                  />
                </div>
              </div>

              <div className="property-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>启用</label>
                  <PropertyEditor
                    type="boolean"
                    value={component.enabled}
                    onChange={(value) => onUpdate({ enabled: value })}
                  />
                </div>
              </div>

              <div className="property-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>锁定</label>
                  <PropertyEditor
                    type="boolean"
                    value={component.locked}
                    onChange={(value) => onUpdate({ locked: value })}
                  />
                </div>
              </div>
            </div>

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
          </>
        )}

        {activeTab === 'view_switch' && (
          <div className="view-switch-panel">
            <div className="property-group">
              <div className="property-group-title">视图切换配置</div>
              
              {component.view_switch && component.view_switch.length > 0 ? (
                <div style={{ marginTop: '8px' }}>
                  {component.view_switch.map((switchEvent, index) => (
                    <div key={index} style={{
                      padding: '12px',
                      marginBottom: '12px',
                      backgroundColor: 'var(--vscode-editor-background)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <strong style={{ fontSize: '12px' }}>切换事件 #{index + 1}</strong>
                        <button
                          onClick={() => handleViewSwitchRemove(index)}
                          style={{
                            padding: '2px 8px',
                            fontSize: '12px',
                            backgroundColor: 'var(--vscode-button-secondaryBackground)',
                            color: 'var(--vscode-button-secondaryForeground)',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: 'pointer'
                          }}
                        >
                          删除
                        </button>
                      </div>

                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>触发事件</label>
                        <PropertyEditor
                          type="select"
                          value={switchEvent.event}
                          onChange={(value) => handleViewSwitchUpdate(index, { event: value as ViewSwitchEventType })}
                          options={[
                            'GUI_EVENT_TOUCH_MOVE_LEFT',
                            'GUI_EVENT_TOUCH_MOVE_RIGHT',
                            'GUI_EVENT_TOUCH_MOVE_UP',
                            'GUI_EVENT_TOUCH_MOVE_DOWN'
                          ]}
                        />
                      </div>

                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>目标视图</label>
                        <select
                          value={switchEvent.target}
                          onChange={(e) => handleViewSwitchUpdate(index, { target: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '4px',
                            marginTop: '4px',
                            backgroundColor: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            border: '1px solid var(--vscode-input-border)',
                            borderRadius: '2px',
                            fontSize: '12px'
                          }}
                        >
                          <option value="">-- 选择目标视图 --</option>
                          {getAvailableViews().map(view => (
                            <option key={view.id} value={view.name}>{view.name || view.id}</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>退出动画</label>
                        <PropertyEditor
                          type="select"
                          value={switchEvent.switch_out_style}
                          onChange={(value) => handleViewSwitchUpdate(index, { switch_out_style: value })}
                          options={[
                            'SWITCH_OUT_TO_LEFT_USE_TRANSLATION',
                            'SWITCH_OUT_TO_RIGHT_USE_TRANSLATION',
                            'SWITCH_OUT_TO_TOP_USE_TRANSLATION',
                            'SWITCH_OUT_TO_BOTTOM_USE_TRANSLATION',
                            'SWITCH_OUT_NONE_ANIMATION'
                          ]}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>进入动画</label>
                        <PropertyEditor
                          type="select"
                          value={switchEvent.switch_in_style}
                          onChange={(value) => handleViewSwitchUpdate(index, { switch_in_style: value })}
                          options={[
                            'SWITCH_IN_FROM_LEFT_USE_TRANSLATION',
                            'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION',
                            'SWITCH_IN_FROM_TOP_USE_TRANSLATION',
                            'SWITCH_IN_FROM_BOTTOM_USE_TRANSLATION',
                            'SWITCH_IN_NONE_ANIMATION'
                          ]}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  fontSize: '12px', 
                  color: 'var(--vscode-descriptionForeground)', 
                  marginTop: '8px',
                  padding: '12px',
                  textAlign: 'center'
                }}>
                  暂无视图切换配置
                </div>
              )}

              <button
                onClick={handleViewSwitchAdd}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                + 添加视图切换
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
