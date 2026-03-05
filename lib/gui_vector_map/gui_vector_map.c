/*
 * Copyright (c) 2026, Realtek Semiconductor Corporation
 *
 * SPDX-License-Identifier: MIT
 */

/*============================================================================*
 *                        Header Files
 *============================================================================*/
#include <string.h>
#include "gui_vector_map.h"
#include "gui_fb.h"
#include "gui_vfs.h"
#include "nav_api.h"

/*============================================================================*
 *                           Types
 *============================================================================*/


/*============================================================================*
 *                           Constants
 *============================================================================*/


/*============================================================================*
 *                            Macros
 *============================================================================*/


/*============================================================================*
 *                            Variables
 *============================================================================*/


/*============================================================================*
 *                           Private Functions
 *============================================================================*/
int map_config(void);
int map_init(void);
int map_loop(void);
int map_exit(void);
const unsigned char* map_get_pixels(void);
static void test_timer_cb(void *param)
{
    GUI_UNUSED(param);
    gui_log("timer cb test!\n");
    map_loop();
	extern void gui_fb_change(void);
	gui_fb_change();
}





/*============================================================================*
 *                           Public Functions
 *============================================================================*/
gui_vector_map_t *gui_vector_map_create_from_mem(void       *parent,
                                   const char *name,
                                   const uint8_t *map_data_addr,
                                   size_t map_data_size,
                                   const uint8_t *ttf_font_data_addr,
                                    size_t ttf_font_data_size,
                                    const char *pc_serial_name_string,
                                   int16_t     x,
                                   int16_t     y,
                                   int16_t     w,
                                   int16_t     h)
{
    gui_log("RAM used before: %d bytes\n", gui_low_mem_used());
    extern const uint8_t *trmap_file_data_address; 
    extern size_t trmap_file_data_size;  
    extern const uint8_t *ttf_font_file_data_address;  
    extern size_t ttf_font_file_data_size;  
    trmap_file_data_address = map_data_addr;
    trmap_file_data_size = map_data_size;
    ttf_font_file_data_address = ttf_font_data_addr;
    ttf_font_file_data_size = ttf_font_data_size;
    extern size_t map_defalut_width;
    extern size_t map_defalut_height;
    map_defalut_width = w;
    map_defalut_height = h;
    extern const char *pc_serial_name;
    pc_serial_name = pc_serial_name_string;
	map_config();
	map_init();
    map_loop();

    gui_img_t * img = gui_img_create_from_mem(
	parent, 
	name,(void *)( map_get_pixels() - sizeof(gui_rgb_data_head_t)), x, y, 0, 0);

    gui_obj_create_timer(&(img->base), 10, true, test_timer_cb);
    gui_obj_start_timer(&(img->base));

    gui_log("RAM used : %d bytes\n", gui_low_mem_used());
    return (void *)img;
}



