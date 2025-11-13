import React, { useState } from 'react';
import { useDesignerStore } from '../store';

const CanvasSettings: React.FC = () => {
  const {
    canvasSize,
    canvasBackgroundColor,
    setCanvasSize,
    setCanvasBackgroundColor,
  } = useDesignerStore();

  // Local state for form inputs
  const [width, setWidth] = useState(canvasSize.width.toString());
  const [height, setHeight] = useState(canvasSize.height.toString());
  const [backgroundColor, setBackgroundColor] = useState(canvasBackgroundColor);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Standard canvas sizes for quick selection
  const standardSizes = [
    { label: 'Custom', width: 0, height: 0 },
    { label: '800x600', width: 800, height: 600 },
    { label: '1024x768', width: 1024, height: 768 },
    { label: '1280x720', width: 1280, height: 720 },
    { label: '1920x1080', width: 1920, height: 1080 },
  ];

  // Handle standard size selection
  const handleSizeSelect = (size: { width: number; height: number }) => {
    if (size.width && size.height) {
      setWidth(size.width.toString());
      setHeight(size.height.toString());
    }
  };

  // Apply canvas settings
  const handleApply = () => {
    const newWidth = parseInt(width, 10);
    const newHeight = parseInt(height, 10);

    // Validate inputs
    if (isNaN(newWidth) || isNaN(newHeight) || newWidth <= 0 || newHeight <= 0) {
      alert('Please enter valid canvas dimensions');
      return;
    }

    // Update canvas settings
    setCanvasSize({ width: newWidth, height: newHeight });
    setCanvasBackgroundColor(backgroundColor);
    setIsDialogOpen(false);
  };

  // Open settings dialog
  const openSettingsDialog = () => {
    // Reset form with current values
    setWidth(canvasSize.width.toString());
    setHeight(canvasSize.height.toString());
    setBackgroundColor(canvasBackgroundColor);
    setIsDialogOpen(true);
  };

  return (
    <>
      <button
        className="canvas-settings-button"
        onClick={openSettingsDialog}
        style={{
          padding: '6px 12px',
          margin: '5px',
          backgroundColor: 'var(--vscode-button-background)',
          color: 'var(--vscode-button-foreground)',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        Canvas Settings
      </button>

      {isDialogOpen && (
        <div
          className="settings-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIsDialogOpen(false)}
        >
          <div
            className="settings-dialog"
            style={{
              backgroundColor: 'var(--vscode-settings-background)',
              padding: '20px',
              borderRadius: '4px',
              minWidth: '300px',
              maxWidth: '90vw',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--vscode-settings-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: 'var(--vscode-settings-headerForeground)', marginBottom: '15px' }}>
              Canvas Settings
            </h3>

            {/* Canvas Size Selection */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: 'var(--vscode-settings-labelForeground)', display: 'block', marginBottom: '5px' }}>
                Canvas Size
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                {standardSizes.map((size) => (
                  <button
                    key={size.label}
                    onClick={() => handleSizeSelect(size)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      backgroundColor: 'var(--vscode-button-background)',
                      color: 'var(--vscode-button-foreground)',
                      border: 'none',
                      borderRadius: '2px',
                      cursor: 'pointer',
                    }}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: 'var(--vscode-settings-labelForeground)', fontSize: '12px', display: 'block' }}>
                    Width (px)
                  </label>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '4px',
                      backgroundColor: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '2px',
                    }}
                    min="100"
                    max="5000"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: 'var(--vscode-settings-labelForeground)', fontSize: '12px', display: 'block' }}>
                    Height (px)
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '4px',
                      backgroundColor: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '2px',
                    }}
                    min="100"
                    max="5000"
                  />
                </div>
              </div>
            </div>

            {/* Background Color Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: 'var(--vscode-settings-labelForeground)', display: 'block', marginBottom: '5px' }}>
                Background Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  style={{
                    width: '50px',
                    height: '30px',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '4px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    fontSize: '12px',
                  }}
                  placeholder="#ffffff"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setIsDialogOpen(false)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--vscode-button-hoverBackground)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CanvasSettings;
