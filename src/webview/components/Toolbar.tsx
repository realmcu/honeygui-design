import React, { useState } from 'react';
import { useDesignerStore } from '../store';
import { Save, Code, Play, RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize2, GitBranch, Palette } from 'lucide-react';
import './Toolbar.css';

const Toolbar: React.FC = () => {
  const {
    setZoom,
    zoom,
    setEditingMode,
    editingMode,
    showViewConnections,
    setShowViewConnections,
    canvasBackgroundColor,
    setCanvasBackgroundColor,
  } = useDesignerStore();

  const [showColorPicker, setShowColorPicker] = useState(false);

  // 点击外部关闭颜色选择器
  React.useEffect(() => {
    if (!showColorPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.background-color-picker')) {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker]);

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

  const handleToggleViewConnections = () => {
    setShowViewConnections(!showViewConnections);
  };

  const handleBackgroundColorChange = (color: string) => {
    setCanvasBackgroundColor(color);
    setShowColorPicker(false);
  };

  const handleSave = () => {
    window.vscodeAPI?.postMessage({
      command: 'save',
      content: {},
    });
  };

  const handleGenerateAllCode = () => {
    window.vscodeAPI?.postMessage({
      command: 'generateCode',
      content: {},
    });
  };

  const handlePreview = () => {
    window.vscodeAPI?.postMessage({
      command: 'executeCommand',
      commandId: 'honeygui.preview',
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
          className={`toolbar-button ${showViewConnections ? 'active' : ''}`}
          onClick={handleToggleViewConnections}
          title="显示/隐藏视图连接"
        >
          <GitBranch size={16} />
          <span>连接</span>
        </button>
        <div className="background-color-picker">
          <button
            className="toolbar-button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="画布背景色"
          >
            <Palette size={16} />
            <span>背景</span>
          </button>
          {showColorPicker && (
            <div className="color-picker-dropdown">
              <button
                className={`color-option ${canvasBackgroundColor === '#ffffff' ? 'active' : ''}`}
                onClick={() => handleBackgroundColorChange('#ffffff')}
                title="白色"
              >
                <div className="color-preview" style={{ backgroundColor: '#ffffff', border: '1px solid #ccc' }} />
                <span>白色</span>
              </button>
              <button
                className={`color-option ${canvasBackgroundColor === '#000000' ? 'active' : ''}`}
                onClick={() => handleBackgroundColorChange('#000000')}
                title="黑色"
              >
                <div className="color-preview" style={{ backgroundColor: '#000000' }} />
                <span>黑色</span>
              </button>
              <button
                className={`color-option ${canvasBackgroundColor === '#3c3c3c' ? 'active' : ''}`}
                onClick={() => handleBackgroundColorChange('#3c3c3c')}
                title="深灰 (RGB 60,60,60)"
              >
                <div className="color-preview" style={{ backgroundColor: '#3c3c3c' }} />
                <span>深灰</span>
              </button>
            </div>
          )}
        </div>
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
          onClick={handleGenerateAllCode}
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
