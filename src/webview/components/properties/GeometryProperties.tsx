import React, { useState } from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { BaseProperties } from './BaseProperties';
import { EventsPanel } from './EventsPanel';
import { componentDefinitions } from '../ComponentLibrary';

interface GradientStop {
  position: number;  // 0.0 - 1.0
  color: string;     // #RRGGBB
}

export const GeometryProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate, components }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');
  const definition = componentDefinitions.find((d) => d.type === component.type);

  // 渐变色标数据（存储在 data.gradientStops 中）
  const gradientStops: GradientStop[] = component.data?.gradientStops || [];
  const useGradient = component.style?.useGradient || false;
  
  // 获取渐变类型/方向的提示文本
  const getGradientHint = () => {
    if (component.type === 'hg_arc') {
      return '弧形使用角度渐变，颜色沿弧线方向变化';
    } else if (component.type === 'hg_circle') {
      const gradientType = component.style?.gradientType || 'radial';
      if (gradientType === 'radial') {
        return '径向渐变：颜色从圆心向边缘辐射变化';
      } else {
        return '角度渐变：颜色沿圆周方向变化（需配合起始/结束角度）';
      }
    } else if (component.type === 'hg_rect') {
      const direction = component.style?.gradientDirection || 'horizontal';
      const directionMap: Record<string, string> = {
        'horizontal': '水平渐变：从左到右',
        'vertical': '垂直渐变：从上到下',
        'diagonal_tl_br': '对角渐变：从左上到右下',
        'diagonal_tr_bl': '对角渐变：从右上到左下'
      };
      return directionMap[direction] || '线性渐变';
    }
    return '';
  };

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

  // 添加渐变色标
  const handleAddGradientStop = () => {
    const newStop: GradientStop = {
      position: gradientStops.length === 0 ? 0 : 1,
      color: '#007acc'
    };
    handleDataChange('gradientStops', [...gradientStops, newStop]);
  };

  // 删除渐变色标
  const handleRemoveGradientStop = (index: number) => {
    const newStops = gradientStops.filter((_, i) => i !== index);
    handleDataChange('gradientStops', newStops);
  };

  // 更新渐变色标
  const handleUpdateGradientStop = (index: number, field: 'position' | 'color', value: any) => {
    const newStops = [...gradientStops];
    newStops[index] = { ...newStops[index], [field]: value };
    handleDataChange('gradientStops', newStops);
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

            {/* Style Properties */}
            {definition && definition.properties.filter(p => p.group === 'style').length > 0 && (
              <div className="property-group">
                <div className="property-group-title">样式</div>
                {definition.properties
                  .filter(p => p.group === 'style')
                  .map((property) => (
                    <div key={property.name} className="property-item">
                      <label>{property.label}</label>
                      <PropertyEditor
                        type={property.type as any}
                        value={(component.style as any)?.[property.name]}
                        onChange={(value) => handleStyleChange(property.name, value)}
                        options={property.options as string[]}
                      />
                    </div>
                  ))}
              </div>
            )}

            {/* Gradient Settings */}
            {useGradient && (
              <div className="property-group">
                <div className="property-group-title">
                  渐变设置
                  <button
                    onClick={handleAddGradientStop}
                    style={{
                      marginLeft: '8px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      backgroundColor: 'var(--vscode-button-background)',
                      color: 'var(--vscode-button-foreground)',
                      border: 'none',
                      borderRadius: '2px',
                      cursor: 'pointer',
                    }}
                  >
                    + 添加色标
                  </button>
                </div>

                {/* 渐变类型提示 */}
                <div style={{ 
                  padding: '8px',
                  marginBottom: '8px',
                  backgroundColor: 'var(--vscode-textBlockQuote-background)',
                  borderLeft: '3px solid var(--vscode-textBlockQuote-border)',
                  fontSize: '11px',
                  color: 'var(--vscode-descriptionForeground)'
                }}>
                  {getGradientHint()}
                </div>

                {/* 弧形渐变角度设置 */}
                {component.type === 'hg_arc' && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                          渐变起始角度
                        </label>
                        <PropertyEditor
                          type="number"
                          value={component.data?.gradientStartAngle ?? component.style?.startAngle ?? 0}
                          onChange={(value) => handleDataChange('gradientStartAngle', value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                          渐变结束角度
                        </label>
                        <PropertyEditor
                          type="number"
                          value={component.data?.gradientEndAngle ?? component.style?.endAngle ?? 360}
                          onChange={(value) => handleDataChange('gradientEndAngle', value)}
                        />
                      </div>
                    </div>
                    <div style={{ 
                      marginTop: '6px',
                      fontSize: '11px',
                      color: 'var(--vscode-descriptionForeground)',
                      fontStyle: 'italic'
                    }}>
                      💡 提示：对于完整圆弧（如 270-270），SDK 会自动补偿渐变角度以绘制圆角封端
                    </div>
                  </div>
                )}

                {/* 圆形角度渐变的额外参数 */}
                {component.type === 'hg_circle' && component.style?.gradientType === 'angular' && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                          起始角度
                        </label>
                        <PropertyEditor
                          type="number"
                          value={component.data?.gradientStartAngle ?? 0}
                          onChange={(value) => handleDataChange('gradientStartAngle', value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                          结束角度
                        </label>
                        <PropertyEditor
                          type="number"
                          value={component.data?.gradientEndAngle ?? 360}
                          onChange={(value) => handleDataChange('gradientEndAngle', value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {gradientStops.length === 0 ? (
                  <div style={{ 
                    padding: '12px', 
                    color: 'var(--vscode-descriptionForeground)',
                    fontSize: '12px',
                    textAlign: 'center'
                  }}>
                    点击"添加色标"开始配置渐变
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {gradientStops.map((stop, index) => (
                      <div 
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px',
                          backgroundColor: 'var(--vscode-editor-background)',
                          borderRadius: '4px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                            位置 (0-1)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            value={stop.position}
                            onChange={(e) => handleUpdateGradientStop(index, 'position', parseFloat(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '4px 6px',
                              backgroundColor: 'var(--vscode-input-background)',
                              color: 'var(--vscode-input-foreground)',
                              border: '1px solid var(--vscode-input-border)',
                              borderRadius: '2px',
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                            颜色
                          </label>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input
                              type="color"
                              value={stop.color}
                              onChange={(e) => handleUpdateGradientStop(index, 'color', e.target.value)}
                              style={{ width: '30px', height: '28px', padding: 0, border: 'none' }}
                            />
                            <input
                              type="text"
                              value={stop.color}
                              onChange={(e) => handleUpdateGradientStop(index, 'color', e.target.value)}
                              style={{
                                flex: 1,
                                padding: '4px 6px',
                                backgroundColor: 'var(--vscode-input-background)',
                                color: 'var(--vscode-input-foreground)',
                                border: '1px solid var(--vscode-input-border)',
                                borderRadius: '2px',
                              }}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveGradientStop(index)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: 'var(--vscode-button-secondaryBackground)',
                            color: 'var(--vscode-button-secondaryForeground)',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            marginTop: '16px',
                          }}
                          title="删除此色标"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {gradientStops.length > 0 && (
                  <div style={{ 
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: 'var(--vscode-textBlockQuote-background)',
                    borderLeft: '3px solid var(--vscode-textBlockQuote-border)',
                    fontSize: '11px',
                    color: 'var(--vscode-descriptionForeground)'
                  }}>
                    <strong>提示：</strong>
                    <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                      <li>位置值范围 0-1，表示渐变的起止位置</li>
                      <li>至少需要 2 个色标才能形成渐变效果</li>
                      {component.type === 'hg_arc' && <li>弧形使用角度渐变（沿弧线方向）</li>}
                      {component.type === 'hg_circle' && component.style?.gradientType === 'radial' && (
                        <li>径向渐变从圆心（位置0）到边缘（位置1）</li>
                      )}
                      {component.type === 'hg_circle' && component.style?.gradientType === 'angular' && (
                        <li>角度渐变沿圆周方向，从起始角度到结束角度</li>
                      )}
                      {component.type === 'hg_rect' && <li>线性渐变按选定方向从起点到终点</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'events' && (
          <EventsPanel component={component} onUpdate={onUpdate} />
        )}
      </div>
    </>
  );
};
