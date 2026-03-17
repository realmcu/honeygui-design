/*
 * Copyright (c) 2026, Realtek Semiconductor Corporation
 *
 * SPDX-License-Identifier: MIT
 */

/*============================================================================*
 *                        Header Files
 *============================================================================*/
#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
#include <pthread.h>
#include <SDL.h>
#ifdef _WIN32
#include <windows.h>
#else
#include <dlfcn.h>
#endif
#include "claw-mcu/claw_mqtt_c_dll/include/claw_mqtt_client.h"
#endif
#include "gui_openclaw.h"

#include "gui_fb.h"
#include "gui_api_os.h"
#include "tp_algo.h"
#include "def_file.h"
#include "stb_truetype.h"

/*============================================================================*
 *                           Types
 *============================================================================*/
#define GUI_OPENCLAW_MAX_MESSAGES        12
#define GUI_OPENCLAW_MAX_MESSAGE_LENGTH  256
#define GUI_OPENCLAW_MAX_WRAP_LINES      12
#define GUI_OPENCLAW_INFO_TEXT_LENGTH    96
#define GUI_OPENCLAW_INPUT_TEXT_LENGTH   256
#define GUI_OPENCLAW_INPUT_EVENT_QUEUE   128
#define GUI_OPENCLAW_MQTT_TEXT_LENGTH    256
#define GUI_OPENCLAW_MQTT_EVENT_QUEUE    16
#define GUI_OPENCLAW_CORRELATION_ID_LEN  64

#define GUI_OPENCLAW_INPUT_EVENT_BACKSPACE (-1)
#define GUI_OPENCLAW_INPUT_EVENT_SUBMIT    (-2)

typedef struct
{
    uint16_t start;
    uint16_t len;
    int width;
} gui_openclaw_line_t;

typedef struct
{
    gui_openclaw_role_t role;
    char text[GUI_OPENCLAW_MAX_MESSAGE_LENGTH];
} gui_openclaw_message_t;

typedef struct
{
    int line_count;
    int bubble_w;
    int bubble_h;
    int line_height;
    gui_openclaw_line_t lines[GUI_OPENCLAW_MAX_WRAP_LINES];
} gui_openclaw_layout_t;

#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
typedef enum
{
    GUI_OPENCLAW_MQTT_EVENT_MESSAGE = 0,
    GUI_OPENCLAW_MQTT_EVENT_STATUS,
    GUI_OPENCLAW_MQTT_EVENT_CONNECTION,
} gui_openclaw_mqtt_event_type_t;

typedef struct
{
    gui_openclaw_mqtt_event_type_t type;
    bool connected;
    char text[GUI_OPENCLAW_MQTT_TEXT_LENGTH];
} gui_openclaw_mqtt_event_t;

typedef claw_client_t *(*gui_openclaw_claw_create_fn)(void);
typedef void (*gui_openclaw_claw_destroy_fn)(claw_client_t *client);
typedef int (*gui_openclaw_claw_configure_fn)(claw_client_t *client,
                                              const char *broker_url,
                                              const char *inbound_topic,
                                              const char *outbound_topic,
                                              const char *sender_id,
                                              const char *client_id,
                                              const char *username,
                                              const char *password,
                                              int qos);
typedef void (*gui_openclaw_claw_set_message_cb_fn)(claw_client_t *client,
                                                    claw_message_callback_t callback,
                                                    void *user_data);
typedef void (*gui_openclaw_claw_set_log_cb_fn)(claw_client_t *client,
                                                claw_log_callback_t callback,
                                                void *user_data);
typedef int (*gui_openclaw_claw_connect_fn)(claw_client_t *client, int timeout_ms);
typedef int (*gui_openclaw_claw_disconnect_fn)(claw_client_t *client, int timeout_ms);
typedef int (*gui_openclaw_claw_is_connected_fn)(const claw_client_t *client);
typedef int (*gui_openclaw_claw_send_text_fn)(claw_client_t *client,
                                              const char *text,
                                              const char *correlation_id,
                                              char *out_correlation_id,
                                              size_t out_correlation_id_size);
typedef const char *(*gui_openclaw_claw_status_string_fn)(int code);

typedef struct
{
#ifdef _WIN32
    HMODULE handle;
#else
    void *handle;
#endif
    gui_openclaw_claw_create_fn create;
    gui_openclaw_claw_destroy_fn destroy;
    gui_openclaw_claw_configure_fn configure;
    gui_openclaw_claw_set_message_cb_fn set_message_callback;
    gui_openclaw_claw_set_log_cb_fn set_log_callback;
    gui_openclaw_claw_connect_fn connect;
    gui_openclaw_claw_disconnect_fn disconnect;
    gui_openclaw_claw_is_connected_fn is_connected;
    gui_openclaw_claw_send_text_fn send_text;
    gui_openclaw_claw_status_string_fn status_string;
} gui_openclaw_mqtt_api_t;
#endif

typedef struct gui_openclaw_ctx
{
    gui_img_t *widget;
    struct gui_openclaw_ctx *next;
    gui_rgb_data_head_t *image_data;
    uint16_t *pixels;
    int width;
    int height;
    const uint8_t *ttf_font_data;
    size_t ttf_font_size;
    stbtt_fontinfo font;
    bool font_ready;
    bool dirty;
    bool connected;
    uint32_t tick_count;
    char broker_url[GUI_OPENCLAW_INFO_TEXT_LENGTH];
    char sender_id[GUI_OPENCLAW_INFO_TEXT_LENGTH];
    char status_text[GUI_OPENCLAW_INFO_TEXT_LENGTH];
    char input_text[GUI_OPENCLAW_INPUT_TEXT_LENGTH];
    uint16_t input_length;
    bool input_enabled;
    int scroll_offset;
    int scroll_offset_max;
    int scroll_hold;
    int scroll_touch_base_delta_y;
    bool scroll_dragging;
    bool scroll_follow_bottom;
    bool input_focused;
#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
    bool mqtt_enabled;
    bool mqtt_connected;
    bool mqtt_connecting;
    bool mqtt_thread_started;
    char inbound_topic[GUI_OPENCLAW_INFO_TEXT_LENGTH];
    char outbound_topic[GUI_OPENCLAW_INFO_TEXT_LENGTH];
    char last_correlation_id[GUI_OPENCLAW_CORRELATION_ID_LEN];
    claw_client_t *mqtt_client;
    gui_openclaw_mqtt_api_t mqtt_api;
    pthread_t mqtt_thread;
    pthread_mutex_t mqtt_event_mutex;
    gui_openclaw_mqtt_event_t mqtt_events[GUI_OPENCLAW_MQTT_EVENT_QUEUE];
    uint16_t mqtt_event_head;
    uint16_t mqtt_event_tail;
#endif
    int message_count;
    gui_openclaw_message_t messages[GUI_OPENCLAW_MAX_MESSAGES];
} gui_openclaw_ctx_t;

/*============================================================================*
 *                           Constants
 *============================================================================*/
static const char *s_openclaw_default_broker = "mqtt://172.29.33.93:1883";
static const char *s_openclaw_default_sender = "esp32-sim-c-cli-01";

/*============================================================================*
 *                            Variables
 *============================================================================*/
static gui_openclaw_ctx_t *s_openclaw_ctx_list = NULL;
static gui_openclaw_ctx_t *s_openclaw_active_ctx = NULL;

#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
static pthread_mutex_t s_openclaw_input_mutex = PTHREAD_MUTEX_INITIALIZER;
static int s_openclaw_input_queue[GUI_OPENCLAW_INPUT_EVENT_QUEUE];
static uint16_t s_openclaw_input_head = 0;
static uint16_t s_openclaw_input_tail = 0;
static bool s_openclaw_sdl_event_watch_installed = false;
#endif

/*============================================================================*
 *                           Private Functions
 *============================================================================*/
static bool gui_openclaw_push_message(gui_openclaw_ctx_t *ctx,
                                      gui_openclaw_role_t role,
                                      const char *text);
static const char *gui_openclaw_touch_type_name(T_GUI_INPUT_TYPE type);
static void gui_openclaw_get_widget_origin(gui_obj_t *obj, int *x, int *y);
static int gui_openclaw_get_chat_content_height(gui_openclaw_ctx_t *ctx, int max_bubble_w);
static void gui_openclaw_update_scroll_bounds(gui_openclaw_ctx_t *ctx,
                                              int chat_panel_h,
                                              int max_bubble_w);
static void gui_openclaw_handle_touch_scroll(gui_openclaw_ctx_t *ctx,
                                             int chat_abs_x,
                                             int chat_abs_y,
                                             int chat_w,
                                             int chat_h);
#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
static void gui_openclaw_mqtt_process_events(gui_openclaw_ctx_t *ctx);
#endif

static void gui_openclaw_log_chat(gui_openclaw_role_t role, const char *text);

static void gui_openclaw_color_to_rgba(uint32_t color,
                                       uint8_t *r,
                                       uint8_t *g,
                                       uint8_t *b,
                                       uint8_t *a)
{
    *r = (uint8_t)((color >> 24) & 0xFF);
    *g = (uint8_t)((color >> 16) & 0xFF);
    *b = (uint8_t)((color >> 8) & 0xFF);
    *a = (uint8_t)(color & 0xFF);
}

static uint16_t gui_openclaw_rgb565(uint8_t r, uint8_t g, uint8_t b)
{
    return (uint16_t)((((uint16_t)r >> 3) << 11) |
                      (((uint16_t)g >> 2) << 5) |
                      ((uint16_t)b >> 3));
}

