/**
 * Figma 节点 → HML 转换器 (Figma Plugin API 版本)
 * 使用 Figma Plugin API 直接访问节点数据
 */

// ==================== 工具函数 ====================

/** RGBA → #RRGGBB */
function rgbaToHex(r: number, g: number, b: number): string {
    const ri = Math.round(r * 255);
    const gi = Math.round(g * 255);
    const bi = Math.round(b * 255);
    return `#${ri.toString(16).padStart(2, '0')}${gi.toString(16).padStart(2, '0')}${bi.toString(16).padStart(2, '0')}`;
}

/** opacity 0-1 → 0-255 */
function toOpacity255(v: number): number {
    return Math.round(v * 255);
}

/** 名称 → 合法 HML id */
function sanitizeId(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 40) || 'node';
}

function ensureUniqueId(id: string, usedIds: Set<string>): string {
    let uid = id;
    let i = 1;
    while (usedIds.has(uid)) { uid = `${id}_${i++}`; }
    usedIds.add(uid);
    return uid;
}

/** XML 转义 */
function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 获取第一个可见纯色填充 */
function getSolidFill(paints: readonly Paint[] | typeof figma.mixed | undefined): RGB | null {
    if (!paints || paints === figma.mixed) return null;
    for (let i = paints.length - 1; i >= 0; i--) {
        const p = paints[i];
        if (p.type === 'SOLID' && p.visible !== false) {
            return p.color;
        }
    }
    return null;
}

/** 检查是否有图片填充 */
function hasImageFill(paints: readonly Paint[] | typeof figma.mixed | undefined): boolean {
    if (!paints || paints === figma.mixed) return false;
    return paints.some((p) => p.type === 'IMAGE' && p.visible !== false);
}

/** 检查是否有渐变 */
function hasGradient(paints: readonly Paint[] | typeof figma.mixed | undefined): boolean {
    if (!paints || paints === figma.mixed) return false;
    return paints.some(
        (p) =>
            p.visible !== false &&
            (p.type === 'GRADIENT_LINEAR' ||
                p.type === 'GRADIENT_RADIAL' ||
                p.type === 'GRADIENT_ANGULAR' ||
                p.type === 'GRADIENT_DIAMOND')
    );
}

// ==================== 类型定义 ====================

interface HmlNode {
    tag: string;
    attrs: Record<string, string | number | boolean>;
    children: HmlNode[];
}

interface ConvertContext {
    usedIds: Set<string>;
    imageNodeIds: string[];        // 需要导出为图片的节点 ID
    imageFileNames: Map<string, string>; // nodeId → 文件名
    warnings: string[];
    defaultFont: string;
    zCounter: number;
}

export interface ConvertResult {
    hmlContent: string;
    projectJson: string;
    mainHmlFile: string;
    imageNodeIds: string[];
    imageFileMap: Record<string, string>;
    stats: {
        viewCount: number;
        nodeCount: number;
        imageCount: number;
    };
    warnings: string[];
}

// ==================== 节点转换 ====================

/**
 * 注册节点为需导出的图片，返回 HML 路径
 */
function registerImageExport(node: SceneNode, ctx: ConvertContext, nameHint?: string): string {
    const name = nameHint || sanitizeId(node.name);
    const fileName = `${ensureUniqueId(name, new Set(ctx.imageFileNames.values()))}.png`;
    ctx.imageNodeIds.push(node.id);
    ctx.imageFileNames.set(node.id, fileName);
    return `assets/${fileName}`;
}

/**
 * 是否应该把节点整体导出为图片
 */
function shouldFlattenAsImage(node: SceneNode): boolean {
    const flattenTypes = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'REGULAR_POLYGON']);
    return flattenTypes.has(node.type);
}

/**
 * 转换文本节点 → hg_label
 */
