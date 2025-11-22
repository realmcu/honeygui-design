#include "gui_design.h"
#include "gui_callbacks.h"
#include <stddef.h>

// 组件句柄定义
gui_obj_t *mainView = NULL;
gui_obj_t *titleLabel = NULL;
gui_obj_t *startButton = NULL;

/**
 * 初始化GUI设计
 * 此函数由HoneyGUI设计器自动生成
 */
void gui_design_init(void) {

    // 创建主视图 (hg_view)
    mainView = gui_view_create(NULL, "mainView", 0, 0, 480, 272);
    gui_obj_set_color(mainView, 0x000000);
    gui_obj_show(mainView, true);

    // 创建标题标签 (hg_label)
    titleLabel = gui_text_create(mainView, "titleLabel", 100, 50, 280, 40);
    gui_text_set(titleLabel, "Welcome to HoneyGUI");
    gui_text_set_font_size(titleLabel, 24);
    gui_text_set_color(titleLabel, 0xFFFFFF);
    gui_obj_show(titleLabel, true);

    // 创建启动按钮 (hg_button)
    startButton = gui_button_create(mainView, "startButton", 150, 120, 180, 60);
    gui_button_set_text(startButton, "Start");
    gui_button_set_color(startButton, 0x007ACC);
    gui_obj_show(startButton, true);
    gui_button_set_click_cb(startButton, on_start_button_click);
}

/**
 * 更新GUI（可选）
 */
void gui_design_update(void) {
    // 动态更新逻辑
}
