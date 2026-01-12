/**
 * Glass Generator Types
 * 玻璃效果生成器类型定义
 */

/**
 * 二维坐标点
 */
export interface Point {
    x: number;
    y: number;
}

/**
 * 路径命令类型
 */
export type PathCommandType = 'move' | 'lineto' | 'quadto' | 'cubicto' | 'bezierto' | 'end';

/**
 * 路径命令基类
 */
export interface PathCommand {
    type: PathCommandType;
}

export interface MoveCommand extends PathCommand {
    type: 'move';
    x: number;
    y: number;
}

export interface LineToCommand extends PathCommand {
    type: 'lineto';
    x: number;
    y: number;
}

export interface QuadToCommand extends PathCommand {
    type: 'quadto';
    x1: number;
    y1: number;
    x: number;
    y: number;
}

export interface CubicToCommand extends PathCommand {
    type: 'cubicto';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x: number;
    y: number;
}

export interface BezierToCommand extends PathCommand {
    type: 'bezierto';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x: number;
    y: number;
}

export interface EndCommand extends PathCommand {
    type: 'end';
}

export type Command = MoveCommand | LineToCommand | QuadToCommand | CubicToCommand | BezierToCommand | EndCommand;

/**
 * 矢量路径类
 */
export class VectorPath {
    commands: Command[] = [];

    addCommand(command: Command): void {
        this.commands.push(command);
    }

    /**
     * 获取路径的边界框
     */
    getBoundingBox(): { minX: number; minY: number; maxX: number; maxY: number } {
        const points = this.getAllPoints();
        if (points.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of points) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }
        return { minX, minY, maxX, maxY };
    }

    /**
     * 获取路径上的所有采样点
     */
    getAllPoints(): Point[] {
        const points: Point[] = [];
        let currentPoint: Point | null = null;

        for (const cmd of this.commands) {
            if (cmd.type === 'move') {
                currentPoint = { x: cmd.x, y: cmd.y };
                points.push(currentPoint);
            } else if (cmd.type === 'lineto') {
                if (!currentPoint) continue;
                points.push({ x: cmd.x, y: cmd.y });
                currentPoint = { x: cmd.x, y: cmd.y };
            } else if (cmd.type === 'quadto') {
                if (!currentPoint) continue;
                const sampled = this.sampleQuadraticCurve(
                    currentPoint,
                    { x: cmd.x1, y: cmd.y1 },
                    { x: cmd.x, y: cmd.y },
                    100
                );
                points.push(...sampled.slice(1));
                currentPoint = { x: cmd.x, y: cmd.y };
            } else if (cmd.type === 'cubicto' || cmd.type === 'bezierto') {
                if (!currentPoint) continue;
                const sampled = this.sampleCubicCurve(
                    currentPoint,
                    { x: cmd.x1, y: cmd.y1 },
                    { x: cmd.x2, y: cmd.y2 },
                    { x: cmd.x, y: cmd.y },
                    100
                );
                points.push(...sampled.slice(1));
                currentPoint = { x: cmd.x, y: cmd.y };
            }
        }
        return points;
    }

    /**
     * 采样二次贝塞尔曲线
     */
    private sampleQuadraticCurve(p0: Point, p1: Point, p2: Point, numSamples: number): Point[] {
        const points: Point[] = [];
        for (let i = 0; i <= numSamples; i++) {
            const t = i / numSamples;
            const x = (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x;
            const y = (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y;
            points.push({ x, y });
        }
        return points;
    }

    /**
     * 采样三次贝塞尔曲线
     */
    private sampleCubicCurve(p0: Point, p1: Point, p2: Point, p3: Point, numSamples: number): Point[] {
        const points: Point[] = [];
        for (let i = 0; i <= numSamples; i++) {
            const t = i / numSamples;
            const x = (1 - t) ** 3 * p0.x + 3 * (1 - t) ** 2 * t * p1.x + 3 * (1 - t) * t ** 2 * p2.x + t ** 3 * p3.x;
            const y = (1 - t) ** 3 * p0.y + 3 * (1 - t) ** 2 * t * p1.y + 3 * (1 - t) * t ** 2 * p2.y + t ** 3 * p3.y;
            points.push({ x, y });
        }
        return points;
    }

    /**
     * 验证路径的有效性
     */
    validate(): { valid: boolean; message: string } {
        if (this.commands.length === 0) {
            return { valid: false, message: '路径为空' };
        }
        if (this.commands[0].type !== 'move') {
            return { valid: false, message: '路径必须以move命令开始' };
        }
        if (this.commands[this.commands.length - 1].type !== 'end') {
            return { valid: false, message: '路径必须以end命令结束' };
        }
        return { valid: true, message: '' };
    }
}

/**
 * 玻璃生成配置
 */
export interface GlassConfig {
    /** 效果区域 (0-100%) */
    blurRadius: number;
    /** 效果强度 (0-100%) */
    blurIntensity: number;
    /** 输出宽度 */
    width?: number;
    /** 输出高度 */
    height?: number;
    /** 背景颜色 (可选) */
    backgroundColor?: string;
    /** 效果区域 (0-1) */
    region?: number;
    /** 扭曲强度 (0-1) */
    distortion?: number;
}

/**
 * 默认配置
 */
export const DEFAULT_GLASS_CONFIG: GlassConfig = {
    blurRadius: 50,
    blurIntensity: 50,
    region: 1.0,
    distortion: 0.05,
};

/**
 * 生成结果
 */
export interface GlassResult {
    /** 输出数据 (Buffer 或 base64) */
    data: Buffer;
    /** 宽度 */
    width: number;
    /** 高度 */
    height: number;
    /** 格式 */
    format: 'png' | 'raw';
    /** 中心X坐标 */
    centerX?: number;
    /** 中心Y坐标 */
    centerY?: number;
}

/**
 * Alpha值计算结果
 */
export interface AlphaResult {
    /** alpha值二维数组 */
    alpha: number[][];
    /** 宽度 */
    width: number;
    /** 高度 */
    height: number;
    /** 中心X坐标 */
    centerX: number;
    /** 中心Y坐标 */
    centerY: number;
}
