import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as fabric from 'fabric';
import { t } from '../i18n';
import './CanvasEditorModal.css';

interface CanvasEditorModalProps {
  isOpen: boolean;
  initialSvg: string;
  onSave: (svgContent: string) => void;
  onClose: () => void;
}

type EditorMode = 'text' | 'designer';
type DrawingTool = 'select' | 'rect' | 'circle' | 'line' | 'path';

/**
 * Canvas SVG 编辑器弹窗
 * 支持 SVG 文本编辑和 Fabric.js 设计器两种模式
 */
export const CanvasEditorModal: React.FC<CanvasEditorModalProps> = ({
  isOpen,
  initialSvg,
  onSave,
  onClose,
}) => {
  const [mode, setMode] = useState<EditorMode>('text');
  const [svgContent, setSvgContent] = useState(initialSvg);
  const [position, setPosition] = useState({ x: 100, y: 50 });
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Fabric.js 状态
  const [fabricCanvas, setFabricCanvas] = useState<any>(null);
  const [currentTool, setCurrentTool] = useState<DrawingTool>('select');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(2);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 初始化内容
  useEffect(() => {
    if (isOpen) {
      setSvgContent(initialSvg);
    } else {
      // 关闭时清理 Fabric.js
      if (fabricCanvas) {
        fabricCanvas.dispose();
        setFabricCanvas(null);
      }
    }
  }, [isOpen, initialSvg]);

  // 初始化 Fabric.js
  useEffect(() => {
    if (isOpen && mode === 'designer' && fabricCanvasRef.current && !fabricCanvas) {
      // 延迟初始化，确保 DOM 已渲染
      const timer = setTimeout(() => {
        initFabricCanvas();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen, mode, fabricCanvas]);

  const initFabricCanvas = () => {
    if (!fabricCanvasRef.current) return;
    
    const canvas = new fabric.Canvas(fabricCanvasRef.current, {
      width: size.width - 40,
      height: size.height - 180,
      backgroundColor: '#ffffff',
      selection: true,
    });

    // 如果有初始 SVG，加载它
    if (svgContent) {
      fabric.loadSVGFromString(svgContent).then((result) => {
        const objects = result.objects.filter((o): o is fabric.FabricObject => o !== null);
        if (objects.length > 0) {
          const group = fabric.util.groupSVGElements(objects, result.options);
          canvas.add(group);
          canvas.renderAll();
        }
      });
    }

    // 自由绘制模式
    canvas.isDrawingMode = false;
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = strokeColor;
      canvas.freeDrawingBrush.width = strokeWidth;
    }

    setFabricCanvas(canvas);
  };

  // 工具切换
  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = currentTool === 'path';
    fabricCanvas.selection = currentTool === 'select';

    if (currentTool === 'path' && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = strokeColor;
      fabricCanvas.freeDrawingBrush.width = strokeWidth;
    }
  }, [currentTool, fabricCanvas, strokeColor, strokeWidth]);

  // 添加图形
  const addShape = (tool: DrawingTool) => {
    if (!fabricCanvas) return;

    let shape: any;
    const centerX = fabricCanvas.width / 2;
    const centerY = fabricCanvas.height / 2;

    switch (tool) {
      case 'rect':
        shape = new fabric.Rect({
          left: centerX - 50,
          top: centerY - 30,
          width: 100,
          height: 60,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        });
        break;
      case 'circle':
        shape = new fabric.Circle({
          left: centerX - 40,
          top: centerY - 40,
          radius: 40,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        });
        break;
      case 'line':
        shape = new fabric.Line([centerX - 50, centerY, centerX + 50, centerY], {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        });
        break;
    }

    if (shape) {
      fabricCanvas.add(shape);
      fabricCanvas.setActiveObject(shape);
      fabricCanvas.renderAll();
    }
  };

  // 删除选中对象
  const deleteSelected = () => {
    if (!fabricCanvas) return;
    const active = fabricCanvas.getActiveObjects();
    if (active.length > 0) {
      active.forEach((obj: any) => fabricCanvas.remove(obj));
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
    }
  };

  // 拖动逻辑
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('modal-header')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
    if (isResizing) {
      setSize({
        width: Math.max(500, e.clientX - position.x),
        height: Math.max(400, e.clientY - position.y),
      });
    }
  }, [isDragging, isResizing, dragOffset, position]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // 从 Fabric.js 获取 SVG
  const getSvgFromDesigner = useCallback((): string => {
    if (fabricCanvas) {
      return fabricCanvas.toSVG();
    }
    return svgContent;
  }, [fabricCanvas, svgContent]);

  // 保存
  const handleSave = useCallback(() => {
    let content = svgContent;
    if (mode === 'designer') {
      content = getSvgFromDesigner();
    }
    onSave(content);
    onClose();
  }, [mode, svgContent, getSvgFromDesigner, onSave, onClose]);

  // 从文件导入
  const handleImportFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          setSvgContent(content);
          // 如果在设计器模式，也加载到 canvas
          if (mode === 'designer' && fabricCanvas) {
            fabricCanvas.clear();
            fabric.loadSVGFromString(content).then((result) => {
              const objects = result.objects.filter((o): o is fabric.FabricObject => o !== null);
              if (objects.length > 0) {
                const group = fabric.util.groupSVGElements(objects, result.options);
                fabricCanvas.add(group);
                fabricCanvas.renderAll();
              }
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [mode, fabricCanvas]);

  // 切换模式时同步内容
  const handleModeChange = useCallback((newMode: EditorMode) => {
    if (mode === 'designer' && newMode === 'text') {
      const content = getSvgFromDesigner();
      setSvgContent(content);
    } else if (mode === 'text' && newMode === 'designer' && fabricCanvas) {
      // 从文本加载到 canvas
      fabricCanvas.clear();
      if (svgContent) {
        fabric.loadSVGFromString(svgContent).then((result) => {
          const objects = result.objects.filter((o): o is fabric.FabricObject => o !== null);
          if (objects.length > 0) {
            const group = fabric.util.groupSVGElements(objects, result.options);
            fabricCanvas.add(group);
            fabricCanvas.renderAll();
          }
        });
      }
    }
    setMode(newMode);
  }, [mode, svgContent, fabricCanvas, getSvgFromDesigner]);

  if (!isOpen) return null;

  return (
    <div className="canvas-editor-overlay">
      <div
        ref={modalRef}
        className="canvas-editor-modal"
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
        }}
      >
        {/* 标题栏 */}
        <div className="modal-header" onMouseDown={handleMouseDown}>
          <span className="modal-title">{t('canvasEditor.title')}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* 模式切换 Tab */}
        <div className="modal-tabs">
          <button
            className={`tab-btn ${mode === 'text' ? 'active' : ''}`}
            onClick={() => handleModeChange('text')}
          >
            {t('canvasEditor.textMode')}
          </button>
          <button
            className={`tab-btn ${mode === 'designer' ? 'active' : ''}`}
            onClick={() => handleModeChange('designer')}
          >
            {t('canvasEditor.designerMode')}
          </button>
        </div>

        {/* 编辑区域 */}
        <div className="modal-content">
          {mode === 'text' ? (
            <div className="text-editor">
              <textarea
                ref={textareaRef}
                className="svg-textarea"
                value={svgContent}
                onChange={(e) => setSvgContent(e.target.value)}
                placeholder={t('canvasEditor.placeholder')}
                spellCheck={false}
              />
              {/* SVG 预览 */}
              <div className="svg-preview">
                <div className="preview-label">{t('canvasEditor.preview')}</div>
                <div
                  className="preview-content"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              </div>
            </div>
          ) : (
            <div className="designer-editor">
              {/* 工具栏 */}
              <div className="designer-toolbar">
                <button
                  className={`tool-btn ${currentTool === 'select' ? 'active' : ''}`}
                  onClick={() => setCurrentTool('select')}
                  title="选择"
                >
                  ↖
                </button>
                <button
                  className="tool-btn"
                  onClick={() => addShape('rect')}
                  title="矩形"
                >
                  ▢
                </button>
                <button
                  className="tool-btn"
                  onClick={() => addShape('circle')}
                  title="圆形"
                >
                  ○
                </button>
                <button
                  className="tool-btn"
                  onClick={() => addShape('line')}
                  title="线条"
                >
                  ╱
                </button>
                <button
                  className={`tool-btn ${currentTool === 'path' ? 'active' : ''}`}
                  onClick={() => setCurrentTool('path')}
                  title="画笔"
                >
                  ✎
                </button>
                <div className="toolbar-separator" />
                <label className="color-picker" title="描边颜色">
                  <span>边</span>
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                  />
                </label>
                <label className="color-picker" title="填充颜色">
                  <span>填</span>
                  <input
                    type="color"
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                  />
                </label>
                <label className="stroke-width" title="线宽">
                  <span>宽</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(parseInt(e.target.value) || 1)}
                  />
                </label>
                <div className="toolbar-separator" />
                <button className="tool-btn" onClick={deleteSelected} title="删除">
                  🗑
                </button>
              </div>
              {/* Fabric.js Canvas */}
              <div className="fabric-container">
                <canvas ref={fabricCanvasRef} />
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="modal-footer">
          <button className="btn-import" onClick={handleImportFile}>
            {t('canvasEditor.importFile')}
          </button>
          <div className="footer-right">
            <button className="btn-cancel" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button className="btn-save" onClick={handleSave}>
              {t('common.confirm')}
            </button>
          </div>
        </div>

        {/* 调整大小手柄 */}
        <div
          className="resize-handle"
          onMouseDown={() => setIsResizing(true)}
        />
      </div>
    </div>
  );
};
