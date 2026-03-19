/*
 * Copyright (c) 2026, Realtek Semiconductor Corporation
 * SPDX-License-Identifier: Apache-2.0
 *
 * LVGL input device port for SDL backend.
 * Adapted from RTK win32_sim for HoneyGUI Designer.
 */

#include "lv_port_indev.h"
#include <pthread.h>
#include <stdio.h>

/* Shared input state (written by fb_sdl.c) */
int32_t         mouse_x            = 0;
int32_t         mouse_y            = 0;
bool            mouse_left_pressed = false;
uint32_t        key_value          = 0;
pthread_mutex_t input_mutex        = PTHREAD_MUTEX_INITIALIZER;
int32_t         encoder_diff       = 0;
bool            encoder_state      = false;

static lv_indev_t *indev_touchpad;
static lv_indev_t *indev_keypad;
static lv_indev_t *indev_encoder;

/* Touchpad callbacks */
static void touchpad_read(lv_indev_t *indev, lv_indev_data_t *data)
{
    static int32_t last_x = 0, last_y = 0;

    pthread_mutex_lock(&input_mutex);
    bool pressed = mouse_left_pressed;
    if (pressed)
    {
        last_x = mouse_x;
        last_y = mouse_y;
    }
    pthread_mutex_unlock(&input_mutex);

    data->point.x = last_x;
    data->point.y = last_y;
    data->state = pressed ? LV_INDEV_STATE_PRESSED : LV_INDEV_STATE_RELEASED;
}

/* Keypad callbacks */
static void keypad_read(lv_indev_t *indev, lv_indev_data_t *data)
{
    static uint32_t last_key = 0;

    pthread_mutex_lock(&input_mutex);
    uint32_t key = key_value;
    pthread_mutex_unlock(&input_mutex);

    if (key != 0)
    {
        data->state = LV_INDEV_STATE_PRESSED;
        last_key = key;
    }
    else
    {
        data->state = LV_INDEV_STATE_RELEASED;
    }
    data->key = last_key;
}

/* Encoder callbacks */
static void encoder_read(lv_indev_t *indev, lv_indev_data_t *data)
{
    pthread_mutex_lock(&input_mutex);
    data->enc_diff = encoder_diff;
    data->state = encoder_state ? LV_INDEV_STATE_PRESSED : LV_INDEV_STATE_RELEASED;
    encoder_diff = 0;
    pthread_mutex_unlock(&input_mutex);
}

void lv_port_indev_init(void)
{
    /* Touchpad (mouse acts as touchpad) */
    indev_touchpad = lv_indev_create();
    lv_indev_set_type(indev_touchpad, LV_INDEV_TYPE_POINTER);
    lv_indev_set_read_cb(indev_touchpad, touchpad_read);

    /* Keypad */
    indev_keypad = lv_indev_create();
    lv_indev_set_type(indev_keypad, LV_INDEV_TYPE_KEYPAD);
    lv_indev_set_read_cb(indev_keypad, keypad_read);

    /* Encoder (mouse wheel) */
    indev_encoder = lv_indev_create();
    lv_indev_set_type(indev_encoder, LV_INDEV_TYPE_ENCODER);
    lv_indev_set_read_cb(indev_encoder, encoder_read);
}
