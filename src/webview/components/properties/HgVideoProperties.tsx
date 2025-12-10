import React from 'react';
import { PropertyPanelProps } from './types';
import { BaseProperties } from './BaseProperties';

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

export const HgVideoProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate }) => {
  const handlePropertyChange = (property: string, value: any) => {
    onUpdate({
      data: {
        ...component.data,
        [property]: value
      }
    });
  };

  const videoData = component.data || {};
  const src = videoData.src || '';
  const format = videoData.format || 'mjpeg';
  const frameRate = videoData.frameRate || 30;
  const quality = videoData.quality || 85;
  const autoPlay = videoData.autoPlay !== false;

  return (
    <div className="properties-content">
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>视频属性</h3>
      
      {/* 基础属性 */}
      <BaseProperties component={component} onUpdate={onUpdate} />
      
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

        {format === 'mjpeg' && (
          <>
            <label style={labelStyle}>质量 (0-100)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={quality}
              onChange={(e) => handlePropertyChange('quality', parseInt(e.target.value) || 85)}
              style={inputStyle}
            />
            <small style={helpTextStyle}>MJPEG 压缩质量，数值越高质量越好</small>
          </>
        )}

        {format === 'avi' && (
          <>
            <label style={labelStyle}>帧率 (FPS)</label>
            <input
              type="number"
              min="1"
              max="60"
              value={frameRate}
              onChange={(e) => handlePropertyChange('frameRate', parseInt(e.target.value) || 30)}
              style={inputStyle}
            />
            <small style={helpTextStyle}>AVI 输出帧率</small>
          </>
        )}
      </div>

      {/* 播放设置 */}
      <div style={{ marginTop: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 600 }}>播放设置</h4>
        
        <label style={labelStyle}>播放帧率</label>
        <input
          type="number"
          min="1"
          max="60"
          value={frameRate}
          onChange={(e) => handlePropertyChange('frameRate', parseInt(e.target.value) || 30)}
          style={inputStyle}
        />
        <small style={helpTextStyle}>运行时播放帧率</small>

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
          <strong>转换说明：</strong>
          <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
            <li>MJPEG: 适合高质量视频，文件较大</li>
            <li>AVI: 兼容性好，支持设置帧率</li>
            <li>H.264: 压缩率高，文件较小</li>
          </ul>
          编译时会自动调用 SDK 工具转换视频格式
        </div>
      </div>
    </div>
  );
};
