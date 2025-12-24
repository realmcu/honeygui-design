import React, { useState, useRef, useEffect } from 'react';
import { useDesignerStore } from '../store';
import { Save, Code, Play, RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize2, GitBranch, Palette, AlignLeft, Grid } from 'lucide-react';
import { AlignType, DistributeType, ResizeType, getAlignmentConfigsByCategory } from '../utils/alignmentUtils';
import './Toolbar.css';

const Toolbar: React.FC = () => {
  const {
    setZoom,
    zoom,
    setEditingMode,
    editingMode,
    showViewRelationModal,
    setShowViewRelationModal,
    canvasBackgroundColor,
    setCanvasBackgroundColor,
    showAlignmentGuides,
    setShowAlignmentGuides,
    selectedComponents,
    alignSelectedComponents,
    distributeSelectedComponents,
    resizeSelectedComponents,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useDesignerStore();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAlignMenu, setShowAlignMenu] = useState(false);
  const alignMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭颜色选择器
  React.useEffect(() => {
    if (!showColorPicker && !showAlignMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showColorPicker && !target.closest('.background-color-picker')) {
        setShowColorPicker(false);
      }
      if (showAlignMenu && alignMenuRef.current && !alignMenuRef.current.contains(target)) {
        setShowAlignMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker, showAlignMenu]);

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
    setShowViewRelationModal(!showViewRelationModal);
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
    undo();
  };

  const handleRedo = () => {
    redo();
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
          disabled={!canUndo()}
        >
          <RotateCcw size={16} />
          <span>撤销</span>
        </button>
        <button
          className="toolbar-button"
          onClick={handleRedo}
          title="重做 (Ctrl+Y)"
          disabled={!canRedo()}
        >
          <RotateCw size={16} />
          <span>重做</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button
          className="toolbar-button"
          onClick={handleToggleViewConnections}
          title="查看视图关系图"
        >
          <GitBranch size={16} />
          <span>关系图</span>
        </button>
        
        <button
          className={`toolbar-button ${showAlignmentGuides ? 'active' : ''}`}
          onClick={() => setShowAlignmentGuides(!showAlignmentGuides)}
          title={showAlignmentGuides ? '隐藏智能辅助线' : '显示智能辅助线'}
        >
          <Grid size={16} />
          <span>辅助线</span>
        </button>
        
        {/* 对齐按钮 - 多选时启用 */}
        <div className="align-menu-container" ref={alignMenuRef}>
          <button
            className={`toolbar-button ${selectedComponents.length < 2 ? 'disabled' : ''}`}
            onClick={() => selectedComponents.length >= 2 && setShowAlignMenu(!showAlignMenu)}
            title={selectedComponents.length < 2 ? '请选择至少2个组件' : '对齐和分布'}
            disabled={selectedComponents.length < 2}
          >
            <AlignLeft size={16} />
            <span>对齐</span>
            {selectedComponents.length >= 2 && (
              <span className="selection-badge">{selectedComponents.length}</span>
            )}
          </button>
          {showAlignMenu && selectedComponents.length >= 2 && (
            <div className="align-dropdown-menu">
              <div className="align-menu-section">
                <div className="align-menu-title">对齐</div>
                {getAlignmentConfigsByCategory('align').map(config => (
                  <button
                    key={config.type}
                    className="align-menu-item"
                    onClick={() => {
                      alignSelectedComponents(config.type as AlignType);
                      setShowAlignMenu(false);
                    }}
                  >
                    <span>{config.label}</span>
                    {config.shortcut && <span className="shortcut">{config.shortcut}</span>}
                  </button>
                ))}
              </div>
              <div className="align-menu-divider" />
              <div className="align-menu-section">
                <div className="align-menu-title">分布</div>
                {getAlignmentConfigsByCategory('distribute').map(config => (
                  <button
                    key={config.type}
                    className={`align-menu-item ${selectedComponents.length < config.minComponents ? 'disabled' : ''}`}
                    onClick={() => {
                      if (selectedComponents.length >= config.minComponents) {
                        distributeSelectedComponents(config.type as DistributeType);
                        setShowAlignMenu(false);
                      }
                    }}
                    disabled={selectedComponents.length < config.minComponents}
                    title={selectedComponents.length < config.minComponents ? `需要至少${config.minComponents}个组件` : ''}
                  >
                    <span>{config.label}</span>
                    {config.shortcut && <span className="shortcut">{config.shortcut}</span>}
                  </button>
                ))}
              </div>
              <div className="align-menu-divider" />
              <div className="align-menu-section">
                <div className="align-menu-title">尺寸</div>
                {getAlignmentConfigsByCategory('resize').map(config => (
                  <button
                    key={config.type}
                    className="align-menu-item"
                    onClick={() => {
                      resizeSelectedComponents(config.type as ResizeType);
                      setShowAlignMenu(false);
                    }}
                  >
                    <span>{config.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
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
