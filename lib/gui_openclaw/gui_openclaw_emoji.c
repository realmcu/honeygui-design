/*
 * Copyright (c) 2026, Realtek Semiconductor Corporation
 *
 * SPDX-License-Identifier: MIT
 */

/*============================================================================*
 *                        Header Files
 *============================================================================*/
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include "gui_openclaw_emoji.h"
#include "gui_fb.h"
#include "gui_api_os.h"
#include "nanovg.h"

/*============================================================================*
 *                           Types
 *============================================================================*/

/** @brief Internal context – one per emoji widget instance. */
struct gui_openclaw_emoji_ctx
{
    gui_img_t                   *img_widget;    /**< The gui_img displaying this face        */
    struct gui_openclaw_emoji_ctx *next;         /**< Linked-list of all emoji instances       */
    gui_rgb_data_head_t         *image_data;    /**< Raw image header + pixel buffer          */
    uint8_t                     *pixel_buf;     /**< Points past the header into pixel_data   */
    int16_t                      width;
    int16_t                      height;
    bool                         dirty;         /**< Needs redraw                             */

    /* Expression state */
    gui_openclaw_expr_t          expression;
    gui_openclaw_emoji_params_t  params;

    /* Simple animation */
    uint32_t                     tick;
    uint32_t                     rng_state;

    /* Blink animation */
    uint16_t                     blink_frame;
    uint16_t                     blink_total_frames;
    uint16_t                     blink_close_frames;
    uint16_t                     blink_hold_frames;
    uint16_t                     blink_open_frames;
    uint16_t                     blink_next_frames;
};

/*============================================================================*
 *                           Constants
 *============================================================================*/
#ifndef M_PI
#define M_PI 3.14159265358979323846f
#endif

/*============================================================================*
 *                            Variables
 *============================================================================*/
static gui_openclaw_emoji_ctx_t *s_emoji_ctx_list = NULL;

/*============================================================================*
 *                       NanoVG AGGE extern
 *============================================================================*/
extern NVGcontext *nvgCreateAGGE(uint32_t w, uint32_t h, uint32_t stride,
                                 enum NVGtexture format, uint8_t *data);
extern void nvgDeleteAGGE(NVGcontext *ctx);

/*============================================================================*
 *                        Private: context helpers
 *============================================================================*/
static gui_openclaw_emoji_ctx_t *emoji_find_ctx(gui_openclaw_emoji_widget_t *widget)
{
    gui_openclaw_emoji_ctx_t *ctx = s_emoji_ctx_list;
    while (ctx)
    {
        if (ctx->img_widget == (gui_img_t *)widget)
        {
            return ctx;
        }
        ctx = ctx->next;
    }
    return NULL;
}

static void emoji_register_ctx(gui_openclaw_emoji_ctx_t *ctx)
{
    ctx->next = s_emoji_ctx_list;
    s_emoji_ctx_list = ctx;
}

/*============================================================================*
 *              Private: map predefined expression to params
 *============================================================================*/
static void emoji_preset_to_params(gui_openclaw_expr_t expr,
                                   gui_openclaw_emoji_params_t *p)
{
    /* default: neutral */
    p->eye_open_l  = 1.0f;
    p->eye_open_r  = 1.0f;
    p->pupil_x     = 0.0f;
    p->pupil_y     = 0.0f;
    p->mouth_open  = 0.0f;
    p->mouth_smile = 0.0f;
    p->brow_raise_l = 0.5f;
    p->brow_raise_r = 0.5f;
    p->blush       = 0.0f;

    switch (expr)
    {
    case GUI_OPENCLAW_EXPR_HAPPY:
        p->mouth_smile = 1.0f;
        p->eye_open_l  = 0.6f;
        p->eye_open_r  = 0.6f;
        p->blush       = 0.4f;
        break;

    case GUI_OPENCLAW_EXPR_SAD:
        p->mouth_smile = -0.8f;
        p->brow_raise_l = 0.8f;
        p->brow_raise_r = 0.8f;
        break;

    case GUI_OPENCLAW_EXPR_ANGRY:
        p->mouth_smile = -0.5f;
        p->mouth_open  = 0.3f;
        p->brow_raise_l = 0.0f;
        p->brow_raise_r = 0.0f;
        break;

    case GUI_OPENCLAW_EXPR_SURPRISED:
        p->mouth_open  = 0.9f;
        p->mouth_smile = 0.0f;
        p->eye_open_l  = 1.0f;
        p->eye_open_r  = 1.0f;
        p->brow_raise_l = 1.0f;
        p->brow_raise_r = 1.0f;
        break;

    case GUI_OPENCLAW_EXPR_THINKING:
        p->pupil_x     = 0.6f;
        p->pupil_y     = -0.4f;
        p->mouth_smile = 0.15f;
        p->brow_raise_l = 0.7f;
        p->brow_raise_r = 0.3f;
        break;

    case GUI_OPENCLAW_EXPR_SLEEPING:
        p->eye_open_l  = 0.0f;
        p->eye_open_r  = 0.0f;
        p->mouth_open  = 0.15f;
        p->mouth_smile = 0.0f;
        break;

    case GUI_OPENCLAW_EXPR_LOVE:
        p->mouth_smile = 0.9f;
        p->eye_open_l  = 0.7f;
        p->eye_open_r  = 0.7f;
        p->blush       = 0.8f;
        break;

    case GUI_OPENCLAW_EXPR_WINK:
        p->eye_open_l  = 1.0f;
        p->eye_open_r  = 0.05f;
        p->mouth_smile = 0.6f;
        break;

    default:
        break;
    }
}

