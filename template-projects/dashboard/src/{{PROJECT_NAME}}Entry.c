#include "gui_api.h"
#include "gui_view.h"
#include "gui_components_init.h"
#include "gui_vfs.h"
#include "hg_romfs.h"

extern const struct romfs_dirent app_romfs_root;

static int app_init(void)
{
    // Mount romfs from embedded data
    gui_vfs_mount_romfs("/", &app_romfs_root, 0);

    gui_view_create(gui_obj_get_root(), "mainView", 0, 0, 0, 0);
    return 0;
}

GUI_INIT_APP_EXPORT(app_init);