static void gui_openclaw_safe_copy(char *dst, size_t dst_size, const char *src)
{
    if (dst == NULL || dst_size == 0)
    {
        return;
    }

    if (src == NULL)
    {
        dst[0] = '\0';
        return;
    }

    strncpy(dst, src, dst_size - 1);
    dst[dst_size - 1] = '\0';
}

static void gui_openclaw_log_chat(gui_openclaw_role_t role, const char *text)
{
    const char *role_name = NULL;

    if (text == NULL || text[0] == '\0')
    {
        return;
    }

    switch (role)
    {
    case GUI_OPENCLAW_ROLE_USER:
        role_name = "you";
        break;

    case GUI_OPENCLAW_ROLE_ASSISTANT:
        role_name = "openclaw";
        break;

    default:
        return;
    }

    gui_log("openclaw chat [%s]: %s\n", role_name, text);
}

static const char *gui_openclaw_touch_type_name(T_GUI_INPUT_TYPE type)
{
    switch (type)
    {
    case TOUCH_INIT:
        return "TOUCH_INIT";
    case TOUCH_HOLD_X:
        return "TOUCH_HOLD_X";
    case TOUCH_HOLD_Y:
        return "TOUCH_HOLD_Y";
    case TOUCH_SHORT:
        return "TOUCH_SHORT";
    case TOUCH_LONG:
        return "TOUCH_LONG";
    case TOUCH_DOUBLE:
        return "TOUCH_DOUBLE";
    case TOUCH_TRIPLE:
        return "TOUCH_TRIPLE";
    case TOUCH_ORIGIN_FROM_X:
        return "TOUCH_ORIGIN_FROM_X";
    case TOUCH_ORIGIN_FROM_Y:
        return "TOUCH_ORIGIN_FROM_Y";
    case TOUCH_LEFT_SLIDE:
        return "TOUCH_LEFT_SLIDE";
    case TOUCH_RIGHT_SLIDE:
        return "TOUCH_RIGHT_SLIDE";
    case TOUCH_UP_SLIDE:
        return "TOUCH_UP_SLIDE";
    case TOUCH_DOWN_SLIDE:
        return "TOUCH_DOWN_SLIDE";
    case TOUCH_SHORT_BUTTON:
        return "TOUCH_SHORT_BUTTON";
    case TOUCH_LONG_BUTTON:
        return "TOUCH_LONG_BUTTON";
    case TOUCH_UP_SLIDE_TWO_PAGE:
        return "TOUCH_UP_SLIDE_TWO_PAGE";
    case TOUCH_DOWN_SLIDE_TWO_PAGE:
        return "TOUCH_DOWN_SLIDE_TWO_PAGE";
    case TOUCH_INVALID:
        return "TOUCH_INVALID";
    default:
        return "TOUCH_UNKNOWN";
    }
}

static void gui_openclaw_get_widget_origin(gui_obj_t *obj, int *x, int *y)
{
    int abs_x = 0;
    int abs_y = 0;

    while (obj != NULL)
    {
        abs_x += obj->x;
        abs_y += obj->y;
        obj = obj->parent;
    }

    if (x != NULL)
    {
        *x = abs_x;
    }
    if (y != NULL)
    {
        *y = abs_y;
    }
}

static gui_openclaw_ctx_t *gui_openclaw_find_ctx(gui_openclaw_t *widget)
{
    gui_openclaw_ctx_t *ctx = s_openclaw_ctx_list;

    while (ctx != NULL)
    {
        if (ctx->widget == (gui_img_t *)widget)
        {
            return ctx;
        }
        ctx = ctx->next;
    }

    return NULL;
}

static void gui_openclaw_register_ctx(gui_openclaw_ctx_t *ctx)
{
    ctx->next = s_openclaw_ctx_list;
    s_openclaw_ctx_list = ctx;
    s_openclaw_active_ctx = ctx;
}

#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
static bool gui_openclaw_enqueue_input_event(int input);

static int gui_openclaw_sdl_event_watch(void *userdata, SDL_Event *event)
{
    GUI_UNUSED(userdata);

    if (s_openclaw_active_ctx == NULL || !s_openclaw_active_ctx->input_enabled)
    {
        return 1;
    }

    if (!s_openclaw_active_ctx->input_focused)
    {
        return 1;
    }

    switch (event->type)
    {
    case SDL_TEXTINPUT:
        {
            const char *text = event->text.text;
            size_t i;
            for (i = 0; text[i] != '\0'; i++)
            {
                gui_openclaw_enqueue_input_event((unsigned char)text[i]);
            }
        }
        break;

    case SDL_KEYDOWN:
        switch (event->key.keysym.sym)
        {
        case SDLK_BACKSPACE:
            gui_openclaw_enqueue_input_event(GUI_OPENCLAW_INPUT_EVENT_BACKSPACE);
            break;

        case SDLK_RETURN:
        case SDLK_KP_ENTER:
            gui_openclaw_enqueue_input_event(GUI_OPENCLAW_INPUT_EVENT_SUBMIT);
            break;

        default:
            break;
        }
        break;

    default:
        break;
    }

    return 1;
}

static void gui_openclaw_install_sdl_event_watch(void)
{
    if (!s_openclaw_sdl_event_watch_installed)
    {
        SDL_AddEventWatch(gui_openclaw_sdl_event_watch, NULL);
        s_openclaw_sdl_event_watch_installed = true;
        gui_log("openclaw: SDL event watch installed\n");
    }
}
#endif

#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
static void gui_openclaw_mqtt_event_init(gui_openclaw_ctx_t *ctx)
{
    pthread_mutex_init(&ctx->mqtt_event_mutex, NULL);
    ctx->mqtt_event_head = 0;
    ctx->mqtt_event_tail = 0;
}

static bool gui_openclaw_mqtt_enqueue_event(gui_openclaw_ctx_t               *ctx,
                                            gui_openclaw_mqtt_event_type_t     type,
                                            const char                        *text,
                                            bool                               connected)
{
    uint16_t next_tail;
    gui_openclaw_mqtt_event_t *event;

    if (ctx == NULL)
    {
        return false;
    }

    pthread_mutex_lock(&ctx->mqtt_event_mutex);
    next_tail = (uint16_t)((ctx->mqtt_event_tail + 1U) % GUI_OPENCLAW_MQTT_EVENT_QUEUE);
    if (next_tail == ctx->mqtt_event_head)
    {
        pthread_mutex_unlock(&ctx->mqtt_event_mutex);
        return false;
    }

    event = &ctx->mqtt_events[ctx->mqtt_event_tail];
    memset(event, 0x00, sizeof(*event));
    event->type = type;
    event->connected = connected;
    gui_openclaw_safe_copy(event->text, sizeof(event->text), text);
    ctx->mqtt_event_tail = next_tail;
    pthread_mutex_unlock(&ctx->mqtt_event_mutex);
    return true;
}

static bool gui_openclaw_mqtt_dequeue_event(gui_openclaw_ctx_t *ctx,
                                            gui_openclaw_mqtt_event_t *event)
{
    if (ctx == NULL || event == NULL)
    {
        return false;
    }

    pthread_mutex_lock(&ctx->mqtt_event_mutex);
    if (ctx->mqtt_event_head == ctx->mqtt_event_tail)
    {
        pthread_mutex_unlock(&ctx->mqtt_event_mutex);
        return false;
    }

    *event = ctx->mqtt_events[ctx->mqtt_event_head];
    ctx->mqtt_event_head = (uint16_t)((ctx->mqtt_event_head + 1U) % GUI_OPENCLAW_MQTT_EVENT_QUEUE);
    pthread_mutex_unlock(&ctx->mqtt_event_mutex);
    return true;
}

static const char *gui_openclaw_mqtt_status_desc(gui_openclaw_ctx_t *ctx, int code)
{
    if (ctx != NULL && ctx->mqtt_api.status_string != NULL)
    {
        return ctx->mqtt_api.status_string(code);
    }
    return "unknown";
}

static void gui_openclaw_mqtt_message_cb(const char *topic,
                                         const char *sender_id,
                                         const char *text,
                                         const char *kind,
                                         const char *correlation_id,
                                         void *user_data)
{
    gui_openclaw_ctx_t *ctx = (gui_openclaw_ctx_t *)user_data;
    char buffer[GUI_OPENCLAW_MQTT_TEXT_LENGTH];

    GUI_UNUSED(topic);
    GUI_UNUSED(sender_id);
    GUI_UNUSED(kind);
    GUI_UNUSED(correlation_id);

    if (ctx == NULL || text == NULL || text[0] == '\0')
    {
        return;
    }

    gui_openclaw_safe_copy(buffer, sizeof(buffer), text);
    gui_openclaw_mqtt_enqueue_event(ctx, GUI_OPENCLAW_MQTT_EVENT_MESSAGE, buffer, true);
}

static void gui_openclaw_mqtt_log_cb(int level, const char *message, void *user_data)
{
    gui_openclaw_ctx_t *ctx = (gui_openclaw_ctx_t *)user_data;
    char buffer[GUI_OPENCLAW_MQTT_TEXT_LENGTH];

    if (ctx == NULL || message == NULL)
    {
        return;
    }

    if (level < CLAW_LOG_WARN)
    {
        return;
    }

    snprintf(buffer, sizeof(buffer), "MQTT log[%d]: %s", level, message);
    gui_openclaw_mqtt_enqueue_event(ctx, GUI_OPENCLAW_MQTT_EVENT_STATUS, buffer, ctx->mqtt_connected);
}

