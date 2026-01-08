import React, { useState } from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { BaseProperties } from './BaseProperties';
import { EventsPanel } from './EventsPanel';
import { useDesignerStore } from '../../store';

export const HgListProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate, components }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');
  const syncListItems = useDesignerStore((state) => state.syncListItems);
  const canvasSize = useDesignerStore((state) => state.canvasSize);

  // 获取当前属性值
  const itemWidth = (component.style as any)?.itemWidth ?? 100;
  const itemHeight = (component.style as any)?.itemHeight ?? 100;
  const space = (component.style as any)?.space ?? 5;
  const direction = (component.style as any)?.direction ?? 'VERTICAL';
  const style = (component.style as any)?.style ?? 'LIST_CLASSIC';
  const noteNum = (component.data as any)?.noteNum ?? 5;
  const autoAlign = (component.data as any)?.autoAlign ?? true;
  const inertia = (component.data as any)?.inertia ?? true;
  const loop = (component.data as any)?.loop ?? false;
  const createBar = (component.data as any)?.createBar ?? false;
  const offset = (component.data as any)?.offset ?? 0;
  const outScope = (component.data as any)?.outScope ?? 0;
  const cardStackLocation = (component.style as any)?.cardStackLocation ?? 0;

  // 屏幕尺寸限制
  const maxWidth = canvasSize.width;
  const maxHeight = canvasSize.height;

  // 计算列表总长度（仅用于显示，不生成代码）
  const calculateTotalLength = () => {
    const noteLength = direction === 'VERTICAL' ? itemHeight : itemWidth;
    return noteLength * noteNum + space * (noteNum - 1);
  };

  // 自定义位置更新处理，添加宽高限制
  const handlePositionChange = (updates: any) => {
    const newPosition = { ...component.position, ...updates };

    // 宽高限制：最小值为 1，最大值为屏幕尺寸
    if (newPosition.width !== undefined) {
      newPosition.width = Math.max(1, Math.min(newPosition.width, maxWidth));
    }
    if (newPosition.height !== undefined) {
      newPosition.height = Math.max(1, Math.min(newPosition.height, maxHeight));
    }

    const finalUpdates: any = { position: newPosition };

    // 垂直方向时，列表宽度改变需要同步项宽度
    if (direction === 'VERTICAL' && newPosition.width !== undefined) {
      finalUpdates.style = {
        ...component.style,
        itemWidth: newPosition.width,
      };
    }

    // 水平方向时，列表高度改变需要同步项高度
    if (direction === 'HORIZONTAL' && newPosition.height !== undefined) {
      finalUpdates.style = {
        ...component.style,
        itemHeight: newPosition.height,
      };
    }

    onUpdate(finalUpdates);
  };

  const handleStyleChange = (property: string, value: any) => {
    const updates: any = {
      style: {
        ...component.style,
        [property]: value,
      },
    };

    // 方向改变时，同步项尺寸与列表尺寸
    if (property === 'direction') {
      if (value === 'VERTICAL') {
        // 切换到垂直方向，项宽度与列表宽度一致
        updates.style.itemWidth = component.position.width;
      } else {
        // 切换到水平方向，项高度与列表高度一致
        updates.style.itemHeight = component.position.height;
      }
    }

    onUpdate(updates);
  };

  const handleDataChange = (property: string, value: any) => {
    // 循环滚动开启时，超出范围必须为 0
    if (property === 'outScope' && loop) {
      value = 0;
    }
    // LIST_CARD 样式时，超出范围必须为 0
    if (property === 'outScope' && style === 'LIST_CARD') {
      value = 0;
    }

    onUpdate({
      data: {
        ...component.data,
        [property]: value,
      },
    });

    // 如果是 noteNum 属性被修改，触发 syncListItems
    if (property === 'noteNum') {
      setTimeout(() => {
        syncListItems(component.id);
      }, 0);
    }
  };

  // 样式改变时的特殊处理
  const handleStyleSelectChange = (value: string) => {
    const updates: any = {
      style: {
        ...component.style,
        style: value,
      },
    };

    // 如果切换到 LIST_CARD，强制关闭循环滚动和超出范围
    if (value === 'LIST_CARD') {
      updates.data = {
        ...component.data,
        loop: false,
        outScope: 0,
      };
    }

    onUpdate(updates);
  };

  // 循环滚动改变时的特殊处理
  const handleLoopChange = (value: boolean) => {
    const updates: any = {
      data: {
        ...component.data,
        loop: value,
      },
    };

    // 如果开启循环滚动，强制关闭滚动条、设置超出范围为0、样式不能为LIST_CARD
    if (value) {
      updates.data.createBar = false;
      updates.data.outScope = 0;
      if (style === 'LIST_CARD') {
        updates.style = {
          ...component.style,
          style: 'LIST_CLASSIC',
        };
      }
    }

    onUpdate(updates);
  };

  // 滚动条改变时的特殊处理
  const handleCreateBarChange = (value: boolean) => {
    // 如果循环滚动开启，不允许开启滚动条
    if (loop && value) {
      return;
    }

    onUpdate({
      data: {
        ...component.data,
        createBar: value,
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
              onUpdate={(updates) => {
                // 如果更新包含 position，使用自定义处理
                if (updates.position) {
                  handlePositionChange(updates.position);
                  // 如果还有其他更新，单独处理
                  const { position, ...rest } = updates;
                  if (Object.keys(rest).length > 0) {
                    onUpdate(rest);
                  }
                } else {
                  onUpdate(updates);
                }
              }}
              components={components}
              disableSize={false}
            />

            {/* 列表总长度显示（仅显示，不生成代码） */}
            <div className="property-group">
              <div className="property-item">
                <label>列表总长度（{direction === 'VERTICAL' ? '高度' : '宽度'}）</label>
                <div style={{
                  padding: '4px 8px',
                  backgroundColor: 'var(--vscode-input-background)',
                  color: 'var(--vscode-descriptionForeground)',
                  border: '1px solid var(--vscode-input-border)',
                  borderRadius: '2px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                }}>
                  {calculateTotalLength()} px
                </div>
                <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                  计算公式：项{direction === 'VERTICAL' ? '高度' : '宽度'} × 项数量 + 间距 × (项数量 - 1)
                </div>
              </div>
            </div>

            {/* 样式属性 */}
            <div className="property-group">
              <div className="property-group-title">样式</div>

              {/* 项尺寸 */}
              <div className="property-item">
                <label>项尺寸</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                  <div>
                    <label style={{ fontSize: '12px' }}>宽度</label>
                    <PropertyEditor
                      type="number"
                      value={itemWidth}
                      onChange={(value) => {
                        const updates: any = {
                          style: {
                            ...component.style,
                            itemWidth: value,
                          },
                        };
                        // 垂直方向时，同步更新列表宽度
                        if (direction === 'VERTICAL') {
                          updates.position = {
                            ...component.position,
                            width: value,
                          };
                        }
                        onUpdate(updates);
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>高度</label>
                    <PropertyEditor
                      type="number"
                      value={itemHeight}
                      onChange={(value) => {
                        const updates: any = {
                          style: {
                            ...component.style,
                            itemHeight: value,
                          },
                        };
                        // 水平方向时，同步更新列表高度
                        if (direction === 'HORIZONTAL') {
                          updates.position = {
                            ...component.position,
                            height: value,
                          };
                        }
                        onUpdate(updates);
                      }}
                    />
                  </div>
                </div>
                {direction === 'VERTICAL' && (
                  <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                    垂直方向：项宽度 = 列表宽度（联动）
                  </div>
                )}
                {direction === 'HORIZONTAL' && (
                  <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                    水平方向：项高度 = 列表高度（联动）
                  </div>
                )}
              </div>

              {/* 项间距 */}
              <div className="property-item">
                <label>项间距</label>
                <PropertyEditor
                  type="number"
                  value={space}
                  onChange={(value) => handleStyleChange('space', value)}
                />
              </div>

              {/* 方向 */}
              <div className="property-item">
                <label>方向</label>
                <PropertyEditor
                  type="select"
                  value={direction}
                  onChange={(value) => handleStyleChange('direction', value)}
                  options={['VERTICAL', 'HORIZONTAL']}
                />
              </div>

              {/* 样式 */}
              <div className="property-item">
                <label>样式</label>
                <PropertyEditor
                  type="select"
                  value={style}
                  onChange={handleStyleSelectChange}
                  options={loop ? ['LIST_CLASSIC', 'LIST_CIRCLE', 'LIST_ZOOM', 'LIST_FADE', 'LIST_FAN', 'LIST_HELIX', 'LIST_CURL'] : ['LIST_CLASSIC', 'LIST_CIRCLE', 'LIST_ZOOM', 'LIST_CARD', 'LIST_FADE', 'LIST_FAN', 'LIST_HELIX', 'LIST_CURL']}
                />
                {loop && style === 'LIST_CARD' && (
                  <div style={{ fontSize: '11px', color: 'var(--vscode-errorForeground)', marginTop: '4px' }}>
                    ⚠️ 循环滚动时不支持 LIST_CARD 样式
                  </div>
                )}
              </div>

              {/* LIST_CARD 样式特有属性：堆叠位置 */}
              {style === 'LIST_CARD' && (
                <div className="property-item">
                  <label>堆叠位置距离 ({direction === 'VERTICAL' ? '底部' : '右侧'})</label>
                  <PropertyEditor
                    type="number"
                    value={cardStackLocation}
                    onChange={(value) => handleStyleChange('cardStackLocation', value)}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                    卡片堆叠到{direction === 'VERTICAL' ? '底部' : '右侧'}的距离
                  </div>
                </div>
              )}
            </div>

            {/* 数据属性 */}
            <div className="property-group">
              <div className="property-group-title">数据</div>

              {/* 项数量 */}
              <div className="property-item">
                <label>项数量</label>
                <PropertyEditor
                  type="number"
                  value={noteNum}
                  onChange={(value) => handleDataChange('noteNum', value)}
                />
              </div>

              {/* 初始偏移 */}
              <div className="property-item">
                <label>初始偏移</label>
                <PropertyEditor
                  type="number"
                  value={offset}
                  onChange={(value) => handleDataChange('offset', value)}
                />
              </div>

              {/* 超出范围 */}
              <div className="property-item">
                <label>超出范围</label>
                <PropertyEditor
                  type="number"
                  value={outScope}
                  onChange={(value) => handleDataChange('outScope', value)}
                />
                {(loop || style === 'LIST_CARD') && outScope !== 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--vscode-errorForeground)', marginTop: '4px' }}>
                    ⚠️ {loop ? '循环滚动' : 'LIST_CARD 样式'}时超出范围必须为 0
                  </div>
                )}
              </div>
            </div>

            {/* 通用属性 */}
            <div className="property-group">
              <div className="property-group-title">通用</div>

              {/* 自动对齐 */}
              <div className="property-item">
                <label>自动对齐</label>
                <PropertyEditor
                  type="boolean"
                  value={autoAlign}
                  onChange={(value) => handleDataChange('autoAlign', value)}
                />
              </div>

              {/* 惯性滚动 */}
              <div className="property-item">
                <label>惯性滚动</label>
                <PropertyEditor
                  type="boolean"
                  value={inertia}
                  onChange={(value) => handleDataChange('inertia', value)}
                />
              </div>

              {/* 循环滚动 */}
              <div className="property-item">
                <label>循环滚动</label>
                <PropertyEditor
                  type="boolean"
                  value={loop}
                  onChange={handleLoopChange}
                />
                {style === 'LIST_CARD' && (
                  <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                    LIST_CARD 样式不支持循环滚动
                  </div>
                )}
              </div>

              {/* 显示滚动条 */}
              <div className="property-item">
                <label>显示滚动条</label>
                <PropertyEditor
                  type="boolean"
                  value={createBar}
                  onChange={handleCreateBarChange}
                />
                {loop && (
                  <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                    循环滚动时不支持滚动条
                  </div>
                )}
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
