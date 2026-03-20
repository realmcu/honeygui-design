import * as fs from 'fs';
import * as path from 'path';
import { RomfsConfig } from '../common/RomfsConfig';

/**
 * Entry file generator
 * Generates the project-level entry file {ProjectName}Entry.c
 */
export class EntryFileGenerator {
    /**
     * Generate the entry file
     * @param srcDir Path to the src directory
     * @param projectName Project name
     */
    static generate(srcDir: string, projectName: string): string {
        // Ensure the directory exists
        if (!fs.existsSync(srcDir)) {
            fs.mkdirSync(srcDir, { recursive: true });
        }

        const entryFile = path.join(srcDir, `${projectName}Entry.c`);
        
        // Only create on first generation
        if (fs.existsSync(entryFile)) {
            return entryFile;
        }

        const romfsRootName = RomfsConfig.getRootName();
        const mainViewId = `${projectName}MainView`;
        const content = `#include "gui_api.h"
#include "gui_view.h"
#include "gui_components_init.h"
#include "gui_vfs.h"
#include "hg_romfs.h"

extern const struct romfs_dirent ${romfsRootName};

static int app_init(void)
{
#ifdef _HONEYGUI_SIMULATOR_
    // Simulator: Mount POSIX filesystem
    gui_vfs_mount_posix("/", "./assets");
#else
    // SOC: Mount romfs from embedded data
    gui_vfs_mount_romfs("/", &${romfsRootName}, 0);
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
