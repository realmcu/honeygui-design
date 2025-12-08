import * as path from 'path';

/**
 * Romfs 配置工具类
 * 统一管理 romfs 文件名和变量名的生成规则
 */
export class RomfsConfig {
    private static readonly ROMFS_FILENAME = 'app_romfs.c';

    /**
     * 获取 romfs 输出文件名
     */
    static getFileName(): string {
        return this.ROMFS_FILENAME;
    }

    /**
     * 根据 mkromfs_for_honeygui.py 的逻辑计算 romfs root 变量名
     * 规则：去掉扩展名，转换为合法 C 标识符，加 _root 后缀
     */
    static getRootName(): string {
        const nameWithoutExt = path.basename(this.ROMFS_FILENAME, path.extname(this.ROMFS_FILENAME));
        const rootName = nameWithoutExt.replace(/[^a-zA-Z0-9_]/g, '_') + '_root';
        return rootName;
    }
}
