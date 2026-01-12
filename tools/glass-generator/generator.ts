/**
 * Glass Generator - 玻璃效果生成器
 * 
 * 数据流: SVG文件 → parse_svg_paths() → svg_path_to_vector_path() → VectorPath对象
 *        → get_close_shape_alpha() → generate_close_shape_glass() → 渲染显示
 */

import * as fs from 'fs';
import { PNG } from 'pngjs';
import { 
    GlassConfig, GlassResult, DEFAULT_GLASS_CONFIG, 
    VectorPath, Command, Point, AlphaResult 
} from './types';

/** GUI头部偏移量 */
const GUI_HEADER_OFFSET = 14;

export class GlassGenerator {
    private config: GlassConfig;

    constructor(config: Partial<GlassConfig> = {}) {
        this.config = { ...DEFAULT_GLASS_CONFIG, ...config };
    }

    /**
     * 从 SVG 文件生成玻璃效果
     * 数据流: SVG文件 → parse_svg_paths() → svg_path_to_vector_path() → VectorPath对象
     *        → get_close_shape_alpha() → generate_close_shape_glass() → 渲染显示
     */
    async generateFromFile(svgPath: string, outputPath?: string): Promise<GlassResult> {
        // 1. 读取SVG文件
        const svgContent = fs.readFileSync(svgPath, 'utf-8');
        
        // 2. 解析SVG路径 → parse_svg_paths()
        const svgPathsData = this.parseSvgPaths(svgContent);
        if (svgPathsData.length === 0) {
            throw new Error('SVG文件中未找到路径数据');
        }

        // 3. 转换为VectorPath对象 → svg_path_to_vector_path()
        const vectorPath = this.svgPathToVectorPath(svgPathsData[0]);
        
        // 确保路径以end命令结束
        const lastCmd = vectorPath.commands[vectorPath.commands.length - 1];
        if (!lastCmd || lastCmd.type !== 'end') {
            vectorPath.addCommand({ type: 'end' });
        }

        // 4. 计算alpha值 → get_close_shape_alpha()
        const distortion = this.config.distortion ?? 0.05;
        const region = this.config.region ?? 1.0;
        const alphaResult = this.getCloseShapeAlpha(vectorPath, distortion, 0, region);

        // 5. 生成玻璃数据 → generate_close_shape_glass()
        const glassData = this.generateCloseShapeGlass(
            alphaResult.alpha,
            alphaResult.width,
            alphaResult.height,
            Math.floor(alphaResult.centerX),
            Math.floor(alphaResult.centerY)
        );

        // 6. 保存文件 (如果指定了输出路径)
        if (outputPath) {
            fs.writeFileSync(outputPath, glassData);
        }

        return {
            data: glassData,
            width: alphaResult.width,
            height: alphaResult.height,
            format: 'raw',
            centerX: Math.floor(alphaResult.centerX),
            centerY: Math.floor(alphaResult.centerY)
        };
    }

