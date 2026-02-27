#include "lv_gltf_override.h"

#ifdef _WIN32
#include <windows.h>
#endif

#include <stdbool.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>

typedef int(__cdecl * rustglb_fb_init_fn)(const char * path, unsigned int width, unsigned int height);
typedef int(__cdecl * rustglb_fb_render_fn)(unsigned char * out_bgra, unsigned long long out_len);
typedef void(__cdecl * rustglb_fb_shutdown_fn)(void);
typedef const char *(__cdecl * rustglb_get_last_error_fn)(void);

typedef struct {
    lv_obj_t * viewer;
    lv_obj_t * image;
    lv_timer_t * timer;
    uint8_t * bgra_buffer;
    uint32_t width;
    uint32_t height;
    lv_image_dsc_t image_dsc;
    lv_gltf_bg_mode_t bg_mode;
    lv_gltf_aa_mode_t aa_mode;
    float fov;
    float distance;
    bool active;
} lv_gltf_override_state_t;

static HMODULE s_rustglb_dll;
static rustglb_fb_init_fn s_fb_init;
static rustglb_fb_render_fn s_fb_render;
static rustglb_fb_shutdown_fn s_fb_shutdown;
static rustglb_get_last_error_fn s_get_last_error;
static lv_gltf_override_state_t s_states[4];
static lv_gltf_override_state_t * s_active_state;

static bool try_load_rustglb(const char * dll_path)
{
    s_rustglb_dll = LoadLibraryA(dll_path);
    if(!s_rustglb_dll) {
        DWORD err = GetLastError();
        LV_LOG_WARN("LoadLibrary failed: %s (err=%lu)", dll_path, (unsigned long)err);
        return false;
    }

    LV_LOG_WARN("rustglb loaded from: %s", dll_path);
    return true;
}

static lv_gltf_override_state_t * find_state(const lv_obj_t * obj)
{
    for(uint32_t i = 0; i < 4; i++) {
        if(s_states[i].active && s_states[i].viewer == obj) {
            return &s_states[i];
        }
    }
    return NULL;
}

static lv_gltf_override_state_t * alloc_state(lv_obj_t * obj)
{
    for(uint32_t i = 0; i < 4; i++) {
        if(!s_states[i].active) {
            lv_gltf_override_state_t * state = &s_states[i];
            lv_memzero(state, sizeof(*state));
            state->viewer = obj;
            state->bg_mode = LV_GLTF_BG_MODE_SOLID;
            state->aa_mode = LV_GLTF_AA_MODE_ON;
            state->fov = 45.0f;
            state->distance = 1.8f;
            state->active = true;
            return state;
        }
    }
    return NULL;
}

static void free_buffers(lv_gltf_override_state_t * state)
{
    if(state->bgra_buffer) {
        lv_free(state->bgra_buffer);
        state->bgra_buffer = NULL;
    }
    state->width = 0;
    state->height = 0;
}

static bool load_rustglb_symbols(void)
{
    if(s_fb_init && s_fb_render && s_fb_shutdown && s_get_last_error) {
        return true;
    }

    if(!s_rustglb_dll) {
        char exe_path[MAX_PATH] = {0};
        char exe_dir[MAX_PATH] = {0};
        char exe_rustglb_path[MAX_PATH] = {0};
        bool loaded = false;

        if(try_load_rustglb("rustglb.dll")) {
            loaded = true;
        }

        if(!loaded) {
            DWORD n = GetModuleFileNameA(NULL, exe_path, MAX_PATH);
            if(n > 0 && n < MAX_PATH) {
                char * slash = strrchr(exe_path, '\\');
                if(slash) {
                    *slash = '\0';
                    strncpy(exe_dir, exe_path, MAX_PATH - 1);
                    exe_dir[MAX_PATH - 1] = '\0';
                    (void)snprintf(exe_rustglb_path, MAX_PATH, "%s\\rustglb.dll", exe_dir);
                    if(try_load_rustglb(exe_rustglb_path)) {
                        loaded = true;
                    }
                }
            }
        }

        if(!loaded) {
            if(try_load_rustglb("..\\lvgl-lib\\lib\\rustglb.dll")) {
                loaded = true;
            }
        }

        if(!loaded) {
            LV_LOG_WARN("failed to load rustglb.dll from all probe paths");
            return false;
        }
    }

    s_fb_init = (rustglb_fb_init_fn)(uintptr_t)GetProcAddress(s_rustglb_dll, "rustglb_fb_init");
    s_fb_render = (rustglb_fb_render_fn)(uintptr_t)GetProcAddress(s_rustglb_dll, "rustglb_fb_render");
    s_fb_shutdown = (rustglb_fb_shutdown_fn)(uintptr_t)GetProcAddress(s_rustglb_dll, "rustglb_fb_shutdown");
    s_get_last_error = (rustglb_get_last_error_fn)(uintptr_t)GetProcAddress(s_rustglb_dll, "rustglb_get_last_error");

    if(!(s_fb_init && s_fb_render && s_fb_shutdown && s_get_last_error)) {
        LV_LOG_WARN("failed to resolve rustglb framebuffer symbols");
        return false;
    }

    LV_LOG_WARN("rustglb symbols resolved (fb_init/fb_render/fb_shutdown/get_last_error)");

    return true;
}

