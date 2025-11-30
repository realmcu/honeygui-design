#include "E2ETestMain.h"
#include "E2ETestMain_callbacks.h"
#include <stddef.h>

// 组件句柄定义
gui_obj_t *testImage = NULL;


// 创建mainView (hg_view)
static void mainView_switch_out(gui_view_t *view)
{
    GUI_UNUSED(view);
}

static void mainView_switch_in(gui_view_t *view)
{
    GUI_UNUSED(view);


    // 创建testImage (hg_image)
    testImage = gui_img_create_from_fs(NULL, "testImage", "assets/test.png", 100, 50, 280, 172);
    gui_obj_show(testImage, true);
}
GUI_VIEW_INSTANCE("mainView", false, mainView_switch_in, mainView_switch_out);