/*============================================================================*
 *              Private: NanoVG drawing helpers
 *============================================================================*/

/**
 * @brief Clamp a float to [lo, hi].
 */
static float emoji_clampf(float v, float lo, float hi)
{
    if (v < lo) { return lo; }
    if (v > hi) { return hi; }
    return v;
}

/**
 * @brief Lerp between two values.
 */
static float emoji_lerpf(float a, float b, float t)
{
    return a + (b - a) * t;
}

/**
 * @brief Per-widget pseudo-random generator.
 */
static uint32_t emoji_rand_next(gui_openclaw_emoji_ctx_t *ctx)
{
    if (ctx == NULL)
    {
        return 0U;
    }

    if (ctx->rng_state == 0U)
    {
        ctx->rng_state = 0x5A17U;
    }

    ctx->rng_state = ctx->rng_state * 1103515245U + 12345U;
    return (ctx->rng_state >> 16) & 0x7FFFU;
}

/**
 * @brief Return a random integer in [min_v, max_v].
 */
static uint32_t emoji_rand_range(gui_openclaw_emoji_ctx_t *ctx,
                                 uint32_t                  min_v,
                                 uint32_t                  max_v)
{
    if (max_v <= min_v)
    {
        return min_v;
    }

    return min_v + (emoji_rand_next(ctx) % (max_v - min_v + 1U));
}

/**
 * @brief Blink frequency multiplier by expression.
 */
static float emoji_blink_frequency_scale(gui_openclaw_expr_t expr)
{
    switch (expr)
    {
    case GUI_OPENCLAW_EXPR_SURPRISED:
    case GUI_OPENCLAW_EXPR_LOVE:
        return 0.7f;

    case GUI_OPENCLAW_EXPR_ANGRY:
        return 1.3f;

    case GUI_OPENCLAW_EXPR_SLEEPING:
        return 0.0f;

    default:
        return 1.0f;
    }
}

/**
 * @brief Schedule the next idle blink in 4~12 seconds, with expression bias.
 */
static void emoji_blink_schedule_next(gui_openclaw_emoji_ctx_t *ctx)
{
    float scale;
    uint32_t min_frames;
    uint32_t max_frames;

    if (ctx == NULL)
    {
        return;
    }

    scale = emoji_blink_frequency_scale(ctx->expression);
    if (scale <= 0.0f)
    {
        ctx->blink_next_frames = 0xFFFFU;
        return;
    }

    min_frames = (uint32_t)(120.0f / scale + 0.5f);
    max_frames = (uint32_t)(360.0f / scale + 0.5f);
    ctx->blink_next_frames = (uint16_t)emoji_rand_range(ctx, min_frames, max_frames);
}

/**
 * @brief Start one blink: quick close, short hold, slow open.
 */
static void emoji_blink_start(gui_openclaw_emoji_ctx_t *ctx)
{
    uint32_t total;
    uint32_t close_frames;
    uint32_t hold_frames;

    if (ctx == NULL)
    {
        return;
    }

    if (emoji_blink_frequency_scale(ctx->expression) <= 0.0f)
    {
        ctx->blink_frame = 0U;
        ctx->blink_total_frames = 0U;
        ctx->blink_close_frames = 0U;
        ctx->blink_hold_frames = 0U;
        ctx->blink_open_frames = 0U;
        ctx->blink_next_frames = 0xFFFFU;
        return;
    }

    total = emoji_rand_range(ctx, 8U, 12U);
    close_frames = emoji_rand_range(ctx, 2U, 3U);
    hold_frames = (total >= 10U && (emoji_rand_next(ctx) & 0x1U) != 0U) ? 2U : 1U;

    if ((close_frames + hold_frames + 4U) > total)
    {
        close_frames = 2U;
        hold_frames = 1U;
    }

    ctx->blink_frame = 0U;
    ctx->blink_total_frames = (uint16_t)total;
    ctx->blink_close_frames = (uint16_t)close_frames;
    ctx->blink_hold_frames = (uint16_t)hold_frames;
    ctx->blink_open_frames = (uint16_t)(total - close_frames - hold_frames);
    emoji_blink_schedule_next(ctx);
}