function convertText(node: TextNode, parentPos: { x: number; y: number }, ctx: ConvertContext): HmlNode {
    const id = ensureUniqueId(sanitizeId(node.name), ctx.usedIds);
    const x = Math.round(node.x);
    const y = Math.round(node.y);
    const w = Math.round(node.width);
    const h = Math.round(node.height);

    const attrs: Record<string, string | number | boolean> = {
        id, x, y, width: w, height: h, zIndex: ctx.zCounter++,
    };

    // 文本内容
    attrs.text = node.characters || 'Text';

    // 字体大小
    const fontSize = node.fontSize;
    if (fontSize !== figma.mixed && typeof fontSize === 'number') {
        attrs.fontSize = Math.round(fontSize);
    }

    // 水平对齐
    const hAlignMap: Record<string, string> = {
        LEFT: 'LEFT', CENTER: 'CENTER', RIGHT: 'RIGHT', JUSTIFIED: 'LEFT',
    };
    if (node.textAlignHorizontal) {
        attrs.hAlign = hAlignMap[node.textAlignHorizontal] || 'LEFT';
    }

    // 垂直对齐
    const vAlignMap: Record<string, string> = {
        TOP: 'TOP', CENTER: 'MID', BOTTOM: 'MID',
    };
    if (node.textAlignVertical) {
        attrs.vAlign = vAlignMap[node.textAlignVertical] || 'TOP';
    }

    // 字间距
    const ls = node.letterSpacing;
    if (ls !== figma.mixed && typeof ls === 'object' && ls.value !== 0) {
        attrs.letterSpacing = Math.round(ls.value);
    }

    // 文本颜色
    const fills = node.fills;
    const color = getSolidFill(fills);
    if (color) {
        attrs.color = rgbaToHex(color.r, color.g, color.b);
    }

    // 字体文件
    attrs.fontFile = `/${ctx.defaultFont}`;

    // 换行
    if (node.characters.includes('\n') || node.textAutoResize === 'HEIGHT') {
        attrs.wordWrap = true;
    }

    if (node.visible === false) attrs.visible = false;

    return { tag: 'hg_label', attrs, children: [] };
}

/**
 * 转换椭圆 → hg_circle
 */
function convertEllipse(node: EllipseNode, ctx: ConvertContext): HmlNode {
    const id = ensureUniqueId(sanitizeId(node.name), ctx.usedIds);
    const w = Math.round(node.width);
    const h = Math.round(node.height);

    const attrs: Record<string, string | number | boolean> = {
        id,
        x: Math.round(node.x),
        y: Math.round(node.y),
        width: w,
        height: h,
        zIndex: ctx.zCounter++,
        radius: Math.round(Math.min(w, h) / 2),
    };

    const fill = getSolidFill(node.fills);
    if (fill) attrs.fillColor = rgbaToHex(fill.r, fill.g, fill.b);
    if (node.opacity < 1) attrs.opacity = toOpacity255(node.opacity);
    if (hasGradient(node.fills)) { attrs.useGradient = true; attrs.gradientType = 'radial'; }
    if (node.visible === false) attrs.visible = false;

    return { tag: 'hg_circle', attrs, children: [] };
}

/**
 * 转换矩形 → hg_rect 或 hg_image
 */
function convertRectangle(node: RectangleNode, ctx: ConvertContext): HmlNode {
    const id = ensureUniqueId(sanitizeId(node.name), ctx.usedIds);
    const attrs: Record<string, string | number | boolean> = {
        id,
        x: Math.round(node.x),
        y: Math.round(node.y),
        width: Math.round(node.width),
        height: Math.round(node.height),
        zIndex: ctx.zCounter++,
    };

    // 如果有图片填充 → hg_image
    if (hasImageFill(node.fills)) {
        const src = registerImageExport(node, ctx, id);
        attrs.src = src;
        if (node.opacity < 1) attrs.transform = JSON.stringify({ opacity: toOpacity255(node.opacity) });
        if (node.visible === false) attrs.visible = false;
        return { tag: 'hg_image', attrs, children: [] };
    }

    // 普通矩形 → hg_rect
    if (node.cornerRadius !== figma.mixed && node.cornerRadius > 0) {
        attrs.borderRadius = Math.round(node.cornerRadius as number);
    }
    const fill = getSolidFill(node.fills);
    if (fill) attrs.fillColor = rgbaToHex(fill.r, fill.g, fill.b);
    if (node.opacity < 1) attrs.opacity = toOpacity255(node.opacity);
    if (hasGradient(node.fills)) {
        attrs.useGradient = true;
        attrs.gradientDirection = 'horizontal';
    }
    if (node.visible === false) attrs.visible = false;

    return { tag: 'hg_rect', attrs, children: [] };
}

/**
 * 转换为 hg_image (矢量导出)
 */
