#ifndef LV_CONF_H
#define LV_CONF_H

/* Basic color depth for Windows backend frame buffer */
#define LV_COLOR_DEPTH 32

/* On PC use C runtime allocators instead of 64KB built-in pool */
#define LV_USE_STDLIB_MALLOC LV_STDLIB_CLIB
#define LV_USE_STDLIB_STRING LV_STDLIB_CLIB
#define LV_USE_STDLIB_SPRINTF LV_STDLIB_CLIB

/* Enable LVGL Windows backend (no SDL dependency) */
#define LV_USE_WINDOWS 1

/* Enable OS abstraction because Windows backend runs a UI thread and uses lv_lock/lv_unlock */
#define LV_USE_OS LV_OS_WINDOWS

/* Optional: keep logs available */
#define LV_USE_LOG 1
#define LV_LOG_LEVEL LV_LOG_LEVEL_WARN
#define LV_LOG_PRINTF 1

/* Enable complex SW renderer features required by radial/conical gradients */
#define LV_DRAW_SW_COMPLEX 1
#define LV_USE_DRAW_SW_COMPLEX_GRADIENTS 1

/* Enable transform pipeline for image scale/rotate */
#define LV_USE_FLOAT 1
#define LV_USE_MATRIX 1
#define LV_DRAW_TRANSFORM_USE_MATRIX 1

/* Allow multi-stop gradients for geometry widgets */
#define LV_GRADIENT_MAX_STOPS 8

/* Enable file system access for image files (A:assets/...) */
#define LV_USE_FS_STDIO 1
#define LV_FS_STDIO_LETTER 'A'
#define LV_FS_STDIO_PATH ""

/* Enable common image decoders for designer assets */
#define LV_USE_LODEPNG 1
#define LV_USE_BMP 1
#define LV_USE_TJPGD 1
#define LV_USE_GIF 1
#define LV_USE_FONT_COMPRESSED 1
#define LV_USE_FFMPEG 1
#endif /*LV_CONF_H*/
