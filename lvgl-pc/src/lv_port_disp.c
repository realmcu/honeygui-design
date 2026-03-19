/*
 * Copyright (c) 2026, Realtek Semiconductor Corporation
 * SPDX-License-Identifier: Apache-2.0
 *
 * LVGL display port for SDL backend.
 * Adapted from RTK win32_sim for HoneyGUI Designer.
 */

#include "lv_port_disp.h"
#include <stdbool.h>

#ifndef LCD_WIDTH
#define LCD_WIDTH  480
#endif
#ifndef LCD_HEIGHT
#define LCD_HEIGHT 480
#endif

#define MY_DISP_HOR_RES LCD_WIDTH
#define MY_DISP_VER_RES LCD_HEIGHT
#define BYTE_PER_PIXEL  (LV_COLOR_FORMAT_GET_SIZE(LV_COLOR_FORMAT_ARGB8888))

static void disp_flush(lv_display_t *disp, const lv_area_t *area, uint8_t *px_map);

extern void port_direct_draw_bitmap_to_lcd(int16_t x, int16_t y,
                                           int16_t width, int16_t height,
                                           const uint8_t *bitmap);

volatile bool disp_flush_enabled = true;

void lv_port_disp_init(void)
{
    lv_display_t *disp = lv_display_create(MY_DISP_HOR_RES, MY_DISP_VER_RES);
    lv_display_set_flush_cb(disp, disp_flush);

    /* Double-buffered full-screen for best performance */
    static uint8_t buf_1[MY_DISP_HOR_RES * MY_DISP_VER_RES * BYTE_PER_PIXEL];
    static uint8_t buf_2[MY_DISP_HOR_RES * MY_DISP_VER_RES * BYTE_PER_PIXEL];
    lv_display_set_buffers(disp, buf_1, buf_2, sizeof(buf_1),
                           LV_DISPLAY_RENDER_MODE_DIRECT);
}

void disp_enable_update(void)  { disp_flush_enabled = true; }
void disp_disable_update(void) { disp_flush_enabled = false; }

static void disp_flush(lv_display_t *disp_drv, const lv_area_t *area, uint8_t *px_map)
{
    if (disp_flush_enabled)
    {
        if (disp_drv->render_mode == LV_DISPLAY_RENDER_MODE_PARTIAL)
        {
            port_direct_draw_bitmap_to_lcd(area->x1, area->y1,
                                           area->x2 - area->x1 + 1,
                                           area->y2 - area->y1 + 1,
                                           (const uint8_t *)px_map);
        }
        else if (disp_drv->render_mode == LV_DISPLAY_RENDER_MODE_DIRECT)
        {
            if (lv_disp_flush_is_last(disp_drv))
            {
                port_direct_draw_bitmap_to_lcd(0, 0, MY_DISP_HOR_RES, MY_DISP_VER_RES,
                                               (const uint8_t *)px_map);
            }
        }
        else
        {
            /* FULL mode */
            port_direct_draw_bitmap_to_lcd(0, 0, MY_DISP_HOR_RES, MY_DISP_VER_RES,
                                           (const uint8_t *)px_map);
        }
    }
    lv_display_flush_ready(disp_drv);
}