/**
 * @brief Return blink closure amount in [0, 1].
 */
static float emoji_blink_closed_amount(const gui_openclaw_emoji_ctx_t *ctx)
{
    uint32_t frame;
    uint32_t close_end;
    uint32_t hold_end;

    if (ctx == NULL || ctx->blink_total_frames == 0U ||
        ctx->blink_frame >= ctx->blink_total_frames)
    {
        return 0.0f;
    }

    frame = (uint32_t)ctx->blink_frame;
    close_end = (uint32_t)ctx->blink_close_frames;
    hold_end = close_end + (uint32_t)ctx->blink_hold_frames;

    if (frame < close_end)
    {
        float t = (float)(frame + 1U) / (float)(close_end > 0U ? close_end : 1U);
        return 1.0f - powf(1.0f - t, 2.6f);
    }

    if (frame < hold_end)
    {
        return 1.0f;
    }

    if (ctx->blink_open_frames > 0U)
    {
        float t = (float)(frame - hold_end + 1U) / (float)ctx->blink_open_frames;
        t = emoji_clampf(t, 0.0f, 1.0f);
        return powf(1.0f - t, 1.8f);
    }

    return 0.0f;
}

/**
 * @brief Compose render parameters with the current blink overlay.
 */
static void emoji_compose_render_params(const gui_openclaw_emoji_ctx_t *ctx,
                                        gui_openclaw_emoji_params_t     *out)
{
    float closed_amount;
    float eye_scale;

    if (ctx == NULL || out == NULL)
    {
        return;
    }

    *out = ctx->params;
    closed_amount = emoji_blink_closed_amount(ctx);
    if (closed_amount <= 0.0f)
    {
        return;
    }

    eye_scale = 1.0f - closed_amount;
    out->eye_open_l = emoji_clampf(out->eye_open_l * eye_scale, 0.0f, 1.0f);
    out->eye_open_r = emoji_clampf(out->eye_open_r * eye_scale, 0.0f, 1.0f);
}

/**
 * @brief Draw the entire face expression into the NVGcontext.
 *
 * Centre of the face is at (cx, cy) with radius r.
 */
