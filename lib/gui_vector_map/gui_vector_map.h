/*
 * Copyright (c) 2026, Realtek Semiconductor Corporation
 *
 * SPDX-License-Identifier: MIT
 */

/*============================================================================*
 *               Define to prevent recursive inclusion
 *============================================================================*/
#ifndef __GUI_VECTOR_MAP_H__
#define __GUI_VECTOR_MAP_H__
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

/** @brief  gui_vector_map widget structure. */
#ifdef  __CC_ARM
#pragma anon_unions
#endif

typedef struct gui_vector_map
{
    gui_img_t base;
} gui_vector_map_t;


/*============================================================================*
 *                         Constants
 *============================================================================*/


/*============================================================================*
 *                         Macros
 *============================================================================*/


/*============================================================================*
 *                         Variables
 *============================================================================*/


/*============================================================================*
 *                         Functions
 *============================================================================*/
gui_vector_map_t *gui_vector_map_create_from_mem(void       *parent,
                                   const char *name,
                                   const uint8_t *map_data_addr,
                                   size_t map_data_size,
                                   const uint8_t *ttf_font_data_addr,
                                    size_t ttf_font_data_size,
                                    const char *pc_serial_name,
                                   int16_t     x,
                                   int16_t     y,
                                   int16_t     w,
                                   int16_t     h);


#ifdef __cplusplus
}
#endif

#endif
