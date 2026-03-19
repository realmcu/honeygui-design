/*
 * LVGL PC Simulator - SDL backend
 *
 * Uses RTK-style SDL port (fb_sdl.c + lv_port_disp.c + lv_port_indev.c)
 * instead of LV_USE_WINDOWS driver, enabling cross-platform support.
 */

#include <stdint.h>
#include <stdio.h>

/* Only pull in SDL_GetTicks – avoid SDL_main.h redefining main() */
extern uint32_t SDL_GetTicks(void);

#include "lvgl.h"
#include "lv_port_disp.h"
#include "lv_port_indev.h"
#include "generated/lvgl_generated_ui.h"

/* Default LCD dimensions if not provided via CMake */
#ifndef LCD_WIDTH
#define LCD_WIDTH 480
#endif
#ifndef LCD_HEIGHT
#define LCD_HEIGHT 480
#endif

static void lvgl_log_cb(lv_log_level_t level, const char *buf)
{
    const char *level_str = "LOG";
    switch (level)
    {
    case LV_LOG_LEVEL_TRACE: level_str = "TRACE"; break;
    case LV_LOG_LEVEL_INFO:  level_str = "INFO";  break;
    case LV_LOG_LEVEL_WARN:  level_str = "WARN";  break;
    case LV_LOG_LEVEL_ERROR: level_str = "ERROR"; break;
    case LV_LOG_LEVEL_USER:  level_str = "USER";  break;
    default: break;
    }
    printf("[LVGL][%s] %s\n", level_str, buf);
    fflush(stdout);
}

static void create_ui(void)
{
    lv_obj_t *scr = lv_screen_active();
    lvgl_generated_ui_create(scr);
}

int main(void)
{
    printf("[APP] boot\n");
    fflush(stdout);

    lv_init();

    /* Register SDL_GetTicks as LVGL tick source (LVGL 9.x uses callback instead of lv_tick_inc) */
    lv_tick_set_cb(SDL_GetTicks);

    lv_log_register_print_cb(lvgl_log_cb);

    printf("[APP] LV_USE_LOG=%d LV_LOG_LEVEL=%d\n", LV_USE_LOG, LV_LOG_LEVEL);
    fflush(stdout);

    LV_LOG_WARN("LVGL logging initialized");

    /* Initialize SDL display and input (fb_sdl.c constructor already started SDL) */
    lv_port_disp_init();
    lv_port_indev_init();

    /* Create UI */
    create_ui();
    lv_refr_now(NULL);

    /* Main loop */
    while (1)
    {
        uint32_t delay_ms = lv_timer_handler();
        if (delay_ms < 1) { delay_ms = 1; }
        if (delay_ms > 20) { delay_ms = 20; }
        lv_delay_ms(delay_ms);
    }

    return 0;
}