static void emoji_draw_face(NVGcontext *vg,
                             float cx, float cy, float r,
                             const gui_openclaw_emoji_params_t *p,
                             gui_openclaw_expr_t expr,
                             uint32_t tick)
{
    
    float eye_spacing = r * 0.35f;
    float eye_y       = cy - r * 0.15f;
    float eye_rx      = r * 0.16f;
    float eye_ry_max  = r * 0.20f;
    float pupil_r     = r * 0.08f;
    float mouth_y     = cy + r * 0.35f;
    float mouth_w     = r * 0.45f;
    float brow_len    = r * 0.22f;
    float brow_y_base = eye_y - r * 0.28f;

    /* --- Face circle (filled) --- */
    nvgBeginPath(vg);
    nvgCircle(vg, cx, cy, r);
    nvgFillColor(vg, nvgRGBA(255, 220, 80, 255));
    nvgFill(vg);

    /* face outline */
    nvgBeginPath(vg);
    nvgCircle(vg, cx, cy, r);
    nvgStrokeWidth(vg, r * 0.04f);
    nvgStrokeColor(vg, nvgRGBA(200, 160, 40, 255));
    nvgStroke(vg);

    /* --- Blush --- */
    if (p->blush > 0.01f)
    {
        uint8_t blush_a = (uint8_t)(emoji_clampf(p->blush, 0.0f, 1.0f) * 120.0f);
        float blush_r = r * 0.18f;
        float blush_y = cy + r * 0.10f;

        nvgBeginPath(vg);
        nvgEllipse(vg, cx - eye_spacing - r * 0.08f, blush_y, blush_r, blush_r * 0.6f);
        nvgFillColor(vg, nvgRGBA(255, 100, 100, blush_a));
        nvgFill(vg);

        nvgBeginPath(vg);
        nvgEllipse(vg, cx + eye_spacing + r * 0.08f, blush_y, blush_r, blush_r * 0.6f);
        nvgFillColor(vg, nvgRGBA(255, 100, 100, blush_a));
        nvgFill(vg);
    }

    /* --- Eyes --- */
    {
        float lo = emoji_clampf(p->eye_open_l, 0.0f, 1.0f);
        float ro = emoji_clampf(p->eye_open_r, 0.0f, 1.0f);
        float ley = eye_ry_max * lo;
        float rey = eye_ry_max * ro;
        float lpx = cx - eye_spacing + emoji_clampf(p->pupil_x, -1, 1) * eye_rx * 0.5f;
        float lpy = eye_y          + emoji_clampf(p->pupil_y, -1, 1) * ley   * 0.3f;
        float rpx = cx + eye_spacing + emoji_clampf(p->pupil_x, -1, 1) * eye_rx * 0.5f;
        float rpy = eye_y           + emoji_clampf(p->pupil_y, -1, 1) * rey   * 0.3f;

        /* eye whites */
        nvgBeginPath(vg);
        nvgEllipse(vg, cx - eye_spacing, eye_y, eye_rx, ley > 1.0f ? ley : 1.0f);
        nvgFillColor(vg, nvgRGBA(255, 255, 255, 255));
        nvgFill(vg);
        nvgStrokeWidth(vg, 1.5f);
        nvgStrokeColor(vg, nvgRGBA(80, 60, 20, 255));
        nvgStroke(vg);

        nvgBeginPath(vg);
        nvgEllipse(vg, cx + eye_spacing, eye_y, eye_rx, rey > 1.0f ? rey : 1.0f);
        nvgFillColor(vg, nvgRGBA(255, 255, 255, 255));
        nvgFill(vg);
        nvgStrokeWidth(vg, 1.5f);
        nvgStrokeColor(vg, nvgRGBA(80, 60, 20, 255));
        nvgStroke(vg);

        /* pupils (only visible when eye is open enough) */
        if (lo > 0.15f)
        {
            nvgBeginPath(vg);
            nvgCircle(vg, lpx, lpy, pupil_r * lo);
            nvgFillColor(vg, nvgRGBA(40, 30, 10, 255));
            nvgFill(vg);
        }
        if (ro > 0.15f)
        {
            nvgBeginPath(vg);
            nvgCircle(vg, rpx, rpy, pupil_r * ro);
            nvgFillColor(vg, nvgRGBA(40, 30, 10, 255));
            nvgFill(vg);
        }

        /* Love expression: draw hearts instead of pupils */
        if (p->blush > 0.6f && lo > 0.3f && ro > 0.3f)
        {
            /* Tiny heart shape (simplified with two arcs + triangle) */
            float hs = pupil_r * 1.8f;
            float hx[2];
            float hy;
            int hi;

            hx[0] = cx - eye_spacing;
            hx[1] = cx + eye_spacing;
            hy  = eye_y;
            for (hi = 0; hi < 2; hi++)
            {
                nvgBeginPath(vg);
                nvgMoveTo(vg, hx[hi], hy + hs * 0.6f);
                nvgBezierTo(vg, hx[hi] - hs, hy - hs * 0.2f,
                            hx[hi] - hs * 0.5f, hy - hs,
                            hx[hi], hy - hs * 0.3f);
                nvgBezierTo(vg, hx[hi] + hs * 0.5f, hy - hs,
                            hx[hi] + hs, hy - hs * 0.2f,
                            hx[hi], hy + hs * 0.6f);
                nvgFillColor(vg, nvgRGBA(220, 40, 60, 200));
                nvgFill(vg);
            }
        }
    }

    /* --- Eyebrows --- */
    {
        float bl = emoji_clampf(p->brow_raise_l, 0, 1);
        float br = emoji_clampf(p->brow_raise_r, 0, 1);
        float lby = brow_y_base - bl * r * 0.12f;
        float rby = brow_y_base - br * r * 0.12f;
        float angle_l = emoji_lerpf(0.25f, -0.15f, bl);
        float angle_r = emoji_lerpf(-0.25f, 0.15f, br);

        nvgStrokeWidth(vg, r * 0.05f);
        nvgStrokeColor(vg, nvgRGBA(80, 50, 20, 255));
        nvgLineCap(vg, NVG_ROUND);

        /* left brow */
        nvgBeginPath(vg);
        nvgMoveTo(vg,
                  cx - eye_spacing - brow_len * cosf(angle_l),
                  lby - brow_len * sinf(angle_l));
        nvgLineTo(vg,
                  cx - eye_spacing + brow_len * cosf(angle_l),
                  lby + brow_len * sinf(angle_l));
        nvgStroke(vg);

        /* right brow */
        nvgBeginPath(vg);
        nvgMoveTo(vg,
                  cx + eye_spacing - brow_len * cosf(angle_r),
                  rby - brow_len * sinf(angle_r));
        nvgLineTo(vg,
                  cx + eye_spacing + brow_len * cosf(angle_r),
                  rby + brow_len * sinf(angle_r));
        nvgStroke(vg);
    }

    /* --- Mouth --- */
    {
        float smile = emoji_clampf(p->mouth_smile, -1, 1);
        float openf = emoji_clampf(p->mouth_open, 0, 1);
        float curve = smile * r * 0.25f;
        float gap   = openf * r * 0.22f;
        float smile_open = emoji_clampf(smile, 0.0f, 1.0f);
        if (smile>0 )
        {
            openf = 0;
            smile_open = 0;
        }
        nvgStrokeWidth(vg, r * 0.04f);
        nvgStrokeColor(vg, nvgRGBA(160, 80, 20, 255));
        nvgLineCap(vg, NVG_ROUND);

          /* Use a normalized mouth-open threshold instead of a pixel threshold.
              Otherwise the same JSON can look like a smile on small widgets but
              degrade into a flat oval on larger widgets. */
          if (openf < 0.2f)
        {
            /* Closed mouth – just a curve */
            nvgBeginPath(vg);
            nvgMoveTo(vg, cx - mouth_w, mouth_y);
            nvgBezierTo(vg,
                        cx - mouth_w * 0.5f, mouth_y + curve,
                        cx + mouth_w * 0.5f, mouth_y + curve,
                        cx + mouth_w, mouth_y);
            nvgStroke(vg);
        }
     else if (smile_open > 0.25f && openf < 0.55f)
{
    // 下半月牙大笑 ── 重点修复上唇弧线（避免折线）

    float base_y       = mouth_y + r * 0.08f;
    float corner_lift  = smile_open * r * 0.20f;            // 嘴角抬高幅度
    float width        = mouth_w * (0.88f + 0.70f * smile_open);

    float bottom_y     = base_y + smile_open * r * 0.32f;   // 下唇最低点
    float upper_mid_y  = base_y - corner_lift * 0.15f;      // 上唇中间点 ── 比嘴角略低一点，形成浅浅下凹弧

    float ctrl_out     = width * 0.65f;
    float ctrl_mid     = width * 0.28f;                     // 中间控制点x距离（越小弧越圆）

    nvgBeginPath(vg);
    nvgMoveTo(vg, cx - width, base_y - corner_lift);        // 左嘴角（高）

    // ────────────── 上唇部分：从左嘴角 → 中间 → 右嘴角 ──────────────
    // 关键：控制点y值接近嘴角高度 + 轻微下移，形成柔和的向下弧而不是折线
    nvgBezierTo(vg,
                cx - ctrl_out, base_y - corner_lift * 0.85f,   // 左控制点：略低于嘴角
                cx - ctrl_mid, upper_mid_y,                    // 中左控制点
                cx,            upper_mid_y);                   // 上唇中间（浅下凹）

    nvgBezierTo(vg,
                cx + ctrl_mid, upper_mid_y,
                cx + ctrl_out, base_y - corner_lift * 0.85f,
                cx + width,    base_y - corner_lift);          // 右嘴角（高）

    // ────────────── 下唇部分：从右嘴角 → 最低点 → 左嘴角 ──────────────
    nvgBezierTo(vg,
                cx + ctrl_out * 1.05f, bottom_y + r * 0.05f,
                cx + ctrl_mid * 1.1f,  bottom_y,
                cx,                    bottom_y);

    nvgBezierTo(vg,
                cx - ctrl_mid * 1.1f,  bottom_y,
                cx - ctrl_out * 1.05f, bottom_y + r * 0.05f,
                cx - width,            base_y - corner_lift);

    nvgClosePath(vg);

    nvgFillColor(vg, nvgRGBA(160, 55, 30, 255));
    nvgFill(vg);

    // 描边（建议保留，能更好看出弧线是否平滑）
    nvgStrokeColor(vg, nvgRGBA(90, 30, 15, 220));
    nvgStrokeWidth(vg, 1.6f);
    nvgStroke(vg);

    // 口腔内填充（可选）
    // if (openf > 0.28f)
    // {
    //     nvgBeginPath(vg);
    //     nvgEllipse(vg, cx, bottom_y + r * 0.05f,
    //                width * 0.50f,
    //                r * (0.09f + 0.15f * smile_open));
    //     nvgFillColor(vg, nvgRGBA(190, 60, 80, 160));
    //     nvgFill(vg);
    // }
}
        else
        {
            /* Open mouth – filled ellipse shaped by curve + gap */
            nvgBeginPath(vg);
            nvgEllipse(vg, cx, mouth_y + curve * 0.5f, mouth_w, gap);
            nvgFillColor(vg, nvgRGBA(140, 50, 20, 255));
            nvgFill(vg);
            nvgStroke(vg);

            /* Tongue hint when mouth is wide open */
            if (openf > 0.5f)
            {
                nvgBeginPath(vg);
                nvgEllipse(vg, cx, mouth_y + curve * 0.5f + gap * 0.5f,
                           mouth_w * 0.5f, gap * 0.4f);
                nvgFillColor(vg, nvgRGBA(220, 100, 100, 200));
                nvgFill(vg);
            }
        }
    }

    /* --- Sleeping: ZZZ text --- */
    if (expr == GUI_OPENCLAW_EXPR_SLEEPING &&
        p->eye_open_l < 0.05f && p->eye_open_r < 0.05f)
    {
        float zy  = cy - r * 0.55f;
        float zx  = cx + r * 0.5f;
        float amp = (float)sinf((float)tick * 0.15f) * 3.0f;

        nvgFontSize(vg, r * 0.22f);
        nvgFillColor(vg, nvgRGBA(100, 100, 200, 180));
        nvgTextAlign(vg, NVG_ALIGN_LEFT | NVG_ALIGN_MIDDLE);

        /* We do a simple approximation since we may not have
           a font loaded in this context – draw Z shapes manually */
        {
            float zw = r * 0.12f;
            float zh = r * 0.14f;
            int zi;

            for (zi = 0; zi < 3; zi++)
            {
                float ox = zx + (float)zi * zw * 1.4f;
                float oy = zy - (float)zi * zh * 0.8f + amp;
                float s  = 1.0f - (float)zi * 0.2f;

                nvgStrokeWidth(vg, r * 0.025f * s);
                nvgStrokeColor(vg, nvgRGBA(100, 100, 200, (unsigned char)(180 - zi * 40)));
                nvgBeginPath(vg);
                nvgMoveTo(vg, ox, oy);
                nvgLineTo(vg, ox + zw * s, oy);
                nvgLineTo(vg, ox, oy + zh * s);
                nvgLineTo(vg, ox + zw * s, oy + zh * s);
                nvgStroke(vg);
            }
        }
    }

    GUI_UNUSED(tick);
}

