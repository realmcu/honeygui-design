import React, { useState } from 'react';
import { PropertyPanelProps } from './types';
import { BaseProperties } from './BaseProperties';
import { PropertyEditor } from './PropertyEditor';
import { EventsPanel } from './EventsPanel';
import { t } from '../../i18n';

export const Hg3DProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate, components }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');

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
    <>
      <div className="properties-tabs">
        <button
          className={activeTab === 'properties' ? 'active' : ''}
          onClick={() => setActiveTab('properties')}
        >
          {t('Properties')}
        </button>
        <button
          className={activeTab === 'events' ? 'active' : ''}
          onClick={() => setActiveTab('events')}
        >
          {t('Events')}
        </button>
      </div>

      <div className="properties-content">
        {activeTab === 'properties' && (
          <>
            <BaseProperties component={component} onUpdate={onUpdate} components={components} />

            <div className="property-section">
              <h4>{t('Model Settings')}</h4>

              <div className="property-item">
                <label>{t('Model Path')}</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <PropertyEditor
                    type="string"
                    value={component.data?.modelPath}
                    onChange={(value) => onUpdate({ data: { ...component.data, modelPath: value } })}
                    title="assets/model.obj"
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
                    title={t('Browse')}
                  >
                    📁
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
                  {t('OBJ format: MTL material and textures must be in the same directory')}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
                  {t('GLTF format: BIN file and textures must be in the same directory')}
                </div>
              </div>

              <div className="property-item">
                <label>{t('Draw Type')}</label>
                <PropertyEditor
                  type="select"
                  value={component.data?.drawType ?? 'L3_DRAW_FRONT_AND_SORT'}
                  onChange={(value) => onUpdate({ data: { ...component.data, drawType: value } })}
                  options={['L3_DRAW_FRONT_ONLY', 'L3_DRAW_FRONT_AND_BACK', 'L3_DRAW_FRONT_AND_SORT']}
                />
                <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
                  {t('Front only / Front and back / Front and sort (default)')}
                </div>
              </div>
            </div>

            <div className="property-section">
              <h4>{t('Camera Settings')}</h4>

              <div className="property-item">
                <label>{t('Camera Position')}</label>
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
              </div>

              <div className="property-item">
                <label>{t('Camera Direction')}</label>
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
              </div>
            </div>

            <div className="property-section">
              <h4>{t('World Coordinate Settings')}</h4>

              <div className="property-item">
                <label>{t('Translation')}</label>
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
              </div>

              <div className="property-item">
                <label>{t('Rotation (degrees)')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  <div>
                    <label style={{ fontSize: '12px' }}>{t('X-axis')}</label>
                    <PropertyEditor
                      type="number"
                      value={component.data?.rotationX ?? 0}
                      onChange={(value) => onUpdate({ data: { ...component.data, rotationX: value } })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>{t('Y-axis')}</label>
                    <PropertyEditor
                      type="number"
                      value={component.data?.rotationY ?? 0}
                      onChange={(value) => onUpdate({ data: { ...component.data, rotationY: value } })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px' }}>{t('Z-axis')}</label>
                    <PropertyEditor
                      type="number"
                      value={component.data?.rotationZ ?? 0}
                      onChange={(value) => onUpdate({ data: { ...component.data, rotationZ: value } })}
                    />
                  </div>
                </div>
              </div>

              <div className="property-item">
                <label>{t('Scale')}</label>
                <PropertyEditor
                  type="number"
                  value={component.data?.scale ?? 5}
                  onChange={(value) => onUpdate({ data: { ...component.data, scale: value } })}
                />
              </div>
            </div>

            <div className="property-section">
              <h4>{t('Interactive Animation')}</h4>

              <div className="property-item">
                <label>
                  <input
                    type="checkbox"
                    checked={component.data?.touchRotationEnabled ?? false}
                    onChange={(e) => onUpdate({ data: { ...component.data, touchRotationEnabled: e.target.checked } })}
                    style={{ marginRight: '8px' }}
                  />
                  {t('Enable Touch Rotation')}
                </label>
                <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
                  {t('In designer, use middle mouse button to preview; on device, responds to touch')}
                </div>
              </div>

              {component.data?.touchRotationEnabled && (
                <>
                  <div className="property-item">
                    <label>{t('Rotation Axis')}</label>
                    <PropertyEditor
                      type="select"
                      value={component.data?.touchRotationAxis ?? 'y'}
                      onChange={(value) => onUpdate({ data: { ...component.data, touchRotationAxis: value } })}
                      options={['x', 'y', 'z']}
                    />
                  </div>

                  <div className="property-item">
                    <label>{t('Sensitivity')}</label>
                    <PropertyEditor
                      type="number"
                      value={component.data?.touchRotationSensitivity ?? 5.0}
                      onChange={(value) => onUpdate({ data: { ...component.data, touchRotationSensitivity: value } })}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
                      {t('Higher value = slower rotation (default 5.0)')}
                    </div>
                  </div>
                </>
              )}

              <div className="property-item" style={{ marginTop: '16px' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={component.data?.autoRotationEnabled ?? false}
                    onChange={(e) => onUpdate({ data: { ...component.data, autoRotationEnabled: e.target.checked } })}
                    style={{ marginRight: '8px' }}
                  />
                  {t('Enable Auto Rotation')}
                </label>
              </div>

              {component.data?.autoRotationEnabled && (
                <>
                  <div className="property-item">
                    <label>{t('Rotation Axis')}</label>
                    <PropertyEditor
                      type="select"
                      value={component.data?.autoRotationAxis ?? 'y'}
                      onChange={(value) => onUpdate({ data: { ...component.data, autoRotationAxis: value } })}
                      options={['x', 'y', 'z']}
                    />
                  </div>

                  <div className="property-item">
                    <label>{t('Rotation Speed')}</label>
                    <PropertyEditor
                      type="number"
                      value={component.data?.autoRotationSpeed ?? 1.0}
                      onChange={(value) => onUpdate({ data: { ...component.data, autoRotationSpeed: value } })}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
                      {t('Rotation angle per frame, positive = counterclockwise (default 1.0)')}
                    </div>
                  </div>
                </>
              )}
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
