#ifndef GUI_DESIGN_H
#define GUI_DESIGN_H

#include "gui_api.h"
#include "gui_screen.h"
#include "gui_text.h"
#include "gui_button.h"

// 组件句柄声明
extern gui_obj_t *mainScreen;
extern gui_obj_t *titleLabel;
extern gui_obj_t *startButton;

// 初始化函数
void gui_design_init(void);

// 更新函数（可选）
void gui_design_update(void);

#endif // GUI_DESIGN_H