static void render_timer_cb(lv_timer_t * timer)
{
    lv_gltf_override_state_t * state = (lv_gltf_override_state_t *)lv_timer_get_user_data(timer);
    if(!state || !state->active || state != s_active_state) {
        return;
    }
    if(!(state->bgra_buffer && s_fb_render)) {
        return;
    }

    const unsigned long long bytes = (unsigned long long)state->width * (unsigned long long)state->height * 4ULL;
    if(s_fb_render(state->bgra_buffer, bytes) != 0) {
        const char * err = s_get_last_error ? s_get_last_error() : NULL;
        LV_LOG_WARN("rustglb_fb_render failed: %s", err ? err : "unknown error");
        return;
    }

    lv_obj_invalidate(state->image);
}

static void viewer_delete_cb(lv_event_t * e)
{
    lv_obj_t * obj = lv_event_get_target(e);
    lv_gltf_override_state_t * state = find_state(obj);
    if(!state) {
        return;
    }

    if(state->timer) {
        lv_timer_delete(state->timer);
        state->timer = NULL;
    }

    if(s_active_state == state) {
        if(s_fb_shutdown) {
            s_fb_shutdown();
        }
        s_active_state = NULL;
    }

    free_buffers(state);
    lv_memzero(state, sizeof(*state));
}

