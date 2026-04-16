import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_ROMFS_BASE_ADDR } from '../common/ProjectConfig';

/**
 * Entry file generator
 * Generates the project-level entry file {ProjectName}Entry.c
 */
export class EntryFileGenerator {
    /**
     * Generate the entry file
     * @param srcDir Path to the src directory
     * @param projectName Project name
     * @param entryViewId The ID of the entry view (from HML with entry="true")
     * @param romfsBaseAddr Romfs base address for embedded flashing (e.g. "0x704D1000")
     */
    static generate(srcDir: string, projectName: string, entryViewId?: string, romfsBaseAddr?: string): string {
        // Ensure the directory exists
        if (!fs.existsSync(srcDir)) {
            fs.mkdirSync(srcDir, { recursive: true });
        }

        const entryFile = path.join(srcDir, `${projectName}Entry.c`);

        const baseAddr = romfsBaseAddr || DEFAULT_ROMFS_BASE_ADDR;
        const mainViewId = entryViewId || `${projectName}MainView`;
        const content = `#include "gui_api.h"
#include "gui_view.h"
#include "gui_components_init.h"
#include "gui_vfs.h"

static int app_init(void)
{
#ifdef _HONEYGUI_SIMULATOR_
    // Simulator: Mount POSIX filesystem
    gui_vfs_mount_posix("/", "./assets");
#else
    // SOC: Mount romfs from flash address
    gui_vfs_mount_romfs("/", (void *)${baseAddr}, 0);
#endif

    gui_view_create(gui_obj_get_root(), "${mainViewId}", 0, 0, 0, 0);
    return 0;
}

GUI_INIT_APP_EXPORT(app_init);
`;
        
        fs.writeFileSync(entryFile, content);
        return entryFile;
    }
}
