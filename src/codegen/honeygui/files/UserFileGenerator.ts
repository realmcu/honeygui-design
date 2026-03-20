/**
 * User code file generator
 * Generates user.h and user.c files (generated once only)
 */

export class UserFileGenerator {

  /**
   * Generate user header file
   */
  generateHeader(baseName: string): string {
    const guardName = `${baseName.toUpperCase()}_USER_H`;
    return `#ifndef ${guardName}
#define ${guardName}

#include "../callbacks/${baseName}_callbacks.h"
#include "../ui/${baseName}_ui.h"

/**
 * User-defined header file
 * This file is generated once only, feel free to modify
 */

// Add custom declarations here

#endif // ${guardName}
`;
  }

  /**
   * Generate user implementation file
   */
  generateImplementation(baseName: string): string {
    return `#include "${baseName}_user.h"

/**
 * User-defined implementation
 * This file is generated once only, feel free to modify
 */

// Add custom implementations here

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