lv_obj_t * lv_gltf_create(lv_obj_t * parent)
{
    lv_obj_t * obj = lv_obj_create(parent);
    lv_obj_remove_style_all(obj);
    lv_obj_set_style_bg_opa(obj, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(obj, 0, 0);
    lv_obj_set_style_pad_all(obj, 0, 0);

    lv_obj_t * image = lv_image_create(obj);
    lv_obj_set_size(image, LV_PCT(100), LV_PCT(100));
    lv_obj_center(image);

    lv_gltf_override_state_t * state = alloc_state(obj);
    if(!state) {
        LV_LOG_WARN("no free gltf override slots");
        return obj;
    }

    state->image = image;
    state->timer = lv_timer_create(render_timer_cb, 33, state);
    lv_obj_add_event_cb(obj, viewer_delete_cb, LV_EVENT_DELETE, NULL);
    LV_LOG_WARN("lv_gltf_create override active");

    return obj;
}

lv_gltf_model_t * lv_gltf_load_model_from_file(lv_obj_t * obj, const char * path)
{
    lv_gltf_override_state_t * state = find_state(obj);
    if(!state || !path || path[0] == '\0') {
        LV_LOG_WARN("lv_gltf_load_model_from_file invalid args");
        return NULL;
    }

    LV_LOG_WARN("lv_gltf_load_model_from_file called: %s", path);

    if(!load_rustglb_symbols()) {
        return NULL;
    }

    lv_obj_update_layout(lv_screen_active());
    lv_coord_t w = lv_obj_get_width(obj);
    lv_coord_t h = lv_obj_get_height(obj);

    if(w <= 1 || h <= 1) {
        lv_obj_update_layout(obj);
        w = lv_obj_get_width(obj);
        h = lv_obj_get_height(obj);
    }

    if(w <= 1 || h <= 1) {
        LV_LOG_WARN("gltf override got tiny size %dx%d, fallback to 220x220", (int)w, (int)h);
        w = 220;
        h = 220;
    }

    free_buffers(state);
    state->width = (uint32_t)w;
    state->height = (uint32_t)h;

    const uint32_t pixel_count = state->width * state->height;
    const uint32_t buffer_size = pixel_count * 4;
    state->bgra_buffer = (uint8_t *)lv_malloc(buffer_size);
    if(!(state->bgra_buffer)) {
        LV_LOG_WARN("gltf override buffer allocation failed");
        free_buffers(state);
        return NULL;
    }

    if(s_fb_shutdown) {
        s_fb_shutdown();
    }

    if(s_fb_init(path, state->width, state->height) != 0) {
        const char * err = s_get_last_error ? s_get_last_error() : NULL;
        LV_LOG_WARN("rustglb_fb_init failed for %s: %s", path, err ? err : "unknown error");
        free_buffers(state);
        return NULL;
    }

    LV_LOG_WARN("rustglb_fb_init ok: %ux%u", state->width, state->height);

    state->image_dsc.header.magic = LV_IMAGE_HEADER_MAGIC;
    state->image_dsc.header.cf = LV_COLOR_FORMAT_ARGB8888;
    state->image_dsc.header.w = state->width;
    state->image_dsc.header.h = state->height;
    state->image_dsc.header.stride = state->width * 4;
    state->image_dsc.data_size = buffer_size;
    state->image_dsc.data = state->bgra_buffer;
    state->image_dsc.reserved = NULL;

    s_active_state = state;

    if(s_fb_render(state->bgra_buffer, (unsigned long long)buffer_size) != 0) {
        const char * err = s_get_last_error ? s_get_last_error() : NULL;
        LV_LOG_WARN("rustglb_fb_render failed on first frame: %s", err ? err : "unknown error");
        return NULL;
    }

    lv_image_set_src(state->image, &state->image_dsc);
    lv_obj_invalidate(state->image);

    return (lv_gltf_model_t *)state;
}

void lv_gltf_set_fov(lv_obj_t * obj, float value)
{
    lv_gltf_override_state_t * state = find_state(obj);
    if(state) {
        state->fov = value;
    }
}

float lv_gltf_get_fov(const lv_obj_t * obj)
{
    lv_gltf_override_state_t * state = find_state(obj);
    return state ? state->fov : 45.0f;
}

void lv_gltf_set_distance(lv_obj_t * obj, float value)
{
    lv_gltf_override_state_t * state = find_state(obj);
    if(state) {
        state->distance = value;
    }
}

float lv_gltf_get_distance(const lv_obj_t * obj)
{
    lv_gltf_override_state_t * state = find_state(obj);
    return state ? state->distance : 1.8f;
}

void lv_gltf_set_background_mode(lv_obj_t * obj, lv_gltf_bg_mode_t value)
{
    lv_gltf_override_state_t * state = find_state(obj);
    if(state) {
        state->bg_mode = value;
    }
}

lv_gltf_bg_mode_t lv_gltf_get_background_mode(const lv_obj_t * obj)
{
    lv_gltf_override_state_t * state = find_state(obj);
    return state ? state->bg_mode : LV_GLTF_BG_MODE_SOLID;
}

void lv_gltf_set_antialiasing_mode(lv_obj_t * obj, lv_gltf_aa_mode_t value)
{
    lv_gltf_override_state_t * state = find_state(obj);
    if(state) {
        state->aa_mode = value;
    }
}

lv_gltf_aa_mode_t lv_gltf_get_antialiasing_mode(const lv_obj_t * obj)
{
    lv_gltf_override_state_t * state = find_state(obj);
    return state ? state->aa_mode : LV_GLTF_AA_MODE_ON;
}

void lv_gltf_set_bg_mode(lv_obj_t * obj, lv_gltf_bg_mode_t value)
{
    lv_gltf_set_background_mode(obj, value);
}

lv_gltf_bg_mode_t lv_gltf_get_bg_mode(const lv_obj_t * obj)
{
    return lv_gltf_get_background_mode(obj);
}

void lv_gltf_set_aa_mode(lv_obj_t * obj, lv_gltf_aa_mode_t value)
{
    lv_gltf_set_antialiasing_mode(obj, value);
}

lv_gltf_aa_mode_t lv_gltf_get_aa_mode(const lv_obj_t * obj)
{
    return lv_gltf_get_antialiasing_mode(obj);
}
