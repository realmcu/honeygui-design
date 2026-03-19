/*
 * Copyright (c) 2026, Realtek Semiconductor Corporation
 * SPDX-License-Identifier: Apache-2.0
 *
 * SDL2 framebuffer backend for LVGL PC simulator.
 * Adapted from RTK win32_sim port for use in HoneyGUI Designer.
 */

#include <SDL.h>
#include <pthread.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>

#include "lvgl.h"

/* LCD dimensions injected by CMake via -DLCD_WIDTH / -DLCD_HEIGHT */
#ifndef LCD_WIDTH
#define LCD_WIDTH   480
#endif
#ifndef LCD_HEIGHT
#define LCD_HEIGHT  480
#endif

/* Designer always uses 32-bit color depth (ARGB8888) */
#define DRV_PIXEL_BITS 32

static SDL_Window   *window   = NULL;
static SDL_Renderer *renderer = NULL;
static SDL_Surface  *surface  = NULL;

static SDL_Rect _rect = { 0, 0, LCD_WIDTH, LCD_HEIGHT };
static int      bpp;
static uint32_t Rmask, Gmask, Bmask, Amask;

static pthread_mutex_t sdl_ok_mutex;
static pthread_cond_t  sdl_ok_event;

/* Shared input state (read by lv_port_indev.c) */
extern int32_t         mouse_x;
extern int32_t         mouse_y;
extern bool            mouse_left_pressed;
extern uint32_t        key_value;
extern pthread_mutex_t input_mutex;
extern int32_t         encoder_diff;
extern bool            encoder_state;

/* Screen dimensions (readable by port layer) */
int sim_screen_width  = LCD_WIDTH;
int sim_screen_height = LCD_HEIGHT;

int32_t sim_get_width(void)  { return sim_screen_width; }
int32_t sim_get_height(void) { return sim_screen_height; }

/* Copy rendered pixels into the SDL surface */
static void lcd_update_window(uint8_t *input, uint8_t *output,
                              uint16_t xStart, uint16_t yStart,
                              uint16_t w, uint16_t h)
{
    uint32_t *read  = (uint32_t *)input;
    uint32_t *write = (uint32_t *)output;
    for (uint32_t i = yStart; i < (h + yStart); i++)
    {
        for (uint32_t j = xStart; j < (w + xStart); j++)
        {
            write[i * sim_get_width() + j] = *read;
            read++;
        }
    }
}

void port_direct_draw_bitmap_to_lcd(int16_t x, int16_t y,
                                    int16_t width, int16_t height,
                                    const uint8_t *bitmap)
{
    if (!surface) { return; }
    uint8_t *dst = surface->pixels;
    lcd_update_window((uint8_t *)bitmap, dst, x, y, width, height);
}

/* Background thread: present surface to window at ~60 FPS */
static void *sdl_flush_thread(void *arg)
{
    (void)arg;
    while (true)
    {
        SDL_Delay(1000 / 60);
        if (!renderer || !surface) { break; }
        SDL_Texture *texture = SDL_CreateTextureFromSurface(renderer, surface);
        if (texture)
        {
            SDL_SetTextureBlendMode(texture, SDL_BLENDMODE_NONE);
            SDL_RenderCopy(renderer, texture, NULL, &_rect);
            SDL_RenderPresent(renderer);
            SDL_DestroyTexture(texture);
        }
    }
    return NULL;
}

