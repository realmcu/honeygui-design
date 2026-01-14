import React, { useState } from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { BaseProperties } from './BaseProperties';
import { EventsPanel } from './EventsPanel';
import { componentDefinitions } from '../ComponentLibrary';
import { useDesignerStore } from '../../store';

// 字体文件扩展名
const FONT_EXTS = ['ttf', 'otf', 'woff', 'woff2', 'bin'];

export const DefaultProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate, components }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [fontFiles, setFontFiles] = useState<string[]>([]);
  const [fontMetrics, setFontMetrics] = useState<{
    needsWarning: boolean;
    message: string;
    example: string;
  } | null>(null);
  const definition = componentDefinitions.find((d) => d.type === component.type);
  const syncListItems = useDesignerStore((state) => state.syncListItems);

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
    
    // 如果是 list 控件的 noteNum 属性被修改，触发 syncListItems
    if (component.type === 'hg_list' && property === 'noteNum') {
      // 使用 setTimeout 确保状态更新后再同步
      setTimeout(() => {
        syncListItems(component.id);
      }, 0);
    }
  };

  const handleGeneralChange = (property: string, value: any) => {
    onUpdate({
      data: {
        ...component.data,
        [property]: value,
      },
    });
  };

  const handleSelectImagePath = (propertyName?: string) => {
    window.vscodeAPI?.postMessage({
      command: 'selectImagePath',
      componentId: component.id,
      propertyName: propertyName || 'src'
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
      } else if (event.data.command === 'fontMetricsLoaded') {
        // 只有当前组件的字体度量信息才更新
        if (event.data.fontPath === (component.data as any)?.fontFile) {
          setFontMetrics(event.data.metrics);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [component.data]);

  // 当字体文件改变时，请求字体度量信息
  React.useEffect(() => {
    const fontFile = (component.data as any)?.fontFile;
    if (fontFile && component.type === 'hg_label') {
      window.vscodeAPI?.postMessage({
        command: 'getFontMetrics',
        fontPath: fontFile
      });
    } else {
      setFontMetrics(null);
    }
  }, [(component.data as any)?.fontFile, component.type]);

  const renderImageProperty = (value: any, onChange: (value: any) => void, propertyName?: string) => {
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
          onClick={() => handleSelectImagePath(propertyName)}
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
                ) : component.type === 'hg_label' ? (
                  <>
                    {/* hg_label 特殊处理：对齐方式在一行 */}
                    <div className="property-item">
                      <label>对齐</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                        <div>
                          <label style={{ fontSize: '12px' }}>水平</label>
                          <PropertyEditor
                            type="select"
                            value={(component.style as any)?.hAlign || 'LEFT'}
                            onChange={(value) => handleStyleChange('hAlign', value)}
                            options={['LEFT', 'CENTER', 'RIGHT']}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px' }}>竖直</label>
                          <PropertyEditor
                            type="select"
                            value={(component.style as any)?.vAlign || 'TOP'}
                            onChange={(value) => handleStyleChange('vAlign', value)}
                            options={['TOP', 'MID']}
                          />
                        </div>
                      </div>
                    </div>
                    {/* 其他样式属性（排除对齐、间距、换行相关） */}
                    {definition.properties
                      .filter(p => p.group === 'style' && !['hAlign', 'vAlign', 'letterSpacing', 'lineSpacing', 'wordWrap', 'wordBreak'].includes(p.name))
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
                    {/* 自动换行和断词保护在一行 */}
                    <div className="property-item">
                      <label>换行</label>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <PropertyEditor
                            type="boolean"
                            value={(component.style as any)?.wordWrap ?? false}
                            onChange={(value) => handleStyleChange('wordWrap', value)}
                          />
                          <span style={{ fontSize: '12px' }}>自动换行</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="英文按空格断词，避免单词被截断">
                          <PropertyEditor
                            type="boolean"
                            value={(component.style as any)?.wordBreak ?? false}
                            onChange={(value) => handleStyleChange('wordBreak', value)}
                          />
                          <span style={{ fontSize: '12px' }}>按词换行</span>
                        </div>
                      </div>
                    </div>
                    {/* 字间距和行间距在一行 */}
                    <div className="property-item">
                      <label>间距</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                        <div>
                          <label style={{ fontSize: '12px' }}>字间距</label>
                          <PropertyEditor
                            type="number"
                            value={(component.style as any)?.letterSpacing ?? 0}
                            onChange={(value) => handleStyleChange('letterSpacing', value)}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px' }}>行间距</label>
                          <PropertyEditor
                            type="number"
                            value={(component.style as any)?.lineSpacing ?? 0}
                            onChange={(value) => handleStyleChange('lineSpacing', value)}
                          />
                        </div>
                      </div>
                    </div>
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
                          (value) => handleDataChange(property.name, value),
                          'src'
                        )
                      ) : (property.name === 'imageOn' || property.name === 'imageOff') && component.type === 'hg_button' ? (
                        // 双态按钮的图片选择器
                        renderImageProperty(
                          (component.data as any)?.[property.name],
                          (value) => handleDataChange(property.name, value),
                          property.name
                        )
                      ) : property.name === 'fontFile' ? (
                        renderFontProperty(
                          (component.data as any)?.[property.name],
                          (value) => handleDataChange(property.name, value)
                        )
                      ) : property.name === 'text' && component.type === 'hg_label' && (component.style as any)?.wordWrap ? (
                        // 自动换行开启时，文本输入框变成多行
                        <textarea
                          value={(component.data as any)?.[property.name] || ''}
                          onChange={(e) => handleDataChange(property.name, e.target.value)}
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            backgroundColor: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            border: '1px solid var(--vscode-input-border)',
                            borderRadius: '2px',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            fontSize: '13px',
                          }}
                        />
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

            {/* General Properties */}
            {definition && definition.properties.filter(p => p.group === 'general').length > 0 && (
              <div className="property-group">
                <div className="property-group-title">通用</div>
                {definition.properties
                  .filter(p => p.group === 'general')
                  .map((property) => (
                    <div key={property.name} className="property-item">
                      <label>{property.label}</label>
                      <PropertyEditor
                        type={property.type as any}
                        value={(component.data as any)?.[property.name]}
                        onChange={(value) => handleGeneralChange(property.name, value)}
                        options={property.options as string[]}
                      />
                    </div>
                  ))}
              </div>
            )}

            {/* Font Properties - 仅对 hg_label 显示 */}
            {definition && component.type === 'hg_label' && definition.properties.filter(p => p.group === 'font').length > 0 && (
              <div className="property-group">
                <div className="property-group-title">字体</div>
                {/* 字体文件 */}
                <div className="property-item">
                  <label>字体文件</label>
                  {renderFontProperty(
                    (component.data as any)?.fontFile,
                    (value) => handleDataChange('fontFile', value)
                  )}
                </div>
                {/* 字体大小 */}
                <div className="property-item">
                  <label>字体大小</label>
                  <PropertyEditor
                    type="number"
                    value={(component.data as any)?.fontSize || 16}
                    onChange={(value) => handleDataChange('fontSize', value)}
                  />
                </div>
                {/* 字体类型 */}
                <div className="property-item">
                  <label>字体类型</label>
                  <PropertyEditor
                    type="select"
                    value={(component.data as any)?.fontType || 'bitmap'}
                    onChange={(value) => handleDataChange('fontType', value)}
                    options={['bitmap', 'vector']}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
                    {(component.data as any)?.fontType === 'vector' ? '矢量字体' : '点阵字体'}
                  </span>
                </div>
                {/* 渲染模式 - 仅点阵字体显示 */}
                {((component.data as any)?.fontType || 'bitmap') === 'bitmap' && (
                  <div className="property-item">
                    <label>渲染模式</label>
                    <PropertyEditor
                      type="select"
                      value={(component.data as any)?.renderMode || '4'}
                      onChange={(value) => handleDataChange('renderMode', value)}
                      options={['1', '2', '4', '8']}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
                      {(component.data as any)?.renderMode || '4'}-bit 灰度
                    </span>
                  </div>
                )}
                {/* 预览模式开关 */}
                <div className="property-item">
                  <label>预览模式（不改变实际渲染效果）</label>
                  <div style={{ marginTop: '4px' }}>
                    {/* 精确预览选项 */}
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        padding: '6px 8px',
                        backgroundColor: (component.data as any)?.useAccuratePreview ?? true 
                          ? 'var(--vscode-list-activeSelectionBackground)' 
                          : 'transparent',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        marginBottom: '4px'
                      }}
                      onClick={() => handleDataChange('useAccuratePreview', true)}
                    >
                      <input 
                        type="radio" 
                        checked={(component.data as any)?.useAccuratePreview ?? true}
                        onChange={() => handleDataChange('useAccuratePreview', true)}
                        style={{ margin: 0 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 500 }}>精确预览</div>
                        <div style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
                          真实渲染效果，与仿真环境和嵌入式环境一致
                        </div>
                      </div>
                    </div>
                    {/* 设计预览选项 */}
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        padding: '6px 8px',
                        backgroundColor: !((component.data as any)?.useAccuratePreview ?? true)
                          ? 'var(--vscode-list-activeSelectionBackground)' 
                          : 'transparent',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleDataChange('useAccuratePreview', false)}
                    >
                      <input 
                        type="radio" 
                        checked={!((component.data as any)?.useAccuratePreview ?? true)}
                        onChange={() => handleDataChange('useAccuratePreview', false)}
                        style={{ margin: 0 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 500 }}>设计预览</div>
                        <div style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
                          设计参考，与 Figma/Sketch 等工具一致
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* 字体度量警告 - 动态显示 */}
                {fontMetrics && fontMetrics.needsWarning && (
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--vscode-descriptionForeground)',
                    marginTop: '8px',
                    padding: '6px 8px',
                    backgroundColor: 'var(--vscode-inputValidation-infoBackground)',
                    border: '1px solid var(--vscode-inputValidation-infoBorder)',
                    borderRadius: '3px',
                    lineHeight: '1.4'
                  }}>
                    <div style={{ marginBottom: '4px', color: 'var(--vscode-inputValidation-infoForeground)' }}>
                      💡 <strong>嵌入式设备采用 Fit-in-Box 算法优化。</strong>
                    </div>
                    <div style={{ marginTop: '4px', opacity: 0.9 }}>
                      {fontMetrics.message}
                    </div>
                    <div style={{ marginTop: '4px', opacity: 0.9 }}>
                      {fontMetrics.example}
                    </div>
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
