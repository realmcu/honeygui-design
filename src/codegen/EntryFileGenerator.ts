import * as fs from 'fs';
import * as path from 'path';
import { RomfsConfig } from '../common/RomfsConfig';

/**
 * 入口文件生成器
 * 生成项目级别的入口文件 {ProjectName}Entry.c
 */
export class EntryFileGenerator {
    /**
     * 生成入口文件
     * @param autogenDir src/autogen 目录路径
     * @param projectName 项目名称
     */
    static generate(autogenDir: string, projectName: string): string {
        // 确保目录存在
        if (!fs.existsSync(autogenDir)) {
            fs.mkdirSync(autogenDir, { recursive: true });
        }

        const entryFile = path.join(autogenDir, `${projectName}Entry.c`);
        
        // 只在首次生成时创建
        if (fs.existsSync(entryFile)) {
            return entryFile;
        }

        const romfsRootName = RomfsConfig.getRootName();
        const content = `#include "gui_api.h"
#include "gui_view.h"
#include "gui_components_init.h"
#include "gui_vfs.h"
#include "hg_romfs.h"

extern const struct romfs_dirent ${romfsRootName};

static int app_init(void)
{
    // Mount romfs from embedded data
    gui_vfs_mount_romfs("/", &${romfsRootName}, 0);

    gui_view_create(gui_obj_get_root(), "mainView", 0, 0, 0, 0);
    return 0;
}

GUI_INIT_APP_EXPORT(app_init);
`;
        
        fs.writeFileSync(entryFile, content);
        return entryFile;
    }
}