/*============================================================================*
 *              Private: render the whole framebuffer
 *============================================================================*/
static void emoji_render(gui_openclaw_emoji_ctx_t *ctx)
{
    gui_dispdev_t *dc;
    NVGcontext *vg;
    int w, h;
    float cx, cy, r;
    gui_openclaw_emoji_params_t render_params;

    if (ctx == NULL || ctx->pixel_buf == NULL)
    {
        return;
    }

    dc = gui_get_dc();
    w  = ctx->width;
    h  = ctx->height;

    /* Clear the pixel buffer to transparent / background */
    memset(ctx->pixel_buf, 0x00, (size_t)w * (size_t)h * (size_t)(dc->bit_depth >> 3));

    /* Create NanoVG context that renders into our buffer */
    vg = nvgCreateAGGE((uint32_t)w, (uint32_t)h,
                       (uint32_t)w * (uint32_t)(dc->bit_depth >> 3),
                       (dc->bit_depth >> 3) == 2 ? NVG_TEXTURE_BGR565 : NVG_TEXTURE_BGRA,
                       ctx->pixel_buf);
    if (vg == NULL)
    {
        return;
    }

    nvgBeginFrame(vg, (float)w, (float)h, 1.0f);
    nvgResetTransform(vg);

    /* Background fill (light grey, rounded rect) */
    nvgBeginPath(vg);
    nvgRoundedRect(vg, 1.0f, 1.0f, (float)(w - 2), (float)(h - 2), (float)w * 0.1f);
    nvgFillColor(vg, nvgRGBA(245, 240, 220, 255));
    nvgFill(vg);

    /* Draw the face centred */
    cx = (float)w * 0.5f;
    cy = (float)h * 0.5f;
    r  = ((float)(w < h ? w : h)) * 0.40f;

    emoji_compose_render_params(ctx, &render_params);
    emoji_draw_face(vg, cx, cy, r, &render_params, ctx->expression, ctx->tick);

    nvgEndFrame(vg);
    nvgDeleteAGGE(vg);

    ctx->dirty = false;
}

