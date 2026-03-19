/*
 * Copyright (c) 2026, Realtek Semiconductor Corporation
 * SPDX-License-Identifier: Apache-2.0
 */

#ifndef LV_PORT_DISP_H
#define LV_PORT_DISP_H

#ifdef __cplusplus
extern "C" {
#endif

#include "lvgl.h"

void lv_port_disp_init(void);
void disp_enable_update(void);
void disp_disable_update(void);

#ifdef __cplusplus
}
#endif

#endif /* LV_PORT_DISP_H */
