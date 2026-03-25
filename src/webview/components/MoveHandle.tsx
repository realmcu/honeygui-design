import React from 'react';
import { Move } from 'lucide-react';
import './MoveHandle.css';

interface MoveHandleProps {
  componentId: string;
  absX: number;
  absY: number;
  width: number;
  onMoveStart: (e: React.MouseEvent, componentId: string) => void;
}

/**
 * 组件移动手柄
 * 作为画布覆盖层渲染，不受组件 overflow:hidden 限制
 */
export const MoveHandle: React.FC<MoveHandleProps> = ({
  componentId,
  absX,
  absY,
  width,
  onMoveStart,
}) => {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onMoveStart(e, componentId);
  };

  return (
    <div
      className="move-handle"
      style={{
        left: absX + width + 2,
        top: absY,
      }}
      onMouseDown={handleMouseDown}
      title="Drag to move"
    >
      <Move size={12} />
    </div>
  );
};

export default MoveHandle;
