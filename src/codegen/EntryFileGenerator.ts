import * as fs from 'fs';
import * as path from 'path';

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

        const content = `#include "gui_api.h"
#include "gui_view.h"
#include "gui_components_init.h"

static int app_init(void)
{
    gui_view_create(gui_obj_get_root(), "mainView", 0, 0, 0, 0);
    return 0;
}

GUI_INIT_APP_EXPORT(app_init);
`;
        
        fs.writeFileSync(entryFile, content);
        return entryFile;
    }
}
