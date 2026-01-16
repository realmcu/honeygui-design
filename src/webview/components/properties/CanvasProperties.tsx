import React from 'react';
import { Component } from '../../types';
import { t } from '../../i18n';
import './CanvasProperties.css';

interface CanvasPropertiesProps {
  component: Component;
  onOpenEditor: () => void;
}

/**
 * Canvas 组件属性面板
 */
export const CanvasProperties: React.FC<CanvasPropertiesProps> = ({
  component,
  onOpenEditor,
}) => {
  const svgContent = component.data?.svgContent as string | undefined;
  const hasSvg = svgContent && svgContent.trim().length > 0;

  return (
    <div className="canvas-properties">
      <div className="property-group">
        <div className="property-label">SVG Content</div>
        <div className="svg-status">
          {hasSvg ? (
            <span className="status-configured">✓ {t('canvasEditor.preview')}</span>
          ) : (
            <span className="status-empty">未配置</span>
          )}
        </div>
        <button className="edit-svg-btn" onClick={onOpenEditor}>
          {t('canvasEditor.editSvg')}
        </button>
      </div>
    </div>
  );
};