static void *gui_openclaw_mqtt_connect_thread(void *arg)
{
    gui_openclaw_ctx_t *ctx = (gui_openclaw_ctx_t *)arg;
    int rc;
    char status[GUI_OPENCLAW_MQTT_TEXT_LENGTH];

    if (ctx == NULL || ctx->mqtt_api.connect == NULL || ctx->mqtt_client == NULL)
    {
        return NULL;
    }

    rc = ctx->mqtt_api.connect(ctx->mqtt_client, 10000);
    ctx->mqtt_connecting = false;
    ctx->mqtt_connected = (rc == CLAW_STATUS_OK);
    if (ctx->mqtt_connected && ctx->mqtt_api.is_connected != NULL)
    {
        ctx->mqtt_connected = (ctx->mqtt_api.is_connected(ctx->mqtt_client) != 0);
    }

    if (ctx->mqtt_connected)
    {
        snprintf(status, sizeof(status), "MQTT connected | outbound=%s", ctx->outbound_topic);
        gui_openclaw_mqtt_enqueue_event(ctx, GUI_OPENCLAW_MQTT_EVENT_CONNECTION, status, true);
    }
    else
    {
        snprintf(status, sizeof(status), "MQTT connect failed: %s", gui_openclaw_mqtt_status_desc(ctx, rc));
        gui_openclaw_mqtt_enqueue_event(ctx, GUI_OPENCLAW_MQTT_EVENT_CONNECTION, status, false);
    }
    return NULL;
}

static void *gui_openclaw_dylib_open(const char *path)
{
#ifdef _WIN32
    return (void *)LoadLibraryA(path);
#else
    return dlopen(path, RTLD_NOW | RTLD_LOCAL);
#endif
}

static void gui_openclaw_dylib_close(void *handle)
{
    if (handle == NULL)
    {
        return;
    }
#ifdef _WIN32
    FreeLibrary((HMODULE)handle);
#else
    dlclose(handle);
#endif
}

static void *gui_openclaw_dylib_symbol(void *handle, const char *name)
{
    if (handle == NULL || name == NULL)
    {
        return NULL;
    }
#ifdef _WIN32
    return (void *)GetProcAddress((HMODULE)handle, name);
#else
    return dlsym(handle, name);
#endif
}

static bool gui_openclaw_mqtt_load_dll(gui_openclaw_ctx_t *ctx)
{
#ifdef _WIN32
    static const char *paths[] =
    {
        "..\\src\\gui_openclaw\\claw-mcu\\claw_mqtt_c_dll\\build-gcc\\libclaw_mqtt_client.dll",
        "realgui/widget/gui_oepnclaw/claw-mcu/claw_mqtt_c_dll/build-gcc/libclaw_mqtt_client.dll",
        "realgui/widget/gui_oepnclaw/claw-mcu/claw_mqtt_c_dll/build-gcc/claw_mqtt_client.dll",
        "realgui/widget/gui_oepnclaw/claw-mcu/claw_mqtt_c_dll/build/Release/claw_mqtt_client.dll",
        "realgui/widget/gui_oepnclaw/claw-mcu/claw_mqtt_c_dll/build/Release/libclaw_mqtt_client.dll",
        "libclaw_mqtt_client.dll",
        "claw_mqtt_client.dll",
    };
#else
    static const char *paths[] =
    {
        "realgui/widget/gui_oepnclaw/claw-mcu/claw_mqtt_c_dll/build-gcc/libclaw_mqtt_client.so",
        "realgui/widget/gui_oepnclaw/claw-mcu/claw_mqtt_c_dll/build/libclaw_mqtt_client.so",
        "libclaw_mqtt_client.so",
    };
#endif
    size_t i;

    for (i = 0; i < sizeof(paths) / sizeof(paths[0]); i++)
    {
        ctx->mqtt_api.handle = gui_openclaw_dylib_open(paths[i]);
        if (ctx->mqtt_api.handle != NULL)
        {
            gui_log("openclaw: loaded mqtt dll: %s\n", paths[i]);
            return true;
        }
    }

    gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text),
                           "MQTT DLL not found | build claw_mqtt_client first");
    return false;
}

static bool gui_openclaw_mqtt_resolve_api(gui_openclaw_ctx_t *ctx)
{
    ctx->mqtt_api.create = (gui_openclaw_claw_create_fn)gui_openclaw_dylib_symbol(ctx->mqtt_api.handle, "claw_client_create");
    ctx->mqtt_api.destroy = (gui_openclaw_claw_destroy_fn)gui_openclaw_dylib_symbol(ctx->mqtt_api.handle, "claw_client_destroy");
    ctx->mqtt_api.configure = (gui_openclaw_claw_configure_fn)gui_openclaw_dylib_symbol(ctx->mqtt_api.handle, "claw_client_configure");
    ctx->mqtt_api.set_message_callback = (gui_openclaw_claw_set_message_cb_fn)gui_openclaw_dylib_symbol(ctx->mqtt_api.handle, "claw_client_set_message_callback");
    ctx->mqtt_api.set_log_callback = (gui_openclaw_claw_set_log_cb_fn)gui_openclaw_dylib_symbol(ctx->mqtt_api.handle, "claw_client_set_log_callback");
    ctx->mqtt_api.connect = (gui_openclaw_claw_connect_fn)gui_openclaw_dylib_symbol(ctx->mqtt_api.handle, "claw_client_connect");
    ctx->mqtt_api.disconnect = (gui_openclaw_claw_disconnect_fn)gui_openclaw_dylib_symbol(ctx->mqtt_api.handle, "claw_client_disconnect");
    ctx->mqtt_api.is_connected = (gui_openclaw_claw_is_connected_fn)gui_openclaw_dylib_symbol(ctx->mqtt_api.handle, "claw_client_is_connected");
    ctx->mqtt_api.send_text = (gui_openclaw_claw_send_text_fn)gui_openclaw_dylib_symbol(ctx->mqtt_api.handle, "claw_client_send_text");
    ctx->mqtt_api.status_string = (gui_openclaw_claw_status_string_fn)gui_openclaw_dylib_symbol(ctx->mqtt_api.handle, "claw_status_string");

    if (ctx->mqtt_api.create == NULL || ctx->mqtt_api.destroy == NULL ||
        ctx->mqtt_api.configure == NULL || ctx->mqtt_api.set_message_callback == NULL ||
        ctx->mqtt_api.set_log_callback == NULL || ctx->mqtt_api.connect == NULL ||
        ctx->mqtt_api.disconnect == NULL || ctx->mqtt_api.is_connected == NULL ||
        ctx->mqtt_api.send_text == NULL || ctx->mqtt_api.status_string == NULL)
    {
        gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text),
                               "MQTT DLL exports incomplete");
        return false;
    }
    return true;
}

static bool gui_openclaw_mqtt_init(gui_openclaw_ctx_t *ctx)
{
    int rc;

    if (ctx == NULL)
    {
        return false;
    }

    ctx->mqtt_enabled = false;
    ctx->mqtt_connected = false;
    ctx->mqtt_connecting = false;
    ctx->mqtt_thread_started = false;
    gui_openclaw_safe_copy(ctx->inbound_topic, sizeof(ctx->inbound_topic), "openclaw/inbound");
    gui_openclaw_safe_copy(ctx->outbound_topic, sizeof(ctx->outbound_topic), "openclaw/outbound");

    if (!gui_openclaw_mqtt_load_dll(ctx))
    {
        return false;
    }
    if (!gui_openclaw_mqtt_resolve_api(ctx))
    {
        gui_openclaw_dylib_close((void *)ctx->mqtt_api.handle);
        memset(&ctx->mqtt_api, 0x00, sizeof(ctx->mqtt_api));
        return false;
    }

    ctx->mqtt_client = ctx->mqtt_api.create();
    if (ctx->mqtt_client == NULL)
    {
        gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text),
                               "MQTT create client failed");
        gui_openclaw_dylib_close((void *)ctx->mqtt_api.handle);
        memset(&ctx->mqtt_api, 0x00, sizeof(ctx->mqtt_api));
        return false;
    }

    ctx->mqtt_api.set_log_callback(ctx->mqtt_client, gui_openclaw_mqtt_log_cb, ctx);
    ctx->mqtt_api.set_message_callback(ctx->mqtt_client, gui_openclaw_mqtt_message_cb, ctx);
    rc = ctx->mqtt_api.configure(ctx->mqtt_client,
                                 ctx->broker_url,
                                 ctx->inbound_topic,
                                 ctx->outbound_topic,
                                 ctx->sender_id,
                                 NULL,
                                 NULL,
                                 NULL,
                                 1);
    if (rc != CLAW_STATUS_OK)
    {
        char status[GUI_OPENCLAW_MQTT_TEXT_LENGTH];
        snprintf(status, sizeof(status), "MQTT configure failed: %s", gui_openclaw_mqtt_status_desc(ctx, rc));
        gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text), status);
        ctx->mqtt_api.destroy(ctx->mqtt_client);
        ctx->mqtt_client = NULL;
        gui_openclaw_dylib_close((void *)ctx->mqtt_api.handle);
        memset(&ctx->mqtt_api, 0x00, sizeof(ctx->mqtt_api));
        return false;
    }

    ctx->mqtt_enabled = true;
    ctx->mqtt_connecting = true;
    gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text), "MQTT connecting...");
    if (pthread_create(&ctx->mqtt_thread, NULL, gui_openclaw_mqtt_connect_thread, ctx) == 0)
    {
        ctx->mqtt_thread_started = true;
    }
    else
    {
        ctx->mqtt_connecting = false;
        ctx->mqtt_enabled = false;
        gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text), "MQTT thread start failed");
        ctx->mqtt_api.destroy(ctx->mqtt_client);
        ctx->mqtt_client = NULL;
        gui_openclaw_dylib_close((void *)ctx->mqtt_api.handle);
        memset(&ctx->mqtt_api, 0x00, sizeof(ctx->mqtt_api));
        return false;
    }
    return true;
}