/* SDL event loop (runs in its own thread) */
void *rtk_gui_sdl(void *arg)
{
    (void)arg;
    SDL_LogSetPriority(SDL_LOG_CATEGORY_APPLICATION, SDL_LOG_PRIORITY_INFO);

    if (SDL_Init(SDL_INIT_VIDEO) < 0)
    {
        fprintf(stderr, "[SDL] Init failed: %s\n", SDL_GetError());
        pthread_cond_signal(&sdl_ok_event);
        pthread_mutex_unlock(&sdl_ok_mutex);
        return NULL;
    }

    char title[64];
    snprintf(title, sizeof(title), "LVGL Simulator %d x %d",
             sim_get_width(), sim_get_height());

    window = SDL_CreateWindow(title,
                              SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
                              sim_get_width(), sim_get_height(), 0);
    renderer = SDL_CreateRenderer(window, -1, 0);
    SDL_SetRenderDrawColor(renderer, 0, 0, 0, 255);
    SDL_RenderClear(renderer);

    SDL_PixelFormatEnumToMasks(SDL_PIXELFORMAT_ARGB8888,
                               &bpp, &Rmask, &Gmask, &Bmask, &Amask);

    surface = SDL_CreateRGBSurface(0, sim_get_width(), sim_get_height(),
                                   bpp, Rmask, Gmask, Bmask, Amask);
    SDL_RenderPresent(renderer);

    /* Signal main thread that SDL is ready */
    pthread_cond_signal(&sdl_ok_event);
    pthread_mutex_unlock(&sdl_ok_mutex);

    /* Start background flush thread */
    pthread_t flush_tid;
    pthread_create(&flush_tid, NULL, sdl_flush_thread, NULL);

    /* Event loop */
    SDL_Event event;
    while (true)
    {
        if (!SDL_WaitEvent(&event)) { continue; }
        switch (event.type)
        {
        case SDL_MOUSEMOTION:
            pthread_mutex_lock(&input_mutex);
            mouse_x = event.motion.x;
            mouse_y = event.motion.y;
            pthread_mutex_unlock(&input_mutex);
            break;
        case SDL_MOUSEBUTTONDOWN:
            if (event.button.button == SDL_BUTTON_LEFT)
            {
                pthread_mutex_lock(&input_mutex);
                mouse_left_pressed = true;
                pthread_mutex_unlock(&input_mutex);
            }
            break;
        case SDL_MOUSEBUTTONUP:
            if (event.button.button == SDL_BUTTON_LEFT)
            {
                pthread_mutex_lock(&input_mutex);
                mouse_left_pressed = false;
                pthread_mutex_unlock(&input_mutex);
            }
            break;
        case SDL_MOUSEWHEEL:
            pthread_mutex_lock(&input_mutex);
            encoder_diff += (event.wheel.y > 0) ? -1 : 1;
            encoder_state = 1;
            pthread_mutex_unlock(&input_mutex);
            SDL_Delay(10);
            pthread_mutex_lock(&input_mutex);
            encoder_state = 0;
            pthread_mutex_unlock(&input_mutex);
            break;
        case SDL_KEYDOWN:
            pthread_mutex_lock(&input_mutex);
            switch (event.key.keysym.sym)
            {
            case SDLK_UP:        key_value = LV_KEY_UP; break;
            case SDLK_DOWN:      key_value = LV_KEY_DOWN; break;
            case SDLK_RIGHT:     key_value = LV_KEY_RIGHT; break;
            case SDLK_LEFT:      key_value = LV_KEY_LEFT; break;
            case SDLK_RETURN:    key_value = LV_KEY_ENTER; break;
            case SDLK_ESCAPE:    key_value = LV_KEY_ESC; break;
            case SDLK_DELETE:    key_value = LV_KEY_DEL; break;
            case SDLK_BACKSPACE: key_value = LV_KEY_BACKSPACE; break;
            case SDLK_TAB:       key_value = LV_KEY_NEXT; break;
            default:             key_value = 0; break;
            }
            pthread_mutex_unlock(&input_mutex);
            break;
        case SDL_KEYUP:
            pthread_mutex_lock(&input_mutex);
            key_value = 0;
            pthread_mutex_unlock(&input_mutex);
            break;
        case SDL_QUIT:
            SDL_Quit();
            exit(0);
            break;
        default:
            break;
        }
    }
    return NULL;
}

/* Auto-init: start SDL thread before main() */
__attribute__((constructor)) void gui_port_dc_init(void)
{
    printf("[SDL] Initializing display backend...\n");
    fflush(stdout);

    pthread_mutex_init(&sdl_ok_mutex, NULL);
    pthread_cond_init(&sdl_ok_event, NULL);

    pthread_t sdl_tid;
    pthread_create(&sdl_tid, NULL, rtk_gui_sdl, NULL);

    /* Wait for SDL window to be ready */
    pthread_mutex_lock(&sdl_ok_mutex);
    pthread_cond_wait(&sdl_ok_event, &sdl_ok_mutex);

    pthread_mutex_destroy(&sdl_ok_mutex);
    pthread_cond_destroy(&sdl_ok_event);

    printf("[SDL] Display backend ready\n");
    fflush(stdout);
}
