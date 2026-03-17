/*
 * Copyright (c) 2026, Realtek Semiconductor Corporation
 *
 * SPDX-License-Identifier: MIT
 */

/*============================================================================*
 *               Define to prevent recursive inclusion
 *============================================================================*/
#ifndef __GUI_OPENCLAW_H__
#define __GUI_OPENCLAW_H__
#ifdef __cplusplus
extern "C" {
#endif

/*============================================================================*
 *                        Header Files
 *============================================================================*/
#include "guidef.h"
#include "gui_api.h"
#include "gui_img.h"

/*============================================================================*
 *                         Types
 *============================================================================*/
typedef gui_img_t gui_openclaw_t;

typedef enum
{
    GUI_OPENCLAW_ROLE_SYSTEM = 0,
    GUI_OPENCLAW_ROLE_USER,
    GUI_OPENCLAW_ROLE_ASSISTANT,
} gui_openclaw_role_t;

/*============================================================================*
 *                         Functions
 *============================================================================*/
gui_openclaw_t *gui_openclaw_create_from_mem(void          *parent,
                                             const char    *name,
                                    
                                             const uint8_t *ttf_font_data_addr,
                                             size_t         ttf_font_data_size,
                                             const char    *sender_id,
                                             int16_t        x,
                                             int16_t        y,
                                             int16_t        w,
                                             int16_t        h);

bool gui_openclaw_append_message(gui_openclaw_t      *widget,
                                 gui_openclaw_role_t  role,
                                 const char          *text);

void gui_openclaw_clear_messages(gui_openclaw_t *widget);

void gui_openclaw_set_connection_info(gui_openclaw_t *widget,
                                      const char     *broker_url,
                                      const char     *sender_id,
                                      bool            connected);

void gui_openclaw_set_status(gui_openclaw_t *widget, const char *status_text);

void gui_openclaw_refresh(gui_openclaw_t *widget);

void gui_openclaw_input_utf8(const char *text);

void gui_openclaw_input_backspace(void);

void gui_openclaw_input_submit(void);

#ifdef __cplusplus
}
#endif

#endif
