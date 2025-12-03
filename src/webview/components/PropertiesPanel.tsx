import React, { useState } from 'react';
import { useDesignerStore } from '../store';
import { Component } from '../types';
import { componentDefinitions } from './ComponentLibrary';
import './PropertiesPanel.css';
import type { ViewSwitchEvent, ViewSwitchEventType, ViewSwitchStyle } from '../../hml/types';

const PropertiesPanel: React.FC = () => {
  const { selectedComponent, updateComponent } = useDesignerStore();
  const [activeTab, setActiveTab] = useState<'properties' | 'view_switch'>('properties');

  const selected = useDesignerStore.getState().getSelectedComponent();

  if (!selected) {
    return (
      <div className="properties-panel">
        <div className="properties-header">
          <h3>属性</h3>
        </div>
        <div className="properties-content">
          <div className="no-selection">请选择一个组件</div>
        </div>
      </div>
    );
  }

  const definition = componentDefinitions.find((d) => d.type === selected.type);

  const handlePropertyChange = (property: string, value: any) => {
    if (!selectedComponent) return;

    updateComponent(selectedComponent, {
      [property]: value,
    });
  };

  const handlePositionChange = (field: 'x' | 'y' | 'width' | 'height', value: number) => {
    if (!selectedComponent) return;

    const current = selected;
    updateComponent(selectedComponent, {
      position: {
        ...current.position,
        [field]: value,
      },
    });
  };

  const handleStyleChange = (property: string, value: any) => {
    if (!selectedComponent) return;

    const current = selected;
    updateComponent(selectedComponent, {
      style: {
        ...current.style,
        [property]: value,
      },
    });
  };

  const handleDataChange = (property: string, value: any) => {
    if (!selectedComponent) return;

    const current = selected;
    updateComponent(selectedComponent, {
      data: {
        ...current.data,
        [property]: value,
      },
    });
  };

  // 视图切换相关处理函数
  const handleViewSwitchAdd = () => {
    if (!selectedComponent) return;

    const newSwitch: ViewSwitchEvent = {
      event: 'GUI_EVENT_TOUCH_MOVE_LEFT',
      target: '',
      switch_out_style: 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION',
      switch_in_style: 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION',
    };

    updateComponent(selectedComponent, {
      view_switch: [...(selected.view_switch || []), newSwitch],
    });
  };

  const handleViewSwitchUpdate = (index: number, updates: Partial<ViewSwitchEvent>) => {
    if (!selectedComponent || !selected.view_switch) return;

    const newSwitches = [...selected.view_switch];
    newSwitches[index] = { ...newSwitches[index], ...updates };

    updateComponent(selectedComponent, {
      view_switch: newSwitches,
    });
  };

  const handleViewSwitchRemove = (index: number) => {
    if (!selectedComponent || !selected.view_switch) return;

    updateComponent(selectedComponent, {
      view_switch: selected.view_switch.filter((_, i) => i !== index),
    });
  };

  // 获取所有 hg_view 组件列表（用于目标选择）
  const getAvailableViews = (): Component[] => {
    const state = useDesignerStore.getState();
    return state.components.filter(c => c.type === 'hg_view' && c.id !== selectedComponent);
  };

  const handleSelectImagePath = () => {
    window.vscodeAPI?.postMessage({
      command: 'selectImagePath',
      componentId: selectedComponent
    });
  };

  const renderPropertyEditor = (property: any, value: any, onChange: (value: any) => void) => {
    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: '4px 6px',
      marginTop: '4px',
      backgroundColor: 'var(--vscode-input-background)',
      color: 'var(--vscode-input-foreground)',
      border: '1px solid var(--vscode-input-border)',
      borderRadius: '2px',
    };

    // 特殊处理：image组件的src属性
    if (property.name === 'src' && selected?.type === 'hg_image') {
      return (
        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="图片路径"
            style={{ ...inputStyle, marginTop: 0, flex: 1 }}
          />
          <button
            onClick={handleSelectImagePath}
            style={{
              padding: '4px 8px',
              backgroundColor: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="选择图片文件"
          >
            📁
          </button>
        </div>
      );
    }

    switch (property.type) {
      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            style={{
              marginTop: '4px',
            }}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            style={inputStyle}
          />
        );

      case 'color':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="color"
              value={value || '#000000'}
              onChange={(e) => onChange(e.target.value)}
              style={{ width: '30px', height: '30px', padding: 0, border: 'none' }}
            />
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
          >
            {property.options?.map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
          />
        );
    }
  };

  return (
    <div className="properties-panel">
      <div className="properties-header">
        <h3>属性</h3>
      </div>

      <div className="properties-tabs">
        <button
          className={activeTab === 'properties' ? 'active' : ''}
          onClick={() => setActiveTab('properties')}
        >
          属性
        </button>
        {selected.type === 'hg_view' && (
          <button
            className={activeTab === 'view_switch' ? 'active' : ''}
            onClick={() => setActiveTab('view_switch')}
          >
            视图切换
          </button>
        )}
      </div>

      <div className="properties-content">
        {activeTab === 'properties' && (
          <>
            {/* Name and ID */}
            <div className="property-group">
              <div className="property-item">
                <label>名称</label>
                {renderPropertyEditor(
                  { type: 'string' },
                  selected.name,
                  (value) => handlePropertyChange('name', value)
                )}
              </div>

              <div className="property-item">
                <label>ID</label>
                <input
                  type="text"
                  value={selected.id}
                  disabled
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    marginTop: '4px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    opacity: 0.6,
                  }}
                />
              </div>
            </div>

            {/* Position and Size */}
            <div className="property-group">
              <div className="property-item">
                <label>位置与大小</label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    marginTop: '8px',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '12px' }}>X</label>
                    {renderPropertyEditor(
                      { type: 'number' },
                      selected.position.x,
                      (value) => handlePositionChange('x', value)
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>Y</label>
                    {renderPropertyEditor(
                      { type: 'number' },
                      selected.position.y,
                      (value) => handlePositionChange('y', value)
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>宽度</label>
                    {selected.type === 'hg_view' ? (
                      <input
                        type="number"
                        value={selected.position.width}
                        disabled
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          marginTop: '4px',
                          backgroundColor: 'var(--vscode-input-background)',
                          color: 'var(--vscode-input-foreground)',
                          border: '1px solid var(--vscode-input-border)',
                          borderRadius: '2px',
                          opacity: 0.6,
                          cursor: 'not-allowed'
                        }}
                        title="hg_view 的宽度由项目分辨率决定，不可修改"
                      />
                    ) : (
                      renderPropertyEditor(
                        { type: 'number' },
                        selected.position.width,
                        (value) => handlePositionChange('width', value)
                      )
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>高度</label>
                    {selected.type === 'hg_view' ? (
                      <input
                        type="number"
                        value={selected.position.height}
                        disabled
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          marginTop: '4px',
                          backgroundColor: 'var(--vscode-input-background)',
                          color: 'var(--vscode-input-foreground)',
                          border: '1px solid var(--vscode-input-border)',
                          borderRadius: '2px',
                          opacity: 0.6,
                          cursor: 'not-allowed'
                        }}
                        title="hg_view 的高度由项目分辨率决定，不可修改"
                      />
                    ) : (
                      renderPropertyEditor(
                        { type: 'number' },
                        selected.position.height,
                        (value) => handlePositionChange('height', value)
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Visibility and State */}
            <div className="property-group">
              <div className="property-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>可见</label>
                  {renderPropertyEditor(
                    { type: 'boolean' },
                    selected.visible,
                    (value) => handlePropertyChange('visible', value)
                  )}
                </div>
              </div>

              <div className="property-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>启用</label>
                  {renderPropertyEditor(
                    { type: 'boolean' },
                    selected.enabled,
                    (value) => handlePropertyChange('enabled', value)
                  )}
                </div>
              </div>

              <div className="property-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>锁定</label>
                  {renderPropertyEditor(
                    { type: 'boolean' },
                    selected.locked,
                    (value) => handlePropertyChange('locked', value)
                  )}
                </div>
              </div>
            </div>

            {/* Style Properties */}
            {definition && (
              <>
                {definition.properties.filter(p => p.group === 'style').length > 0 && (
                  <div className="property-group">
                    <div className="property-group-title">样式</div>
                    {definition.properties
                      .filter(p => p.group === 'style')
                      .map((property) => (
                        <div key={property.name} className="property-item">
                          <label>{property.label}</label>
                          {renderPropertyEditor(
                            property,
                            (selected.style as any)?.[property.name],
                            (value) => handleStyleChange(property.name, value)
                          )}
                        </div>
                      ))}
                  </div>
                )}

                {/* Data Properties */}
                {definition.properties.filter(p => p.group === 'data').length > 0 && (
                  <div className="property-group">
                    <div className="property-group-title">数据</div>
                    {definition.properties
                      .filter(p => p.group === 'data')
                      .map((property) => (
                        <div key={property.name} className="property-item">
                          <label>{property.label}</label>
                          {renderPropertyEditor(
                            property,
                            (selected.data as any)?.[property.name],
                            (value) => handleDataChange(property.name, value)
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'view_switch' && selected.type === 'hg_view' && (
          <div className="view-switch-panel">
            <div className="property-group">
              <div className="property-group-title">视图切换配置</div>
              
              {selected.view_switch && selected.view_switch.length > 0 ? (
                <div style={{ marginTop: '8px' }}>
                  {selected.view_switch.map((switchEvent, index) => (
                    <div key={index} style={{
                      padding: '12px',
                      marginBottom: '12px',
                      backgroundColor: 'var(--vscode-editor-background)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <strong style={{ fontSize: '12px' }}>
                          切换事件 #{index + 1}
                        </strong>
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

                      {/* 触发事件 */}
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>触发事件</label>
                        <select
                          value={switchEvent.event}
                          onChange={(e) => handleViewSwitchUpdate(index, { event: e.target.value as ViewSwitchEventType })}
                          style={{
                            width: '100%',
                            padding: '4px',
                            backgroundColor: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            border: '1px solid var(--vscode-input-border)',
                            borderRadius: '2px',
                            fontSize: '12px'
                          }}
                        >
                          <option value="GUI_EVENT_TOUCH_MOVE_LEFT">← 左滑</option>
                          <option value="GUI_EVENT_TOUCH_MOVE_RIGHT">→ 右滑</option>
                          <option value="GUI_EVENT_TOUCH_MOVE_UP">↑ 上滑</option>
                          <option value="GUI_EVENT_TOUCH_MOVE_DOWN">↓ 下滑</option>
                        </select>
                      </div>

                      {/* 目标视图 */}
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>目标视图</label>
                        <select
                          value={switchEvent.target}
                          onChange={(e) => handleViewSwitchUpdate(index, { target: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '4px',
                            backgroundColor: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            border: '1px solid var(--vscode-input-border)',
                            borderRadius: '2px',
                            fontSize: '12px'
                          }}
                        >
                          <option value="">-- 选择目标视图 --</option>
                          {getAvailableViews().map(view => (
                            <option key={view.id} value={view.id}>{view.name || view.id}</option>
                          ))}
                        </select>
                      </div>

                      {/* 退出动画 */}
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>退出动画</label>
                        <select
                          value={switchEvent.switch_out_style}
                          onChange={(e) => handleViewSwitchUpdate(index, { switch_out_style: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '4px',
                            backgroundColor: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            border: '1px solid var(--vscode-input-border)',
                            borderRadius: '2px',
                            fontSize: '11px'
                          }}
                        >
                          <optgroup label="平移">
                            <option value="SWITCH_OUT_TO_LEFT_USE_TRANSLATION">向左平移</option>
                            <option value="SWITCH_OUT_TO_RIGHT_USE_TRANSLATION">向右平移</option>
                            <option value="SWITCH_OUT_TO_TOP_USE_TRANSLATION">向上平移</option>
                            <option value="SWITCH_OUT_TO_BOTTOM_USE_TRANSLATION">向下平移</option>
                          </optgroup>
                          <optgroup label="立方体">
                            <option value="SWITCH_OUT_TO_LEFT_USE_CUBE">向左立方体</option>
                            <option value="SWITCH_OUT_TO_RIGHT_USE_CUBE">向右立方体</option>
                            <option value="SWITCH_OUT_TO_TOP_USE_CUBE">向上立方体</option>
                            <option value="SWITCH_OUT_TO_BOTTOM_USE_CUBE">向下立方体</option>
                          </optgroup>
                          <optgroup label="旋转">
                            <option value="SWITCH_OUT_TO_LEFT_USE_ROTATE">向左旋转</option>
                            <option value="SWITCH_OUT_TO_RIGHT_USE_ROTATE">向右旋转</option>
                            <option value="SWITCH_OUT_TO_TOP_USE_ROTATE">向上旋转</option>
                            <option value="SWITCH_OUT_TO_BOTTOM_USE_ROTATE">向下旋转</option>
                          </optgroup>
                          <optgroup label="缩放">
                            <option value="SWITCH_OUT_TO_LEFT_USE_REDUCTION">向左缩放</option>
                            <option value="SWITCH_OUT_TO_RIGHT_USE_REDUCTION">向右缩放</option>
                            <option value="SWITCH_OUT_TO_TOP_USE_REDUCTION">向上缩放</option>
                            <option value="SWITCH_OUT_TO_BOTTOM_USE_REDUCTION">向下缩放</option>
                          </optgroup>
                          <optgroup label="其他">
                            <option value="SWITCH_OUT_NONE_ANIMATION">无动画</option>
                            <option value="SWITCH_OUT_ANIMATION_FADE">淡出</option>
                            <option value="SWITCH_OUT_ANIMATION_ZOOM">缩放</option>
                            <option value="SWITCH_OUT_STILL_USE_BLUR">模糊</option>
                          </optgroup>
                        </select>
                      </div>

                      {/* 进入动画 */}
                      <div>
                        <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>进入动画</label>
                        <select
                          value={switchEvent.switch_in_style}
                          onChange={(e) => handleViewSwitchUpdate(index, { switch_in_style: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '4px',
                            backgroundColor: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            border: '1px solid var(--vscode-input-border)',
                            borderRadius: '2px',
                            fontSize: '11px'
                          }}
                        >
                          <optgroup label="平移">
                            <option value="SWITCH_IN_FROM_LEFT_USE_TRANSLATION">从左平移</option>
                            <option value="SWITCH_IN_FROM_RIGHT_USE_TRANSLATION">从右平移</option>
                            <option value="SWITCH_IN_FROM_TOP_USE_TRANSLATION">从上平移</option>
                            <option value="SWITCH_IN_FROM_BOTTOM_USE_TRANSLATION">从下平移</option>
                          </optgroup>
                          <optgroup label="立方体">
                            <option value="SWITCH_IN_FROM_LEFT_USE_CUBE">从左立方体</option>
                            <option value="SWITCH_IN_FROM_RIGHT_USE_CUBE">从右立方体</option>
                            <option value="SWITCH_IN_FROM_TOP_USE_CUBE">从上立方体</option>
                            <option value="SWITCH_IN_FROM_BOTTOM_USE_CUBE">从下立方体</option>
                          </optgroup>
                          <optgroup label="旋转">
                            <option value="SWITCH_IN_FROM_LEFT_USE_ROTATE">从左旋转</option>
                            <option value="SWITCH_IN_FROM_RIGHT_USE_ROTATE">从右旋转</option>
                            <option value="SWITCH_IN_FROM_TOP_USE_ROTATE">从上旋转</option>
                            <option value="SWITCH_IN_FROM_BOTTOM_USE_ROTATE">从下旋转</option>
                          </optgroup>
                          <optgroup label="缩放">
                            <option value="SWITCH_IN_FROM_LEFT_USE_REDUCTION">从左缩放</option>
                            <option value="SWITCH_IN_FROM_RIGHT_USE_REDUCTION">从右缩放</option>
                            <option value="SWITCH_IN_FROM_TOP_USE_REDUCTION">从上缩放</option>
                            <option value="SWITCH_IN_FROM_BOTTOM_USE_REDUCTION">从下缩放</option>
                          </optgroup>
                          <optgroup label="其他">
                            <option value="SWITCH_IN_NONE_ANIMATION">无动画</option>
                            <option value="SWITCH_IN_ANIMATION_FADE">淡入</option>
                            <option value="SWITCH_IN_ANIMATION_ZOOM">缩放</option>
                            <option value="SWITCH_IN_STILL_USE_BLUR">模糊</option>
                            <option value="SWITCH_IN_CENTER_ZOOM_FADE">中心缩放淡入</option>
                          </optgroup>
                        </select>
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
    </div>
  );
};

export default PropertiesPanel;
