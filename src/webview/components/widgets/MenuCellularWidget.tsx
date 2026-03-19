import React, { useMemo } from 'react';
import { WidgetProps } from './types';

/**
 * 蜂窝菜单预览控件
 * 排布规则：行交替 3-4-3-4...
 *   偶数行（row=0,2,4...）：4个圆，均匀分布
 *   奇数行（row=1,3,5...）：3个圆，居中分布（相当于偏移半个间距）
 * 缩放效果：中心圆最大，向外按距离缩小（透视感）
 */
export const MenuCellularWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const width = component.position.width || 240;
  const height = component.position.height || 240;
  const iconSize = parseInt(String(component.style?.iconSize)) || 64;

  // 圆心间距
  const colSpacing = width / 4;          // 4列时的列间距
  const rowSpacing = iconSize * 0.88;    // 行间距略小于 iconSize，让行间紧凑

  // 生成所有圆的坐标
  const circles = useMemo(() => {
    const items: { x: number; y: number; row: number; col: number }[] = [];

    // 计算需要多少行才能填满高度（上下各多一行以填满边缘）
    const totalRows = Math.ceil(height / rowSpacing) + 2;
    const startRow = -1;

    for (let row = startRow; row < startRow + totalRows; row++) {
      const y = row * rowSpacing + rowSpacing / 2;
      if (y < -iconSize || y > height + iconSize) continue;

      const isOddRow = Math.abs(row) % 2 === 1; // 奇数行3个，偶数行4个

      if (!isOddRow) {
        // 偶数行：4个圆，x = colSpacing/2, 3/2, 5/2, 7/2 * colSpacing
        for (let col = 0; col < 4; col++) {
          const x = colSpacing / 2 + col * colSpacing;
          items.push({ x, y, row, col });
        }
      } else {
        // 奇数行：3个圆，居中，x = colSpacing, 2*colSpacing, 3*colSpacing
        for (let col = 0; col < 3; col++) {
          const x = colSpacing + col * colSpacing;
          items.push({ x, y, row, col });
        }
      }
    }
    return items;
  }, [width, height, colSpacing, rowSpacing, iconSize]);

  // 画布中心，用于计算距离
  const cx = width / 2;
  const cy = height / 2;

  // 最大可能距离（对角线一半）
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  // 颜色调色板
  const palette = [
    '#4A9EFF', '#FF6B6B', '#51CF66', '#FFD43B',
    '#CC5DE8', '#FF922B', '#20C997', '#F06595',
    '#74C0FC', '#A9E34B', '#FFA94D', '#DA77F2',
  ];

  const getColor = (row: number, col: number) => {
    const idx = Math.abs(row * 5 + col * 3) % palette.length;
    return palette[idx];
  };

  return (
    <div
      style={{
        ...style,
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0d0d0d 100%)',
        position: 'relative',
      }}
      {...handlers}
    >
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        {/* 从远到近排序，近的圆覆盖远的 */}
        {[...circles]
          .sort((a, b) => {
            const da = Math.sqrt((a.x - cx) ** 2 + (a.y - cy) ** 2);
            const db = Math.sqrt((b.x - cx) ** 2 + (b.y - cy) ** 2);
            return db - da;
          })
          .map(({ x, y, row, col }) => {
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            const t = dist / maxDist;

            // 缩放：中心 scale=1.0，边缘 scale=0.5
            const scale = 1.0 - t * 0.5;
            const r = (iconSize / 2) * scale;
            const color = getColor(row, col);
            const opacity = 0.95 - t * 0.4;
            const brightness = 1.0 - t * 0.25;

            return (
              <g key={`${row}-${col}`}>
                {/* 圆形主体 */}
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={color}
                  opacity={opacity}
                  style={{ filter: `brightness(${brightness})` }}
                />
                {/* 左上高光 */}
                <circle
                  cx={x - r * 0.28}
                  cy={y - r * 0.28}
                  r={r * 0.32}
                  fill="white"
                  opacity={0.18 * scale}
                />
              </g>
            );
          })}
      </svg>

      {/* 标签 */}
      <div style={{
        position: 'absolute',
        bottom: 4,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 10,
        color: 'rgba(255,255,255,0.45)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        Menu Cellular
      </div>
    </div>
  );
};
