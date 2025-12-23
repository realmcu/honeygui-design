import React, { useState } from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { BaseProperties } from './BaseProperties';
import { EventsPanel } from './EventsPanel';
import { componentDefinitions } from '../ComponentLibrary';

// 字体文件扩展名
const FONT_EXTS = ['ttf', 'otf', 'woff', 'woff2', 'bin'];

export const DefaultProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate, components }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [fontFiles, setFontFiles] = useState<string[]>([]);
  const definition = componentDefinitions.find((d) => d.type === component.type);

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

  const handleSelectImagePath = () => {
    window.vscodeAPI?.postMessage({
      command: 'selectImagePath',
      componentId: component.id
    });
  };

  // 请求字体文件列表
  const handleOpenFontPicker = () => {
    window.vscodeAPI?.postMessage({ command: 'getFontFiles' });
    setShowFontPicker(true);
  };

  // 监听字体文件列表响应
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.command === 'fontFilesLoaded') {
        setFontFiles(event.data.fonts || []);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const renderImageProperty = (value: any, onChange: (value: any) => void) => {
    return (
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="图片路径"
          style={{
            flex: 1,
            padding: '4px 6px',
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border)',
            borderRadius: '2px',
          }}
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
  };

  const renderFontProperty = (value: any, onChange: (value: any) => void) => {
    return (
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="字体文件路径"
            style={{
              flex: 1,
              padding: '4px 6px',
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              border: '1px solid var(--vscode-input-border)',
              borderRadius: '2px',
            }}
          />
          <button
            onClick={handleOpenFontPicker}
            style={{
              padding: '4px 8px',
              backgroundColor: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="选择字体文件"
          >
            🔤
          </button>
        </div>
        {showFontPicker && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: 'var(--vscode-dropdown-background)',
            border: '1px solid var(--vscode-dropdown-border)',
            borderRadius: '4px',
            maxHeight: '200px',
            overflowY: 'auto',
            marginTop: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}>
            {fontFiles.length === 0 ? (
              <div style={{ padding: '8px', color: 'var(--vscode-descriptionForeground)', fontSize: '12px' }}>
                暂无字体文件，请先上传到 assets 目录
              </div>
            ) : (
              fontFiles.map((font) => (
                <div
                  key={font}
                  onClick={() => {
                    onChange(font);
                    setShowFontPicker(false);
                  }}
                  style={{
                    padding: '6px 8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    borderBottom: '1px solid var(--vscode-dropdown-border)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  🔤 {font}
                </div>
              ))
            )}
            <div
              onClick={() => setShowFontPicker(false)}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                fontSize: '12px',
                textAlign: 'center',
                color: 'var(--vscode-descriptionForeground)',
              }}
            >
              关闭
            </div>
          </div>
        )}
      </div>
    );
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
              disableSize={component.type === 'hg_list'}
              sizeTooltip={component.type === 'hg_list' ? '列表尺寸由项数量、项长度和间距自动计算' : undefined}
            />

            {/* Style Properties */}
            {definition && definition.properties.filter(p => p.group === 'style').length > 0 && (
              <div className="property-group">
                <div className="property-group-title">样式</div>
                {/* hg_list 特殊处理：项宽度和项高度在一行 */}
                {component.type === 'hg_list' ? (
                  <>
                    <div className="property-item">
                      <label>项尺寸</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                        <div>
                          <label style={{ fontSize: '12px' }}>宽度</label>
                          <PropertyEditor
                            type="number"
                            value={(component.style as any)?.itemWidth ?? 100}
                            onChange={(value) => handleStyleChange('itemWidth', value)}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px' }}>高度</label>
                          <PropertyEditor
                            type="number"
                            value={(component.style as any)?.itemHeight ?? 100}
                            onChange={(value) => handleStyleChange('itemHeight', value)}
                          />
                        </div>
                      </div>
                    </div>
                    {definition.properties
                      .filter(p => p.group === 'style' && p.name !== 'itemWidth' && p.name !== 'itemHeight')
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
                  </>
                ) : (
                  definition.properties
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
                    ))
                )}
              </div>
            )}

            {/* Data Properties */}
            {definition && definition.properties.filter(p => p.group === 'data').length > 0 && (
              <div className="property-group">
                <div className="property-group-title">数据</div>
                {definition.properties
                  .filter(p => p.group === 'data')
                  .map((property) => (
                    <div key={property.name} className="property-item">
                      <label>{property.label}</label>
                      {property.name === 'src' && component.type === 'hg_image' ? (
                        renderImageProperty(
                          (component.data as any)?.[property.name],
                          (value) => handleDataChange(property.name, value)
                        )
                      ) : property.name === 'fontFile' ? (
                        renderFontProperty(
                          (component.data as any)?.[property.name],
                          (value) => handleDataChange(property.name, value)
                        )
                      ) : (
                        <PropertyEditor
                          type={property.type as any}
                          value={(component.data as any)?.[property.name]}
                          onChange={(value) => handleDataChange(property.name, value)}
                          options={property.options as string[]}
                        />
                      )}
                    </div>
                  ))}
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