function convertAsImage(node: SceneNode, ctx: ConvertContext): HmlNode {
    const id = ensureUniqueId(sanitizeId(node.name), ctx.usedIds);
    const src = registerImageExport(node, ctx, id);

    const attrs: Record<string, string | number | boolean> = {
        id,
        x: Math.round(node.x),
        y: Math.round(node.y),
        width: Math.round(node.width),
        height: Math.round(node.height),
        zIndex: ctx.zCounter++,
        src,
    };

    if (node.opacity < 1) attrs.transform = JSON.stringify({ opacity: toOpacity255(node.opacity) });
    if (node.visible === false) attrs.visible = false;

    return { tag: 'hg_image', attrs, children: [] };
}

/**
 * 转换容器节点 (FRAME/GROUP/COMPONENT/INSTANCE) → hg_window
 */
function convertContainer(
    node: FrameNode | GroupNode | ComponentNode | InstanceNode | ComponentSetNode,
    ctx: ConvertContext
): HmlNode {
    const id = ensureUniqueId(sanitizeId(node.name), ctx.usedIds);
    const attrs: Record<string, string | number | boolean> = {
        id,
        x: Math.round(node.x),
        y: Math.round(node.y),
        width: Math.round(node.width),
        height: Math.round(node.height),
        zIndex: ctx.zCounter++,
    };

    // 背景
    const isFrame = node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE';
    if (isFrame) {
        const fillNode = node as FrameNode;
        if (hasImageFill(fillNode.fills)) {
            // 有图片背景 → 添加一个 hg_image 子节点作为背景
        } else {
            const bg = getSolidFill(fillNode.fills);
            if (bg) {
                attrs.backgroundColor = rgbaToHex(bg.r, bg.g, bg.b);
                attrs.showBackground = true;
            }
        }
    }

    if (node.opacity < 1) attrs.opacity = toOpacity255(node.opacity);
    if (node.visible === false) attrs.visible = false;

    // 递归子节点
    const savedZ = ctx.zCounter;
    ctx.zCounter = 0;
    const children: HmlNode[] = [];

    // 如果有图片背景，先加一个背景 image
    if (isFrame && hasImageFill((node as FrameNode).fills)) {
        const bgId = ensureUniqueId(`${id}_bg`, ctx.usedIds);
        const bgSrc = registerImageExport(node, ctx, bgId);
        children.push({
            tag: 'hg_image',
            attrs: {
                id: bgId, x: 0, y: 0,
                width: Math.round(node.width), height: Math.round(node.height),
                zIndex: ctx.zCounter++, src: bgSrc,
            },
            children: [],
        });
    }

    if ('children' in node && node.children) {
        for (const child of node.children) {
            const converted = convertSceneNode(child as SceneNode, ctx);
            if (converted) children.push(converted);
        }
    }

    ctx.zCounter = savedZ;

    return { tag: 'hg_window', attrs, children };
}

/**
 * 转换任意 SceneNode
 */
function convertSceneNode(node: SceneNode, ctx: ConvertContext): HmlNode | null {
    if (node.visible === false) return null;
    if (node.type === 'SLICE') return null;

    if (shouldFlattenAsImage(node)) {
        return convertAsImage(node, ctx);
    }

    switch (node.type) {
        case 'TEXT':
            return convertText(node as TextNode, { x: 0, y: 0 }, ctx);
        case 'ELLIPSE':
            return convertEllipse(node as EllipseNode, ctx);
        case 'RECTANGLE':
            return convertRectangle(node as RectangleNode, ctx);
        case 'FRAME':
        case 'GROUP':
        case 'COMPONENT':
        case 'COMPONENT_SET':
        case 'INSTANCE':
            return convertContainer(node as any, ctx);
        default:
            // 其他类型尝试导出为图片
            ctx.warnings.push(`Node "${node.name}" (${node.type}) exported as image`);
            return convertAsImage(node, ctx);
    }
}

// ==================== HML 序列化 ====================

function serializeNode(node: HmlNode, depth: number): string {
    const indent = '    '.repeat(depth);
    const attrParts: string[] = [];

    for (const [k, v] of Object.entries(node.attrs)) {
        if (v === undefined || v === null) continue;
        if (typeof v === 'string') {
            attrParts.push(`${k}="${escapeXml(v)}"`);
        } else {
            attrParts.push(`${k}="${v}"`);
        }
    }

    const attrStr = attrParts.join(' ');

    if (node.children.length === 0) {
        return `${indent}<${node.tag} ${attrStr} />`;
    }

    const lines = [`${indent}<${node.tag} ${attrStr}>`];
    for (const child of node.children) {
        lines.push(serializeNode(child, depth + 1));
    }
    lines.push(`${indent}</${node.tag}>`);
    return lines.join('\n');
}

