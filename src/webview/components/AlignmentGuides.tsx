import React from 'react';
import './AlignmentGuides.css';

export interface AlignmentLine {
  type: 'vertical' | 'horizontal';
  position: number; // x for vertical, y for horizontal
  label?: string; // 显示的提示文本，如 "居中"
  color?: string; // 线条颜色
}

interface AlignmentGuidesProps {
  lines: AlignmentLine[];
  zoom: number;
  offset: { x: number; y: number };
}

export const AlignmentGuides: React.FC<AlignmentGuidesProps> = ({ lines, zoom, offset }) => {
  return (
    <div className="alignment-guides-container" style={{ pointerEvents: 'none' }}>
      {lines.map((line, index) => {
        const isVertical = line.type === 'vertical';
        const color = line.color || '#ff00ff'; // 默认洋红色
        
        const style: React.CSSProperties = isVertical
          ? {
              position: 'absolute',
              left: `${line.position * zoom + offset.x}px`,
              top: 0,
              width: '1px',
              height: '100%',
              backgroundColor: color,
              boxShadow: `0 0 2px ${color}`,
            }
          : {
              position: 'absolute',
              left: 0,
              top: `${line.position * zoom + offset.y}px`,
              width: '100%',
              height: '1px',
              backgroundColor: color,
              boxShadow: `0 0 2px ${color}`,
            };

        return (
          <React.Fragment key={index}>
            <div className="alignment-guide-line" style={style} />
            {line.label && (
              <div
                className="alignment-guide-label"
                style={{
                  position: 'absolute',
                  left: isVertical ? `${line.position * zoom + offset.x + 5}px` : '10px',
                  top: isVertical ? '10px' : `${line.position * zoom + offset.y + 5}px`,
                  backgroundColor: color,
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                }}
              >
                {line.label}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
