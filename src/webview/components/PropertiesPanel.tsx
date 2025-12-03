import React from 'react';
import { useDesignerStore } from '../store';
import { propertyPanelRegistry } from './properties';
import './PropertiesPanel.css';

const PropertiesPanel: React.FC = () => {
  const { selectedComponent, updateComponent } = useDesignerStore();
  const selected = useDesignerStore.getState().getSelectedComponent();

  if (!selected) {
    return (
      <div className="properties-panel">
        <div className="properties-header">
          <h3>属性</h3>
        </div>
        <div className="properties-content">
          <div className="no-selection">请选择一个组件</div>
        </div>
      </div>
    );
  }

  const PropertyPanel = propertyPanelRegistry[selected.type];

  const handleUpdate = (updates: Partial<typeof selected>) => {
    if (!selectedComponent) return;
    updateComponent(selectedComponent, updates);
  };

  return (
    <div className="properties-panel">
      <div className="properties-header">
        <h3>属性</h3>
      </div>

      {PropertyPanel ? (
        <PropertyPanel component={selected} onUpdate={handleUpdate} />
      ) : (
        <div className="properties-content">
          <div className="no-selection">未知组件类型: {selected.type}</div>
        </div>
      )}
    </div>
  );
};

export default PropertiesPanel;