static void gui_openclaw_mqtt_process_events(gui_openclaw_ctx_t *ctx)
{
    gui_openclaw_mqtt_event_t event;

    while (gui_openclaw_mqtt_dequeue_event(ctx, &event))
    {
        switch (event.type)
        {
        case GUI_OPENCLAW_MQTT_EVENT_MESSAGE:
            gui_openclaw_push_message(ctx, GUI_OPENCLAW_ROLE_ASSISTANT, event.text);
            gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text), "Reply received");
            break;

        case GUI_OPENCLAW_MQTT_EVENT_STATUS:
            gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text), event.text);
            ctx->dirty = true;
            break;

        case GUI_OPENCLAW_MQTT_EVENT_CONNECTION:
            ctx->connected = event.connected;
            ctx->mqtt_connected = event.connected;
            gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text), event.text);
            ctx->dirty = true;
            break;

        default:
            break;
        }
    }
}
#endif

static size_t gui_openclaw_utf8_trim_to_fit(const char *text, size_t max_len)
{
    size_t len;

    if (text == NULL)
    {
        return 0;
    }

    len = strlen(text);
    if (len <= max_len)
    {
        return len;
    }

    len = max_len;
    while (len > 0 && (((unsigned char)text[len] & 0xC0U) == 0x80U))
    {
        len--;
    }
    return len;
}

static void gui_openclaw_input_remove_last_codepoint(gui_openclaw_ctx_t *ctx)
{
    if (ctx == NULL || ctx->input_length == 0)
    {
        return;
    }

    ctx->input_length--;
    while (ctx->input_length > 0 &&
           (((unsigned char)ctx->input_text[ctx->input_length] & 0xC0U) == 0x80U))
    {
        ctx->input_length--;
    }
    ctx->input_text[ctx->input_length] = '\0';
    ctx->dirty = true;
}

static bool gui_openclaw_input_append_text(gui_openclaw_ctx_t *ctx, const char *text)
{
    size_t copy_len;

    if (ctx == NULL || text == NULL || text[0] == '\0')
    {
        return false;
    }

    if ((size_t)ctx->input_length >= sizeof(ctx->input_text) - 1)
    {
        return false;
    }

    copy_len = gui_openclaw_utf8_trim_to_fit(text,
                                             (sizeof(ctx->input_text) - 1U) - (size_t)ctx->input_length);
    if (copy_len == 0)
    {
        return false;
    }

    memcpy(&ctx->input_text[ctx->input_length], text, copy_len);
    ctx->input_length = (uint16_t)(ctx->input_length + copy_len);
    ctx->input_text[ctx->input_length] = '\0';
    ctx->dirty = true;
    return true;
}

static void gui_openclaw_input_submit_ctx(gui_openclaw_ctx_t *ctx)
{
#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
    int rc;
    char status[GUI_OPENCLAW_MQTT_TEXT_LENGTH];
#endif

    if (ctx == NULL)
    {
        return;
    }

    if (ctx->input_text[0] == '\0')
    {
        gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text),
                               "Input is empty | Type in simulator window and press Enter");
        ctx->dirty = true;
        return;
    }

    gui_openclaw_push_message(ctx, GUI_OPENCLAW_ROLE_USER, ctx->input_text);
#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
    if (ctx->mqtt_enabled && ctx->mqtt_client != NULL && ctx->mqtt_api.send_text != NULL)
    {
        if (!ctx->mqtt_connected && ctx->mqtt_api.is_connected != NULL)
        {
            ctx->mqtt_connected = (ctx->mqtt_api.is_connected(ctx->mqtt_client) != 0);
            ctx->connected = ctx->mqtt_connected;
        }

        if (ctx->mqtt_connected)
        {
            rc = ctx->mqtt_api.send_text(ctx->mqtt_client,
                                         ctx->input_text,
                                         NULL,
                                         ctx->last_correlation_id,
                                         sizeof(ctx->last_correlation_id));
            if (rc == CLAW_STATUS_OK)
            {
                snprintf(status, sizeof(status), "Sent | correlationId=%s", ctx->last_correlation_id);
            }
            else
            {
                snprintf(status, sizeof(status), "Send failed: %s", gui_openclaw_mqtt_status_desc(ctx, rc));
            }
            gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text), status);
        }
        else if (ctx->mqtt_connecting)
        {
            gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text),
                                   "MQTT still connecting...");
        }
        else
        {
            gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text),
                                   "MQTT not connected");
        }
    }
    else
    {
        gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text),
                               "MQTT DLL unavailable | message stored locally");
    }
#else
    gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text),
                           "Keyboard input ready | Enter=send | Backspace=delete");
#endif
    ctx->input_length = 0;
    ctx->input_text[0] = '\0';
    ctx->dirty = true;
}

#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
static bool gui_openclaw_enqueue_input_event(int input)
{
    uint16_t next_tail;

    pthread_mutex_lock(&s_openclaw_input_mutex);
    next_tail = (uint16_t)((s_openclaw_input_tail + 1U) % GUI_OPENCLAW_INPUT_EVENT_QUEUE);
    if (next_tail == s_openclaw_input_head)
    {
        pthread_mutex_unlock(&s_openclaw_input_mutex);
        return false;
    }

    s_openclaw_input_queue[s_openclaw_input_tail] = input;
    s_openclaw_input_tail = next_tail;
    pthread_mutex_unlock(&s_openclaw_input_mutex);
    return true;
}

static bool gui_openclaw_dequeue_input_event(int *input)
{
    if (input == NULL)
    {
        return false;
    }

    pthread_mutex_lock(&s_openclaw_input_mutex);
    if (s_openclaw_input_head == s_openclaw_input_tail)
    {
        pthread_mutex_unlock(&s_openclaw_input_mutex);
        return false;
    }

    *input = s_openclaw_input_queue[s_openclaw_input_head];
    s_openclaw_input_head = (uint16_t)((s_openclaw_input_head + 1U) % GUI_OPENCLAW_INPUT_EVENT_QUEUE);
    pthread_mutex_unlock(&s_openclaw_input_mutex);
    return true;
}

static void gui_openclaw_process_input_events(gui_openclaw_ctx_t *ctx)
{
    int input;

    while (gui_openclaw_dequeue_input_event(&input))
    {
        if (input == GUI_OPENCLAW_INPUT_EVENT_BACKSPACE)
        {
            gui_openclaw_input_remove_last_codepoint(ctx);
        }
        else if (input == GUI_OPENCLAW_INPUT_EVENT_SUBMIT)
        {
            gui_openclaw_input_submit_ctx(ctx);
        }
        else if (input >= 0 && input <= 0xFF)
        {
            char ch[2];
            ch[0] = (char)input;
            ch[1] = '\0';
            gui_openclaw_input_append_text(ctx, ch);
        }
    }
}
#else
static void gui_openclaw_process_input_events(gui_openclaw_ctx_t *ctx)
{
    GUI_UNUSED(ctx);
}
#endif

static bool gui_openclaw_init_font(gui_openclaw_ctx_t *ctx)
{
    int offset;

    if (ctx == NULL || ctx->ttf_font_data == NULL)
    {
        return false;
    }

    offset = stbtt_GetFontOffsetForIndex(ctx->ttf_font_data, 0);
    if (offset < 0)
    {
        offset = 0;
    }

    ctx->font_ready = (stbtt_InitFont(&ctx->font, ctx->ttf_font_data, offset) != 0);
    if (!ctx->font_ready)
    {
        gui_log("openclaw: failed to initialize ttf font\n");
    }
    return ctx->font_ready;
}

static void gui_openclaw_blend_pixel(gui_openclaw_ctx_t *ctx,
                                     int x,
                                     int y,
                                     uint8_t r,
                                     uint8_t g,
                                     uint8_t b,
                                     uint8_t alpha)
{
    uint16_t bg_pixel;
    uint16_t *pixel;
    uint16_t bg_r;
    uint16_t bg_g;
    uint16_t bg_b;
    uint16_t out_r;
    uint16_t out_g;
    uint16_t out_b;
    uint16_t inv_alpha;

    if (ctx == NULL || ctx->pixels == NULL)
    {
        return;
    }

    if (x < 0 || y < 0 || x >= ctx->width || y >= ctx->height || alpha == 0)
    {
        return;
    }

    pixel = &ctx->pixels[y * ctx->width + x];
    if (alpha == 255)
    {
        *pixel = gui_openclaw_rgb565(r, g, b);
        return;
    }

    bg_pixel = *pixel;
    bg_r = (uint16_t)((bg_pixel >> 11) & 0x1F);
    bg_g = (uint16_t)((bg_pixel >> 5) & 0x3F);
    bg_b = (uint16_t)(bg_pixel & 0x1F);
    inv_alpha = (uint16_t)(255 - alpha);

    out_r = (uint16_t)((((uint16_t)(r >> 3) & 0x1F) * alpha + bg_r * inv_alpha) >> 8);
    out_g = (uint16_t)((((uint16_t)(g >> 2) & 0x3F) * alpha + bg_g * inv_alpha) >> 8);
    out_b = (uint16_t)((((uint16_t)(b >> 3) & 0x1F) * alpha + bg_b * inv_alpha) >> 8);

    *pixel = (uint16_t)((out_r << 11) | (out_g << 5) | out_b);
}

