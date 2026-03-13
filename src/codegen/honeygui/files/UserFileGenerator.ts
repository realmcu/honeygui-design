/**
 * 用户代码文件生成器
 * 负责生成 user.h 和 user.c 文件（只生成一次）
 */

export class UserFileGenerator {

  /**
   * 生成用户头文件
   */
  generateHeader(baseName: string): string {
    const guardName = `${baseName.toUpperCase()}_USER_H`;
    return `#ifndef ${guardName}
#define ${guardName}

#include "../callbacks/${baseName}_callbacks.h"
#include "../ui/${baseName}_ui.h"

/**
 * 用户自定义头文件
 * 此文件只生成一次，可自由修改
 */

// 在此添加自定义声明

#endif // ${guardName}
`;
  }

  /**
   * 生成用户实现文件
   */
  generateImplementation(baseName: string): string {
    return `#include "${baseName}_user.h"

/**
 * 用户自定义实现
 * 此文件只生成一次，可自由修改
 */

// 在此添加自定义实现

/***
 * Template function
 * Distinguish development environments
 */
// void user_defined_func_called_by_event(void *obj, gui_event_t *e)
// {
//     GUI_UNUSED(obj);
//     GUI_UNUSED(e);
// #ifdef _HONEYGUI_SIMULATOR_
//     // TODO
// #else
//     // TODO
// #endif
// }

// void user_defined_func_called_by_msg(gui_obj_t *obj, const char *topic, void *data, uint16_t len)
// {
//     GUI_UNUSED(obj);
//     GUI_UNUSED(topic);
//     GUI_UNUSED(data);
//     GUI_UNUSED(len);
// #ifdef _HONEYGUI_SIMULATOR_
//     // TODO
// #else
//     // TODO
// #endif
// }
`;
  }
}
