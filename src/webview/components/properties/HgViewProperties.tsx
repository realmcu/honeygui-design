import React, { useState } from 'react';
import { PropertyPanelProps } from './types';
import { PropertyEditor } from './PropertyEditor';
import { BaseProperties } from './BaseProperties';
import { EventsPanel } from './EventsPanel';
import { t } from '../../i18n';

export const HgViewProperties: React.FC<PropertyPanelProps> = ({ component, onUpdate, components }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'events'>('properties');

  // 计算默认动画步长（屏幕高度的 1/10）
  const defaultAnimateStep = Math.round(component.position.height / 10);

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
            <BaseProperties 
              component={component} 
              onUpdate={onUpdate}
              components={components}
              disableSize={true}
              sizeTooltip={t('hg_view size is determined by project resolution and cannot be modified')}
              hideParent={true}
            >
              {/* UI Entry View - 名称后、位置与大小前 */}
              <div className="property-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>{t('UI Entry View')}</label>
                  <PropertyEditor
                    type="boolean"
                    value={component.data?.entry === true || component.data?.entry === 'true'}
                    onChange={(value) => handleDataChange('entry', value)}
                  />
                </div>
              </div>
            </BaseProperties>

            {/* Style Properties */}
            <div className="property-group">
              <div className="property-group-title">{t('Style')}</div>
              <div className="property-item">
                <label>{t('Background Color')}</label>
                <PropertyEditor
                  type="color"
                  value={component.style?.backgroundColor}
                  onChange={(value) => handleStyleChange('backgroundColor', value)}
                />
              </div>
            </div>

            {/* View Specific Properties */}
            <div className="property-group">
              <div className="property-group-title">{t('View Properties')}</div>
              <div className="property-item" style={{ opacity: 0.4, pointerEvents: 'none' }} title="Coming soon">
                <label>{t('Resident Memory')}</label>
                <PropertyEditor
                  type="boolean"
                  value={component.data?.residentMemory || false}
                  onChange={(value) => handleDataChange('residentMemory', value)}
                />
              </div>
              <div className="property-item">
                <label>{t('Animation Step')}</label>
                <PropertyEditor
                  type="number"
                  value={component.data?.animateStep ?? defaultAnimateStep}
                  onChange={(value) => handleDataChange('animateStep', value)}
                />
              </div>
              <div className="property-item">
                <label>{t('Opacity (0-255)')}</label>
                <PropertyEditor
                  type="number"
                  value={component.data?.opacity ?? 255}
                  onChange={(value) => handleDataChange('opacity', value)}
                  min={0}
                  max={255}
                />
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
