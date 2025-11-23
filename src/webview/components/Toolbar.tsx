import React, { useState } from 'react';
import { useDesignerStore } from '../store';
import { Save, Code, Play, RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize2, Grid3x3, MousePointer } from 'lucide-react';
import './Toolbar.css';

const Toolbar: React.FC = () => {
  const {
    setZoom,
    zoom,
    setEditingMode,
    editingMode,
    snapToGrid,
    setSnapToGrid,
    generateCode,
  } = useDesignerStore();

  const handleZoomIn = () => {
    setZoom(Math.min(zoom * 1.2, 8));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom / 1.2, 0.25));
  };

  const handleZoomFit = () => {
    setZoom(1);
  };

  const handleSelectMode = () => {
    setEditingMode('select');
  };

  const handleToggleGrid = () => {
    setSnapToGrid(!snapToGrid);
  };

  const handleSave = () => {
    window.vscodeAPI?.postMessage({
      command: 'save',
      content: {},
    });
  };

  const handleGenerateCode = () => {
    generateCode('cpp');
  };

  const handlePreview = () => {
    window.vscodeAPI?.postMessage({
      command: 'preview',
      content: {},
    });
  };

  const handleUndo = () => {
    // Implement undo logic
  };

  const handleRedo = () => {
    // Implement redo logic
  };

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <button
          className="toolbar-button"
          onClick={handleSave}
          title="保存 (Ctrl+S)"
        >
          <Save size={16} />
          <span>保存</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button
          className="toolbar-button"
          onClick={handleUndo}
          title="撤销 (Ctrl+Z)"
          disabled
        >
          <RotateCcw size={16} />
          <span>撤销</span>
        </button>
        <button
          className="toolbar-button"
          onClick={handleRedo}
          title="重做 (Ctrl+Y)"
          disabled
        >
          <RotateCw size={16} />
          <span>重做</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button
          className={`toolbar-button ${snapToGrid ? 'active' : ''}`}
          onClick={handleToggleGrid}
          title="切换网格"
        >
          <Grid3x3 size={16} />
          <span>网格</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button
          className="toolbar-button"
          onClick={handleZoomOut}
          title="缩小"
        >
          <ZoomOut size={16} />
        </button>
        <div className="zoom-level">{Math.round(zoom * 100)}%</div>
        <button
          className="toolbar-button"
          onClick={handleZoomIn}
          title="放大"
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="toolbar-button"
          onClick={handleZoomFit}
          title="适应屏幕"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      <div style={{ flex: 1 }} />

      <div className="toolbar-section">
        <button
          className="toolbar-button primary"
          onClick={handleGenerateCode}
          title="生成代码"
        >
          <Code size={16} />
          <span>生成代码</span>
        </button>
        <button
          className="toolbar-button primary"
          onClick={handlePreview}
          title="预览"
        >
          <Play size={16} />
          <span>预览</span>
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