static void gui_openclaw_fill_rect(gui_openclaw_ctx_t *ctx,
                                   int x,
                                   int y,
                                   int w,
                                   int h,
                                   uint32_t color)
{
    uint8_t r;
    uint8_t g;
    uint8_t b;
    uint8_t a;
    int x0;
    int y0;
    int x1;
    int y1;
    int px;
    int py;

    if (ctx == NULL || w <= 0 || h <= 0)
    {
        return;
    }

    gui_openclaw_color_to_rgba(color, &r, &g, &b, &a);

    x0 = (x < 0) ? 0 : x;
    y0 = (y < 0) ? 0 : y;
    x1 = (x + w > ctx->width) ? ctx->width : (x + w);
    y1 = (y + h > ctx->height) ? ctx->height : (y + h);

    for (py = y0; py < y1; py++)
    {
        for (px = x0; px < x1; px++)
        {
            gui_openclaw_blend_pixel(ctx, px, py, r, g, b, a);
        }
    }
}

static void gui_openclaw_draw_rect_border(gui_openclaw_ctx_t *ctx,
                                          int x,
                                          int y,
                                          int w,
                                          int h,
                                          uint32_t color)
{
    gui_openclaw_fill_rect(ctx, x, y, w, 1, color);
    gui_openclaw_fill_rect(ctx, x, y + h - 1, w, 1, color);
    gui_openclaw_fill_rect(ctx, x, y, 1, h, color);
    gui_openclaw_fill_rect(ctx, x + w - 1, y, 1, h, color);
}

static void gui_openclaw_fill_rect_clipped(gui_openclaw_ctx_t *ctx,
                                           int x,
                                           int y,
                                           int w,
                                           int h,
                                           uint32_t color,
                                           int clip_x,
                                           int clip_y,
                                           int clip_w,
                                           int clip_h)
{
    int x0;
    int y0;
    int x1;
    int y1;

    if (ctx == NULL || w <= 0 || h <= 0 || clip_w <= 0 || clip_h <= 0)
    {
        return;
    }

    x0 = (x > clip_x) ? x : clip_x;
    y0 = (y > clip_y) ? y : clip_y;
    x1 = ((x + w) < (clip_x + clip_w)) ? (x + w) : (clip_x + clip_w);
    y1 = ((y + h) < (clip_y + clip_h)) ? (y + h) : (clip_y + clip_h);

    if (x1 <= x0 || y1 <= y0)
    {
        return;
    }

    gui_openclaw_fill_rect(ctx, x0, y0, x1 - x0, y1 - y0, color);
}

static void gui_openclaw_draw_rect_border_clipped(gui_openclaw_ctx_t *ctx,
                                                  int x,
                                                  int y,
                                                  int w,
                                                  int h,
                                                  uint32_t color,
                                                  int clip_x,
                                                  int clip_y,
                                                  int clip_w,
                                                  int clip_h)
{
    if (w <= 0 || h <= 0)
    {
        return;
    }

    gui_openclaw_fill_rect_clipped(ctx, x, y, w, 1, color,
                                   clip_x, clip_y, clip_w, clip_h);
    gui_openclaw_fill_rect_clipped(ctx, x, y + h - 1, w, 1, color,
                                   clip_x, clip_y, clip_w, clip_h);
    gui_openclaw_fill_rect_clipped(ctx, x, y, 1, h, color,
                                   clip_x, clip_y, clip_w, clip_h);
    gui_openclaw_fill_rect_clipped(ctx, x + w - 1, y, 1, h, color,
                                   clip_x, clip_y, clip_w, clip_h);
}

static int gui_openclaw_decode_utf8(const char *text, int *codepoint)
{
    const unsigned char *s = (const unsigned char *)text;

    if (s == NULL || s[0] == '\0')
    {
        *codepoint = 0;
        return 0;
    }

    if (s[0] < 0x80)
    {
        *codepoint = s[0];
        return 1;
    }
    if ((s[0] & 0xE0) == 0xC0 && s[1] != 0)
    {
        *codepoint = ((s[0] & 0x1F) << 6) | (s[1] & 0x3F);
        return 2;
    }
    if ((s[0] & 0xF0) == 0xE0 && s[1] != 0 && s[2] != 0)
    {
        *codepoint = ((s[0] & 0x0F) << 12) | ((s[1] & 0x3F) << 6) | (s[2] & 0x3F);
        return 3;
    }
    if ((s[0] & 0xF8) == 0xF0 && s[1] != 0 && s[2] != 0 && s[3] != 0)
    {
        *codepoint = ((s[0] & 0x07) << 18) | ((s[1] & 0x3F) << 12) |
                     ((s[2] & 0x3F) << 6) | (s[3] & 0x3F);
        return 4;
    }

    *codepoint = '?';
    return 1;
}

static int gui_openclaw_measure_span(gui_openclaw_ctx_t *ctx,
                                     const char *text,
                                     uint16_t len,
                                     float font_size)
{
    float scale;
    int width = 0;
    int previous_codepoint = 0;
    uint16_t index = 0;

    if (ctx == NULL || !ctx->font_ready || text == NULL || len == 0)
    {
        return 0;
    }

    scale = stbtt_ScaleForPixelHeight(&ctx->font, font_size);
    while (index < len)
    {
        int codepoint;
        int advance;
        int lsb;
        int consumed = gui_openclaw_decode_utf8(text + index, &codepoint);

        if (consumed <= 0)
        {
            break;
        }

        if (previous_codepoint != 0)
        {
            width += (int)(stbtt_GetCodepointKernAdvance(&ctx->font, previous_codepoint, codepoint) * scale);
        }

        stbtt_GetCodepointHMetrics(&ctx->font, codepoint, &advance, &lsb);
        GUI_UNUSED(lsb);
        width += (int)(advance * scale);
        previous_codepoint = codepoint;
        index += (uint16_t)consumed;
    }

    return width;
}

static void gui_openclaw_layout_message(gui_openclaw_ctx_t *ctx,
                                        const char *text,
                                        float font_size,
                                        int max_text_width,
                                        gui_openclaw_layout_t *layout)
{
    uint16_t text_len;
    uint16_t line_start;
    uint16_t index;
    int current_width;
    int max_width;
    int line_height;
    int last_break_width;
    int last_break_index;

    memset(layout, 0x00, sizeof(*layout));
    if (text == NULL)
    {
        return;
    }

    text_len = (uint16_t)strlen(text);
    line_start = 0;
    index = 0;
    current_width = 0;
    max_width = 0;
    last_break_width = 0;
    last_break_index = -1;
    line_height = (int)(font_size * 1.35f);
    if (line_height < (int)font_size + 4)
    {
        line_height = (int)font_size + 4;
    }
    layout->line_height = line_height;

    while (index < text_len && layout->line_count < GUI_OPENCLAW_MAX_WRAP_LINES)
    {
        int codepoint;
        int advance;
        int lsb;
        int consumed = gui_openclaw_decode_utf8(text + index, &codepoint);
        int glyph_width;

        if (consumed <= 0)
        {
            break;
        }

        if (text[index] == '\n')
        {
            layout->lines[layout->line_count].start = line_start;
            layout->lines[layout->line_count].len = (uint16_t)(index - line_start);
            layout->lines[layout->line_count].width = current_width;
            if (current_width > max_width)
            {
                max_width = current_width;
            }
            layout->line_count++;
            index++;
            line_start = index;
            current_width = 0;
            last_break_width = 0;
            last_break_index = -1;
            continue;
        }

        stbtt_GetCodepointHMetrics(&ctx->font, codepoint, &advance, &lsb);
        GUI_UNUSED(lsb);
        glyph_width = (int)(advance * stbtt_ScaleForPixelHeight(&ctx->font, font_size));

        if (current_width > 0 && current_width + glyph_width > max_text_width)
        {
            if (last_break_index >= (int)line_start)
            {
                layout->lines[layout->line_count].start = line_start;
                layout->lines[layout->line_count].len = (uint16_t)(last_break_index - line_start);
                layout->lines[layout->line_count].width = last_break_width;
                if (last_break_width > max_width)
                {
                    max_width = last_break_width;
                }
                layout->line_count++;
                index = (uint16_t)(last_break_index + 1);
            }
            else
            {
                layout->lines[layout->line_count].start = line_start;
                layout->lines[layout->line_count].len = (uint16_t)(index - line_start);
                layout->lines[layout->line_count].width = current_width;
                if (current_width > max_width)
                {
                    max_width = current_width;
                }
                layout->line_count++;
            }
            line_start = index;
            current_width = 0;
            last_break_width = 0;
            last_break_index = -1;
            continue;
        }

        if (text[index] == ' ')
        {
            last_break_index = index;
            last_break_width = current_width;
        }

        current_width += glyph_width;
        index += (uint16_t)consumed;
    }

    if (layout->line_count < GUI_OPENCLAW_MAX_WRAP_LINES && line_start <= text_len)
    {
        layout->lines[layout->line_count].start = line_start;
        layout->lines[layout->line_count].len = (uint16_t)(text_len - line_start);
        layout->lines[layout->line_count].width = current_width;
        if (current_width > max_width)
        {
            max_width = current_width;
        }
        layout->line_count++;
    }

    if (layout->line_count == 0)
    {
        layout->line_count = 1;
    }

    layout->bubble_w = max_width + 20;
    if (layout->bubble_w > max_text_width + 20)
    {
        layout->bubble_w = max_text_width + 20;
    }
    if (layout->bubble_w < 56)
    {
        layout->bubble_w = 56;
    }
    layout->bubble_h = layout->line_count * layout->line_height + 16;
}

static int gui_openclaw_get_chat_content_height(gui_openclaw_ctx_t *ctx, int max_bubble_w)
{
    int total_height = 0;
    int i;

    if (ctx == NULL)
    {
        return 0;
    }

    for (i = 0; i < ctx->message_count; i++)
    {
        gui_openclaw_layout_t layout;

        gui_openclaw_layout_message(ctx, ctx->messages[i].text, 15.0f, max_bubble_w - 20, &layout);
        total_height += layout.bubble_h + 18;
    }

    return total_height;
}

