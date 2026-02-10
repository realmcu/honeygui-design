import React, { useState, useRef, useEffect } from 'react';
import { useDesignerStore } from '../store';
import { Save, Code, RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize2, GitBranch, Palette, AlignLeft, Grid, Download, Rocket, Trash2, Square, Users } from 'lucide-react';
import { AlignType, DistributeType, ResizeType, getAlignmentConfigsByCategory } from '../utils/alignmentUtils';
import { t } from '../i18n';
import './Toolbar.css';

const Toolbar: React.FC<{
  showCollaborationPanel: boolean;
  onToggleCollaboration: () => void;
}> = ({ showCollaborationPanel, onToggleCollaboration }) => {
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
    isSimulationRunning,
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

  const handleUartDownload = () => {
    window.vscodeAPI?.postMessage({
      command: 'executeCommand',
      commandId: 'honeygui.uartDownload',
    });
  };

  const handleSimulation = () => {
    if (isSimulationRunning) {
      // 停止仿真
      window.vscodeAPI?.postMessage({
        command: 'executeCommand',
        commandId: 'honeygui.simulation.stop',
      });
    } else {
      // 启动仿真
      window.vscodeAPI?.postMessage({
        command: 'executeCommand',
        commandId: 'honeygui.simulation',
      });
    }
  };

  const handleClean = () => {
    window.vscodeAPI?.postMessage({
      command: 'executeCommand',
      commandId: 'honeygui.simulation.clean',
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
          title={`${t('Save')} (Ctrl+S)`}
        >
          <Save size={16} strokeWidth={1.4} />
          <span>{t('Save')}</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <div className="toolbar-segmented">
          <button
            className="toolbar-icon-button"
            onClick={handleUndo}
            title={`${t('Undo')} (Ctrl+Z)`}
            disabled={!canUndo()}
          >
            <RotateCcw size={16} strokeWidth={1.4} />
          </button>
          <button
            className="toolbar-icon-button"
            onClick={handleRedo}
            title={`${t('Redo')} (Ctrl+Y)`}
            disabled={!canRedo()}
          >
            <RotateCw size={16} strokeWidth={1.4} />
          </button>
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button
          className="toolbar-icon-button"
          onClick={handleToggleViewConnections}
          title={t('View Relations')}
        >
          <GitBranch size={16} strokeWidth={1.4} />
        </button>
        
        <button
          className={`toolbar-icon-button ${showAlignmentGuides ? 'active' : ''}`}
          onClick={() => setShowAlignmentGuides(!showAlignmentGuides)}
          title={showAlignmentGuides ? t('Hide guides') : t('Show guides')}
        >
          <Grid size={16} strokeWidth={1.4} />
        </button>
        
        {/* Align button */}
        <div className="align-menu-container" ref={alignMenuRef}>
          <button
            className={`toolbar-icon-button ${selectedComponents.length < 2 ? 'disabled' : ''}`}
            onClick={() => selectedComponents.length >= 2 && setShowAlignMenu(!showAlignMenu)}
            title={selectedComponents.length < 2 ? t('Select at least 2 components') : t('Align and distribute')}
            disabled={selectedComponents.length < 2}
          >
            <AlignLeft size={16} strokeWidth={1.4} />
            {selectedComponents.length >= 2 && (
              <span className="selection-badge">{selectedComponents.length}</span>
            )}
          </button>
          {showAlignMenu && selectedComponents.length >= 2 && (
            <div className="align-dropdown-menu">
              <div className="align-menu-section">
                <div className="align-menu-title">{t('Align')}</div>
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
                <div className="align-menu-title">{t('Distribute')}</div>
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
                    title={selectedComponents.length < config.minComponents ? `${t('Requires at least')} ${config.minComponents}` : ''}
                  >
                    <span>{config.label}</span>
                    {config.shortcut && <span className="shortcut">{config.shortcut}</span>}
                  </button>
                ))}
              </div>
              <div className="align-menu-divider" />
              <div className="align-menu-section">
                <div className="align-menu-title">{t('Size')}</div>
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
            className="toolbar-icon-button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title={t('Background Color')}
          >
            <Palette size={16} strokeWidth={1.4} />
          </button>
          {showColorPicker && (
            <div className="color-picker-dropdown">
              <button
                className={`color-option ${canvasBackgroundColor === '#ffffff' ? 'active' : ''}`}
                onClick={() => handleBackgroundColorChange('#ffffff')}
                title={t('White')}
              >
                <div className="color-preview" style={{ backgroundColor: '#ffffff', border: '1px solid #ccc' }} />
                <span>{t('White')}</span>
              </button>
              <button
                className={`color-option ${canvasBackgroundColor === '#000000' ? 'active' : ''}`}
                onClick={() => handleBackgroundColorChange('#000000')}
                title={t('Black')}
              >
                <div className="color-preview" style={{ backgroundColor: '#000000' }} />
                <span>{t('Black')}</span>
              </button>
              <button
                className={`color-option ${canvasBackgroundColor === '#3c3c3c' ? 'active' : ''}`}
                onClick={() => handleBackgroundColorChange('#3c3c3c')}
                title={t('Dark Gray')}
              >
                <div className="color-preview" style={{ backgroundColor: '#3c3c3c' }} />
                <span>{t('Dark Gray')}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <div className="toolbar-segmented">
          <button
            className="toolbar-icon-button"
            onClick={handleZoomOut}
            title={t('Zoom Out')}
          >
            <ZoomOut size={16} strokeWidth={1.4} />
          </button>
          <div className="segmented-value zoom-level">{Math.round(zoom * 100)}%</div>
          <button
            className="toolbar-icon-button"
            onClick={handleZoomIn}
            title={t('Zoom In')}
          >
            <ZoomIn size={16} strokeWidth={1.4} />
          </button>
          <button
            className="toolbar-icon-button"
            onClick={handleZoomFit}
            title={t('Fit to Screen')}
          >
            <Maximize2 size={16} strokeWidth={1.4} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div className="toolbar-section">
        <button
          className={`toolbar-button ${showCollaborationPanel ? 'active' : ''}`}
          onClick={onToggleCollaboration}
          title={t('Collaboration')}
        >
          <Users size={16} strokeWidth={1.4} />
          <span>{t('Collaboration')}</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button
          className="toolbar-button primary"
          onClick={handleGenerateAllCode}
          title={t('Generate Code')}
        >
          <Code size={16} strokeWidth={1.4} />
          <span>{t('Generate Code')}</span>
        </button>
        <button
          className={`toolbar-button primary ${isSimulationRunning ? 'running' : ''}`}
          onClick={handleSimulation}
          title={isSimulationRunning ? t('Stop Simulation') : t('Compile & Simulate')}
        >
          {isSimulationRunning ? <Square size={16} strokeWidth={1.4} /> : <Rocket size={16} strokeWidth={1.4} />}
          <span>{isSimulationRunning ? t('Stop') : t('Simulate')}</span>
        </button>
        <div className="toolbar-segmented">
          <button
            className="toolbar-icon-button"
            onClick={handleUartDownload}
            title={t('UART Download')}
          >
            <Download size={16} strokeWidth={1.4} />
          </button>
          <button
            className="toolbar-icon-button"
            onClick={handleClean}
            title={t('Clean Build')}
          >
            <Trash2 size={16} strokeWidth={1.4} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
