import React from 'react';
import { PropertyPanelProps } from './types';
import { BaseProperties } from './BaseProperties';
import { PropertyEditor } from './PropertyEditor';

export const Hg3DProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate }) => {
  const handleBrowseModel = () => {
    window.vscodeAPI?.postMessage({
      command: 'browseFile',
      componentId: component.id,
      propertyName: 'modelPath',
      filters: {
        '3D模型': ['obj', 'gltf']
      }
    });
  };



  return (
    <div className="properties-content">
      <BaseProperties component={component} onUpdate={onUpdate} />

      <div className="property-section">
        <h4>模型设置</h4>

        <div className="property-item">
          <label>模型路径</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <PropertyEditor
              type="string"
              value={component.data?.modelPath}
              onChange={(value) => onUpdate({ data: { ...component.data, modelPath: value } })}
              title="模型文件路径，如: assets/model.obj"
            />
            <button
              onClick={handleBrowseModel}
              style={{
                padding: '4px 8px',
                backgroundColor: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '12px',
                whiteSpace: 'nowrap'
              }}
              title="浏览文件"
            >
              📁
            </button>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
            OBJ格式：MTL材质和纹理需在同目录
          </div>
          <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
            GLTF格式：BIN文件和纹理需在同目录
          </div>
        </div>


      </div>

      <div className="property-section">
        <h4>变换</h4>

        <div className="property-item">
          <label>X轴旋转 (度)</label>
          <PropertyEditor
            type="number"
            value={component.data?.rotationX ?? 0}
            onChange={(value) => onUpdate({ data: { ...component.data, rotationX: value } })}
          />
        </div>

        <div className="property-item">
          <label>Y轴旋转 (度)</label>
          <PropertyEditor
            type="number"
            value={component.data?.rotationY ?? 0}
            onChange={(value) => onUpdate({ data: { ...component.data, rotationY: value } })}
          />
        </div>

        <div className="property-item">
          <label>Z轴旋转 (度)</label>
          <PropertyEditor
            type="number"
            value={component.data?.rotationZ ?? 0}
            onChange={(value) => onUpdate({ data: { ...component.data, rotationZ: value } })}
          />
        </div>

        <div className="property-item">
          <label>缩放</label>
          <PropertyEditor
            type="number"
            value={component.data?.scale ?? 1}
            onChange={(value) => onUpdate({ data: { ...component.data, scale: value } })}
          />
        </div>
      </div>
    </div>
  );
};
