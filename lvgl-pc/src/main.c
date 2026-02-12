#include <stdint.h>

#include "lvgl.h"

#include "src/drivers/windows/lv_windows_display.h"
#include "src/drivers/windows/lv_windows_input.h"

typedef struct {
    lv_obj_t * value_label;
    lv_obj_t * bar;
    lv_obj_t * arc;
} slider_ui_ctx_t;

static slider_ui_ctx_t g_slider_ui_ctx;

static void slider_changed_cb(lv_event_t * e)
{
    lv_obj_t * slider = (lv_obj_t *)lv_event_get_target(e);
    slider_ui_ctx_t * ctx = (slider_ui_ctx_t *)lv_event_get_user_data(e);
    if(!slider || !ctx) return;

    int32_t v = lv_slider_get_value(slider);
    if(ctx->value_label) lv_label_set_text_fmt(ctx->value_label, "Slider: %d", (int)v);
    if(ctx->bar) lv_bar_set_value(ctx->bar, v, LV_ANIM_OFF);
    if(ctx->arc) lv_arc_set_value(ctx->arc, v);
}

static void create_ui(void)
{
    lv_obj_t * scr = lv_screen_active();

    lv_obj_t * cont = lv_obj_create(scr);
    lv_obj_set_size(cont, lv_pct(100), lv_pct(100));
    lv_obj_set_flex_flow(cont, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(cont, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_all(cont, 24, 0);
    lv_obj_set_style_pad_row(cont, 12, 0);
    /* If widgets exceed the window height, allow scrolling instead of clipping. */
    lv_obj_set_scroll_dir(cont, LV_DIR_VER);
    lv_obj_set_scrollbar_mode(cont, LV_SCROLLBAR_MODE_AUTO);

    lv_obj_t * title = lv_label_create(cont);
    lv_label_set_text(title, "Hello LVGL (MinGW + Windows backend)");

    lv_obj_t * btn = lv_button_create(cont);
    lv_obj_set_width(btn, 160);
    lv_obj_t * btn_label = lv_label_create(btn);
    lv_label_set_text(btn_label, "Button");
    lv_obj_center(btn_label);

    lv_obj_t * slider_value = lv_label_create(cont);
    lv_label_set_text(slider_value, "Slider: 30");

    lv_obj_t * slider = lv_slider_create(cont);
    lv_obj_set_width(slider, 360);
    lv_slider_set_range(slider, 0, 100);
    lv_slider_set_value(slider, 30, LV_ANIM_OFF);
    g_slider_ui_ctx.value_label = slider_value;
    g_slider_ui_ctx.bar = NULL;
    g_slider_ui_ctx.arc = NULL;
    lv_obj_add_event_cb(slider, slider_changed_cb, LV_EVENT_VALUE_CHANGED, &g_slider_ui_ctx);

    lv_obj_t * bar = lv_bar_create(cont);
    lv_obj_set_width(bar, 360);
    lv_bar_set_range(bar, 0, 100);
    lv_bar_set_value(bar, 30, LV_ANIM_OFF);
    g_slider_ui_ctx.bar = bar;

    lv_obj_t * arc = lv_arc_create(cont);
    lv_obj_set_size(arc, 120, 120);
    lv_arc_set_range(arc, 0, 100);
    lv_arc_set_value(arc, 30);
    g_slider_ui_ctx.arc = arc;

    lv_obj_t * sw = lv_switch_create(cont);
    lv_obj_add_state(sw, LV_STATE_CHECKED);

    lv_obj_t * cb = lv_checkbox_create(cont);
    lv_checkbox_set_text(cb, "Checkbox");

    lv_obj_t * dd = lv_dropdown_create(cont);
    lv_obj_set_width(dd, 220);
    lv_dropdown_set_options(dd, "Option A\nOption B\nOption C");

    lv_obj_t * ta = lv_textarea_create(cont);
    lv_obj_set_width(ta, 360);
    lv_textarea_set_one_line(ta, true);
    lv_textarea_set_placeholder_text(ta, "Type here...");
}

int main(void)
{
    lv_init();

    lv_display_t * disp = lv_windows_create_display(
        L"LVGL PC (MinGW)",
        800,
        480,
        100,  /* zoom level: 100% */
        true, /* allow DPI override */
        true  /* simulator mode (not resizable) */
    );

    if(disp == NULL) {
        return 1;
    }

    /* Be explicit: create UI on this display. */
    lv_display_set_default(disp);

    (void)lv_windows_acquire_pointer_indev(disp);
    (void)lv_windows_acquire_keypad_indev(disp);
    (void)lv_windows_acquire_encoder_indev(disp);

    lv_lock();
    create_ui();
    /* Force at least one refresh right away (useful if the first timer tick is delayed). */
    lv_screen_load(lv_screen_active());
    lv_refr_now(disp);
    lv_unlock();

    while(1) {
        lv_lock();
        uint32_t delay_ms = lv_timer_handler();
        lv_unlock();

        if(delay_ms < 1) delay_ms = 1;
        if(delay_ms > 20) delay_ms = 20;
        lv_delay_ms(delay_ms);
    }
}