static void gui_openclaw_update_scroll_bounds(gui_openclaw_ctx_t *ctx,
                                              int chat_panel_h,
                                              int max_bubble_w)
{
    int visible_height;
    int content_height;

    if (ctx == NULL)
    {
        return;
    }

    visible_height = chat_panel_h - 20;
    if (visible_height < 0)
    {
        visible_height = 0;
    }

    content_height = gui_openclaw_get_chat_content_height(ctx, max_bubble_w);
    ctx->scroll_offset_max = content_height - visible_height;
    if (ctx->scroll_offset_max < 0)
    {
        ctx->scroll_offset_max = 0;
    }

    if (ctx->scroll_follow_bottom && !ctx->scroll_dragging)
    {
        ctx->scroll_offset = ctx->scroll_offset_max;
        return;
    }

    if (ctx->scroll_offset < 0)
    {
        ctx->scroll_offset = 0;
    }
    if (ctx->scroll_offset > ctx->scroll_offset_max)
    {
        ctx->scroll_offset = ctx->scroll_offset_max;
    }
}

static bool gui_openclaw_point_in_rect(int px, int py, int x, int y, int w, int h)
{
    return (px >= x && px < (x + w) && py >= y && py < (y + h));
}

static void gui_openclaw_handle_touch_scroll(gui_openclaw_ctx_t *ctx,
                                             int chat_abs_x,
                                             int chat_abs_y,
                                             int chat_w,
                                             int chat_h)
{
    touch_info_t *tp;
    bool touch_start_in_chat;
    bool touch_now_in_chat;
    int drag_delta_y;
    int abs_drag_delta_y;
    int touch_now_x;
    int touch_now_y;

    if (ctx == NULL)
    {
        return;
    }

    tp = tp_get_info();
    if (tp == NULL)
    {
        return;
    }

    touch_now_x = tp->x + tp->deltaX;
    touch_now_y = tp->y + tp->deltaY;
    touch_start_in_chat = gui_openclaw_point_in_rect(tp->x, tp->y, chat_abs_x, chat_abs_y, chat_w, chat_h);
    touch_now_in_chat = gui_openclaw_point_in_rect(touch_now_x, touch_now_y,
                                                   chat_abs_x, chat_abs_y, chat_w, chat_h);
    drag_delta_y = tp->deltaY - ctx->scroll_touch_base_delta_y;
    abs_drag_delta_y = (drag_delta_y < 0) ? (-drag_delta_y) : drag_delta_y;

    if ((tp->pressed || tp->pressing) && ctx->scroll_offset_max <= 0)
    {
        gui_log("openclaw touch: no scroll range content fits viewport\n");
    }

    if (!ctx->scroll_dragging)
    {
        if (tp->pressed && (touch_start_in_chat || touch_now_in_chat))
        {
            ctx->scroll_dragging = true;
            ctx->scroll_hold = ctx->scroll_offset;
            ctx->scroll_touch_base_delta_y = tp->deltaY;
            gui_log("openclaw touch: start drag hold=%d base_dy=%d\n",
                    ctx->scroll_hold,
                    ctx->scroll_touch_base_delta_y);
        }
    }

    if (ctx->scroll_dragging && tp->pressing)
    {
        int next_offset = ctx->scroll_hold - drag_delta_y;

        if (abs_drag_delta_y <= SAME_POINT_THR)
        {
            next_offset = ctx->scroll_offset;
        }

        if (next_offset < 0)
        {
            next_offset = 0;
        }
        if (next_offset > ctx->scroll_offset_max)
        {
            next_offset = ctx->scroll_offset_max;
        }

        if (next_offset != ctx->scroll_offset)
        {
            ctx->scroll_offset = next_offset;
            ctx->dirty = true;
            gui_log("openclaw touch: move offset=%d drag_dy=%d raw_dy=%d type=%s\n",
                    ctx->scroll_offset,
                drag_delta_y,
                    tp->deltaY,
                    gui_openclaw_touch_type_name(tp->type));
        }
        ctx->scroll_follow_bottom = (ctx->scroll_offset >= ctx->scroll_offset_max);
    }

    if (ctx->scroll_dragging && tp->released)
    {
        gui_log("openclaw touch: end drag offset=%d/%d\n",
                ctx->scroll_offset,
                ctx->scroll_offset_max);
        ctx->scroll_dragging = false;
        ctx->scroll_hold = ctx->scroll_offset;
        ctx->scroll_touch_base_delta_y = 0;
        ctx->scroll_follow_bottom = (ctx->scroll_offset >= ctx->scroll_offset_max);
    }
}

static void gui_openclaw_draw_text(gui_openclaw_ctx_t *ctx,
                                   int x,
                                   int y,
                                   const char *text,
                                   float font_size,
                                   uint32_t color)
{
    uint8_t r;
    uint8_t g;
    uint8_t b;
    uint8_t a;
    float scale;
    int ascent;
    int descent;
    int line_gap;
    float baseline;
    int pen_x = x;

    if (ctx == NULL || !ctx->font_ready || text == NULL)
    {
        return;
    }

    gui_openclaw_color_to_rgba(color, &r, &g, &b, &a);
    scale = stbtt_ScaleForPixelHeight(&ctx->font, font_size);
    stbtt_GetFontVMetrics(&ctx->font, &ascent, &descent, &line_gap);
    GUI_UNUSED(descent);
    GUI_UNUSED(line_gap);
    baseline = y + ascent * scale;

    while (*text != '\0')
    {
        int codepoint;
        int advance;
        int lsb;
        int x0;
        int y0;
        int x1;
        int y1;
        int out_w;
        int out_h;
        int consumed = gui_openclaw_decode_utf8(text, &codepoint);
        unsigned char *bitmap;

        if (consumed <= 0)
        {
            break;
        }

        if (codepoint == '\n')
        {
            pen_x = x;
            baseline += font_size * 1.35f;
            text += consumed;
            continue;
        }

        stbtt_GetCodepointHMetrics(&ctx->font, codepoint, &advance, &lsb);
        stbtt_GetCodepointBitmapBox(&ctx->font, codepoint, scale, scale, &x0, &y0, &x1, &y1);
        out_w = x1 - x0;
        out_h = y1 - y0;
        bitmap = stbtt_GetCodepointBitmap(&ctx->font, 0, scale, codepoint, &out_w, &out_h, 0, 0);

        if (bitmap != NULL)
        {
            int px_base = pen_x + (int)(lsb * scale);
            int py_base = (int)baseline + y0;
            int row;
            int col;

            for (row = 0; row < out_h; row++)
            {
                for (col = 0; col < out_w; col++)
                {
                    uint8_t glyph_alpha = bitmap[row * out_w + col];
                    uint16_t alpha = (uint16_t)((glyph_alpha * a) >> 8);
                    gui_openclaw_blend_pixel(ctx, px_base + col, py_base + row, r, g, b, (uint8_t)alpha);
                }
            }
            stbtt_FreeBitmap(bitmap, NULL);
        }

        pen_x += (int)(advance * scale);
        text += consumed;
    }
}

static void gui_openclaw_draw_text_clipped(gui_openclaw_ctx_t *ctx,
                                           int x,
                                           int y,
                                           const char *text,
                                           float font_size,
                                           uint32_t color,
                                           int clip_x,
                                           int clip_y,
                                           int clip_w,
                                           int clip_h)
{
    uint8_t r;
    uint8_t g;
    uint8_t b;
    uint8_t a;
    float scale;
    int ascent;
    int descent;
    int line_gap;
    float baseline;
    int pen_x = x;

    if (ctx == NULL || !ctx->font_ready || text == NULL || clip_w <= 0 || clip_h <= 0)
    {
        return;
    }

    gui_openclaw_color_to_rgba(color, &r, &g, &b, &a);
    scale = stbtt_ScaleForPixelHeight(&ctx->font, font_size);
    stbtt_GetFontVMetrics(&ctx->font, &ascent, &descent, &line_gap);
    GUI_UNUSED(descent);
    GUI_UNUSED(line_gap);
    baseline = y + ascent * scale;

    while (*text != '\0')
    {
        int codepoint;
        int advance;
        int lsb;
        int x0;
        int y0;
        int x1;
        int y1;
        int out_w;
        int out_h;
        int consumed = gui_openclaw_decode_utf8(text, &codepoint);
        unsigned char *bitmap;

        if (consumed <= 0)
        {
            break;
        }

        if (codepoint == '\n')
        {
            pen_x = x;
            baseline += font_size * 1.35f;
            text += consumed;
            continue;
        }

        stbtt_GetCodepointHMetrics(&ctx->font, codepoint, &advance, &lsb);
        stbtt_GetCodepointBitmapBox(&ctx->font, codepoint, scale, scale, &x0, &y0, &x1, &y1);
        out_w = x1 - x0;
        out_h = y1 - y0;
        bitmap = stbtt_GetCodepointBitmap(&ctx->font, 0, scale, codepoint, &out_w, &out_h, 0, 0);

        if (bitmap != NULL)
        {
            int px_base = pen_x + (int)(lsb * scale);
            int py_base = (int)baseline + y0;
            int row;
            int col;

            for (row = 0; row < out_h; row++)
            {
                int py = py_base + row;

                if (py < clip_y || py >= (clip_y + clip_h))
                {
                    continue;
                }

                for (col = 0; col < out_w; col++)
                {
                    int px = px_base + col;
                    uint8_t glyph_alpha;
                    uint16_t alpha;

                    if (px < clip_x || px >= (clip_x + clip_w))
                    {
                        continue;
                    }

                    glyph_alpha = bitmap[row * out_w + col];
                    alpha = (uint16_t)((glyph_alpha * a) >> 8);
                    gui_openclaw_blend_pixel(ctx, px, py, r, g, b, (uint8_t)alpha);
                }
            }
            stbtt_FreeBitmap(bitmap, NULL);
        }

        pen_x += (int)(advance * scale);
        text += consumed;
    }
}

