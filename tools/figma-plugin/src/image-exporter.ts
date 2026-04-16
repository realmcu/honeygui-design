/**
 * 图片导出器
 * 使用 Figma Plugin API 导出节点为图片数据
 */

/**
 * 批量导出节点为图片
 * @param nodeIds 节点 ID 列表
 * @param format 图片格式
 * @param scale 缩放
 * @param onProgress 进度回调
 * @returns nodeId → Uint8Array 的映射
 */
export async function exportNodeImages(
    nodeIds: string[],
    format: 'PNG' | 'JPG',
    scale: number,
    onProgress?: (current: number, total: number) => void
): Promise<Record<string, Uint8Array>> {
    const result: Record<string, Uint8Array> = {};
    const total = nodeIds.length;

    for (let i = 0; i < nodeIds.length; i++) {
        const nodeId = nodeIds[i];

        try {
            const node = figma.getNodeById(nodeId) as SceneNode;
            if (!node) {
                console.warn(`Node not found: ${nodeId}`);
                continue;
            }

            const exportSettings: ExportSettings = {
                format: format,
                constraint: { type: 'SCALE', value: scale },
            } as ExportSettingsImage;

            const bytes = await node.exportAsync(exportSettings);
            result[nodeId] = bytes;
        } catch (err) {
            console.warn(`Failed to export node ${nodeId}:`, err);
        }

        if (onProgress) {
            onProgress(i + 1, total);
        }
    }

    return result;
}
