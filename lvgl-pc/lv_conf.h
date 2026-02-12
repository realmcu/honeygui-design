#ifndef LV_CONF_H
#define LV_CONF_H

/* Basic color depth for Windows backend frame buffer */
#define LV_COLOR_DEPTH 32

/* Enable LVGL Windows backend (no SDL dependency) */
#define LV_USE_WINDOWS 1

/* Enable OS abstraction because Windows backend runs a UI thread and uses lv_lock/lv_unlock */
#define LV_USE_OS LV_OS_WINDOWS

/* Optional: keep logs available */
#define LV_USE_LOG 1
#define LV_LOG_LEVEL LV_LOG_LEVEL_WARN

#endif /*LV_CONF_H*/
