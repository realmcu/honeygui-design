import React from 'react';
import { PropertyPanelProps } from './types';
import { BaseProperties } from './BaseProperties';
import { PropertyEditor } from './PropertyEditor';

export const Hg3DProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate, components }) => {
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
      <BaseProperties component={component} onUpdate={onUpdate} components={components} />

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

        <div className="property-item">
          <label>绘制类型</label>
          <PropertyEditor
            type="select"
            value={component.data?.drawType ?? 'L3_DRAW_FRONT_AND_SORT'}
            onChange={(value) => onUpdate({ data: { ...component.data, drawType: value } })}
            options={['L3_DRAW_FRONT_ONLY', 'L3_DRAW_FRONT_AND_BACK', 'L3_DRAW_FRONT_AND_SORT']}
          />
          <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
            仅正面 / 正面和背面 / 正面并排序（默认）
          </div>
        </div>

      </div>

      <div className="property-section">
        <h4>相机设置</h4>

        <div className="property-item">
          <label>相机位置</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
            <div>
              <label style={{ fontSize: '12px' }}>X</label>
              <PropertyEditor
                type="number"
                value={component.data?.cameraPosX ?? 0}
                onChange={(value) => onUpdate({ data: { ...component.data, cameraPosX: value } })}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>Y</label>
              <PropertyEditor
                type="number"
                value={component.data?.cameraPosY ?? 0}
                onChange={(value) => onUpdate({ data: { ...component.data, cameraPosY: value } })}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>Z</label>
              <PropertyEditor
                type="number"
                value={component.data?.cameraPosZ ?? 0}
                onChange={(value) => onUpdate({ data: { ...component.data, cameraPosZ: value } })}
              />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
          </div>
        </div>

        <div className="property-item">
          <label>相机朝向</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
            <div>
              <label style={{ fontSize: '12px' }}>X</label>
              <PropertyEditor
                type="number"
                value={component.data?.cameraLookX ?? 0}
                onChange={(value) => onUpdate({ data: { ...component.data, cameraLookX: value } })}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>Y</label>
              <PropertyEditor
                type="number"
                value={component.data?.cameraLookY ?? 0}
                onChange={(value) => onUpdate({ data: { ...component.data, cameraLookY: value } })}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>Z</label>
              <PropertyEditor
                type="number"
                value={component.data?.cameraLookZ ?? 1}
                onChange={(value) => onUpdate({ data: { ...component.data, cameraLookZ: value } })}
              />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
          </div>
        </div>
      </div>

      <div className="property-section">
        <h4>世界坐标系设置</h4>

        <div className="property-item">
          <label>平移</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
            <div>
              <label style={{ fontSize: '12px' }}>X</label>
              <PropertyEditor
                type="number"
                value={component.data?.worldX ?? 0}
                onChange={(value) => onUpdate({ data: { ...component.data, worldX: value } })}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>Y</label>
              <PropertyEditor
                type="number"
                value={component.data?.worldY ?? 0}
                onChange={(value) => onUpdate({ data: { ...component.data, worldY: value } })}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>Z</label>
              <PropertyEditor
                type="number"
                value={component.data?.worldZ ?? 30}
                onChange={(value) => onUpdate({ data: { ...component.data, worldZ: value } })}
              />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
          </div>
        </div>

        <div className="property-item">
          <label>旋转 (度)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
            <div>
              <label style={{ fontSize: '12px' }}>X轴</label>
              <PropertyEditor
                type="number"
                value={component.data?.rotationX ?? 0}
                onChange={(value) => onUpdate({ data: { ...component.data, rotationX: value } })}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>Y轴</label>
              <PropertyEditor
                type="number"
                value={component.data?.rotationY ?? 0}
                onChange={(value) => onUpdate({ data: { ...component.data, rotationY: value } })}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>Z轴</label>
              <PropertyEditor
                type="number"
                value={component.data?.rotationZ ?? 0}
                onChange={(value) => onUpdate({ data: { ...component.data, rotationZ: value } })}
              />
            </div>
          </div>
        </div>

        <div className="property-item">
          <label>缩放</label>
          <PropertyEditor
            type="number"
            value={component.data?.scale ?? 5}
            onChange={(value) => onUpdate({ data: { ...component.data, scale: value } })}
          />
        </div>
      </div>
    </div>
  );
};
