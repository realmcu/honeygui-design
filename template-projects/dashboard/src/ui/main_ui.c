/**
 * main UI实现（自动生成，请勿手动修改）
 * 生成时间: 2025-12-12T02:38:45.765Z
 */
#include "main_ui.h"
#include "../callbacks/main_callbacks.h"
#include <stddef.h>

// 组件句柄定义
gui_obj_t *hg_image_1765440312282_hnzy = NULL;


// 创建mainView (hg_view)
static void mainView_switch_out(gui_view_t *view)
{
    GUI_UNUSED(view);
}

static void mainView_switch_in(gui_view_t *view)
{
    GUI_UNUSED(view);


    // 创建image_2282 (hg_image)
    hg_image_1765440312282_hnzy = (gui_obj_t *)gui_img_create_from_fs((gui_obj_t *)view, "image_2282", "/StartEngine.bin", 285, 133, 190, 190);
    gui_obj_show(hg_image_1765440312282_hnzy, true);
}
GUI_VIEW_INSTANCE("mainView", false, mainView_switch_in, mainView_switch_out);