function parseResolution(resolution: string): { width: number; height: number; hml: string; project: string } {
    const match = resolution.trim().match(/^(\d+)\s*[xX]\s*(\d+)$/);
    const width = match ? Number(match[1]) : 454;
    const height = match ? Number(match[2]) : 454;
    return {
        width,
        height,
        hml: `${width}x${height}`,
        project: `${width}X${height}`,
    };
}

function sanitizeProjectBaseName(name: string): string {
    const value = name.replace(/[^a-zA-Z0-9_]/g, '');
    return value || 'Project';
}

// ==================== 主入口 ====================

export function convertPageToHml(
    frames: SceneNode[],
    opts: {
        projectName: string;
        resolution: string;
        pixelMode: string;
        defaultFont: string;
    }
): ConvertResult {
    const ctx: ConvertContext = {
        usedIds: new Set(),
        imageNodeIds: [],
        imageFileNames: new Map(),
        warnings: [],
        defaultFont: opts.defaultFont,
        zCounter: 0,
    };

    const resolution = parseResolution(opts.resolution);
    const resW = resolution.width;
    const resH = resolution.height;
    const projectBaseName = sanitizeProjectBaseName(opts.projectName);
    const mainHmlFile = `ui/${projectBaseName}Main.hml`;
    const views: HmlNode[] = [];

    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const viewId = ensureUniqueId('view_' + sanitizeId(frame.name), ctx.usedIds);
        const isEntry = i === 0;

        const viewAttrs: Record<string, string | number | boolean> = {
            id: viewId,
            name: frame.name,
            x: Math.round(frame.x), y: Math.round(frame.y),
            width: resW, height: resH,
        };
        if (isEntry) viewAttrs.entry = true;

        // 背景色
        if ('fills' in frame) {
            const bg = getSolidFill((frame as FrameNode).fills);
            if (bg) viewAttrs.backgroundColor = rgbaToHex(bg.r, bg.g, bg.b);
        }

        // 转换子节点
        ctx.zCounter = 0;
        const children: HmlNode[] = [];

        // 图片背景
        if ('fills' in frame && hasImageFill((frame as FrameNode).fills)) {
            const bgId = ensureUniqueId(`${viewId}_bg`, ctx.usedIds);
            const bgSrc = registerImageExport(frame, ctx, bgId);
            children.push({
                tag: 'hg_image',
                attrs: { id: bgId, x: 0, y: 0, width: resW, height: resH, zIndex: ctx.zCounter++, src: bgSrc },
                children: [],
            });
        }

        if ('children' in frame) {
            for (const child of (frame as FrameNode).children) {
                const converted = convertSceneNode(child as SceneNode, ctx);
                if (converted) children.push(converted);
            }
        }

        views.push({ tag: 'hg_view', attrs: viewAttrs, children });
    }

    // 序列化 HML
    const hmlLines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<hml>',
        '    <meta>',
        `        <project name="${escapeXml(opts.projectName)}" appId="com.honeygui.${sanitizeId(opts.projectName)}"`,
        `                 resolution="${resolution.hml}" pixelMode="${opts.pixelMode}" />`,
        '    </meta>',
        '    <view>',
    ];
    for (const v of views) {
        hmlLines.push(serializeNode(v, 2));
    }
    hmlLines.push('    </view>');
    hmlLines.push('</hml>');

    const hmlContent = hmlLines.join('\n');

    // project.json
    const projectJson = JSON.stringify({
        $schema: 'HoneyGUI',
        type: 'Designer',
        version: '1.0.0',
        name: opts.projectName,
        appId: `com.honeygui.${sanitizeId(opts.projectName)}`,
        resolution: resolution.project,
        cornerRadius: 20,
        targetEngine: 'honeygui',
        minSdk: 'API 2: HoneyGUI V1.1.0',
        pixelMode: opts.pixelMode,
        mainHmlFile,
        romfsBaseAddr: '0x704D1000',
        created: new Date().toISOString(),
    }, null, 2);

    const imageFileMap: Record<string, string> = {};
    for (const [nodeId, fileName] of ctx.imageFileNames.entries()) {
        imageFileMap[nodeId] = fileName;
    }

    return {
        hmlContent,
        projectJson,
        mainHmlFile,
        imageNodeIds: ctx.imageNodeIds,
        imageFileMap,
        stats: {
            viewCount: views.length,
            nodeCount: ctx.usedIds.size,
            imageCount: ctx.imageNodeIds.length,
        },
        warnings: ctx.warnings,
    };
}
