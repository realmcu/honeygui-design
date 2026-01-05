import React, { useState } from 'react';
import { PropertyPanelProps } from './types';
import { BaseProperties } from './BaseProperties';
import { EventsPanel } from './EventsPanel';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  marginTop: '4px',
  backgroundColor: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  borderRadius: '2px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginTop: '8px',
  marginBottom: '2px',
  fontSize: '12px',
  color: 'var(--vscode-foreground)',
};

const helpTextStyle: React.CSSProperties = {
  display: 'block',
  marginTop: '2px',
  fontSize: '11px',
  color: 'var(--vscode-descriptionForeground)',
};

export const HgVideoProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate, components }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');

  const handlePropertyChange = (property: string, value: any) => {
    const newData = {
      ...component.data,
      [property]: value
    };
    
    // 当格式改变时，自动调整质量值到正确范围
    if (property === 'format') {
      const currentQuality = component.data?.quality;
      if (value === 'h264') {
        // H.264: CRF 0-51，默认 23
        if (currentQuality === undefined || currentQuality < 0 || currentQuality > 51) {
          newData.quality = 23;
        }
      } else {
        // MJPEG/AVI: 1-31，默认 1
        if (currentQuality === undefined || currentQuality < 1 || currentQuality > 31) {
          newData.quality = 1;
        }
      }
    }
    
    // 当视频路径改变时，请求获取视频尺寸
    if (property === 'src' && value) {
      const vscodeAPI = (window as any).vscodeAPI;
      if (vscodeAPI) {
        vscodeAPI.postMessage({
          command: 'getVideoSizeForProperty',
          videoPath: value,
          componentId: component.id
        });
      }
    }
    
    onUpdate({ data: newData });
  };

  const videoData = component.data || {};
  const src = videoData.src || '';
  const format = videoData.format || 'mjpeg';
  const frameRate = videoData.frameRate || 30;
  const quality = videoData.quality || 85;
  const autoPlay = videoData.autoPlay !== false;
  const loop = videoData.loop === true;

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
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>视频属性</h3>
            
            <BaseProperties component={component} onUpdate={onUpdate} components={components} disableSize={true} sizeTooltip="视频尺寸由源文件决定" />
            
            {/* 视频设置 */}
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 600 }}>视频设置</h4>
              
              <label style={labelStyle}>视频路径</label>
              <input
                type="text"
                value={src}
                onChange={(e) => handlePropertyChange('src', e.target.value)}
                placeholder="assets/video.mp4"
                style={inputStyle}
              />
              <small style={helpTextStyle}>从资源面板拖拽视频文件到画布</small>
            </div>

            {/* 视频转换设置 */}
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 600 }}>转换设置</h4>
              
              <label style={labelStyle}>输出格式</label>
              <select
                value={format}
                onChange={(e) => handlePropertyChange('format', e.target.value)}
                style={inputStyle}
              >
                <option value="mjpeg">MJPEG</option>
                <option value="avi">AVI (MJPEG)</option>
                <option value="h264">H.264</option>
              </select>
              <small style={helpTextStyle}>编译时将视频转换为此格式</small>

              <label style={labelStyle}>帧率 (FPS)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={frameRate}
                onChange={(e) => handlePropertyChange('frameRate', parseInt(e.target.value) || 30)}
                style={inputStyle}
              />
              <small style={helpTextStyle}>输出视频帧率</small>

              {(format === 'mjpeg' || format === 'avi') && (
                <>
                  <label style={labelStyle}>质量 (1-31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={quality <= 31 ? quality : 1}
                    onChange={(e) => handlePropertyChange('quality', parseInt(e.target.value) || 1)}
                    style={inputStyle}
                  />
                  <small style={helpTextStyle}>JPEG 压缩质量，1=最高质量，31=最低质量</small>
                </>
              )}

              {format === 'h264' && (
                <>
                  <label style={labelStyle}>CRF 质量 (0-51)</label>
                  <input
                    type="number"
                    min="0"
                    max="51"
                    value={quality <= 51 ? quality : 23}
                    onChange={(e) => handlePropertyChange('quality', parseInt(e.target.value) || 23)}
                    style={inputStyle}
                  />
                  <small style={helpTextStyle}>H.264 CRF 值，0=无损，23=默认，51=最低质量</small>
                </>
              )}
            </div>

            {/* 播放设置 */}
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 600 }}>播放设置</h4>

              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoPlay}
                  onChange={(e) => handlePropertyChange('autoPlay', e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                自动播放
              </label>
              <small style={helpTextStyle}>组件创建后自动开始播放</small>

              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', cursor: 'pointer', marginTop: '8px' }}>
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={(e) => handlePropertyChange('loop', e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                循环播放
              </label>
              <small style={helpTextStyle}>视频播放结束后自动重新开始</small>
            </div>

            {/* 提示信息 */}
            <div style={{ marginTop: '16px' }}>
              <div style={{
                padding: '8px',
                background: 'var(--vscode-textBlockQuote-background)',
                border: '1px solid var(--vscode-textBlockQuote-border)',
                borderRadius: '4px',
                fontSize: '11px',
                color: 'var(--vscode-descriptionForeground)'
              }}>
                <strong>格式说明：</strong>
                <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                  <li>MJPEG: Motion JPEG，质量 1-31（1=最高）</li>
                  <li>AVI: MJPEG 封装，质量 1-31（1=最高）</li>
                  <li>H.264: 高压缩率，CRF 0-51（23=默认）</li>
                </ul>
                编译时自动调用 SDK 工具转换
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
