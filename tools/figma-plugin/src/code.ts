/**
 * Figma Plugin 后端入口
 * 运行在 Figma 沙箱环境，可访问 Figma Plugin API
 */

import { convertPageToHml } from './converter';
import { exportNodeImages } from './image-exporter';

// 显示 UI
figma.showUI(__html__, {
    width: 480,
    height: 560,
    title: 'Export to HML',
    themeColors: true,
});

/**
 * 获取当前文件的 page 列表
 */
function getPageList(): Array<{ id: string; name: string; childCount: number }> {
    return figma.root.children.map((page) => ({
        id: page.id,
        name: page.name,
        childCount: page.children.length,
    }));
}

/**
 * 获取指定 page 的顶层 frame 列表
 */
function getFrameList(
    pageId: string
): Array<{ id: string; name: string; width: number; height: number }> {
    const page = figma.root.children.find((p) => p.id === pageId);
    if (!page) return [];

    return page.children
        .filter(
            (node) =>
                node.type === 'FRAME' ||
                node.type === 'COMPONENT' ||
                node.type === 'COMPONENT_SET'
        )
        .map((node) => ({
            id: node.id,
            name: node.name,
            width: Math.round(node.width),
            height: Math.round(node.height),
        }));
}

/**
 * 执行导出
 */
async function doExport(msg: {
    pageId: string;
    frameIds: string[];
    projectName: string;
    resolution: string;
    pixelMode: string;
    imageFormat: 'PNG' | 'JPG';
    imageScale: number;
    defaultFont: string;
    exportImages: boolean;
    exportInteractions: boolean;
}): Promise<void> {
    try {
        figma.ui.postMessage({ type: 'export-progress', step: 'converting', progress: 0 });

        // 1. 找到 page
        const page = figma.root.children.find((p) => p.id === msg.pageId);
        if (!page) {
            throw new Error(`Page not found: ${msg.pageId}`);
        }

        // 2. 筛选 frame
        let frames: SceneNode[];
        if (msg.frameIds.length > 0) {
            frames = page.children.filter((n) => msg.frameIds.includes(n.id)) as SceneNode[];
        } else {
            frames = page.children.filter(
                (n) =>
                    n.type === 'FRAME' ||
                    n.type === 'COMPONENT' ||
                    n.type === 'COMPONENT_SET'
            ) as SceneNode[];
        }

        if (frames.length === 0) {
            throw new Error('No frames found to export');
        }

        figma.ui.postMessage({ type: 'export-progress', step: 'converting', progress: 10 });

        // 3. 转换为 HML
        const result = convertPageToHml(frames, {
            projectName: msg.projectName,
            resolution: msg.resolution,
            pixelMode: msg.pixelMode,
            defaultFont: msg.defaultFont,
            exportInteractions: msg.exportInteractions,
        });

        figma.ui.postMessage({ type: 'export-progress', step: 'exporting-images', progress: 40 });

        // 4. 导出图片资源
        let imageDataMap: Record<string, Uint8Array> = {};
        if (msg.exportImages && result.imageNodeIds.length > 0) {
            imageDataMap = await exportNodeImages(
                result.imageNodeIds,
                msg.imageFormat,
                msg.imageScale,
                (current, total) => {
                    const progress = 40 + Math.round((current / total) * 50);
                    figma.ui.postMessage({
                        type: 'export-progress',
                        step: 'exporting-images',
                        progress,
                        detail: `${current}/${total}`,
                    });
                }
            );
        }

        const namedImageDataMap: Record<string, Uint8Array> = {};
        for (const [nodeId, data] of Object.entries(imageDataMap)) {
            const fileName = result.imageFileMap[nodeId];
            if (fileName) {
                namedImageDataMap[fileName] = data;
            }
        }

        figma.ui.postMessage({ type: 'export-progress', step: 'packaging', progress: 95 });

        // 5. 发送结果给 UI 层打包下载
        figma.ui.postMessage({
            type: 'export-result',
            hmlContent: result.hmlContent,
            projectJson: result.projectJson,
            mainHmlFile: result.mainHmlFile,
            imageDataMap: serializeImageMap(namedImageDataMap),
            imageFormat: msg.imageFormat.toLowerCase(),
            projectName: msg.projectName,
            stats: result.stats,
            warnings: result.warnings,
        });

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({ type: 'export-error', message: errMsg });
    }
}

/**
 * 将 Uint8Array Map 转为可序列化格式 (数组)
 */
function serializeImageMap(
    map: Record<string, Uint8Array>
): Record<string, number[]> {
    const result: Record<string, number[]> = {};
    for (const [key, value] of Object.entries(map)) {
        result[key] = Array.from(value);
    }
    return result;
}

// 监听 UI 消息
figma.ui.onmessage = async (msg: any) => {
    switch (msg.type) {
        case 'get-pages':
            figma.ui.postMessage({
                type: 'page-list',
                pages: getPageList(),
                fileName: figma.root.name,
            });
            break;

        case 'get-frames':
            figma.ui.postMessage({
                type: 'frame-list',
                frames: getFrameList(msg.pageId),
            });
            break;

        case 'export':
            await doExport(msg);
            break;

        case 'cancel':
            figma.closePlugin();
            break;
    }
};
