/*
 * Copyright (c) 2026, Realtek Semiconductor Corporation
 *
 * SPDX-License-Identifier: MIT
 */

/*============================================================================*
 *               Define to prevent recursive inclusion
 *============================================================================*/
#ifndef __GUI_OPENCLAW_EMOJI_H__
#define __GUI_OPENCLAW_EMOJI_H__
#ifdef __cplusplus
extern "C" {
#endif

/*============================================================================*
 *                        Header Files
 *============================================================================*/
#include "guidef.h"
#include "gui_api.h"
#include "gui_img.h"
#include "gui_obj.h"

/*============================================================================*
 *                         Types
 *============================================================================*/

/**
 * @brief Predefined expression types for the OpenClaw emoji widget.
 */
typedef enum
{
    GUI_OPENCLAW_EXPR_NEUTRAL = 0,   /**< Neutral face          */
    GUI_OPENCLAW_EXPR_HAPPY,         /**< Happy / smiling       */
    GUI_OPENCLAW_EXPR_SAD,           /**< Sad face              */
    GUI_OPENCLAW_EXPR_ANGRY,         /**< Angry face            */
    GUI_OPENCLAW_EXPR_SURPRISED,     /**< Surprised / shocked   */
    GUI_OPENCLAW_EXPR_THINKING,      /**< Thinking face         */
    GUI_OPENCLAW_EXPR_SLEEPING,      /**< Sleeping / zzz        */
    GUI_OPENCLAW_EXPR_LOVE,          /**< Heart-eyes            */
    GUI_OPENCLAW_EXPR_WINK,          /**< Winking               */
    GUI_OPENCLAW_EXPR_MAX,
} gui_openclaw_expr_t;

/**
 * @brief Fine-grained expression parameters for continuous control.
 *
 * Values are in the range [0.0 .. 1.0] unless stated otherwise.
 * When receiving expression data from OpenClaw (via MQTT / JSON),
 * map the fields to these parameters for smooth animation.
 */
typedef struct gui_openclaw_emoji_params
{
    float eye_open_l;       /**< Left  eye openness (0 = closed, 1 = fully open) */
    float eye_open_r;       /**< Right eye openness                              */
    float pupil_x;          /**< Pupil horizontal offset (-1 left .. +1 right)   */
    float pupil_y;          /**< Pupil vertical   offset (-1 up   .. +1 down)    */
    float mouth_open;       /**< Mouth openness   (0 = closed, 1 = wide open)    */
    float mouth_smile;      /**< Mouth curvature  (-1 = frown, +1 = smile)       */
    float brow_raise_l;     /**< Left  eyebrow raise  (0 .. 1)                   */
    float brow_raise_r;     /**< Right eyebrow raise  (0 .. 1)                   */
    float blush;            /**< Blush intensity (0 .. 1)                         */
} gui_openclaw_emoji_params_t;

/**
 * @brief OpenClaw emoji widget context (opaque to the caller).
 */
typedef struct gui_openclaw_emoji_ctx gui_openclaw_emoji_ctx_t;

/**
 * @brief The public handle returned to callers is simply a gui_img_t*.
 */
typedef gui_img_t gui_openclaw_emoji_widget_t;

/*============================================================================*
 *                         Functions
 *============================================================================*/

/**
 * @brief Create an OpenClaw emoji expression widget.
 *
 * Allocates a frame buffer, uses NanoVG to draw the face,
 * and displays the result via a gui_img widget.
 *
 * @param parent   Parent widget in the GUI tree.
 * @param name     Widget name.
 * @param x        X-axis coordinate relative to parent.
 * @param y        Y-axis coordinate relative to parent.
 * @param w        Width in pixels (of the face canvas).
 * @param h        Height in pixels (of the face canvas).
 * @return gui_openclaw_emoji_widget_t*  Pointer to the created widget,
 *         or NULL on failure.
 */
gui_openclaw_emoji_widget_t *gui_openclaw_emoji_create(void       *parent,
                                                       const char *name,
                                                       int16_t     x,
                                                       int16_t     y,
                                                       int16_t     w,
                                                       int16_t     h);

/**
 * @brief Switch to a predefined expression.
 *
 * @param widget  Widget handle returned by gui_openclaw_emoji_create().
 * @param expr    One of the GUI_OPENCLAW_EXPR_* values.
 */
void gui_openclaw_emoji_set_expression(gui_openclaw_emoji_widget_t *widget,
                                       gui_openclaw_expr_t          expr);

/**
 * @brief Set fine-grained expression parameters (for continuous animation).
 *
 * @param widget  Widget handle.
 * @param params  Pointer to the parameter struct.
 */
void gui_openclaw_emoji_set_params(gui_openclaw_emoji_widget_t       *widget,
                                   const gui_openclaw_emoji_params_t *params);

/**
 * @brief Force a redraw of the emoji face buffer.
 *
 * Normally the widget redraws automatically via its timer.
 * Call this if you want an immediate refresh.
 *
 * @param widget  Widget handle.
 */
void gui_openclaw_emoji_refresh(gui_openclaw_emoji_widget_t *widget);

/**
 * @brief Parse an OpenClaw JSON expression payload and apply it.
 *
 * Expected JSON keys (all optional, float values):
 *   eye_open_l, eye_open_r, pupil_x, pupil_y,
 *   mouth_open, mouth_smile, brow_raise_l, brow_raise_r, blush
 *
 * Unknown keys or malformed input are silently ignored.
 *
 * @param widget  Widget handle.
 * @param json    Null-terminated JSON string from OpenClaw.
 * @return true if at least one parameter was successfully parsed.
 */
bool gui_openclaw_emoji_apply_json(gui_openclaw_emoji_widget_t *widget,
                                   const char                  *json);

#ifdef __cplusplus
}
#endif

#endif /* __GUI_OPENCLAW_EMOJI_H__ */