/*============================================================================*
 *              Private: timer callback (called every frame)
 *============================================================================*/
static void emoji_timer_cb(void *param)
{
    gui_openclaw_emoji_ctx_t *ctx;
    bool blink_started = false;

    ctx = emoji_find_ctx((gui_openclaw_emoji_widget_t *)param);
    if (ctx == NULL)
    {
        return;
    }

    ctx->tick++;

    if (ctx->expression == GUI_OPENCLAW_EXPR_SLEEPING)
    {
        ctx->blink_frame = 0U;
        ctx->blink_total_frames = 0U;
        ctx->blink_close_frames = 0U;
        ctx->blink_hold_frames = 0U;
        ctx->blink_open_frames = 0U;
        ctx->blink_next_frames = 0xFFFFU;
    }
    else if (ctx->blink_total_frames > 0U)
    {
        emoji_render(ctx);
        gui_fb_change();

        ctx->blink_frame++;
        if (ctx->blink_frame >= ctx->blink_total_frames)
        {
            ctx->blink_frame = 0U;
            ctx->blink_total_frames = 0U;
            ctx->blink_close_frames = 0U;
            ctx->blink_hold_frames = 0U;
            ctx->blink_open_frames = 0U;
        }

        return;
    }
    else
    {
        uint32_t burst_threshold;

        if (ctx->blink_next_frames != 0xFFFFU && ctx->blink_next_frames > 0U)
        {
            ctx->blink_next_frames--;
        }

        if (ctx->blink_next_frames == 0U)
        {
            blink_started = true;
        }
        else
        {
            burst_threshold = (uint32_t)(emoji_blink_frequency_scale(ctx->expression) * 10.0f + 0.5f);
            if (burst_threshold > 0U && emoji_rand_range(ctx, 0U, 999U) < burst_threshold)
            {
                blink_started = true;
            }
        }
    }

    if (blink_started)
    {
        emoji_blink_start(ctx);
        emoji_render(ctx);
        gui_fb_change();

        ctx->blink_frame++;
        if (ctx->blink_frame >= ctx->blink_total_frames)
        {
            ctx->blink_frame = 0U;
            ctx->blink_total_frames = 0U;
            ctx->blink_close_frames = 0U;
            ctx->blink_hold_frames = 0U;
            ctx->blink_open_frames = 0U;
        }
        return;
    }

    if (ctx->dirty || (ctx->tick % 6U) == 0U)
    {
        emoji_render(ctx);
        gui_fb_change();
    }
}

