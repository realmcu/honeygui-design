#include "E2ETestMain.h"
#include "E2ETestMain_callbacks.h"
#include <stddef.h>

// 组件句柄定义


// 创建mainView (hg_view)
static void mainView_switch_out(gui_view_t *view)
{
    GUI_UNUSED(view);
}

static void mainView_switch_in(gui_view_t *view)
{
    GUI_UNUSED(view);
}
GUI_VIEW_INSTANCE("mainView", false, mainView_switch_in, mainView_switch_out);