static void gui_openclaw_render(gui_openclaw_ctx_t *ctx)
{
    char info_line[GUI_OPENCLAW_INFO_TEXT_LENGTH * 2];
    char input_line[GUI_OPENCLAW_INPUT_TEXT_LENGTH + 4];
    int y;
    int i;
    int max_bubble_w;
    int input_box_y;
    int input_box_h;
    int chat_panel_h;
    int chat_panel_w;
    int chat_panel_x;
    int chat_panel_y;
    int chat_bottom;
    const char *input_text;

    if (ctx == NULL || ctx->pixels == NULL)
    {
        return;
    }

    gui_openclaw_fill_rect(ctx, 0, 0, ctx->width, ctx->height, 0xF5F7FAFF);

    gui_openclaw_fill_rect(ctx, 0, 0, ctx->width, 34, 0x1F2A44FF);
    gui_openclaw_draw_text(ctx, 12, 8, "OpenClaw MQTT Chat", 18.0f, 0xFFFFFFFF);

    gui_openclaw_fill_rect(ctx, ctx->width - 22, 11, 8, 8,
                           ctx->connected ? ((ctx->tick_count & 0x04U) ? 0x4CD964FF : 0x34C759FF) : 0xFF9500FF);

    snprintf(info_line, sizeof(info_line), "%s | senderId=%s",
             ctx->broker_url[0] ? ctx->broker_url : s_openclaw_default_broker,
             ctx->sender_id[0] ? ctx->sender_id : s_openclaw_default_sender);
    gui_openclaw_draw_text(ctx, 12, 38, info_line, 11.0f, 0x4A5568FF);

    if (ctx->status_text[0] != '\0')
    {
        gui_openclaw_draw_text(ctx, 12, 54, ctx->status_text, 12.0f,
                               ctx->connected ? 0x2D6A4FFF : 0xB26A00FF);
    }

    input_box_h = 44;
    input_box_y = ctx->height - input_box_h - 12;
    chat_panel_h = input_box_y - 72 - 10;
    if (chat_panel_h < 40)
    {
        chat_panel_h = 40;
    }
    chat_panel_x = 10;
    chat_panel_y = 72;
    chat_panel_w = ctx->width - 20;
    chat_bottom = 72 + chat_panel_h;

    gui_openclaw_fill_rect(ctx, chat_panel_x, chat_panel_y, chat_panel_w, chat_panel_h, 0xFFFFFFFF);
    gui_openclaw_draw_rect_border(ctx, chat_panel_x, chat_panel_y, chat_panel_w, chat_panel_h, 0xD8DEE9FF);

    {
        bool show_cursor = ctx->input_focused && ((ctx->tick_count & 0x04U) != 0U);
        uint32_t box_border_color = ctx->input_focused ? 0x2F80EDFF : 0xD8DEE9FF;
        uint32_t label_color     = ctx->input_focused ? 0x2F80EDFF : 0x718096FF;

        gui_openclaw_fill_rect(ctx, 10, input_box_y, ctx->width - 20, input_box_h, 0xFFFFFFFF);
        gui_openclaw_draw_rect_border(ctx, 10, input_box_y, ctx->width - 20, input_box_h, box_border_color);
        gui_openclaw_draw_text(ctx, 18, input_box_y - 14, "input>", 11.0f, label_color);

        if (ctx->input_text[0] != '\0')
        {
            snprintf(input_line, sizeof(input_line), "%s%s",
                     ctx->input_text,
                     show_cursor ? "_" : "");
            input_text = input_line;
        }
        else
        {
            if (ctx->input_focused)
            {
                snprintf(input_line, sizeof(input_line), "%s",
                         show_cursor ? "_" : "");
                input_text = input_line;
            }
            else
            {
                input_text = ctx->input_enabled
                             ? "Type here and press Enter"
                             : "Keyboard input unavailable on this platform";
            }
        }
        gui_openclaw_draw_text(ctx, 18, input_box_y + 12, input_text, 14.0f,
                               ctx->input_text[0] != '\0' ? 0x1F2937FF : 0x94A3B8FF);
    }

    y = 84;
    max_bubble_w = (ctx->width * 7) / 10;
    gui_openclaw_update_scroll_bounds(ctx, chat_panel_h, max_bubble_w);
    y -= ctx->scroll_offset;

    for (i = 0; i < ctx->message_count; i++)
    {
        gui_openclaw_layout_t layout;
        gui_openclaw_message_t *message = &ctx->messages[i];
        int bubble_x;
        int text_x;
        int line_index;
        uint32_t bubble_color;
        uint32_t border_color;
        uint32_t text_color;
        uint32_t role_color;
        const char *role_name;

        gui_openclaw_layout_message(ctx, message->text, 15.0f, max_bubble_w - 20, &layout);
        if (y + layout.bubble_h + 18 <= 84)
        {
            y += layout.bubble_h + 18;
            continue;
        }

        if (y >= chat_bottom)
        {
            break;
        }

        switch (message->role)
        {
        case GUI_OPENCLAW_ROLE_USER:
            bubble_color = 0x2F80EDFF;
            border_color = 0x2C6DD2FF;
            text_color = 0xFFFFFFFF;
            role_color = 0x2F80EDFF;
            role_name = "you>";
            bubble_x = ctx->width - layout.bubble_w - 20;
            break;

        case GUI_OPENCLAW_ROLE_ASSISTANT:
            bubble_color = 0xEEF2F7FF;
            border_color = 0xD0D7E2FF;
            text_color = 0x1F2937FF;
            role_color = 0x556987FF;
            role_name = "openclaw>";
            bubble_x = 20;
            break;

        default:
            bubble_color = 0xFFF7E6FF;
            border_color = 0xF2D2A4FF;
            text_color = 0x7A4E00FF;
            role_color = 0xA16207FF;
            role_name = "system>";
            bubble_x = 20;
            break;
        }

        gui_openclaw_draw_text_clipped(ctx, bubble_x, y - 14, role_name, 11.0f, role_color,
                           chat_panel_x + 1, chat_panel_y + 1,
                           chat_panel_w - 2, chat_panel_h - 2);
        gui_openclaw_fill_rect_clipped(ctx, bubble_x, y, layout.bubble_w, layout.bubble_h, bubble_color,
                           chat_panel_x + 1, chat_panel_y + 1,
                           chat_panel_w - 2, chat_panel_h - 2);
        gui_openclaw_draw_rect_border_clipped(ctx, bubble_x, y, layout.bubble_w, layout.bubble_h,
                              border_color,
                              chat_panel_x + 1, chat_panel_y + 1,
                              chat_panel_w - 2, chat_panel_h - 2);

        text_x = bubble_x + 10;
        for (line_index = 0; line_index < layout.line_count; line_index++)
        {
            char line_buf[GUI_OPENCLAW_MAX_MESSAGE_LENGTH];
            uint16_t line_len = layout.lines[line_index].len;

            if (line_len >= sizeof(line_buf))
            {
                line_len = sizeof(line_buf) - 1;
            }

            memcpy(line_buf, message->text + layout.lines[line_index].start, line_len);
            line_buf[line_len] = '\0';
            gui_openclaw_draw_text_clipped(ctx,
                                           text_x,
                                           y + 8 + line_index * layout.line_height,
                                           line_buf,
                                           15.0f,
                                           text_color,
                                           chat_panel_x + 1,
                                           chat_panel_y + 1,
                                           chat_panel_w - 2,
                                           chat_panel_h - 2);
        }

        y += layout.bubble_h + 18;
    }

    ctx->dirty = false;
}

static bool gui_openclaw_push_message(gui_openclaw_ctx_t *ctx,
                                      gui_openclaw_role_t role,
                                      const char *text)
{
    gui_openclaw_message_t *slot;

    if (ctx == NULL || text == NULL || text[0] == '\0')
    {
        return false;
    }

    if (ctx->message_count >= GUI_OPENCLAW_MAX_MESSAGES)
    {
        memmove(&ctx->messages[0],
                &ctx->messages[1],
                sizeof(ctx->messages[0]) * (GUI_OPENCLAW_MAX_MESSAGES - 1));
        ctx->message_count = GUI_OPENCLAW_MAX_MESSAGES - 1;
    }

    slot = &ctx->messages[ctx->message_count++];
    slot->role = role;
    gui_openclaw_safe_copy(slot->text, sizeof(slot->text), text);
    gui_openclaw_log_chat(role, slot->text);
    if (!ctx->scroll_dragging && ctx->scroll_follow_bottom)
    {
        ctx->scroll_offset = ctx->scroll_offset_max;
    }
    ctx->dirty = true;
    return true;
}