/*============================================================================*
 *              Private: simple JSON value parser (no dependency)
 *============================================================================*/

/**
 * @brief Find "key": <number> in a JSON string, return the number.
 *        Returns false if key not found.
 */
static bool emoji_json_get_float(const char *json, const char *key, float *out)
{
    const char *pos;
    char search[64];
    int len;

    if (json == NULL || key == NULL || out == NULL)
    {
        return false;
    }

    len = snprintf(search, sizeof(search), "\"%s\"", key);
    if (len <= 0)
    {
        return false;
    }

    pos = strstr(json, search);
    if (pos == NULL)
    {
        return false;
    }

    /* skip past "key" */
    pos += len;
    /* skip whitespace and colon */
    while (*pos == ' ' || *pos == '\t' || *pos == ':')
    {
        pos++;
    }

    *out = (float)atof(pos);
    return true;
}

/*============================================================================*
 *                           Public Functions
 *============================================================================*/

gui_openclaw_emoji_widget_t *gui_openclaw_emoji_create(void       *parent,
                                                       const char *name,
                                                       int16_t     x,
                                                       int16_t     y,
                                                       int16_t     w,
                                                       int16_t     h)
{
    gui_openclaw_emoji_ctx_t *ctx;
    gui_img_t *img;
    gui_dispdev_t *dc;
    size_t buf_size;

    if (parent == NULL || w <= 0 || h <= 0)
    {
        return NULL;
    }
    if (name == NULL)
    {
        name = "openclaw_emoji";
    }

    dc = gui_get_dc();

    /* Allocate context */
    ctx = gui_malloc(sizeof(gui_openclaw_emoji_ctx_t));
    GUI_ASSERT(ctx != NULL);
    memset(ctx, 0x00, sizeof(gui_openclaw_emoji_ctx_t));

    ctx->width  = w;
    ctx->height = h;
    ctx->dirty  = true;
    ctx->expression = GUI_OPENCLAW_EXPR_NEUTRAL;
    ctx->rng_state = (((uint32_t)(uint16_t)w << 16) ^ (uint32_t)(uint16_t)h ^ 0x5A17U);

    /* Allocate the frame buffer (header + pixels) */
    buf_size = sizeof(gui_rgb_data_head_t)
               + (size_t)w * (size_t)h * (size_t)(dc->bit_depth >> 3);
    ctx->image_data = gui_malloc(buf_size);
    GUI_ASSERT(ctx->image_data != NULL);
    memset(ctx->image_data, 0x00, buf_size);

    ctx->image_data->type = (dc->bit_depth >> 3) == 2 ? RGB565 : ARGB8888;
    ctx->image_data->w    = w;
    ctx->image_data->h    = h;
    ctx->pixel_buf = (uint8_t *)ctx->image_data + sizeof(gui_rgb_data_head_t);

    /* Set default expression */
    emoji_preset_to_params(GUI_OPENCLAW_EXPR_NEUTRAL, &ctx->params);
    emoji_blink_schedule_next(ctx);

    /* Do an initial render */
    emoji_render(ctx);

    /* Create a gui_img to display our buffer */
    img = gui_img_create_from_mem(parent, name, ctx->image_data, x, y, 0, 0);
    GUI_ASSERT(img != NULL);
    ctx->img_widget = img;

    /* Register in the global list */
    emoji_register_ctx(ctx);

    /* Start a periodic timer for animation (33 ms ≈ 30 fps) */
    gui_obj_create_timer(&(img->base), 33, true, emoji_timer_cb);
    gui_obj_start_timer(&(img->base));

    gui_log("openclaw_emoji: created %dx%d, buf=%d bytes\n",
            w, h, (int)buf_size);

    return (gui_openclaw_emoji_widget_t *)img;
}

