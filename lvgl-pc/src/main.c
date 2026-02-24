#include <stdint.h>
#include <stdio.h>

#ifdef _WIN32
#include <windows.h>
#endif

#include "lvgl.h"

#include "src/drivers/windows/lv_windows_display.h"
#include "src/drivers/windows/lv_windows_input.h"
#include "generated/lvgl_generated_ui.h"

/* Default LCD dimensions if not provided via CMake */
#ifndef LCD_WIDTH
#define LCD_WIDTH 480
#endif
#ifndef LCD_HEIGHT
#define LCD_HEIGHT 480
#endif

static void lvgl_log_cb(lv_log_level_t level, const char * buf)
{
    const char * level_str = "LOG";
    switch(level) {
        case LV_LOG_LEVEL_TRACE: level_str = "TRACE"; break;
        case LV_LOG_LEVEL_INFO:  level_str = "INFO"; break;
        case LV_LOG_LEVEL_WARN:  level_str = "WARN"; break;
        case LV_LOG_LEVEL_ERROR: level_str = "ERROR"; break;
        case LV_LOG_LEVEL_USER:  level_str = "USER"; break;
        default: break;
    }

    printf("[LVGL][%s] %s\n", level_str, buf);
    fflush(stdout);
}

static void create_ui(void)
{
    lv_obj_t * scr = lv_screen_active();
    honeygui_lvgl_ui_create(scr);
}

int main(void)
{
#ifdef _WIN32
    /* 禁用 Windows DPI 缩放，保持 1:1 像素 */
    extern BOOL __stdcall SetProcessDPIAware(void);
    SetProcessDPIAware();
#endif

    printf("[APP] boot\n");
    fflush(stdout);

    lv_init();
    lv_log_register_print_cb(lvgl_log_cb);

    printf("[APP] LV_USE_LOG=%d LV_LOG_LEVEL=%d\n", LV_USE_LOG, LV_LOG_LEVEL);
    fflush(stdout);

    LV_LOG_WARN("LVGL logging initialized");

    lv_display_t * disp = lv_windows_create_display(
        L"LVGL PC (MinGW)",
        LCD_WIDTH,
        LCD_HEIGHT,
        100,  /* zoom level: 100% */
        true, /* allow DPI override: false = 禁用系统 DPI 缩放，保持 1:1 像素 */
        false  /* simulator mode (not resizable) */
    );

    if(disp == NULL) {
        return 1;
    }

    /* Be explicit: create UI on this display. */
    lv_display_set_default(disp);

    (void)lv_windows_acquire_pointer_indev(disp);
    (void)lv_windows_acquire_keypad_indev(disp);
    (void)lv_windows_acquire_encoder_indev(disp);

    lv_lock();
    create_ui();
    /* Force at least one refresh right away (useful if the first timer tick is delayed). */
    lv_screen_load(lv_screen_active());
    lv_refr_now(disp);
    lv_unlock();

    while(1) {
        lv_lock();
        uint32_t delay_ms = lv_timer_handler();
        lv_unlock();

        if(delay_ms < 1) delay_ms = 1;
        if(delay_ms > 20) delay_ms = 20;
        lv_delay_ms(delay_ms);
    }
}