    /**
     * 解析SVG内容中的路径数据（支持 path 和 polygon）
     * 对应Python: parse_svg_paths()
     */
    parseSvgPaths(svgContent: string): string[] {
        const paths: string[] = [];
        
        // 解析 <path d="..."> 元素
        const pathPattern = /<path[^>]*\sd="([^"]*)"[^>]*>/gi;
        let match;
        while ((match = pathPattern.exec(svgContent)) !== null) {
            const pathData = match[1].trim();
            if (pathData) {
                paths.push(pathData);
            }
        }
        
        // 解析 <polygon points="..."> 元素
        const polygonPattern = /<polygon[^>]*\spoints="([^"]*)"[^>]*>/gi;
        while ((match = polygonPattern.exec(svgContent)) !== null) {
            const pointsData = match[1].trim();
            if (pointsData) {
                // 将 polygon points 转换为 path d 格式
                const pathD = this.polygonPointsToPathD(pointsData);
                if (pathD) {
                    paths.push(pathD);
                }
            }
        }
        
        // 解析 <polyline points="..."> 元素
        const polylinePattern = /<polyline[^>]*\spoints="([^"]*)"[^>]*>/gi;
        while ((match = polylinePattern.exec(svgContent)) !== null) {
            const pointsData = match[1].trim();
            if (pointsData) {
                // 将 polyline points 转换为 path d 格式（不闭合）
                const pathD = this.polygonPointsToPathD(pointsData, false);
                if (pathD) {
                    paths.push(pathD);
                }
            }
        }
        
        return paths;
    }

    /**
     * 将 polygon/polyline 的 points 属性转换为 path 的 d 属性格式
     * @param pointsData points 属性值，如 "100,10 40,198 190,78 10,78 160,198"
     * @param close 是否闭合路径（polygon=true, polyline=false）
     */
    private polygonPointsToPathD(pointsData: string, close: boolean = true): string | null {
        // 解析点坐标，支持多种分隔格式：
        // "x1,y1 x2,y2 x3,y3" 或 "x1 y1 x2 y2 x3 y3" 或 "x1,y1,x2,y2,x3,y3"
        const numbers = pointsData.match(/-?\d+\.?\d*/g)?.map(Number);
        if (!numbers || numbers.length < 4) return null;
        
        const points: Array<{x: number, y: number}> = [];
        for (let i = 0; i < numbers.length - 1; i += 2) {
            points.push({ x: numbers[i], y: numbers[i + 1] });
        }
        
        if (points.length < 2) return null;
        
        // 构建 path d 字符串
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x} ${points[i].y}`;
        }
        if (close) {
            d += ' Z';
        }
        
        return d;
    }

    /**
     * 将SVG路径数据转换为VectorPath对象
     * 对应Python: svg_path_to_vector_path()
     */
    svgPathToVectorPath(svgPathData: string): VectorPath {
        const vectorPath = new VectorPath();
        
        // 解析SVG路径命令: M, L, H, V, C, S, Q, T, A, Z
        const commandPattern = /([MLHVCSQTAZ])\s*([^MLHVCSQTAZ]*)/gi;
        let currentX = 0, currentY = 0;
        let match;

        while ((match = commandPattern.exec(svgPathData)) !== null) {
            const cmd = match[1].toUpperCase();
            const params = match[2].trim();
            
            if (!params && cmd !== 'Z') continue;
            
            // 解析数字参数
            const numbers = params.match(/-?\d+\.?\d*/g)?.map(Number) || [];

            switch (cmd) {
                case 'M': // Move to
                    if (numbers.length >= 2) {
                        currentX = numbers[0];
                        currentY = numbers[1];
                        vectorPath.addCommand({ type: 'move', x: currentX, y: currentY });
                    }
                    break;
                case 'L': // Line to
                    if (numbers.length >= 2) {
                        currentX = numbers[0];
                        currentY = numbers[1];
                        vectorPath.addCommand({ type: 'lineto', x: currentX, y: currentY });
                    }
                    break;
                case 'H': // Horizontal line
                    if (numbers.length >= 1) {
                        currentX = numbers[0];
                        vectorPath.addCommand({ type: 'lineto', x: currentX, y: currentY });
                    }
                    break;
                case 'V': // Vertical line
                    if (numbers.length >= 1) {
                        currentY = numbers[0];
                        vectorPath.addCommand({ type: 'lineto', x: currentX, y: currentY });
                    }
                    break;
                case 'C': // Cubic Bezier
                    if (numbers.length >= 6) {
                        const [x1, y1, x2, y2, x, y] = numbers;
                        currentX = x;
                        currentY = y;
                        vectorPath.addCommand({ type: 'cubicto', x1, y1, x2, y2, x, y });
                    }
                    break;
                case 'Q': // Quadratic Bezier
                    if (numbers.length >= 4) {
                        const [x1, y1, x, y] = numbers;
                        currentX = x;
                        currentY = y;
                        vectorPath.addCommand({ type: 'quadto', x1, y1, x, y });
                    }
                    break;
                case 'Z': // Close path
                    vectorPath.addCommand({ type: 'end' });
                    break;
            }
        }

        return vectorPath;
    }

    /**
     * 获取闭合形状的alpha值数组
     * 对应Python: get_close_shape_alpha()
     */
    getCloseShapeAlpha(path: VectorPath, maxRatio: number, padding: number = 0, region: number = 1.0): AlphaResult {
        const pathPoints = path.getAllPoints();
        if (pathPoints.length < 3) {
            return { alpha: [], width: 0, height: 0, centerX: 0, centerY: 0 };
        }

        // 获取边界框
        const bbox = path.getBoundingBox();
        if (bbox.maxX === bbox.minX || bbox.maxY === bbox.minY) {
            return { alpha: [], width: 0, height: 0, centerX: 0, centerY: 0 };
        }

        // 计算形状尺寸
        const shapeWidth = Math.floor(bbox.maxX - bbox.minX + 2 * padding);
        const shapeHeight = Math.floor(bbox.maxY - bbox.minY + 2 * padding);
        if (shapeWidth <= 0 || shapeHeight <= 0) {
            return { alpha: [], width: 0, height: 0, centerX: 0, centerY: 0 };
        }

        // 计算偏移
        const offsetX = -bbox.minX + padding;
        const offsetY = -bbox.minY + padding;

        // 转换点到新坐标系并计算中心
        const screenPoints: Point[] = [];
        let centerXSum = 0, centerYSum = 0;
        for (const point of pathPoints) {
            const x = point.x + offsetX;
            const y = point.y + offsetY;
            centerXSum += x;
            centerYSum += y;
            screenPoints.push({ x: Math.floor(x), y: Math.floor(y) });
        }

        const centerX = centerXSum / pathPoints.length;
        const centerY = centerYSum / pathPoints.length;

        // 创建alpha数组
        const alpha: number[][] = Array.from({ length: shapeHeight }, () => 
            Array(shapeWidth).fill(0)
        );

        // 遍历每个像素
        for (let y = 0; y < shapeHeight; y++) {
            for (let x = 0; x < shapeWidth; x++) {
                // 检查点是否在多边形内
                if (!this.pointInPolygon(x, y, screenPoints)) continue;

                // 计算从中心到边界的距离
                const dx = x - centerX;
                const dy = y - centerY;
                const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

                // 计算射线与多边形边界的交点距离
                const boundaryDistance = this.rayPolygonIntersectionDistance(
                    centerX, centerY, dx, dy, screenPoints
                );

                if (boundaryDistance <= 1e-10) continue;

                // 计算距离比例
                const threshold = boundaryDistance * (1 - region);
                if (distanceFromCenter > threshold) {
                    const distanceRatio = Math.min(
                        (distanceFromCenter - threshold) / (boundaryDistance * region),
                        1.0
                    );
                    // alpha = maxRatio * f(distanceRatio)
                    const t = distanceRatio;
                    alpha[y][x] = maxRatio * (5.5 * t * t - 2 * t * t * t);
                }
            }
        }

        return { alpha, width: shapeWidth, height: shapeHeight, centerX, centerY };
    }

    /**
     * 生成闭合形状的玻璃数据
     * 对应Python: generate_close_shape_glass()
     */
    generateCloseShapeGlass(
        distortion: number[][], 
        width: number, 
        height: number, 
        centerX: number, 
        centerY: number
    ): Buffer {
        const output = Buffer.alloc(width * height * 2 + GUI_HEADER_OFFSET);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                const ratio = distortion[y]?.[x] ?? 0;
                const offsetX = Math.floor(-dx * ratio);
                const offsetY = Math.floor(-dy * ratio);

                const absolutePos = (y * width + x) * 2 + GUI_HEADER_OFFSET;
                // 写入有符号8位整数
                output.writeInt8(Math.max(-128, Math.min(127, offsetX)), absolutePos);
                output.writeInt8(Math.max(-128, Math.min(127, offsetY)), absolutePos + 1);
            }
        }

        // 设置头部信息
        output[0] = 0x00;
        output[1] = 0x88;
        output[2] = 0x9A;
        output[3] = 0x01;
        output[4] = 0xF6;
        output[5] = 0x01;
        output[6] = 0x00;
        output[7] = 0x00;
        output[8] = 0;
        output[9] = 0;

        // 设置宽度和高度 (uint16)
        output.writeUInt16LE(width, 2);
        output.writeUInt16LE(height, 4);
        output.writeUInt16LE(centerX, 10);
        output.writeUInt16LE(centerY, 12);

        return output;
    }

    /**
     * 判断点是否在多边形内部 (射线投射算法)
     */
    private pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
        let inside = false;
        const n = polygon.length;
        
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    /**
     * 计算从中心点沿指定方向到多边形边界的距离
     */
    private rayPolygonIntersectionDistance(
        centerX: number, centerY: number,
        dirX: number, dirY: number,
        polygon: Point[]
    ): number {
        const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
        if (dirLength < 1e-10) return 1.0;

        const normDirX = dirX / dirLength;
        const normDirY = dirY / dirLength;
        let minDistance = Infinity;
        const n = polygon.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const x1 = polygon[i].x, y1 = polygon[i].y;
            const x2 = polygon[j].x, y2 = polygon[j].y;

            const edgeX = x2 - x1;
            const edgeY = y2 - y1;
            const toEdgeX = x1 - centerX;
            const toEdgeY = y1 - centerY;

            // 叉积
            const cross = normDirX * edgeY - normDirY * edgeX;
            if (Math.abs(cross) < 1e-10) continue;

            const t = (toEdgeX * edgeY - toEdgeY * edgeX) / cross;
            const s = (toEdgeX * normDirY - toEdgeY * normDirX) / cross;

            if (t > 1e-10 && s >= 0 && s <= 1) {
                minDistance = Math.min(minDistance, t);
            }
        }

        return minDistance === Infinity ? 1.0 : minDistance;
    }

    /**
     * 更新配置
     */
    setConfig(config: Partial<GlassConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * 获取当前配置
     */
    getConfig(): GlassConfig {
        return { ...this.config };
    }

    /**
     * 将玻璃效果渲染到背景图片上，返回 base64 图片数据
     * 输出范围限制为 SVG 矢量图形的边界
     * @param glassData 玻璃数据 Buffer
     * @param bgImagePath 背景图片路径
     * @param centerX 玻璃中心X坐标
     * @param centerY 玻璃中心Y坐标
     */
    async renderGlassOnBackground(
        glassData: Buffer,
        bgImagePath: string,
        centerX?: number,
        centerY?: number
    ): Promise<{ base64: string; width: number; height: number }> {
        const fs = await import('fs');

        // 读取背景图片
        const bgBuffer = fs.readFileSync(bgImagePath);
        
        // 解析 PNG 图片获取 RGBA 数据
        const { width: bgWidth, height: bgHeight, data: bgData } = await this.decodePng(bgBuffer);

        // 解析玻璃数据头部
        const glassWidth = glassData.readUInt16LE(2);
        const glassHeight = glassData.readUInt16LE(4);

        // 计算玻璃效果在背景上的位置
        const GUI_HEADER_OFFSET = 14;
        const shapeCenterX = centerX ?? Math.floor(bgWidth / 2);
        const shapeCenterY = centerY ?? Math.floor(bgHeight / 2);

        // 计算输出图片的边界（限制为玻璃区域）
        const outputX = Math.max(0, shapeCenterX - Math.floor(glassWidth / 2));
        const outputY = Math.max(0, shapeCenterY - Math.floor(glassHeight / 2));
        const outputWidth = Math.min(glassWidth, bgWidth - outputX);
        const outputHeight = Math.min(glassHeight, bgHeight - outputY);

        // 创建输出数据（只包含玻璃区域）
        const outputData = Buffer.alloc(outputWidth * outputHeight * 4);

        // 先复制背景区域
        for (let y = 0; y < outputHeight; y++) {
            for (let x = 0; x < outputWidth; x++) {
                const bgX = outputX + x;
                const bgY = outputY + y;
                const srcIdx = (bgY * bgWidth + bgX) * 4;
                const dstIdx = (y * outputWidth + x) * 4;
                outputData[dstIdx] = bgData[srcIdx];
                outputData[dstIdx + 1] = bgData[srcIdx + 1];
                outputData[dstIdx + 2] = bgData[srcIdx + 2];
                outputData[dstIdx + 3] = bgData[srcIdx + 3];
            }
        }

        // 应用玻璃效果
        for (let y = 0; y < glassHeight; y++) {
            const yRelative = y + shapeCenterY - Math.floor(glassHeight / 2);
            for (let x = 0; x < glassWidth; x++) {
                const xRelative = x + shapeCenterX - Math.floor(glassWidth / 2);

                // 获取玻璃偏移数据
                const glassPos = (y * glassWidth + x) * 2 + GUI_HEADER_OFFSET;
                const offsetX = glassData.readInt8(glassPos);
                const offsetY = glassData.readInt8(glassPos + 1);

                // 计算源位置（从背景取像素）
                const srcX = xRelative + offsetX;
                const srcY = yRelative + offsetY;

                // 边界检查
                if (srcX < 0 || srcX >= bgWidth || srcY < 0 || srcY >= bgHeight) continue;
                if (xRelative < outputX || xRelative >= outputX + outputWidth) continue;
                if (yRelative < outputY || yRelative >= outputY + outputHeight) continue;

                // 计算在输出图片中的位置
                const outX = xRelative - outputX;
                const outY = yRelative - outputY;

                // 应用像素偏移
                const srcIdx = (srcY * bgWidth + srcX) * 4;
                const dstIdx = (outY * outputWidth + outX) * 4;
                outputData[dstIdx] = bgData[srcIdx];         // R
                outputData[dstIdx + 1] = bgData[srcIdx + 1]; // G
                outputData[dstIdx + 2] = bgData[srcIdx + 2]; // B
                outputData[dstIdx + 3] = bgData[srcIdx + 3]; // A
            }
        }

        // 编码为 PNG 并转换为 base64
        const pngBuffer = await this.encodePng(outputData, outputWidth, outputHeight);
        const base64 = pngBuffer.toString('base64');

        return { base64: `data:image/png;base64,${base64}`, width: outputWidth, height: outputHeight };
    }

    /**
     * 从 SVG 文件生成预览图片
     */
    async generatePreview(svgPath: string, bgImagePath: string): Promise<{ base64: string; width: number; height: number }> {
        // 生成玻璃数据
        const result = await this.generateFromFile(svgPath);
        
        // 渲染到背景上
        return this.renderGlassOnBackground(
            result.data,
            bgImagePath,
            result.centerX,
            result.centerY
        );
    }

    /**
     * 简单的 PNG 解码器（使用 pngjs）
     */
    private async decodePng(buffer: Buffer): Promise<{ width: number; height: number; data: Buffer }> {
        return new Promise((resolve, reject) => {
            const png = new PNG();
            png.parse(buffer, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({
                    width: data.width,
                    height: data.height,
                    data: Buffer.from(data.data)
                });
            });
        });
    }

    /**
     * PNG 编码器（使用 pngjs）
     */
    private async encodePng(data: Buffer, width: number, height: number): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const png = new PNG({ width, height });
            png.data = data;
            
            const chunks: Buffer[] = [];
            png.pack()
                .on('data', (chunk: Buffer) => chunks.push(chunk))
                .on('end', () => resolve(Buffer.concat(chunks)))
                .on('error', reject);
        });
    }
}