void gui_openclaw_emoji_set_expression(gui_openclaw_emoji_widget_t *widget,
                                       gui_openclaw_expr_t          expr)
{
    gui_openclaw_emoji_ctx_t *ctx = emoji_find_ctx(widget);
    if (ctx == NULL || expr >= GUI_OPENCLAW_EXPR_MAX)
    {
        return;
    }

    ctx->expression = expr;
    emoji_preset_to_params(expr, &ctx->params);
    ctx->blink_frame = 0U;
    ctx->blink_total_frames = 0U;
    ctx->blink_close_frames = 0U;
    ctx->blink_hold_frames = 0U;
    ctx->blink_open_frames = 0U;
    emoji_blink_schedule_next(ctx);
    ctx->dirty = true;
}

void gui_openclaw_emoji_set_params(gui_openclaw_emoji_widget_t       *widget,
                                   const gui_openclaw_emoji_params_t *params)
{
    gui_openclaw_emoji_ctx_t *ctx = emoji_find_ctx(widget);
    if (ctx == NULL || params == NULL)
    {
        return;
    }

    ctx->params = *params;
    ctx->dirty  = true;
}

void gui_openclaw_emoji_refresh(gui_openclaw_emoji_widget_t *widget)
{
    gui_openclaw_emoji_ctx_t *ctx = emoji_find_ctx(widget);
    if (ctx == NULL)
    {
        return;
    }

    emoji_render(ctx);
    gui_fb_change();
}

bool gui_openclaw_emoji_apply_json(gui_openclaw_emoji_widget_t *widget,
                                   const char                  *json)
{
    gui_openclaw_emoji_ctx_t *ctx = emoji_find_ctx(widget);
    bool any = false;

    if (ctx == NULL || json == NULL)
    {
        return false;
    }

    if (emoji_json_get_float(json, "eye_open_l", &ctx->params.eye_open_l))
    {
        any = true;
        gui_log("openclaw_emoji: parsed eye_open_l=%f\n", ctx->params.eye_open_l);
    }
    if (emoji_json_get_float(json, "eye_open_r", &ctx->params.eye_open_r))
    {
        any = true;
        gui_log("openclaw_emoji: parsed eye_open_r=%f\n", ctx->params.eye_open_r);
    }
    if (emoji_json_get_float(json, "pupil_x", &ctx->params.pupil_x))
    {
        any = true;
        gui_log("openclaw_emoji: parsed pupil_x=%f\n", ctx->params.pupil_x);
    }
    if (emoji_json_get_float(json, "pupil_y", &ctx->params.pupil_y))
    {
        any = true;
        gui_log("openclaw_emoji: parsed pupil_y=%f\n", ctx->params.pupil_y);
    }
    if (emoji_json_get_float(json, "mouth_open", &ctx->params.mouth_open))
    {
        any = true;
        gui_log("openclaw_emoji: parsed mouth_open=%f\n", ctx->params.mouth_open);
    }
    if (emoji_json_get_float(json, "mouth_smile", &ctx->params.mouth_smile))
    {
        any = true;
        gui_log("openclaw_emoji: parsed mouth_smile=%f\n", ctx->params.mouth_smile);
    }
    if (emoji_json_get_float(json, "brow_raise_l", &ctx->params.brow_raise_l))
    {
        any = true;
        gui_log("openclaw_emoji: parsed brow_raise_l=%f\n", ctx->params.brow_raise_l);
    }
    if (emoji_json_get_float(json, "brow_raise_r", &ctx->params.brow_raise_r))
    {
        any = true;
        gui_log("openclaw_emoji: parsed brow_raise_r=%f\n", ctx->params.brow_raise_r);
    }
    if (emoji_json_get_float(json, "blush", &ctx->params.blush))
    {
        any = true;
        gui_log("openclaw_emoji: parsed blush=%f\n", ctx->params.blush);
    }

    if (any)
    {
        ctx->dirty = true;
    }
    else
    {
        gui_log("openclaw_emoji: no supported JSON fields found\n");
    }
    return any;
}