static void gui_openclaw_timer_cb(void *param)
{
    gui_openclaw_ctx_t *ctx = gui_openclaw_find_ctx((gui_openclaw_t *)param);
    int widget_x;
    int widget_y;
    int input_box_h;
    int input_box_y;
    int chat_panel_h;

    if (ctx == NULL)
    {
        return;
    }

    if (ctx == s_openclaw_active_ctx && ctx->input_enabled)
    {
        gui_openclaw_process_input_events(ctx);
    }

#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
    if (ctx->mqtt_enabled)
    {
        gui_openclaw_mqtt_process_events(ctx);
    }
#endif

    gui_openclaw_get_widget_origin(&(ctx->widget->base), &widget_x, &widget_y);
    input_box_h = 44;
    input_box_y = ctx->height - input_box_h - 12;
    chat_panel_h = input_box_y - 72 - 10;
    if (chat_panel_h < 40)
    {
        chat_panel_h = 40;
    }
    gui_openclaw_update_scroll_bounds(ctx, chat_panel_h, (ctx->width * 7) / 10);
    gui_openclaw_handle_touch_scroll(ctx,
                                     widget_x + 10,
                                     widget_y + 72,
                                     ctx->width - 20,
                                     chat_panel_h);

    {
        touch_info_t *tp = tp_get_info();
        if (tp != NULL && tp->pressed)
        {
            bool hit_input = gui_openclaw_point_in_rect(tp->x, tp->y,
                                                        widget_x + 10,
                                                        widget_y + input_box_y,
                                                        ctx->width - 20,
                                                        input_box_h);
            bool hit_chat  = gui_openclaw_point_in_rect(tp->x, tp->y,
                                                        widget_x + 10,
                                                        widget_y + 72,
                                                        ctx->width - 20,
                                                        chat_panel_h);
            if (hit_input)
            {
                if (!ctx->input_focused)
                {
                    ctx->input_focused = true;
                    ctx->dirty = true;
                }
            }
            else if (hit_chat)
            {
                if (ctx->input_focused)
                {
                    ctx->input_focused = false;
                    ctx->dirty = true;
                }
            }
        }
    }

    ctx->tick_count++;
    if (!ctx->dirty && (ctx->tick_count % 4U) != 0U)
    {
        return;
    }

    gui_openclaw_render(ctx);
    gui_fb_change();
}

static void gui_openclaw_seed_default_messages(gui_openclaw_ctx_t *ctx)
{
    gui_openclaw_push_message(ctx, GUI_OPENCLAW_ROLE_SYSTEM, "Connected. Type text and press Enter.");
    gui_openclaw_push_message(ctx, GUI_OPENCLAW_ROLE_ASSISTANT, "Use /help for commands.");
    gui_openclaw_push_message(ctx, GUI_OPENCLAW_ROLE_ASSISTANT, "This widget now renders chat text with TTF into a framebuffer and displays it through gui_img_create_from_mem.");
#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
    gui_openclaw_push_message(ctx, GUI_OPENCLAW_ROLE_SYSTEM, "Keyboard input is captured directly from the simulator window.");
#else
    gui_openclaw_push_message(ctx, GUI_OPENCLAW_ROLE_SYSTEM, "Keyboard text input is disabled on this platform build.");
#endif
}

/*============================================================================*
 *                           Public Functions
 *============================================================================*/
gui_openclaw_t *gui_openclaw_create_from_mem(void          *parent,
                                             const char    *name,
                                             const uint8_t *ttf_font_data_addr,
                                             size_t         ttf_font_data_size,
                                             const char    *sender_id,
                                             int16_t        x,
                                             int16_t        y,
                                             int16_t        w,
                                             int16_t        h)
{
    gui_openclaw_ctx_t *ctx;
    gui_img_t *img;
    size_t image_size;


    if (parent == NULL || w <= 0 || h <= 0)
    {
        return NULL;
    }

    ctx = gui_malloc(sizeof(gui_openclaw_ctx_t));
    GUI_ASSERT(ctx != NULL);
    memset(ctx, 0x00, sizeof(gui_openclaw_ctx_t));

    ctx->width = w;
    ctx->height = h;
    ctx->ttf_font_data = ttf_font_data_addr;
    ctx->ttf_font_size = ttf_font_data_size;
    ctx->connected = false;
    ctx->dirty = true;
    ctx->scroll_follow_bottom = true;
    ctx->input_focused = true;
#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
    ctx->input_enabled = true;
    gui_openclaw_mqtt_event_init(ctx);
#else
    ctx->input_enabled = false;
#endif
    gui_openclaw_safe_copy(ctx->broker_url, sizeof(ctx->broker_url), s_openclaw_default_broker);
    gui_openclaw_safe_copy(ctx->sender_id, sizeof(ctx->sender_id),
                           (sender_id != NULL && sender_id[0] != '\0') ? sender_id : s_openclaw_default_sender);
    gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text),
                           ctx->input_enabled ?
                           "MQTT loading..." :
                           "MQTT ready | keyboard input unavailable on this platform");

    image_size = sizeof(gui_rgb_data_head_t) + (size_t)w * (size_t)h * sizeof(uint16_t);
    ctx->image_data = gui_malloc(image_size);
    GUI_ASSERT(ctx->image_data != NULL);
    memset(ctx->image_data, 0x00, image_size);
    ctx->image_data->type = RGB565;
    ctx->image_data->w = w;
    ctx->image_data->h = h;
    ctx->pixels = (uint16_t *)((uint8_t *)ctx->image_data + sizeof(gui_rgb_data_head_t));

    gui_openclaw_init_font(ctx);
    gui_openclaw_seed_default_messages(ctx);
#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
    gui_openclaw_mqtt_init(ctx);
    gui_openclaw_install_sdl_event_watch();
#endif
    gui_openclaw_render(ctx);

    img = gui_img_create_from_mem(parent, name, ctx->image_data, x, y, 0, 0);
    ctx->widget = img;
    gui_openclaw_register_ctx(ctx);

    gui_obj_create_timer(&(img->base), 10, true, gui_openclaw_timer_cb);
    gui_obj_start_timer(&(img->base));

    gui_log("openclaw: widget created, ram used=%d bytes\n", gui_low_mem_used());
    return (gui_openclaw_t *)img;
}

bool gui_openclaw_append_message(gui_openclaw_t      *widget,
                                 gui_openclaw_role_t  role,
                                 const char          *text)
{
    gui_openclaw_ctx_t *ctx = gui_openclaw_find_ctx(widget);
    bool ok;

    if (ctx == NULL)
    {
        return false;
    }

    ok = gui_openclaw_push_message(ctx, role, text);
    if (ok)
    {
        gui_openclaw_render(ctx);
        gui_fb_change();
    }
    return ok;
}

void gui_openclaw_clear_messages(gui_openclaw_t *widget)
{
    gui_openclaw_ctx_t *ctx = gui_openclaw_find_ctx(widget);

    if (ctx == NULL)
    {
        return;
    }

    ctx->message_count = 0;
    ctx->scroll_offset = 0;
    ctx->scroll_offset_max = 0;
    ctx->scroll_hold = 0;
    ctx->scroll_touch_base_delta_y = 0;
    ctx->scroll_dragging = false;
    ctx->scroll_follow_bottom = true;
    ctx->dirty = true;
    gui_openclaw_render(ctx);
    gui_fb_change();
}

void gui_openclaw_set_connection_info(gui_openclaw_t *widget,
                                      const char     *broker_url,
                                      const char     *sender_id,
                                      bool            connected)
{
    gui_openclaw_ctx_t *ctx = gui_openclaw_find_ctx(widget);

    if (ctx == NULL)
    {
        return;
    }

    if (broker_url != NULL)
    {
        gui_openclaw_safe_copy(ctx->broker_url, sizeof(ctx->broker_url), broker_url);
    }
    if (sender_id != NULL)
    {
        gui_openclaw_safe_copy(ctx->sender_id, sizeof(ctx->sender_id), sender_id);
    }
    ctx->connected = connected;
    ctx->dirty = true;
}

void gui_openclaw_set_status(gui_openclaw_t *widget, const char *status_text)
{
    gui_openclaw_ctx_t *ctx = gui_openclaw_find_ctx(widget);

    if (ctx == NULL)
    {
        return;
    }

    gui_openclaw_safe_copy(ctx->status_text, sizeof(ctx->status_text), status_text);
    ctx->dirty = true;
}

void gui_openclaw_refresh(gui_openclaw_t *widget)
{
    gui_openclaw_ctx_t *ctx = gui_openclaw_find_ctx(widget);

    if (ctx == NULL)
    {
        return;
    }

    gui_openclaw_render(ctx);
    gui_fb_change();
}

void gui_openclaw_input_utf8(const char *text)
{
#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
    size_t i;

    if (text == NULL || s_openclaw_active_ctx == NULL || !s_openclaw_active_ctx->input_enabled)
    {
        return;
    }

    for (i = 0; text[i] != '\0'; i++)
    {
        if (!gui_openclaw_enqueue_input_event((unsigned char)text[i]))
        {
            gui_log("openclaw: input queue full, dropping text\n");
            break;
        }
    }
#else
    GUI_UNUSED(text);
#endif
}

void gui_openclaw_input_backspace(void)
{
#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
    if (s_openclaw_active_ctx == NULL || !s_openclaw_active_ctx->input_enabled)
    {
        return;
    }

    if (!gui_openclaw_enqueue_input_event(GUI_OPENCLAW_INPUT_EVENT_BACKSPACE))
    {
        gui_log("openclaw: input queue full, dropping backspace\n");
    }
#endif
}

void gui_openclaw_input_submit(void)
{
#if defined(_HONEYGUI_SIMULATOR_) && (defined(_WIN32) || defined(__linux__))
    if (s_openclaw_active_ctx == NULL || !s_openclaw_active_ctx->input_enabled)
    {
        return;
    }

    if (!gui_openclaw_enqueue_input_event(GUI_OPENCLAW_INPUT_EVENT_SUBMIT))
    {
        gui_log("openclaw: input queue full, dropping submit\n");
    }
#endif
}



