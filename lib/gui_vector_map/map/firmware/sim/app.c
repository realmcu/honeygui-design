/**
 * @file main.c
 * @brief Windows simulation main program for TrMap navigation
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>
#include "map_types.h"

/* For _kbhit() and _getch() - keyboard input */
#ifdef  USE_HONEY_GUI
#include "kb_algo.h"
#include "tp_algo.h"
#elif defined(_WIN32)
#include <conio.h>  
#else
/* MCU GPIO Key includes */
#include "trace.h"
#include "hw_tim.h"
#include "section.h"
#include "hal_gpio.h"
#include "hal_gpio_int.h"
#include "rtl876x_pinmux.h"
#include "mfb_api.h"           /* MFB (Multi-Function Button) API */
#include "touch_CHSC6417.h"    /* Touch screen driver */
#include "os_sync.h"           /* For os_lock/os_unlock */
#endif

/* ============================================================================
 * MCU GPIO Key Definitions
 * KEY1: P3_0  - Toggle recording/replay mode (GPS Track mode only)
 * KEY2: P3_5  - Cycle application mode (Navigation/Nav Setup/GPS Track) or confirm destination
 * KEY3: P3_1  - Reserved
 * MFB:  Multi-Function Button - Reserved (uses mfb_api.h for low-power wake)
 * ============================================================================
 */
#if !defined(_WIN32) && !defined(USE_HONEY_GUI)
#define MCU_KEY1_PIN                  P3_0   /* Toggle recording/replay mode */
#define MCU_KEY2_PIN                  P3_5   /* Reset zoom and pan */
#define MCU_KEY3_PIN                  P3_1   /* Cycle application mode */

/* Key event flags (set by ISR, cleared by main loop) */
static volatile uint8_t g_key1_pressed = 0;
static volatile uint8_t g_key2_pressed = 0;
static volatile uint8_t g_key3_pressed = 0;
static volatile uint8_t g_mfb_pressed = 0;   /* MFB button event flag */

/**
 * @brief KEY1 GPIO interrupt handler (P3_0 - Toggle recording/replay)
 * Simple handler without debounce - sets flag on falling edge (press)
 */
static void mcu_key1_handler(uint32_t key_index)
{
    uint8_t level = hal_gpio_get_input_level(key_index);
    if (level == 0)  /* Pressed (active low) */
    {
        g_key1_pressed = 1;
        MAP_PRINTF("KEY1 (P3_0): Pressed");
    }
}

/**
 * @brief KEY2 GPIO interrupt handler (ADC_0 - Cycle app mode)
 * Simple handler without debounce - sets flag on falling edge (press)
 */
static void mcu_key2_handler(uint32_t key_index)
{
    uint8_t level = hal_gpio_get_input_level(key_index);
    if (level == 0)  /* Pressed (active low) */
    {
        g_key2_pressed = 1;
        MAP_PRINTF("KEY2 (ADC_0): Pressed");
    }
}

/**
 * @brief KEY3 GPIO interrupt handler (P3_1 - Reserved)
 * Simple handler without debounce - sets flag on falling edge (press)
 */
static void mcu_key3_handler(uint32_t key_index)
{
    uint8_t level = hal_gpio_get_input_level(key_index);
    if (level == 0)  /* Pressed (active low) */
    {
        g_key3_pressed = 1;
        MAP_PRINTF("KEY3 (P3_1): Pressed");
    }
}

/**
 * @brief MFB (Multi-Function Button) interrupt handler - Reserved
 * Callback function for mfb_init(), called on MFB level change
 */
static void mcu_mfb_handler(void)
{
    MAP_PRINTF("MFB: Interrupt triggered");
    bool level = mfb_get_level();
    if (!level)  /* Pressed (active low) */
    {
        g_mfb_pressed = 1;
        MAP_PRINTF("MFB: Pressed");
    }
}

/**
 * @brief Initialize MCU GPIO keys for GPS track mode
 *
 * KEY1 (P3_0):  Toggle recording/replay mode
 * KEY2 (ADC_0): Cycle application mode
 * KEY3 (P3_1):  Reserved
 * MFB:          Multi-Function Button - Reserved
 *
 * Note: No debounce timers - simple edge-triggered interrupts
 */
void mcu_gpio_keys_init(void)
{
    hal_gpio_init();
    hal_gpio_int_init();

    /* Initialize KEY1 (P3_0) - Toggle recording/replay */
    hal_gpio_init_pin(MCU_KEY1_PIN, GPIO_TYPE_AUTO, GPIO_DIR_INPUT, GPIO_PULL_UP);
    hal_gpio_set_up_irq(MCU_KEY1_PIN, GPIO_IRQ_EDGE, GPIO_IRQ_ACTIVE_LOW, false);
    hal_gpio_register_isr_callback(MCU_KEY1_PIN, mcu_key1_handler, MCU_KEY1_PIN);
    hal_gpio_irq_enable(MCU_KEY1_PIN);

    /* Initialize KEY2 (ADC_0) - Cycle application mode */
    hal_gpio_init_pin(MCU_KEY2_PIN, GPIO_TYPE_AUTO, GPIO_DIR_INPUT, GPIO_PULL_UP);
    hal_gpio_set_up_irq(MCU_KEY2_PIN, GPIO_IRQ_EDGE, GPIO_IRQ_ACTIVE_LOW, false);
    hal_gpio_register_isr_callback(MCU_KEY2_PIN, mcu_key2_handler, MCU_KEY2_PIN);
    hal_gpio_irq_enable(MCU_KEY2_PIN);

    /* Initialize KEY3 (P3_1) - Reserved */
    hal_gpio_init_pin(MCU_KEY3_PIN, GPIO_TYPE_AUTO, GPIO_DIR_INPUT, GPIO_PULL_UP);
    hal_gpio_set_up_irq(MCU_KEY3_PIN, GPIO_IRQ_EDGE, GPIO_IRQ_ACTIVE_LOW, false);
    hal_gpio_register_isr_callback(MCU_KEY3_PIN, mcu_key3_handler, MCU_KEY3_PIN);
    hal_gpio_irq_enable(MCU_KEY3_PIN);

    /* Initialize MFB (Multi-Function Button) - Reserved */
    mfb_init(mcu_mfb_handler);
    mfb_irq_enable();

    MAP_PRINTF("MCU GPIO Keys initialized (no debounce):");
    MAP_PRINTF("  KEY1(P3_0): Toggle recording/replay");
    MAP_PRINTF("  KEY2(ADC_0): Cycle app mode (Nav/Setup/Track)");
    MAP_PRINTF("  KEY3(P3_1): Reserved");
    MAP_PRINTF("  MFB: Reserved");
}
#elif defined(USE_HONEY_GUI)
static void mcu_gpio_keys_init(void)
{
}

typedef struct
{
    const char *name;
    uint32_t last_press_timestamp;
} trmap_honey_gui_key_state_t;

static trmap_honey_gui_key_state_t g_trmap_honey_gui_keys[] =
{
    {"Home", 0},
    {"Back", 0},
    {"Menu", 0},
    {"Power", 0},
};

static int trmap_honey_gui_touch_active(const touch_info_t *tp)
{
    return (tp != NULL) && (tp->pressed || tp->pressing);
}

static int trmap_honey_gui_touch_released(const touch_info_t *tp)
{
    return (tp != NULL) && (tp->released != 0);
}

static trmap_honey_gui_key_state_t *trmap_honey_gui_find_key_state(const char *name)
{
    uint32_t i;

    if (name == NULL)
    {
        return NULL;
    }

    for (i = 0; i < (sizeof(g_trmap_honey_gui_keys) / sizeof(g_trmap_honey_gui_keys[0])); i++)
    {
        if (strcmp(g_trmap_honey_gui_keys[i].name, name) == 0)
        {
            return &g_trmap_honey_gui_keys[i];
        }
    }

    return NULL;
}

static int trmap_honey_gui_consume_key_press(const char *name)
{
    gui_obj_t *kb_root;
    gui_node_list_t *node;
    trmap_honey_gui_key_state_t *key_state;

    key_state = trmap_honey_gui_find_key_state(name);
    if (key_state == NULL)
    {
        return 0;
    }

    kb_root = gui_obj_get_kb_root();
    if (kb_root == NULL)
    {
        return 0;
    }

    gui_list_for_each(node, &kb_root->child_list)
    {
        gui_obj_t *obj = gui_list_entry(node, gui_obj_t, brother_list);
        gui_indev_kb_t *kb = (gui_indev_kb_t *)obj;
        uint32_t press_timestamp;

        if (obj->name == NULL || strcmp(obj->name, name) != 0)
        {
            continue;
        }

        if (kb->state == NULL || kb->timestamp_ms_press == NULL)
        {
            return 0;
        }

        press_timestamp = *(kb->timestamp_ms_press);
        if (*(kb->state) == true && press_timestamp != 0 &&
            press_timestamp != key_state->last_press_timestamp)
        {
            key_state->last_press_timestamp = press_timestamp;
            return 1;
        }

        return 0;
    }

    return 0;
}
#endif



#include "nav_api.h"
#include "render_api.h"
#include "memory_monitor.h"
#include "lane_guidance.h"
#include "gps_simulator.h"
#include "gps_provider.h"
#include "gps_driver.h"
#include "map_control.h"

/* Default settings */
size_t map_defalut_width = 410;
size_t map_defalut_height = 502;
#define DEFAULT_WIDTH   map_defalut_width
#define DEFAULT_HEIGHT  map_defalut_height
#define DEFAULT_MAP     "../../data/map.bin"
#define DEFAULT_OUTPUT  "path_output.bmp"

/* Navigation constants */
#define OFF_ROUTE_THRESHOLD     50.0   /* Off-route threshold (meters) */
#define ARRIVAL_THRESHOLD       10.0f   /* Arrival at destination threshold (meters) */
#define NAV_UPDATE_INTERVAL_MS  25      /* Navigation update interval (ms) */
#define NAV_SIMULATION_SPEED    200.0f  /* Simulation navigation speed (m/s, ~72km/h) */

/* GPS Map / Nav Setup Mode constants */
#define GPS_MAP_VIEW_RADIUS     100.0f  /* Map display radius (meters) */
#define MAP_VIEW_UPDATE_INTERVAL_MS 100 /* Map view update interval (ms) */
#define GPS_MAP_UPDATE_INTERVAL_MS  100 /* GPS map update interval (ms) */
#define NAV_SETUP_PAN_STEP     0.0005f  /* Pan step per key press (degrees, ~55m) */

/* Track mode constants */
#define GPS_TRACK_MAX_POINTS        10000   /* Maximum track points to store */
#define GPS_TRACK_MIN_DISTANCE      5.0f    /* Minimum distance between track points (meters) */
#define GPS_TRACK_UPDATE_INTERVAL_MS 100    /* Track mode update interval (ms) */

/* Viewport control constants */
#define VIEWPORT_ZOOM_STEP      1.5f    /* Zoom step factor */
#define VIEWPORT_ZOOM_MIN       0.05f    /* Minimum zoom (zoomed in) */
#define VIEWPORT_ZOOM_MAX       800.0f   /* Maximum zoom (zoomed out) */
#define VIEWPORT_PAN_STEP       0.2f    /* Pan step as fraction of view */

/* Touch double-tap detection constants */
#define TOUCH_DOUBLE_TAP_TIME_MS    400     /* Maximum time between taps (ms) */
#define TOUCH_DOUBLE_TAP_DISTANCE   50      /* Maximum distance between taps (pixels) */

/* Application modes */
typedef enum
{
    APP_MODE_MAP_VIEW,          /* Simple map view mode (startup default) */
    APP_MODE_GPS_INIT,          /* GPS initialization mode */
    APP_MODE_GPS_TRACK_RECORD,  /* GPS track recording mode */
    APP_MODE_GPS_TRACK_REPLAY,  /* GPS track replay mode */
    APP_MODE_GPS_MAP,           /* GPS map / navigation setup mode */
    APP_MODE_NAVIGATION,        /* Navigation mode */
    APP_MODE_COUNT              /* Total number of modes (for cycling) */
} app_mode_t;

/* Mode switch request (set by keyboard handler, processed by main loop) */
static volatile int g_mode_switch_requested = 0;
static volatile app_mode_t g_mode_switch_target = APP_MODE_MAP_VIEW;

typedef enum
{
    TRMAP_MAP_CONTROL_PAN_NORTH,
    TRMAP_MAP_CONTROL_PAN_SOUTH,
    TRMAP_MAP_CONTROL_PAN_WEST,
    TRMAP_MAP_CONTROL_PAN_EAST
} trmap_map_control_pan_direction_t;

static int trmap_map_control_pan_internal(trmap_map_control_pan_direction_t direction);
static trmap_app_mode_t trmap_public_mode_from_internal(app_mode_t mode);
static int trmap_internal_mode_from_public(trmap_app_mode_t mode, app_mode_t *out_mode);

/* ============================================================================
 * GPS Position Structure (Legacy - now uses gps_simulator.h)
 * ============================================================================
 */

/* Note: gps_position_t is now defined in gps_simulator.h */

/* ============================================================================
 * Navigation State Structure
 * ============================================================================
 */

typedef struct
{
    path_t *current_path;       /* Current path (for display and navigation detection) */
    path_t *original_path;      /* Original path (from start to end, for display) */
    uint32_t current_segment;   /* Current segment index */
    float distance_to_next;     /* Distance to next turn point */
    float remaining_distance;   /* Remaining total distance */
    float total_distance;       /* Total route distance (for display) */
    float orig_start_lat;       /* Original start latitude (unchanged by rerouting) */
    float orig_start_lon;       /* Original start longitude */
    float orig_end_lat;         /* Original end latitude */
    float orig_end_lon;         /* Original end longitude */
    int off_route;              /* Whether off route */
    int arrived;                /* Whether arrived at destination */
} nav_state_t;

/* ============================================================================
 * Application Configuration Structure
 * ============================================================================
 */

typedef struct
{
    const char *map_file;
    const char *output_file;
    int width;
    int height;
    float start_lat;
    float start_lon;
    float end_lat;
    float end_lon;
    int has_start;
    int has_end;
    transport_mode_t transport_mode;
    int max_frames;             /* Max frames in navigation mode (0=unlimited) */
    app_mode_t app_mode;        /* Application mode: navigation/GPS map */
    float gps_view_radius;      /* GPS map display radius (meters) */
    /* GPS Provider configuration */
    gps_provider_type_t gps_type;   /* GPS data source type */
    const char *gps_serial_port;    /* Serial GPS port name (e.g., "COM3") */
    uint32_t gps_baudrate;          /* Serial baud rate */
} app_config_t;

/* ============================================================================
 * Application State Structure (for navigation mode)
 * ============================================================================
 */

typedef struct
{
    gps_simulator_t gps_sim;    /* GPS simulator (for simulation mode) */
    gps_provider_t *gps_provider; /* GPS provider (unified interface) */
    nav_state_t nav;            /* Navigation state */
    app_config_t config;        /* Configuration */
    map_t *map;                 /* Map */
    renderer_t *renderer;       /* Renderer */
    int running;                /* Is running */
    int needs_reroute;          /* Needs rerouting */
    int needs_redraw;           /* Needs redraw */
    int frame_count;            /* Frame count */
    /* Lane guidance state */
    guidance_state_t guidance_state;    /* Lane guidance state */
    guidance_style_t guidance_style;    /* Lane guidance style */
    lane_display_style_t lane_style;    /* Multi-lane display style (Phase 2) */
    /* Map control state */
    float pan_offset_lat;       /* Pan offset in latitude (degrees) */
    float pan_offset_lon;       /* Pan offset in longitude (degrees) */
    float zoom_factor;          /* Zoom factor (1.0 = default) */
#if !defined(_WIN32) || defined(USE_HONEY_GUI)
    /* Touch pan and zoom control */
    int touch_active;           /* Touch is currently active */
    uint16_t touch_start_x;     /* Touch start X coordinate */
    uint16_t touch_start_y;     /* Touch start Y coordinate */
    uint16_t touch_last_x;      /* Last touch X coordinate */
    uint16_t touch_last_y;      /* Last touch Y coordinate */
    /* Double-tap detection */
    uint32_t last_tap_time;     /* Timestamp of last tap (ms) */
    uint16_t last_tap_x;        /* X coordinate of last tap */
    uint16_t last_tap_y;        /* Y coordinate of last tap */
#endif
} app_state_t;

/* ============================================================================
 * Helper Functions
 * ============================================================================
 */

static void print_usage(const char *prog_name)
{
    MAP_PRINTF("TrMap Navigation Simulator\n");
    MAP_PRINTF("Usage: %s [options]\n", prog_name);
    MAP_PRINTF("\nOptions:\n");
    MAP_PRINTF("  -m, --map <file>      Map file path (default: %s)\n", DEFAULT_MAP);
    MAP_PRINTF("  -o, --output <file>   Output frames prefix (default: %s)\n", DEFAULT_OUTPUT);
    MAP_PRINTF("  -w, --width <pixels>  Output width (default: %d)\n", DEFAULT_WIDTH);
    MAP_PRINTF("  -h, --height <pixels> Output height (default: %d)\n", DEFAULT_HEIGHT);
    MAP_PRINTF("  --start <lat,lon>     Start coordinate\n");
    MAP_PRINTF("  --end <lat,lon>       End coordinate\n");
    MAP_PRINTF("  --mode <mode>         Transport mode: car, bike, walk, transit\n");
    MAP_PRINTF("                        - car:     Highway/motorway preferred (default)\n");
    MAP_PRINTF("                        - bike:    Residential roads, avoid highways\n");
    MAP_PRINTF("                        - walk:    Small roads and alleys preferred\n");
    MAP_PRINTF("                        - transit: Future subway support\n");
    MAP_PRINTF("  --frames <n>          Max frames (0=infinite, default=100)\n");
    MAP_PRINTF("  --map-view            Map view mode (simple map, no GPS) - default\n");
    MAP_PRINTF("  --gps-init            GPS initialization mode (wait for GPS fix)\n");
    MAP_PRINTF("  --nav                 Navigation mode (with route guidance)\n");
    MAP_PRINTF("  --gps-map             Navigation setup mode (select destination)\n");
    MAP_PRINTF("  --gps-track           GPS track mode (records and displays track)\n");
    MAP_PRINTF("  --view-radius <m>     GPS map/track view radius in meters (default=500)\n");
    MAP_PRINTF("\nGPS Source Options:\n");
    MAP_PRINTF("  --gps-sim             Use GPS simulator (default)\n");
    MAP_PRINTF("  --gps-serial <port>   Use serial GPS on specified port (e.g., COM3)\n");
    MAP_PRINTF("  --gps-baud <rate>     Serial GPS baud rate (default=9600)\n");
    MAP_PRINTF("  --list-ports          List available serial ports and exit\n");
    MAP_PRINTF("  --help                Show this help\n");
    MAP_PRINTF("\nExamples:\n");
    MAP_PRINTF("  Navigation mode with GPS simulator:\n");
    MAP_PRINTF("    %s --start 39.910,116.320 --end 39.940,116.380 --mode car\n", prog_name);
    MAP_PRINTF("  Navigation mode with real GPS hardware:\n");
    MAP_PRINTF("    %s --gps-serial COM3 --gps-baud 9600 --end 39.940,116.380\n", prog_name);
    MAP_PRINTF("  Navigation setup mode with serial GPS:\n");
    MAP_PRINTF("    %s --gps-map --gps-serial COM3 --view-radius 1000\n", prog_name);
    MAP_PRINTF("  GPS Track mode with serial GPS:\n");
    MAP_PRINTF("    %s --gps-track --gps-serial COM3 --view-radius 500\n", prog_name);
    MAP_PRINTF("  List available serial ports:\n");
    MAP_PRINTF("    %s --list-ports\n", prog_name);
    MAP_PRINTF("\nRuntime Mode Switching:\n");
    MAP_PRINTF("  Press [M] to cycle through modes, or [1/2/3/4/5] for direct switch:\n");
    MAP_PRINTF("    [1] GPS Init mode\n");
    MAP_PRINTF("    [2] Track Record mode\n");
    MAP_PRINTF("    [3] Nav Setup mode\n");
    MAP_PRINTF("    [4] Navigation mode\n");
    MAP_PRINTF("  On MCU: Press KEY2 to cycle modes\n");
}

static int parse_coord(const char *str, float *lat, float *lon)
{
    return sscanf(str, "%f,%f", lat, lon) == 2;
}

static transport_mode_t parse_mode(const char *str)
{
    if (strcmp(str, "car") == 0)
    {
        return TRANSPORT_CAR;
    }
    if (strcmp(str, "bike") == 0)
    {
        return TRANSPORT_BIKE;
    }
    if (strcmp(str, "walk") == 0)
    {
        return TRANSPORT_WALK;
    }
    if (strcmp(str, "transit") == 0)
    {
        return TRANSPORT_TRANSIT;
    }
    return TRANSPORT_CAR;
}

static const char *mode_to_string(transport_mode_t mode)
{
    switch (mode)
    {
        case TRANSPORT_CAR:
            return "car";
        case TRANSPORT_BIKE:
            return "bike";
        case TRANSPORT_WALK:
            return "walk";
        case TRANSPORT_TRANSIT:
            return "transit";
        default:
            return "car";
    }
}

/* ============================================================================
 * Application Mode Switch Functions
 * ============================================================================
 */

/**
 * @brief Get application mode name string
 * @param mode Application mode
 * @return Mode name string
 */
static const char *app_mode_to_string(app_mode_t mode)
{
    switch (mode)
    {
        case APP_MODE_MAP_VIEW:
            return "Map View";
        case APP_MODE_GPS_INIT:
            return "GPS Init";
        case APP_MODE_GPS_TRACK_RECORD:
            return "Track Record";
        case APP_MODE_GPS_TRACK_REPLAY:
            return "Track Replay";
        case APP_MODE_GPS_MAP:
            return "Nav Setup";
        case APP_MODE_NAVIGATION:
            return "Navigation";
        default:
            return "Unknown";
    }
}

static trmap_app_mode_t trmap_public_mode_from_internal(app_mode_t mode)
{
    switch (mode)
    {
        case APP_MODE_MAP_VIEW:
            return TRMAP_APP_MODE_MAP_VIEW;
        case APP_MODE_GPS_INIT:
            return TRMAP_APP_MODE_GPS_INIT;
        case APP_MODE_GPS_TRACK_RECORD:
            return TRMAP_APP_MODE_GPS_TRACK_RECORD;
        case APP_MODE_GPS_TRACK_REPLAY:
            return TRMAP_APP_MODE_GPS_TRACK_REPLAY;
        case APP_MODE_GPS_MAP:
            return TRMAP_APP_MODE_GPS_MAP;
        case APP_MODE_NAVIGATION:
            return TRMAP_APP_MODE_NAVIGATION;
        default:
            return TRMAP_APP_MODE_MAP_VIEW;
    }
}

static int trmap_internal_mode_from_public(trmap_app_mode_t mode, app_mode_t *out_mode)
{
    if (!out_mode)
    {
        return 0;
    }

    switch (mode)
    {
        case TRMAP_APP_MODE_MAP_VIEW:
            *out_mode = APP_MODE_MAP_VIEW;
            return 1;
        case TRMAP_APP_MODE_GPS_INIT:
            *out_mode = APP_MODE_GPS_INIT;
            return 1;
        case TRMAP_APP_MODE_GPS_TRACK_RECORD:
            *out_mode = APP_MODE_GPS_TRACK_RECORD;
            return 1;
        case TRMAP_APP_MODE_GPS_TRACK_REPLAY:
            *out_mode = APP_MODE_GPS_TRACK_REPLAY;
            return 1;
        case TRMAP_APP_MODE_GPS_MAP:
            *out_mode = APP_MODE_GPS_MAP;
            return 1;
        case TRMAP_APP_MODE_NAVIGATION:
            *out_mode = APP_MODE_NAVIGATION;
            return 1;
        default:
            return 0;
    }
}

/**
 * @brief Request application mode switch
 * This function is called from keyboard handlers to request a mode switch.
 * The actual switch is performed in the main loop.
 * @param current_mode Current application mode
 * @param target_mode Target mode to switch to, or -1 to cycle to next mode
 */
static void app_request_mode_switch(app_mode_t current_mode, int target_mode)
{
    app_mode_t next_mode;

    if (target_mode < 0)
    {
        /* Cycle to next mode */
        next_mode = (app_mode_t)((current_mode + 1) % APP_MODE_COUNT);
    }
    else
    {
        next_mode = (app_mode_t)target_mode;
    }

    if (next_mode != current_mode)
    {
        g_mode_switch_target = next_mode;
        g_mode_switch_requested = 1;
        MAP_PRINTF("🔄 Mode switch requested: %s -> %s\n",
                   app_mode_to_string(current_mode),
                   app_mode_to_string(next_mode));
    }
}

/**
 * @brief Check if mode switch is requested
 * @return 1 if mode switch is requested, 0 otherwise
 */
static int app_is_mode_switch_requested(void)
{
    return g_mode_switch_requested;
}

/**
 * @brief Clear mode switch request (called after processing)
 */
static void app_clear_mode_switch_request(void)
{
    g_mode_switch_requested = 0;
}

/* ============================================================================
 * Configuration Functions
 * ============================================================================
 */
const char *pc_serial_name = "COM15";  /* Default serial port name (can be overridden by command line) */
/**
 * @brief Initialize app configuration with default values
 * Default configuration matches: build_and_test.bat nav suzhou_full car 100 31.25,120.55,31.35,120.65
 */
static void config_init(app_config_t *config)
{
    config->map_file = "../../data/map.trmap";
    config->output_file = DEFAULT_OUTPUT;
    config->width = DEFAULT_WIDTH;
    config->height = DEFAULT_HEIGHT;
    config->start_lat = 31.33f;
    config->start_lon = 120.62f;
    config->end_lat = 31.35f;
    config->end_lon = 120.65f;
    config->has_start = 1;
    config->has_end = 1;
    config->transport_mode = TRANSPORT_CAR;
    config->max_frames = 100;
    config->app_mode = APP_MODE_MAP_VIEW;  /* Start with simple map view mode */
    config->gps_view_radius = GPS_MAP_VIEW_RADIUS;
    /* GPS Provider defaults */
    config->gps_type = GPS_PROVIDER_SERIAL;
    config->gps_serial_port = pc_serial_name;
    config->gps_baudrate = 9600;
}

/**
 * @brief Parse command line arguments into config
 * @return 0 on success, 1 to show help and exit, -1 on error
 */
static int config_parse_args(app_config_t *config, int argc, char *argv[])
{
    for (int i = 1; i < argc; i++)
    {
        if (strcmp(argv[i], "--help") == 0)
        {
            print_usage(argv[0]);
            return 1;  /* Show help and exit */
        }
        else if (strcmp(argv[i], "--list-ports") == 0)
        {
            /* List available serial ports and exit */
            MAP_PRINTF("Scanning for available serial ports...\n");
            char ports[32][32];
            int count = gps_driver_list_ports(ports, 32);
            if (count == 0)
            {
                MAP_PRINTF("No serial ports found.\n");
            }
            else
            {
                MAP_PRINTF("Found %d serial port(s):\n", count);
                for (int j = 0; j < count; j++)
                {
                    MAP_PRINTF("  %s\n", ports[j]);
                }
            }
            return 1;  /* Exit after listing ports */
        }
        else if ((strcmp(argv[i], "-m") == 0 || strcmp(argv[i], "--map") == 0) && i + 1 < argc)
        {
            config->map_file = argv[++i];
        }
        else if ((strcmp(argv[i], "-o") == 0 || strcmp(argv[i], "--output") == 0) && i + 1 < argc)
        {
            config->output_file = argv[++i];
        }
        else if ((strcmp(argv[i], "-w") == 0 || strcmp(argv[i], "--width") == 0) && i + 1 < argc)
        {
            config->width = atoi(argv[++i]);
        }
        else if ((strcmp(argv[i], "-h") == 0 || strcmp(argv[i], "--height") == 0) && i + 1 < argc)
        {
            config->height = atoi(argv[++i]);
        }
        else if (strcmp(argv[i], "--start") == 0 && i + 1 < argc)
        {
            if (parse_coord(argv[++i], &config->start_lat, &config->start_lon))
            {
                config->has_start = 1;
            }
            else
            {
                MAP_FPRINTF("Error: Invalid start coordinate format\n");
                return -1;
            }
        }
        else if (strcmp(argv[i], "--end") == 0 && i + 1 < argc)
        {
            if (parse_coord(argv[++i], &config->end_lat, &config->end_lon))
            {
                config->has_end = 1;
            }
            else
            {
                MAP_FPRINTF("Error: Invalid end coordinate format\n");
                return -1;
            }
        }
        else if (strcmp(argv[i], "--mode") == 0 && i + 1 < argc)
        {
            config->transport_mode = parse_mode(argv[++i]);
        }
        else if (strcmp(argv[i], "--frames") == 0 && i + 1 < argc)
        {
            config->max_frames = atoi(argv[++i]);
        }
        else if (strcmp(argv[i], "--map-view") == 0)
        {
            config->app_mode = APP_MODE_MAP_VIEW;
        }
        else if (strcmp(argv[i], "--gps-init") == 0)
        {
            config->app_mode = APP_MODE_GPS_INIT;
        }
        else if (strcmp(argv[i], "--nav") == 0)
        {
            config->app_mode = APP_MODE_NAVIGATION;
        }
        else if (strcmp(argv[i], "--gps-map") == 0)
        {
            config->app_mode = APP_MODE_GPS_MAP;
        }
        else if (strcmp(argv[i], "--gps-track") == 0)
        {
            config->app_mode = APP_MODE_GPS_TRACK_RECORD;
        }
        else if (strcmp(argv[i], "--view-radius") == 0 && i + 1 < argc)
        {
            config->gps_view_radius = (float)atof(argv[++i]);
        }
        /* GPS Source Options */
        else if (strcmp(argv[i], "--gps-sim") == 0)
        {
            config->gps_type = GPS_PROVIDER_SIMULATOR;
        }
        else if (strcmp(argv[i], "--gps-serial") == 0 && i + 1 < argc)
        {
            config->gps_type = GPS_PROVIDER_SERIAL;
            config->gps_serial_port = argv[++i];
        }
        else if (strcmp(argv[i], "--gps-baud") == 0 && i + 1 < argc)
        {
            config->gps_baudrate = (uint32_t)atoi(argv[++i]);
        }
    }
    return 0;
}

/* Note: config_set_default_coords has been removed.
 * GPS coordinates are now provided by the GPS simulator.
 * If start/end coordinates are not specified, they will be set from the map
 * during GPS simulator initialization.
 */

/* ============================================================================
 * Render Options Configuration
 * ============================================================================
 */

/**
 * @brief Configure render options for map rendering with dynamic road type selection
 * @param opts Render options structure to configure
 * @param renderer Renderer with current viewport
 */
static void setup_render_options(render_options_t *opts, const renderer_t *renderer)
{
    render_options_init(opts);
    /* Customize what to render */
    opts->flags = RENDER_OPT_ROADS      /* Roads */
                  | RENDER_OPT_WATER      /* Water bodies */
                  | RENDER_OPT_PARKS      /* Parks and forests */
                  | RENDER_OPT_BUILDINGS  /* Buildings */
                  | RENDER_OPT_LABELS
                  ;    /* Labels */

    /* Calculate viewport coverage (approximate distance in degrees) */
    float lat_range = renderer->view_max_lat - renderer->view_min_lat;
    float lon_range = renderer->view_max_lon - renderer->view_min_lon;
    float viewport_size = sqrtf(lat_range * lat_range + lon_range * lon_range);

    /* Dynamic road type selection based on zoom level:
     * - Large area (>0.05 deg, ~5km): Only major roads (motorway, trunk, primary)
     * - Medium area (0.01-0.05 deg, ~1-5km): Main roads (secondary + major)
     * - Small area (0.005-0.01 deg, ~500m-1km): Urban roads (tertiary + main)
     * - Very small area (<0.005 deg, <500m): All roads including residential and service
     */
    MAP_PRINTF("Viewport size (deg): %.4f\n", (double)viewport_size);
    if (viewport_size > 0.1f)
    {
        /* Large area - only major roads */
        opts->road_types = ROAD_TYPE_MAIN;
        opts->flags = RENDER_OPT_ROADS      /* Roads */
                      | RENDER_OPT_WATER      /* Water bodies */
                      | RENDER_OPT_PARKS      /* Parks and forests */
                      // | RENDER_OPT_BUILDINGS  /* Buildings */
                      | RENDER_OPT_LABELS
                      ;    /* Labels */
    }
    else if (viewport_size > 0.04f)
    {
        /* Large area - only major roads */
        opts->road_types = ROAD_TYPE_MAIN;
        opts->flags = RENDER_OPT_ROADS      /* Roads */
                      | RENDER_OPT_WATER      /* Water bodies */
                      | RENDER_OPT_PARKS      /* Parks and forests */
                      | RENDER_OPT_BUILDINGS  /* Buildings */
                      | RENDER_OPT_LABELS
                      ;    /* Labels */
    }
    else
    {
        /* Very small area - all roads */
        opts->flags = RENDER_OPT_ROADS      /* Roads */
                      | RENDER_OPT_WATER      /* Water bodies */
                      | RENDER_OPT_PARKS      /* Parks and forests */
                      | RENDER_OPT_BUILDINGS  /* Buildings */
                      | RENDER_OPT_LABELS
                      ;    /* Labels */
        opts->road_types = ROAD_TYPE_ALL;
    }

    /* Control which label types to render */
    opts->label_types = LABEL_TYPE_PLACE /* Only render place labels */
                        | LABEL_TYPE_ROAD    /* Road labels */
                        | LABEL_TYPE_WATER   /* Water labels */
                        | LABEL_TYPE_PARK    /* Park labels */
                        | LABEL_TYPE_POI     /* POI labels */
                        ;
    /* Control which road types get labels */
    opts->road_label_types = ROAD_TYPE_ALL ;

    /* Road segment filtering: skip road segments smaller than specified pixels on screen */
    opts->min_road_segment_length = 1.0f;

    /* Area simplification: skip areas and boundary segments that are too small on screen */
    opts->min_area_segment_length = 4.0f;  /* Minimum area boundary segment length (pixels) */
    opts->min_area_size = 16.0f;           /* Minimum area size (square pixels), areas smaller than this are skipped */
}

/* ============================================================================
 * GPS Simulation Functions (Now uses GPS Simulator module)
 * ============================================================================
 */

/* Note: gps_simulate_movement and sample_navigation_points have been moved
 * to the GPS Simulator module (gps_simulator.h/c).
 * The GPS simulator is now the single source of position data.
 * Data flow: GPS Simulator -> Navigation Program
 */

/**
 * @brief Check if current position is off route
 * @return 1 if off route, 0 if on route
 */
static int check_off_route(const path_t *path, const gps_position_t *gps,
                           uint32_t start_segment, uint32_t *nearest_segment)
{
    if (!path || path->count < 2 || !gps->valid)
    {
        return 0;
    }

    float min_dist = 1e9f;
    uint32_t min_idx = start_segment;

    /* Search nearby segments (within 10 segments of current) */
    uint32_t search_start = (start_segment > 10) ? start_segment - 10 : 0;
    uint32_t search_end = (start_segment + 20 < path->count) ? start_segment + 20 : path->count - 1;

    for (uint32_t i = search_start; i < search_end; i++)
    {
        float d = nav_calculate_distance(gps->lat, gps->lon,
                                         path->points[i].lat, path->points[i].lon);
        if (d < min_dist)
        {
            min_dist = d;
            min_idx = i;
        }
    }

    *nearest_segment = min_idx;
    return ((double)min_dist > OFF_ROUTE_THRESHOLD) ? 1 : 0;
}

/**
 * @brief Calculate remaining distance from current segment to destination
 */
static float calc_remaining_distance(const path_t *path, uint32_t from_segment)
{
    float total = 0;
    for (uint32_t i = from_segment; i < path->count - 1; i++)
    {
        total += nav_calculate_distance(
                     path->points[i].lat, path->points[i].lon,
                     path->points[i + 1].lat, path->points[i + 1].lon);
    }
    return total;
}

/**
 * @brief Create a path representing remaining route from current GPS position to destination
 *
 * This creates a new path that starts from the current GPS position and includes
 * all remaining points from the original path (from current_segment to end).
 *
 * @param original_path The original complete path
 * @param gps Current GPS position
 * @param from_segment Current segment index on the path
 * @return New path_t* that must be freed by caller, or NULL on error
 */
static path_t *create_remaining_path(const path_t *original_path,
                                     const gps_position_t *gps,
                                     uint32_t from_segment)
{
    if (!original_path || original_path->count < 2 || !gps)
    {
        return NULL;
    }

    /* Calculate how many points in remaining path: current position + remaining points */
    uint32_t remaining_points = original_path->count - from_segment;
    if (remaining_points < 1)
    {
        return NULL;
    }

    /* Allocate new path: 1 (current GPS) + remaining points from original */
    path_t *remaining = (path_t *)MAP_MALLOC(sizeof(path_t));
    if (!remaining)
    {
        return NULL;
    }

    remaining->count = 1 + remaining_points;  /* GPS position + remaining original points */
    remaining->points = (coord_t *)MAP_MALLOC(sizeof(coord_t) * remaining->count);
    if (!remaining->points)
    {
        MAP_FREE(remaining);
        return NULL;
    }

    /* First point is current GPS position */
    remaining->points[0].lat = gps->lat;
    remaining->points[0].lon = gps->lon;

    /* Copy remaining points from original path */
    for (uint32_t i = 0; i < remaining_points; i++)
    {
        remaining->points[1 + i] = original_path->points[from_segment + i];
    }

    /* Calculate total distance of remaining path */
    remaining->total_distance = 0;
    for (uint32_t i = 0; i < remaining->count - 1; i++)
    {
        remaining->total_distance += nav_calculate_distance(
                                         remaining->points[i].lat, remaining->points[i].lon,
                                         remaining->points[i + 1].lat, remaining->points[i + 1].lon);
    }
    return remaining;
}

/* Note: sample_navigation_points has been moved to the GPS Simulator module.
 * See gps_simulator.c for the implementation.
 */

/**
 * @brief Update navigation state based on current GPS position from provider
 */
static void update_nav_state(app_state_t *app)
{
    nav_state_t *nav = &app->nav;
    const gps_position_t *gps = gps_provider_get_position(app->gps_provider);

    if (!nav->current_path || !gps || !gps->valid || nav->arrived)
    {
        return;
    }

    /* Check if off route */
    uint32_t nearest;
    nav->off_route = check_off_route(nav->current_path, gps, nav->current_segment, &nearest);

    if (nav->off_route)
    {
        MAP_PRINTF("⚠️  Off route, distance > %.0fm\n", OFF_ROUTE_THRESHOLD);
        app->needs_reroute = 1;
        return;
    }

    /* Update current segment */
    nav->current_segment = nearest;

    /* Calculate remaining distance */
    nav->remaining_distance = calc_remaining_distance(nav->current_path, nav->current_segment);

    /* Check arrival */
    path_t *p = nav->current_path;
    float dist_to_dest = nav_calculate_distance(gps->lat, gps->lon,
                         p->points[p->count - 1].lat,
                         p->points[p->count - 1].lon);
    if (dist_to_dest < ARRIVAL_THRESHOLD)
    {
        nav->arrived = 1;
        MAP_PRINTF("✓ Arrived at destination!\n");
    }

    app->needs_redraw = 1;
}

/* ============================================================================
 * Navigation Mode Functions
 * ============================================================================
 */

/**
 * @brief Re-route from current GPS position to destination
 */
static int do_reroute(app_state_t *app)
{
    MAP_PRINTF("\n🔄 Rerouting from current position...\n");

    /* Get current GPS position */
    const gps_position_t *gps = gps_provider_get_position(app->gps_provider);
    if (!gps || !gps->valid)
    {
        MAP_FPRINTF("Error: Invalid GPS position for rerouting\n");
        return -1;
    }

    /* Free old path */
    if (app->nav.current_path)
    {
        path_free(app->nav.current_path);
        app->nav.current_path = NULL;
    }

    /* Free old original path (will be replaced with new route) */
    if (app->nav.original_path)
    {
        if (app->nav.original_path->points)
        {
            MAP_FREE(app->nav.original_path->points);
        }
        MAP_FREE(app->nav.original_path);
        app->nav.original_path = NULL;
    }
    /* Find new path from current GPS position with fallback support */
    /* Try up to 10 nearby nodes within 500m radius if the nearest node is unreachable */
    app->nav.current_path = nav_find_path_with_fallback(
                                app->map,
                                gps->lat, gps->lon,
                                app->config.end_lat, app->config.end_lon,
                                app->config.transport_mode,
                                10,     /* max_fallback_nodes: try up to 10 nearby nodes */
                                2500.0f  /* max_search_radius: within 2500 meters */
                            );

    if (!app->nav.current_path)
    {
        MAP_FPRINTF("Error: Rerouting failed - no reachable path from current position\n");
        return -1;
    }

    /* Update original_path to the new route (for gray path display) */
    app->nav.original_path = (path_t *)MAP_MALLOC(sizeof(path_t));
    if (app->nav.original_path)
    {
        app->nav.original_path->count = app->nav.current_path->count;
        app->nav.original_path->total_distance = app->nav.current_path->total_distance;
        app->nav.original_path->points = (coord_t *)MAP_MALLOC(sizeof(coord_t) * app->nav.current_path->count);
        if (app->nav.original_path->points)
        {
            memcpy(app->nav.original_path->points, app->nav.current_path->points,
                   sizeof(coord_t) * app->nav.current_path->count);
        }
        else
        {
            MAP_FREE(app->nav.original_path);
            app->nav.original_path = NULL;
        }
    }

    /* Re-route the GPS provider as well (simulator only) */
    if (!gps_provider_reroute(app->gps_provider, app->map, app->config.transport_mode))
    {
        /* Not an error for serial GPS - it doesn't support reroute */
        if (gps_provider_get_type(app->gps_provider) == GPS_PROVIDER_SIMULATOR)
        {
            MAP_FPRINTF("Warning: Failed to reroute GPS provider\n");
        }
    }

    /* Reset navigation state */
    app->nav.current_segment = 0;
    app->nav.off_route = 0;
    app->needs_reroute = 0;
    app->needs_redraw = 1;

    /* Re-initialize lane guidance state with new path */
    guidance_init(&app->guidance_state, app->nav.current_path);

    MAP_PRINTF("✓ New path: %u points, %.2f km\n",
               app->nav.current_path->count,
               (double)(app->nav.current_path->total_distance / 1000.0f));
    return 0;
}

/**
 * @brief Render a navigation frame with current position marker
 *
 * Uses same viewport as static rendering (fit to entire path),
 * with current position marker moving along the route.
 */
static int render_nav_frame(app_state_t *app)
{
    renderer_t *r = app->renderer;
    const app_config_t *config = &app->config;
    const gps_position_t *gps = gps_provider_get_position(app->gps_provider);

    /* Clear canvas */
    renderer_clear(r, 0xFFFFFFFF);

    /*
     * Navigation mode: dynamically adjust viewport
     * Display range from current position to destination, not from start to end
     */
    if (app->nav.current_path && gps && gps->valid)
    {
        /* Create path from current position to destination */
        path_t *nav_view_path = create_remaining_path(app->nav.current_path,
                                gps,
                                app->nav.current_segment);
        if (nav_view_path && nav_view_path->count >= 2)
        {
            renderer_fit_path(r, nav_view_path, 0.15f);
        }
        else
        {
            /* If remaining path is too short, use full path as fallback */
            renderer_fit_path(r, app->nav.current_path, 0.15f);
        }
        if (nav_view_path)
        {
            MAP_FREE(nav_view_path->points);
            MAP_FREE(nav_view_path);
        }
    }
    else if (app->nav.current_path)
    {
        renderer_fit_path(r, app->nav.current_path, 0.15f);
    }

    /* Apply map pan and zoom adjustments to viewport */
    if (app->zoom_factor != 1.0f || app->pan_offset_lat != 0.0f || app->pan_offset_lon != 0.0f)
    {
        /* Get current viewport directly from renderer struct */
        float vp_min_lat = r->view_min_lat;
        float vp_min_lon = r->view_min_lon;
        float vp_max_lat = r->view_max_lat;
        float vp_max_lon = r->view_max_lon;

        /* Calculate viewport center and dimensions */
        float center_lat = (vp_min_lat + vp_max_lat) / 2.0f;
        float center_lon = (vp_min_lon + vp_max_lon) / 2.0f;
        float lat_range = vp_max_lat - vp_min_lat;
        float lon_range = vp_max_lon - vp_min_lon;

        /* Apply pan offset */
        center_lat += app->pan_offset_lat;
        center_lon += app->pan_offset_lon;

        /* Apply zoom factor */
        lat_range *= app->zoom_factor;
        lon_range *= app->zoom_factor;

        /* Set new viewport */
        renderer_set_viewport(r,
                              center_lat - lat_range / 2.0f,
                              center_lon - lon_range / 2.0f,
                              center_lat + lat_range / 2.0f,
                              center_lon + lon_range / 2.0f);
    }

    /* Render map with theme */
    map_theme_t theme = MAP_THEME_GOOGLE;
    render_options_t opts;
    setup_render_options(&opts, r);  /* Pass renderer for dynamic road type selection */
    render_map_with_options(r, app->map, &theme, &opts);
    /* Render navigation path */
    if (app->nav.current_path)
    {
        /*
         * GPS navigation mode: draw two paths
         * 1. Original path (gray): complete planned route from start to end
         * 2. Remaining path (blue highlight): route from current GPS position to destination
         */

        /* 1. Draw original complete path (gray, thinner, as reference line) */
        path_t *original = app->nav.original_path ? app->nav.original_path : app->nav.current_path;
        render_style_t original_style =
        {
            .path_color = 0x9E9E9Eff,     /* Gray with alpha */
            .path_width = 7.0f,            /* Thinner line */
            .start_color = 0x4CAF5080,    /* Semi-transparent green */
            .end_color = 0xF4433680,      /* Semi-transparent red */
            .point_radius = 6.0f,
            .background_color = 0xFFFFFFFF,
            .min_segment_length = 1.0f    /* Small segment filtering */
        };
        render_path(r, original, &original_style);
        /* 2. Draw remaining path (blue highlight, thicker, to emphasize current route) */
        path_t *remaining = create_remaining_path(app->nav.current_path,
                            gps,
                            app->nav.current_segment);
        if (remaining)
        {
            render_style_t remaining_style =
            {
                .path_color = 0x2196F3FF,     /* Bright Blue */
                .path_width = 7.0f,            /* Thicker line, highlight */
                .start_color = 0x2196F3FF,    /* Blue start (current position) */
                .end_color = 0xF44336FF,      /* Red end */
                .point_radius = 8.0f,
                .background_color = 0xFFFFFFFF,
                .min_segment_length = 1.0f    /* Small segment filtering */
            };
            render_path(r, remaining, &remaining_style);

            /* Free the temporarily created remaining path */
            MAP_FREE(remaining->points);
            MAP_FREE(remaining);
        }
    }

    // /* Draw start point marker (green) */
    // if (app->nav.current_path && app->nav.current_path->count > 0) {
    //     float start_x, start_y;
    //     renderer_coord_to_screen(r,
    //                              app->nav.current_path->points[0].lat,
    //                              app->nav.current_path->points[0].lon,
    //                              &start_x, &start_y);
    //     render_text(r, start_x - 8, start_y - 12, "●", 24.0f, 0x4CAF50FF);  /* Green */
    // }

    // /* Draw end point marker (red) */
    // if (app->nav.current_path && app->nav.current_path->count > 1) {
    //     float end_x, end_y;
    //     uint32_t last_idx = app->nav.current_path->count - 1;
    //     renderer_coord_to_screen(r,
    //                              app->nav.current_path->points[last_idx].lat,
    //                              app->nav.current_path->points[last_idx].lon,
    //                              &end_x, &end_y);
    //     render_text(r, end_x - 8, end_y - 12, "●", 24.0f, 0xF44336FF);  /* Red */
    // }

    // /* Draw current position marker (blue, larger) */
    // float screen_x, screen_y;
    // renderer_coord_to_screen(r, app->gps.lat, app->gps.lon, &screen_x, &screen_y);
    // render_text(r, screen_x - 10, screen_y - 15, "●", 32.0f, 0x2196F3FF);  /* Blue */

    /* ========================================================================
     * Render Lane Guidance Panel with Multi-Lane Display (Phase 2)
     * - Now displays CURRENT road lane info instead of next junction
     * ========================================================================
     */
    if (app->nav.current_path && !app->nav.arrived && gps && gps->valid)
    {
        /* Update guidance state with current GPS position */
        guidance_update(&app->guidance_state, gps->lat, gps->lon);

        /* Get lane configuration from map for CURRENT road segment */
        lane_config_t lane_config;
        memset(&lane_config, 0, sizeof(lane_config));
        bool has_lane_info = false;

        /* Get current segment from guidance state */
        uint32_t current_seg = app->guidance_state.current_segment;
        if (app->nav.current_path && current_seg + 1 < app->nav.current_path->count)
        {
            float lat1 = app->nav.current_path->points[current_seg].lat;
            float lon1 = app->nav.current_path->points[current_seg].lon;
            float lat2 = app->nav.current_path->points[current_seg + 1].lat;
            float lon2 = app->nav.current_path->points[current_seg + 1].lon;
            has_lane_info = nav_get_lane_config(app->map, lat1, lon1, lat2, lon2, &lane_config);

            /* Fallback: estimate lane count from road type if no lane data */
            if (!has_lane_info)
            {
                uint8_t road_type = nav_get_road_type(app->map, lat1, lon1, lat2, lon2);
                if (road_type != 0xFF)
                {
                    /* Estimate lane count based on road type */
                    switch (road_type)
                    {
                        case 6:  /* Motorway */
                            lane_config.lane_count = 3;
                            break;
                        case 5:  /* Trunk */
                            lane_config.lane_count = 3;
                            break;
                        case 4:  /* Primary */
                            lane_config.lane_count = 2;
                            break;
                        case 3:  /* Secondary */
                            lane_config.lane_count = 2;
                            break;
                        case 2:  /* Tertiary */
                            lane_config.lane_count = 2;
                            break;
                        case 1:  /* Residential */
                            lane_config.lane_count = 1;
                            break;
                        case 0:  /* Service */
                            lane_config.lane_count = 1;
                            break;
                        default:
                            lane_config.lane_count = 2;
                            break;
                    }
                    /* All lanes default to straight */
                    for (int i = 0; i < lane_config.lane_count; i++)
                    {
                        lane_config.lanes[i].directions = LANE_DIR_STRAIGHT;
                    }
                    has_lane_info = true;
                }
            }

            // /* Log lane info source */
            // if (has_lane_info)
            // {
            //     MAP_PRINTF("[Frame %d] Lane info (segment %u): %d lanes - ",
            //                app->frame_count, current_seg, lane_config.lane_count);
            //     for (int li = 0; li < lane_config.lane_count; li++)
            //     {
            //         uint8_t dir = lane_config.lanes[li].directions;
            //         MAP_PRINTF("[%d:", li);
            //         if (dir & LANE_DIR_LEFT)
            //         {
            //             MAP_PRINTF("L");
            //         }
            //         if (dir & LANE_DIR_SLIGHT_LEFT)
            //         {
            //             MAP_PRINTF("SL");
            //         }
            //         if (dir & LANE_DIR_STRAIGHT)
            //         {
            //             MAP_PRINTF("S");
            //         }
            //         if (dir & LANE_DIR_SLIGHT_RIGHT)
            //         {
            //             MAP_PRINTF("SR");
            //         }
            //         if (dir & LANE_DIR_RIGHT)
            //         {
            //             MAP_PRINTF("R");
            //         }
            //         if (dir & LANE_DIR_UTURN)
            //         {
            //             MAP_PRINTF("U");
            //         }
            //         MAP_PRINTF("] ");
            //     }
            //     MAP_PRINTF("\n");
            // }
        }

        /* Render current road lane info directly if available */
        if (has_lane_info && lane_config.lane_count > 0)
        {
            /* Get next junction info for recommended lane calculation */
            junction_guidance_t next_junction;
            bool has_junction = (guidance_get_next_junction(&app->guidance_state, &next_junction) == MAP_OK);

            /* Calculate recommended lane based on next maneuver */
            uint8_t recommended_lane = 255;
            /* Show recommendation when approaching junction (within 1000m) or for any non-straight maneuver */
            if (has_junction && next_junction.maneuver != MANEUVER_STRAIGHT &&
                    next_junction.maneuver != MANEUVER_NONE)
            {
                if (next_junction.distance < 1000.0f)
                {
                    recommended_lane = guidance_calculate_recommended_lane(&lane_config, next_junction.maneuver);
                }
            }

            /* Create junction_ext structure for rendering */
            junction_guidance_ext_t junction_ext;
            memset(&junction_ext, 0, sizeof(junction_ext));
            junction_ext.has_lane_info = true;
            junction_ext.lane_info.lane_count = lane_config.lane_count;
            junction_ext.lane_info.recommended_lane = recommended_lane;

            /* Copy junction info if available */
            if (has_junction)
            {
                junction_ext.distance = next_junction.distance;
                junction_ext.maneuver = next_junction.maneuver;
                junction_ext.turn_angle = next_junction.turn_angle;
            }
            for (int i = 0; i < lane_config.lane_count && i < MAX_LANES_PER_ROAD; i++)
            {
                junction_ext.lane_info.lanes[i].is_recommended = (i == recommended_lane) ? 1 : 0;
                junction_ext.lane_info.lanes[i].is_current = 0;
                /* For recommended lane approaching a turn, show turn direction arrow */
                if (i == recommended_lane && recommended_lane != 255 && has_junction &&
                        next_junction.distance < 1000.0f)
                {
                    /* Convert maneuver to lane direction for the recommended lane */
                    uint8_t turn_dir = LANE_DIR_STRAIGHT;
                    switch (next_junction.maneuver)
                    {
                        case MANEUVER_LEFT:
                        case MANEUVER_SHARP_LEFT:
                        case MANEUVER_UTURN_LEFT:
                        case MANEUVER_RAMP_LEFT:
                            turn_dir = LANE_DIR_LEFT;
                            break;
                        case MANEUVER_SLIGHT_LEFT:
                            turn_dir = LANE_DIR_SLIGHT_LEFT;
                            break;
                        case MANEUVER_RIGHT:
                        case MANEUVER_SHARP_RIGHT:
                        case MANEUVER_UTURN_RIGHT:
                        case MANEUVER_RAMP_RIGHT:
                            turn_dir = LANE_DIR_RIGHT;
                            break;
                        case MANEUVER_SLIGHT_RIGHT:
                            turn_dir = LANE_DIR_SLIGHT_RIGHT;
                            break;
                        default:
                            turn_dir = lane_config.lanes[i].directions;
                            break;
                    }
                    junction_ext.lane_info.lanes[i].directions = turn_dir;
                }
                else
                {
                    junction_ext.lane_info.lanes[i].directions = lane_config.lanes[i].directions;
                }
            }

            // /* Log junction and recommended lane info */
            // if (has_junction && next_junction.maneuver != MANEUVER_STRAIGHT &&
            //         next_junction.maneuver != MANEUVER_ARRIVE)
            // {
            //     static const char *maneuver_names[] =
            //     {
            //         "None", "Straight", "Left", "Right", "Slight Left", "Slight Right",
            //         "Sharp Left", "Sharp Right", "U-Turn Left", "U-Turn Right",
            //         "Ramp Left", "Ramp Right", "Merge", "Arrive"
            //     };
            //     const char *maneuver_str = (next_junction.maneuver < 14) ?
            //                                maneuver_names[next_junction.maneuver] : "Unknown";
            //     MAP_PRINTF("         -> Next: %s in %.0fm", maneuver_str, next_junction.distance);
            //     if (recommended_lane != 255)
            //     {
            //         MAP_PRINTF(", use lane %d", recommended_lane);
            //     }
            //     MAP_PRINTF("\n");
            // }            /* Render lane guidance panel at top-right corner */
            float panel_width = 140.0f;
            float panel_x = app->config.width - panel_width - 65.0f;
            float panel_y = 5.0f;

            render_full_lane_guidance(r, &junction_ext,
                                      &app->guidance_style, &app->lane_style,
                                      panel_x, panel_y, panel_width);
        }
    }    /* Render title at top-left corner */
    char info[256];
    snprintf(info, sizeof(info), "GPS Navigation");
    render_text(r, 50.0f, 20.0f, info, 28.0f, 0xFF0000FF);  /* Red title */

    /* Distance info (main info line 1) */
    snprintf(info, sizeof(info), "Distance: %.2f km | Mode: %s",
             (double)(app->nav.current_path ? app->nav.current_path->total_distance / 1000.0f : 0),
             mode_to_string(config->transport_mode));
    render_text(r, 10.0f, 55.0f, info, 18.0f, 0x333333FF);  /* Dark gray info */

    /* GPS status line (main info line 2) */
    if (gps && gps->valid)
    {
        snprintf(info, sizeof(info), "GPS: %.6f, %.6f",
                 (double)gps->lat, (double)gps->lon);
    }
    else
    {
        snprintf(info, sizeof(info), "GPS: No Signal");
    }
    render_text(r, 10.0f, 75.0f, info, 16.0f, 0x666666FF);
    /* GPS status line (main info line 2) */
    if (gps && gps->valid)
    {
        snprintf(info, sizeof(info), "Speed: %.1f km/h | Accuracy: %.1fm",
                 (double)(gps->speed * 3.6f), (double)gps->accuracy);
        render_text(r, 10.0f, 93.0f, info, 16.0f, 0x666666FF);
    }


    /* Remaining distance (auxiliary info) */
    snprintf(info, sizeof(info), "Remaining: %.2f km", (double)(app->nav.remaining_distance / 1000.0f));
    render_text(r, 10.0f, 105.0f, info, 14.0f, 0x999999FF);

    if (app->nav.off_route)
    {
        render_text(r, 10.0f, 130.0f, "⚠ OFF ROUTE - Rerouting...", 20.0f, 0xFF0000FF);
    }
    if (app->nav.arrived)
    {
        render_text(r, app->config.width - 140.0f - 8.0f, 20.0f, "✓ ARRIVED!", 28.0f, 0xFF0000FF);
    }    /* Controls help */
#ifdef _WIN32
    snprintf(info, sizeof(info), "[WASD/Arrows] Pan | [Z/X] Zoom | [0] Reset | [M] Mode | [1/2/3/4] Switch | [Q] Quit");
    render_text(r, 10.0f, app->config.height - 25.0f, info, 14.0f, 0x666666FF);
#else
    snprintf(info, sizeof(info), "[KEY1-] [MFB+] Zoom | Tap Reset | [KEY3] Mode | Slide Pan");
    /* Center the text */
    float text_x = (app->config.width - strlen(info) * 5.0f) / 2.0f;
    render_text(r, text_x, app->config.height - 25.0f, info, 14.0f, 0x666666FF);
#endif

    /* Save frame */
    char filename[256];
    snprintf(filename, sizeof(filename), "frames/screen.png");
    render_save_png(r, filename);

    app->needs_redraw = 0;
    app->frame_count++;

    return 0;
}

/* ============================================================================
 * Core Application Functions
 * ============================================================================
 */

/**
 * @brief Find navigation path between two points
 * @return path_t* on success, NULL on failure
 */
static path_t *do_pathfinding(const map_t *map, const app_config_t *config)
{
    MAP_PRINTF("\nFinding path from (%.6f, %.6f) to (%.6f, %.6f)...\n",
               (double)config->start_lat, (double)config->start_lon,
               (double)config->end_lat, (double)config->end_lon);
    MAP_PRINTF("Transport mode: %s\n", mode_to_string(config->transport_mode));

    path_t *path = nav_find_path_with_mode(map,
                                           config->start_lat, config->start_lon,
                                           config->end_lat, config->end_lon,
                                           config->transport_mode);
    if (!path)
    {
        MAP_FPRINTF("Error: No path found\n");
        return NULL;
    }

    memory_monitor_print("After Pathfinding");

    MAP_PRINTF("\nPath found:\n");
    MAP_PRINTF("  Points: %u\n", path->count);
    MAP_PRINTF("  Distance: %.2f meters (%.2f km)\n",
               (double)path->total_distance, (double)(path->total_distance / 1000.0f));
    return path;
}

/**
 * @brief Check for memory leaks and print final status
 */
static void do_leak_check(void)
{
    size_t leaks = memory_monitor_check_leaks();
    if (leaks > 0)
    {
        MAP_PRINTF("⚠️  Warning: Detected %zu potential memory leaks\n", leaks);
        MAP_PRINTF("⚠️  Warning: Detected %zu potential memory leaks\n", leaks);
    }
    else
    {
        MAP_PRINTF("✓ No memory leaks detected\n");
    }
}

/* ============================================================================
 * Main Entry Point
 * ============================================================================
 */

/**
 * @brief Initialize navigation mode
 * @param app Application state (must be zero-initialized by caller)
 * @param map Map data
 * @param config Application configuration
 * @return 0 on success, non-zero on failure
 */
static int nav_init(app_state_t *app, map_t *map, app_config_t *config)
{
    /* Initialize application state */
    app->map = map;
    app->config = *config;

    /* Create renderer */
    app->renderer = renderer_create(config->width, config->height);
    if (!app->renderer)
    {
        MAP_FPRINTF("Error: Failed to create renderer\n");
        return 1;
    }

    /*
     * Initialize GPS Provider
     * GPS Provider is the single source of position data
     * Data flow: GPS Provider -> Navigation Program
     * Supports both GPS Simulator and Serial GPS Driver
     */
    gps_provider_config_t gps_config;
    gps_provider_config_init(&gps_config);
    gps_config.type = config->gps_type;

    /* Configure based on GPS type */
    if (config->gps_type == GPS_PROVIDER_SIMULATOR)
    {
        gps_config.sim_config.simulation_speed = NAV_SIMULATION_SPEED;
        gps_config.sim_config.jitter_mode = GPS_JITTER_NORMAL;
        gps_config.sim_config.jitter_amount_m = 5.0f;

        MAP_PRINTF("\n🛰️  Initializing GPS Simulator...\n");
        MAP_PRINTF("   Start: %.6f, %.6f\n", (double)config->start_lat, (double)config->start_lon);
        MAP_PRINTF("   End: %.6f, %.6f\n", (double)config->end_lat, (double)config->end_lon);
        MAP_PRINTF("   GPS jitter: %.1fm (simulating real GPS)\n", (double)gps_config.sim_config.jitter_amount_m);
    }
    else if (config->gps_type == GPS_PROVIDER_SERIAL)
    {
        gps_config.serial_port = config->gps_serial_port;
        gps_config.baudrate = config->gps_baudrate;

        MAP_PRINTF("\n📡 Initializing Serial GPS Driver...\n");
        MAP_PRINTF("   Port: %s\n", config->gps_serial_port);
        MAP_PRINTF("   Baud rate: %u\n", config->gps_baudrate);
        MAP_PRINTF("   End: %.6f, %.6f\n", (double)config->end_lat, (double)config->end_lon);
    }

    app->gps_provider = gps_provider_create(&gps_config, map,
                                            config->start_lat, config->start_lon,
                                            config->end_lat, config->end_lon,
                                            config->transport_mode);
    if (!app->gps_provider)
    {
        MAP_FPRINTF("Error: Failed to initialize GPS Provider\n");
        renderer_destroy(app->renderer);
        app->renderer = NULL;
        return 1;
    }

    MAP_PRINTF("✓ GPS Provider initialized: %s\n",
               gps_provider_type_str(config->gps_type));

    /* For simulator, also init the internal gps_sim for backward compatibility */
    if (config->gps_type == GPS_PROVIDER_SIMULATOR)
    {
        /* Get the underlying simulator */
        gps_simulator_t *sim = gps_provider_get_simulator(app->gps_provider);
        if (sim)
        {
            uint32_t waypoint_count;
            (void)gps_simulator_get_route(sim, &waypoint_count);
            MAP_PRINTF("   Waypoints: %u\n", waypoint_count);
        }
    }    /* Create a path structure for navigation and display (separate from GPS provider) */
    app->nav.current_path = do_pathfinding(map, config);

    /* Check if start and end are too close or path not found - treat as already arrived */
    float direct_distance = nav_calculate_distance(
                                config->start_lat, config->start_lon,
                                config->end_lat, config->end_lon);

    if (!app->nav.current_path || direct_distance < 50.0f)
    {
        MAP_PRINTF("📍 Destination is very close (%.1fm) - Already arrived!\n", (double)direct_distance);

        /* Create a minimal path with just start and end points */
        if (!app->nav.current_path)
        {
            app->nav.current_path = (path_t *)MAP_MALLOC(sizeof(path_t));
            if (app->nav.current_path)
            {
                app->nav.current_path->count = 2;
                app->nav.current_path->total_distance = direct_distance;
                app->nav.current_path->points = (coord_t *)MAP_MALLOC(sizeof(coord_t) * 2);
                if (app->nav.current_path->points)
                {
                    app->nav.current_path->points[0].lat = config->start_lat;
                    app->nav.current_path->points[0].lon = config->start_lon;
                    app->nav.current_path->points[1].lat = config->end_lat;
                    app->nav.current_path->points[1].lon = config->end_lon;
                }
                else
                {
                    MAP_FREE(app->nav.current_path);
                    app->nav.current_path = NULL;
                }
            }
        }

        /* Set arrived flag - will show "arrived" state */
        app->nav.arrived = 1;
        app->nav.remaining_distance = 0;
    }

    /* Save a copy of the original path for display */
    if (app->nav.current_path)
    {
        app->nav.original_path = (path_t *)MAP_MALLOC(sizeof(path_t));
        if (app->nav.original_path)
        {
            app->nav.original_path->count = app->nav.current_path->count;
            app->nav.original_path->total_distance = app->nav.current_path->total_distance;
            app->nav.original_path->points = (coord_t *)MAP_MALLOC(sizeof(coord_t) * app->nav.current_path->count);
            if (app->nav.original_path->points)
            {
                memcpy(app->nav.original_path->points, app->nav.current_path->points,
                       sizeof(coord_t) * app->nav.current_path->count);
            }
            else
            {
                MAP_FREE(app->nav.original_path);
                app->nav.original_path = NULL;
            }
        }

        /* Initialize navigation state (only if not already arrived) */
        if (!app->nav.arrived)
        {
            app->nav.current_segment = 0;
            app->nav.remaining_distance = app->nav.current_path->total_distance;
            app->nav.off_route = 0;
            app->nav.arrived = 0;
        }

        /* Initialize lane guidance state with Google style (matching map theme) */
        guidance_init(&app->guidance_state, app->nav.current_path);
    }
    else
    {
        /* No path at all - should not happen but handle gracefully */
        app->nav.original_path = NULL;
        app->nav.arrived = 1;
        app->nav.remaining_distance = 0;
    }

    app->nav.current_segment = 0;
    app->nav.off_route = 0;
    app->needs_redraw = 1;
    app->pan_offset_lat = 0.0f;
    app->pan_offset_lon = 0.0f;
    app->zoom_factor = 1.0f;

    /* Initialize guidance styles */
    guidance_style_init_preset(&app->guidance_style, GUIDANCE_STYLE_GOOGLE);
    lane_display_style_init_preset(&app->lane_style, GUIDANCE_STYLE_GOOGLE);

#if !defined(_WIN32) || defined(USE_HONEY_GUI)
    /* Initialize touch pan and zoom control */
    app->touch_active = 0;
    app->touch_start_x = 0;
    app->touch_start_y = 0;
    app->touch_last_x = 0;
    app->touch_last_y = 0;
    /* Initialize double-tap detection */
    app->last_tap_time = 0;
    app->last_tap_x = 0;
    app->last_tap_y = 0;
#endif

    MAP_PRINTF("Mode: Continuous Navigation (%s)\n", gps_provider_type_str(config->gps_type));
    MAP_PRINTF("   GPS data flow: %s -> Navigation\n", gps_provider_type_str(config->gps_type));

    return 0;
}

/**
 * @brief Handle keyboard input for navigation mode
 * @param app Navigation app state
 * @return 0=continue, 1=quit, 2=mode switch
 */
#ifdef USE_HONEY_GUI
static int nav_handle_keyboard_honey(app_state_t *app)
{
    touch_info_t *tp = tp_get_info();

    if (trmap_honey_gui_consume_key_press("Home"))
    {
        (void)trmap_map_control_zoom_out();
        MAP_PRINTF("Home: Zoom out %.1fx", app->zoom_factor);
    }

    if (trmap_honey_gui_consume_key_press("Back"))
    {
        (void)trmap_map_control_reset();
        MAP_PRINTF("Back: Reset zoom and pan");
    }

    if (trmap_honey_gui_consume_key_press("Menu"))
    {
        MAP_PRINTF("Menu: Switch application mode");
        (void)trmap_request_next_mode_switch();
        return 2;
    }

    if (trmap_honey_gui_consume_key_press("Power"))
    {
        (void)trmap_map_control_zoom_in();
        MAP_PRINTF("Power: Zoom in %.1fx", app->zoom_factor);
    }

    if (trmap_honey_gui_touch_active(tp))
    {
        if (!app->touch_active || tp->pressed)
        {
            app->touch_active = 1;
            app->touch_start_x = tp->x;
            app->touch_start_y = tp->y;
            app->touch_last_x = tp->deltaX;
            app->touch_last_y = tp->deltaY;
        }
        else
        {
            int16_t dx = tp->deltaX - app->touch_last_x;
            int16_t dy = tp->deltaY - app->touch_last_y;

            if (dx != 0 || dy != 0)
            {
                float effective_radius = app->config.gps_view_radius * app->zoom_factor;
                float meters_per_pixel_lat = (2.0f * effective_radius) / app->config.height;
                float meters_per_pixel_lon = (2.0f * effective_radius) / app->config.width;

                const gps_position_t *gps = gps_provider_get_position(app->gps_provider);
                float current_lat = (gps && gps->valid) ? gps->lat : app->config.start_lat;
                current_lat += app->pan_offset_lat;

                float lat_deg_per_meter = 1.0f / 111000.0f;
                float lon_deg_per_meter = 1.0f / (111000.0f * cosf(current_lat * 3.14159265f / 180.0f));

                (void)trmap_map_control_pan_delta(
                    dy * meters_per_pixel_lat * lat_deg_per_meter,
                    -dx * meters_per_pixel_lon * lon_deg_per_meter);

                app->touch_last_x = tp->deltaX;
                app->touch_last_y = tp->deltaY;
            }
        }
    }
    else if (trmap_honey_gui_touch_released(tp) && app->touch_active)
    {
        int16_t dist_x;
        int16_t dist_y;
        uint32_t distance_sq;

        app->touch_active = 0;
        dist_x = tp->deltaX;
        dist_y = tp->deltaY;
        distance_sq = (uint32_t)(dist_x * dist_x + dist_y * dist_y);

        if (distance_sq < (TOUCH_DOUBLE_TAP_DISTANCE * TOUCH_DOUBLE_TAP_DISTANCE))
        {
            (void)trmap_map_control_reset();
            MAP_PRINTF("Tap: Reset zoom and pan");
        }
        else
        {
            (void)trmap_map_control_pan_finish();
            MAP_PRINTF("Touch pan end: offset %.6f, %.6f", app->pan_offset_lat, app->pan_offset_lon);
        }
    }

    return 0;
}
#elif defined (_WIN32)
static int nav_handle_keyboard_pc(app_state_t *app)
{
    (void)app;

    if (!_kbhit())
    {
        return 0;
    }

    int ch = _getch();

    /* Handle arrow keys (they come as 0 or 0xE0 followed by actual code) */
    if (ch == 0 || ch == 0xE0)
    {
        ch = _getch();
        switch (ch)
        {
            case 72:  /* Up arrow */
                (void)trmap_map_control_pan_north();
                break;
            case 80:  /* Down arrow */
                (void)trmap_map_control_pan_south();
                break;
            case 75:  /* Left arrow */
                (void)trmap_map_control_pan_west();
                break;
            case 77:  /* Right arrow */
                (void)trmap_map_control_pan_east();
                break;
        }
        return 0;
    }
    switch (ch)
    {
        case 'w':
        case 'W':
            (void)trmap_map_control_pan_north();
            break;

        case 's':
        case 'S':
            (void)trmap_map_control_pan_south();
            break;

        case 'a':
        case 'A':
            (void)trmap_map_control_pan_west();
            break;

        case 'd':
        case 'D':
            (void)trmap_map_control_pan_east();
            break;

        case 'z':
        case 'Z':
            (void)trmap_map_control_zoom_in();
            break;

        case 'x':
        case 'X':
            (void)trmap_map_control_zoom_out();
            break;

        case '0':
            (void)trmap_map_control_reset();
            break;

        case 'm':
        case 'M':  /* M - cycle to next application mode */
            (void)trmap_request_next_mode_switch();
            return 2;

        case '1':  /* 1 - switch to Track Record mode */
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_GPS_TRACK_RECORD);
            return 2;

        case '2':  /* 2 - switch to Track Replay mode */
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_GPS_TRACK_REPLAY);
            return 2;

        case '3':  /* 3 - switch to GPS Map mode */
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_GPS_MAP);
            return 2;

        case '4':  /* 4 - switch to Navigation mode */
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_NAVIGATION);
            return 2;

        case 'q':
        case 'Q':  /* Q - quit */
        case 27:   /* ESC */
            MAP_PRINTF("👋 Exiting...\n");
            return 1;
    }
    return 0;
}

#else
static int nav_handle_keyboard_mcu(app_state_t *app)
{
    /* MCU GPIO Key Handling for Navigation Mode */

    /* KEY1 (P3_0): Zoom out (increase view radius) */
    if (g_key1_pressed)
    {
        g_key1_pressed = 0;
        (void)trmap_map_control_zoom_out();
        MAP_PRINTF("KEY1: Zoom out %.1fx", app->zoom_factor);
    }

    /* KEY2 (ADC_0): Reset zoom and pan to default */
    if (g_key2_pressed)
    {
        g_key2_pressed = 0;
        (void)trmap_map_control_reset();
        MAP_PRINTF("KEY2: Reset zoom and pan");
    }

    /* KEY3 (P3_1): Cycle to next application mode */
    if (g_key3_pressed)
    {
        g_key3_pressed = 0;
        MAP_PRINTF("KEY3: Switch application mode");
        (void)trmap_request_next_mode_switch();
        return 2;
    }

    /* MFB: Zoom in (decrease view radius) */
    if (g_mfb_pressed)
    {
        g_mfb_pressed = 0;
        (void)trmap_map_control_zoom_in();
        MAP_PRINTF("MFB: Zoom in %.1fx", app->zoom_factor);
    }

    /* Touch screen pan handling */
    {
        TOUCH_DATA touch_data;
        uint32_t s = os_lock();
        touch_data = get_raw_touch_data();
        os_unlock(s);

        if (touch_data.is_press)
        {
            if (!app->touch_active)
            {
                /* Touch just started */
                app->touch_active = 1;
                app->touch_start_x = touch_data.x;
                app->touch_start_y = touch_data.y;
                app->touch_last_x = touch_data.x;
                app->touch_last_y = touch_data.y;
            }
            else
            {
                /* Touch is moving - calculate pan delta */
                int16_t dx = (int16_t)touch_data.x - (int16_t)app->touch_last_x;
                int16_t dy = (int16_t)touch_data.y - (int16_t)app->touch_last_y;

                if (dx != 0 || dy != 0)
                {
                    /* Convert screen pixels to map coordinates */
                    float effective_radius = app->config.gps_view_radius * app->zoom_factor;
                    float meters_per_pixel_lat = (2.0f * effective_radius) / app->config.height;
                    float meters_per_pixel_lon = (2.0f * effective_radius) / app->config.width;

                    /* Get current center for longitude scaling */
                    const gps_position_t *gps = gps_provider_get_position(app->gps_provider);
                    float current_lat = (gps && gps->valid) ? gps->lat : app->config.start_lat;
                    current_lat += app->pan_offset_lat;

                    float lat_deg_per_meter = 1.0f / 111000.0f;
                    float lon_deg_per_meter = 1.0f / (111000.0f * cosf(current_lat * 3.14159265f / 180.0f));

                    /* Pan in opposite direction of drag (map follows finger) */
                    (void)trmap_map_control_pan_delta(
                        dy * meters_per_pixel_lat * lat_deg_per_meter,
                        -dx * meters_per_pixel_lon * lon_deg_per_meter);

                    app->touch_last_x = touch_data.x;
                    app->touch_last_y = touch_data.y;
                }
            }
        }
        else
        {
            if (app->touch_active)
            {
                /* Touch just ended - check if it was a tap (no pan movement) */
                app->touch_active = 0;

                /* Calculate distance from touch start to end */
                int16_t dist_x = (int16_t)touch_data.x - (int16_t)app->touch_start_x;
                int16_t dist_y = (int16_t)touch_data.y - (int16_t)app->touch_start_y;
                uint32_t distance_sq = (uint32_t)(dist_x * dist_x + dist_y * dist_y);

                /* If touch didn't move much, it's a tap - reset zoom and pan */
                if (distance_sq < (TOUCH_DOUBLE_TAP_DISTANCE * TOUCH_DOUBLE_TAP_DISTANCE))
                {
                    /* Single tap detected - reset zoom and pan to default */
                    (void)trmap_map_control_reset();
                    MAP_PRINTF("Tap: Reset zoom and pan");
                }
                else
                {
                    (void)trmap_map_control_pan_finish();
                    /* Touch was a pan gesture */
                    MAP_PRINTF("Touch pan end: offset %.6f, %.6f", app->pan_offset_lat, app->pan_offset_lon);
                }
            }
        }
    }
    return 0;
}
#endif

static int nav_handle_keyboard(app_state_t *app)
{

#ifdef USE_HONEY_GUI
    return nav_handle_keyboard_honey(app);
#elif defined _WIN32
    return nav_handle_keyboard_pc(app);
#else
    return nav_handle_keyboard_mcu(app);
#endif
}

/**
 * @brief Run one iteration of the navigation loop
 * @param app Application state
 * @return 0 to continue, 1 if navigation completed, 2 if mode switch, -1 on error
 */
static int nav_loop(app_state_t *app)
{
    /* Use fixed time step for simulation (1 second per frame) */
    const float delta_time = 1.0f;
    static uint32_t no_fix_log_counter = 0;  /* Counter for throttling no-fix logs */

    /* Handle keyboard input */
    int kb_result = nav_handle_keyboard(app);
    if (kb_result == 1)
    {
        return 1;  /* User requested quit */
    }
    else if (kb_result == 2)
    {
        return 2;  /* Mode switch requested */
    }

    /* 1. Update GPS Provider (get new position from GPS provider) */
    bool got_data = gps_provider_update(app->gps_provider, delta_time);
    const gps_position_t *gps = gps_provider_get_position(app->gps_provider);
    MAP_PRINTF("[Frame %d] GPS Provider Update: %s\n",
               app->frame_count, got_data ? "Got Data" : "No Data");
    if (got_data)
    {
        if (gps && gps->valid)
        {
            /* Valid GPS fix - log and redraw */
            MAP_PRINTF("[Frame %d] GPS: %.6f, %.6f | Heading: %.0f° | Speed: %.1f km/h | Accuracy: %.1fm\n",
                       app->frame_count, (double)gps->lat, (double)gps->lon,
                       (double)gps->heading, (double)(gps->speed * 3.6f), (double)gps->accuracy);
            app->needs_redraw = 1;  /* GPS has valid fix, need redraw */
            no_fix_log_counter = 0;  /* Reset counter when we get a fix */
        }
        else
        {
            /* GPS data received but no valid fix - only log every 2 seconds (about 80 iterations at 25ms) */
            no_fix_log_counter++;
            if (no_fix_log_counter == 1 || no_fix_log_counter % 80 == 0)
            {
                if (gps_provider_get_type(app->gps_provider) == GPS_PROVIDER_SERIAL)
                {
                    gps_driver_t *driver = gps_provider_get_driver(app->gps_provider);
                    if (driver)
                    {
                        const gps_driver_data_t *data = gps_driver_get_data(driver);
                        MAP_PRINTF("⚠️  GPS: No Fix | Satellites: %d | NMEA: %u sentences | Fix: %s | Waiting...\n",
                                   data ? data->satellites_used : 0,
                                   gps_driver_get_sentence_count(driver),
                                   gps_driver_fix_quality_str(data ? data->fix_quality : GPS_DRIVER_FIX_INVALID));
                    }
                    else
                    {
                        MAP_PRINTF("⚠️  GPS: No Fix - Waiting for satellites...\n");
                    }
                }
                else
                {
                    MAP_PRINTF("⚠️  GPS: No Fix - Waiting for satellites...\n");
                }
            }
            /* Don't set needs_redraw when there's no valid fix - no point saving frames */
        }
    }
    else
    {
        /* No data received from GPS - only log every 200 iterations (about 5 seconds) */
        no_fix_log_counter++;
        if (no_fix_log_counter % 200 == 0)
        {
            if (gps_provider_get_type(app->gps_provider) == GPS_PROVIDER_SERIAL)
            {
                gps_driver_t *driver = gps_provider_get_driver(app->gps_provider);
                MAP_PRINTF("GPS: Waiting for data... (NMEA: %u sentences)\n",
                           driver ? gps_driver_get_sentence_count(driver) : 0);
            }
            else
            {
                MAP_PRINTF("GPS: Waiting for data...\n");
            }
        }
    }

    /* Check if GPS provider is complete (simulator only) */
    if (gps_provider_is_complete(app->gps_provider))
    {
        app->nav.arrived = 1;
    }

    /* 2. Update navigation state */
    update_nav_state(app);

    /* 3. Handle rerouting if needed */
    if (app->needs_reroute)
    {
        if (do_reroute(app) != 0)
        {
            MAP_FPRINTF("Error: Failed to reroute\n");
            return -1;
        }
    }
    /* 4. Check if arrived */
    if (app->nav.arrived)
    {
        MAP_PRINTF("\n🎉 Navigation complete! Arrived at destination.\n");
        render_nav_frame(app);  /* Render final frame */
        return 1;  /* Navigation completed */
    }

    /* 5. Render frame if needed */
    if (app->needs_redraw)
    {
        render_nav_frame(app);
    }
    /* 6. Check frame limit */
    if (app->config.max_frames > 0 && app->frame_count >= app->config.max_frames)
    {
        MAP_PRINTF("\n⏹️  Maximum frame limit reached (%d)\n", app->config.max_frames);
        return 1;  /* Navigation completed (frame limit) */
    }

    return 0;  /* Continue navigation */
}

/**
 * @brief Cleanup navigation mode resources
 * @param app Application state
 */
static void nav_cleanup(app_state_t *app)
{
    MAP_PRINTF("\nNavigation ended, total %d frames generated\n", app->frame_count);

    /* Cleanup GPS provider */
    if (app->gps_provider)
    {
        gps_provider_destroy(app->gps_provider);
        app->gps_provider = NULL;
    }

    /* Cleanup navigation resources */
    if (app->nav.current_path)
    {
        path_free(app->nav.current_path);
        app->nav.current_path = NULL;
    }
    if (app->nav.original_path)
    {
        if (app->nav.original_path->points)
        {
            MAP_FREE(app->nav.original_path->points);
        }
        MAP_FREE(app->nav.original_path);
        app->nav.original_path = NULL;
    }
    if (app->renderer)
    {
        renderer_destroy(app->renderer);
        app->renderer = NULL;
    }
}

/* ============================================================================
 * Navigation Setup Mode Functions (formerly GPS Map Display Mode)
 * ============================================================================
 */

/**
 * @brief Navigation Setup State Structure
 * In this mode, the user can move the destination marker on the map
 * and confirm to start navigation to that destination.
 */
typedef struct
{
    gps_simulator_t gps_sim;    /* GPS simulator (for simulation mode) */
    gps_provider_t *gps_provider; /* GPS provider (unified interface) */
    app_config_t config;        /* Configuration */
    map_t *map;                 /* Map */
    renderer_t *renderer;       /* Renderer */
    int running;                /* Is running */
    int frame_count;            /* Frame count */
    /* Navigation setup - destination selection */
    float dest_lat;             /* Destination latitude (map center) */
    float dest_lon;             /* Destination longitude (map center) */
    int dest_initialized;       /* Destination initialized from GPS */    /* Pending navigation start point (from last GPS fix when user confirmed) */
    float nav_start_lat;        /* Navigation start latitude (from GPS) */    float
    nav_start_lon;        /* Navigation start longitude (from GPS) */
    int nav_requested;          /* Navigation was requested (dest confirmed) */
    /* Zoom control */
    float zoom_factor;          /* Zoom factor (1.0 = default, <1 = zoom in, >1 = zoom out) */
#if !defined(_WIN32) || defined(USE_HONEY_GUI)
    /* Touch pan control */
    int touch_active;           /* Touch is currently active */
    uint16_t touch_start_x;     /* Touch start X coordinate */
    uint16_t touch_start_y;     /* Touch start Y coordinate */
    uint16_t touch_last_x;      /* Last touch X coordinate */
    uint16_t touch_last_y;      /* Last touch Y coordinate */
    float pan_offset_lat;       /* Pan offset in latitude (degrees) */
    float pan_offset_lon;       /* Pan offset in longitude (degrees) */
    /* Double-tap detection */
    uint32_t last_tap_time;     /* Timestamp of last tap (ms) */
    uint16_t last_tap_x;        /* X coordinate of last tap */
    uint16_t last_tap_y;        /* Y coordinate of last tap */
#endif
} gps_map_state_t;

/**
 * @brief GPS Track Mode State Structure
 *
 * Track mode records the GPS path traveled and dynamically adjusts the viewport to ensure:
 * 1. Starting point is in the viewport
 * 2. Current position is in the viewport
 * 3. All track points are in the viewport
 */
typedef struct
{
    gps_provider_t *gps_provider; /* GPS provider (unified interface) */    app_config_t config;        /* Configuration */
    map_t *map;                 /* Map */
    renderer_t *renderer;       /* Renderer */
    int running;                /* Is running */
    int frame_count;            /* Frame count */

    /* Track data */
    coord_t *track_points;      /* Track points array */
    uint32_t track_count;       /* Current track point count */
    uint32_t track_capacity;    /* Track points array capacity */

    /* Starting point */
    float start_lat;            /* Starting point latitude */
    float start_lon;            /* Starting point longitude */
    int has_start;              /* Has starting point recorded */
    /* Viewport control */
    float initial_radius;       /* Initial view radius (meters) */
    float current_radius;       /* Current view radius (meters) */
    float min_lat, max_lat;     /* Track bounds */
    float min_lon, max_lon;
    /* Replay control */
    int replay_mode;            /* 0=recording, 1=replay */
    int replay_paused;          /* Replay paused flag */
    uint32_t replay_index;      /* Current replay position */
    int replay_speed;           /* Replay speed: 1=normal, 2=2x, 4=4x, -1=reverse */    /* Manual viewport control */
    int manual_view;            /* 0=auto viewport, 1=manual viewport */
    float manual_zoom;          /* Manual zoom factor (1.0 = normal) */
    float pan_offset_lat;       /* Pan offset in latitude (degrees) */
    float pan_offset_lon;       /* Pan offset in longitude (degrees) */
#if !defined(_WIN32) || defined(USE_HONEY_GUI)
    /* Touch pan control */
    int touch_active;           /* Touch is currently active */
    uint16_t touch_start_x;     /* Touch start X coordinate */
    uint16_t touch_start_y;     /* Touch start Y coordinate */
    uint16_t touch_last_x;      /* Last touch X coordinate */
    uint16_t touch_last_y;      /* Last touch Y coordinate */
    /* Double-tap detection */
    uint32_t last_tap_time;     /* Timestamp of last tap (ms) */
    uint16_t last_tap_x;        /* X coordinate of last tap */
    uint16_t last_tap_y;        /* Y coordinate of last tap */
#endif
} gps_track_state_t;

/* ============================================================================
 * GPS Initialization Mode State Structure
 * ============================================================================
 * GPS Init mode displays GPS status during initialization and automatically
 * switches to Track Record mode when GPS signal becomes valid.
 */
typedef struct
{
    gps_provider_t *gps_provider; /* GPS provider (unified interface) */
    app_config_t config;          /* Configuration */
    map_t *map;                   /* Map */
    renderer_t *renderer;         /* Renderer */
    int running;                  /* Is running */
    int frame_count;              /* Frame count */
    uint32_t init_start_time;     /* Initialization start time (ms) */
    int gps_valid_count;          /* Consecutive valid GPS readings */
} gps_init_state_t;

/* ============================================================================
 * Map View Mode State Structure
 * ============================================================================
 * Map View mode displays the map without GPS features, allowing pan/zoom.
 * This is the startup default mode for simple map viewing.
 */
typedef struct
{
    app_config_t config;          /* Configuration */
    map_t *map;                   /* Map */
    renderer_t *renderer;         /* Renderer */
    int running;                  /* Is running */
    int frame_count;              /* Frame count */
    int needs_redraw;             /* Flag to indicate redraw needed */
    float view_lat;               /* View center latitude */
    float view_lon;               /* View center longitude */
    float zoom_factor;            /* Zoom factor (1.0 = default) */
#if !defined(_WIN32) || defined(USE_HONEY_GUI)
    /* Touch pan control */
    int touch_active;             /* Touch is active */
    int16_t touch_start_x;        /* Touch start X */
    int16_t touch_start_y;        /* Touch start Y */
    int16_t touch_last_x;         /* Last touch X */
    int16_t touch_last_y;         /* Last touch Y */
    float pan_offset_lat;         /* Pan offset latitude */
    float pan_offset_lon;         /* Pan offset longitude */
    /* Double-tap detection */
    uint32_t last_tap_time;       /* Timestamp of last tap (ms) */
    uint16_t last_tap_x;          /* X coordinate of last tap */
    uint16_t last_tap_y;          /* Y coordinate of last tap */
#endif
} map_view_state_t;

/**
 * @brief Set viewport centered on GPS position with given radius
 * @param renderer Renderer
 * @param lat Center latitude
 * @param lon Center longitude
 * @param radius_m View radius in meters
 */
static void set_viewport_around_point(renderer_t *renderer,
                                      float lat, float lon,
                                      float radius_m)
{
    /* Convert radius from meters to approximate degrees */
    /* At equator: 1 degree latitude ≈ 111km, 1 degree longitude ≈ 111km * cos(lat) */
    float lat_delta = radius_m / 111000.0f;
    float lon_delta = radius_m / (111000.0f * cosf(lat * 3.14159265f / 180.0f));

    float min_lat = lat - lat_delta;
    float max_lat = lat + lat_delta;
    float min_lon = lon - lon_delta;
    float max_lon = lon + lon_delta;

    renderer_set_viewport(renderer, min_lat, min_lon, max_lat, max_lon);
}

/**
 * @brief Render GPS map frame centered on current position
 */
static int render_gps_map_frame(gps_map_state_t *state)
{
    renderer_t *r = state->renderer;
    const gps_position_t *gps = gps_provider_get_position(state->gps_provider);

    if (!gps || !gps->valid)
    {
        /* No valid GPS signal - don't render frame, just return */
        return 0;
    }

    /* Initialize destination to current GPS position on first valid fix */
    if (!state->dest_initialized)
    {
        state->dest_lat = gps->lat;
        state->dest_lon = gps->lon;
        state->dest_initialized = 1;
    }    /* Clear canvas */
    renderer_clear(r, 0xFFFFFFFF);

    /* Set viewport centered on DESTINATION point (not GPS position) */
    /* Apply zoom factor to view radius */
    float effective_radius = state->config.gps_view_radius * state->zoom_factor;

    /* Calculate view center including any active pan offset */
    float view_center_lat = state->dest_lat;
    float view_center_lon = state->dest_lon;
#if !defined(_WIN32) || defined(USE_HONEY_GUI)
    /* Apply touch pan offset during drag */
    view_center_lat += state->pan_offset_lat;
    view_center_lon += state->pan_offset_lon;
#endif
    set_viewport_around_point(r, view_center_lat, view_center_lon, effective_radius);

    /* Render map with theme */
    map_theme_t theme = MAP_THEME_GOOGLE;
    render_options_t opts;
    setup_render_options(&opts, r);  /* Pass renderer for dynamic road type selection */
    render_map_with_options(r, state->map, &theme,
                            &opts);    /* Draw destination marker first (blue, drawn below GPS marker) */
    float dest_screen_x, dest_screen_y;
    renderer_coord_to_screen(r, state->dest_lat, state->dest_lon, &dest_screen_x, &dest_screen_y);

    int dest_marker_size = 44;  /* Slightly larger for destination */

#ifdef USE_TRVG
    /* Blue color for destination marker: RGB(0x42, 0x85, 0xF4) - Google Blue */
    trvg_fast_gps_marker(&r->trvg,
                         (int)dest_screen_x, (int)dest_screen_y, dest_marker_size,
                         0x42, 0x85, 0xF4);  /* Google Blue for destination */
#else
    render_text(r, dest_screen_x - 8, dest_screen_y - 16, "V", 32.0f, 0x4285F4FF);  /* Blue marker */
#endif

    /* Draw current GPS position marker on top (red, always visible) */
    float gps_screen_x, gps_screen_y;
    renderer_coord_to_screen(r, gps->lat, gps->lon, &gps_screen_x, &gps_screen_y);

    int marker_size = 32;

    /* Clamp GPS marker to screen edges so it's always visible even when off-viewport */
    float clamped_gps_x = gps_screen_x;
    float clamped_gps_y = gps_screen_y;
    int gps_off_screen = 0;
    const float margin = 30.0f;
    if (clamped_gps_x < margin || clamped_gps_x > state->config.width - margin ||
            clamped_gps_y < margin || clamped_gps_y > state->config.height - margin)
    {
        gps_off_screen = 1;
        if (clamped_gps_x < margin)
        {
            clamped_gps_x = margin;
        }
        if (clamped_gps_x > state->config.width - margin)
        {
            clamped_gps_x = state->config.width - margin;
        }
        if (clamped_gps_y < margin)
        {
            clamped_gps_y = margin;
        }
        if (clamped_gps_y > state->config.height - margin)
        {
            clamped_gps_y = state->config.height - margin;
        }
    }

#ifdef USE_TRVG
    trvg_fast_gps_marker_with_heading(&r->trvg,
                                      (int)clamped_gps_x, (int)clamped_gps_y, marker_size,
                                      gps->heading,
                                      0xEA, 0x43, 0x35);  /* Google Maps red for current position */
#else
    render_text(r, clamped_gps_x - 8, clamped_gps_y - 12, "O", 24.0f, 0xEA4335FF);  /* Red circle */
#endif

    /* If GPS is off screen, draw a small label indicating direction */
    if (gps_off_screen)
    {
        render_text(r, clamped_gps_x - 20, clamped_gps_y + 12, "GPS", 12.0f, 0xEA4335FF);
    }

    /* Render title overlay */
    char info[256];
    snprintf(info, sizeof(info), "Navigation Setup");
    render_text(r, 50.0f, 20.0f, info, 28.0f, 0x2196F3FF);  /* Blue title */

    /* Destination info line */
    snprintf(info, sizeof(info), "Dest: %.6f, %.6f",
             (double)state->dest_lat, (double)state->dest_lon);
    render_text(r, 10.0f, 55.0f, info, 18.0f, 0x4285F4FF);  /* Blue text for dest */

    /* GPS info line */
    snprintf(info, sizeof(info), "GPS: %.6f, %.6f | Speed: %.1f km/h",
             (double)gps->lat, (double)gps->lon, (double)(gps->speed * 3.6f));
    render_text(r, 10.0f, 80.0f, info, 16.0f, 0x666666FF);

    /* Distance from GPS to destination */
    float dlat = state->dest_lat - gps->lat;
    float dlon = state->dest_lon - gps->lon;
    float dist_m = sqrtf(dlat * dlat + dlon * dlon) * 111000.0f;
    if (dist_m >= 1000.0f)
    {
        snprintf(info, sizeof(info), "Distance: %.1f km | [WASD] Move dest | [Enter] Start nav",
                 (double)(dist_m / 1000.0f));
    }
    else
    {
        snprintf(info, sizeof(info), "Distance: %.0f m | [WASD] Move dest | [Enter] Start nav",
                 (double)dist_m);
    }
    render_text(r, 10.0f, 105.0f, info, 14.0f, 0x999999FF);    /* Controls help */
#ifdef _WIN32
    snprintf(info, sizeof(info), "[WASD/Arrows] Move | [Z/X] Zoom | [0] Reset | [Enter] Navigate | [M] Mode | [Q] Quit");
    render_text(r, 10.0f, state->config.height - 25.0f, info, 14.0f, 0x666666FF);
#else
    snprintf(info, sizeof(info), "[KEY1-] [MFB+] Zoom | Tap Reset | [KEY3] Mode | Slide Pan");
    float text_x = (state->config.width - strlen(info) * 5.0f) / 2.0f;
    render_text(r, text_x, state->config.height - 25.0f, info, 14.0f, 0x666666FF);
#endif

    /* Save frame */
    char filename[256];
    snprintf(filename, sizeof(filename), "frames/screen.png");
    render_save_png(r, filename);

    state->frame_count++;

    return 0;
}

/**
 * @brief Initialize Navigation Setup mode (formerly GPS map display mode)
 * @param state GPS map state (must be zero-initialized by caller)
 * @param map Map data
 * @param config Application configuration
 * @return 0 on success, non-zero on failure
 */
static int gps_map_init(gps_map_state_t *state, map_t *map, app_config_t *config)
{
    state->map = map;
    state->config = *config;

    /* Initialize destination (will be set from GPS on first valid fix) */
    state->dest_lat = config->start_lat;
    state->dest_lon = config->start_lon;
    state->dest_initialized = 0;    /* Initialize zoom control */
    state->zoom_factor = 1.0f;  /* Default zoom (1.0 = 100%) */

#if !defined(_WIN32) || defined(USE_HONEY_GUI)
    /* Initialize touch pan control */
    state->touch_active = 0;
    state->touch_start_x = 0;
    state->touch_start_y = 0;
    state->touch_last_x = 0;
    state->touch_last_y = 0;
    state->pan_offset_lat = 0.0f;
    state->pan_offset_lon = 0.0f;
    /* Initialize double-tap detection */
    state->last_tap_time = 0;
    state->last_tap_x = 0;
    state->last_tap_y = 0;
#endif

    /* Create renderer */
    state->renderer = renderer_create(config->width, config->height);
    if (!state->renderer)
    {
        MAP_FPRINTF("Error: Failed to create renderer\n");
        return 1;
    }

    /* Initialize GPS Provider for nav setup mode */
    gps_provider_config_t gps_prov_config;
    gps_provider_config_init(&gps_prov_config);
    gps_prov_config.type = config->gps_type;
    MAP_PRINTF("\n🗺️  Navigation Setup Mode\n");
    MAP_PRINTF("   GPS source: %s\n", gps_provider_type_str(config->gps_type));
    MAP_PRINTF("   View radius: %.0f m\n", (double)config->gps_view_radius);
    if (config->gps_type == GPS_PROVIDER_SIMULATOR)
    {
        gps_prov_config.sim_config.simulation_speed = 30.0f;  /* Slower speed for map viewing */
        gps_prov_config.sim_config.jitter_mode = GPS_JITTER_NORMAL;
        gps_prov_config.sim_config.jitter_amount_m = 3.0f;
        MAP_PRINTF("   Start point: %.6f, %.6f\n", (double)config->start_lat, (double)config->start_lon);
        MAP_PRINTF("   GPS jitter: %.1fm\n", (double)gps_prov_config.sim_config.jitter_amount_m);
    }
    else if (config->gps_type == GPS_PROVIDER_SERIAL)
    {
        gps_prov_config.serial_port = config->gps_serial_port;
        gps_prov_config.baudrate = config->gps_baudrate;
        MAP_PRINTF("   Port: %s @ %u baud\n", config->gps_serial_port, config->gps_baudrate);
    }

    /* For GPS map mode without navigation, we need end point for simulator path */
    /* If no end point, create a circular path around start point */
    float end_lat = config->end_lat;
    float end_lon = config->end_lon;
    if (!config->has_end)
    {
        /* Create end point slightly offset from start for simulator */
        end_lat = config->start_lat + 0.01f;  /* ~1km north */
        end_lon = config->start_lon + 0.01f;  /* ~1km east */
    }

    state->gps_provider = gps_provider_create(&gps_prov_config, map,
                          config->start_lat, config->start_lon,
                          end_lat, end_lon,
                          config->transport_mode);
    if (!state->gps_provider)
    {
        MAP_FPRINTF("Error: Failed to initialize GPS provider\n");
        renderer_destroy(state->renderer);
        state->renderer = NULL;
        return 1;
    }
    MAP_PRINTF("✓ GPS provider initialized (%s)\n", gps_provider_type_str(config->gps_type));

    return 0;
}

/**
 * @brief Handle keyboard input for GPS map mode
 * @param state GPS map state
 * @return 0=continue, 1=quit, 2=mode switch
 */
/**
 * @brief Handle keyboard input for Navigation Setup mode
 *
 * Controls:
 * - WASD / Arrow keys: Move destination marker on map
 * - Enter: Confirm destination and switch to Navigation mode
 * - M: Cycle to next application mode
 * - 1/2/3: Direct mode switch
 * - Q/ESC: Quit
 *
 * MCU Keys:
 * - KEY1 (P3_0): Zoom out (increase view radius)
 * - KEY2 (ADC_0): Confirm destination and start navigation
 * - KEY3 (P3_1): Reset zoom and destination to default
 * - MFB: Zoom in (decrease view radius)
 *
 * @param state GPS map state
 * @return 0=continue, 1=quit, 2=mode switch
 */
#ifdef  USE_HONEY_GUI
static int gps_map_handle_keyboard_honey(gps_map_state_t *state)
{
    touch_info_t *tp = tp_get_info();

    if (trmap_honey_gui_consume_key_press("Home"))
    {
        (void)trmap_map_control_zoom_out();
        MAP_PRINTF("Home: Zoom out %.1fx", state->zoom_factor);
    }

    if (trmap_honey_gui_consume_key_press("Back"))
    {
        (void)trmap_map_control_reset();
        MAP_PRINTF("Back: Reset to %.6f, %.6f, Zoom 1x", state->dest_lat, state->dest_lon);
    }

    if (trmap_honey_gui_consume_key_press("Menu"))
    {
        const gps_position_t *gps = gps_provider_get_position(state->gps_provider);

        if (gps && gps->valid)
        {
            state->nav_start_lat = gps->lat;
            state->nav_start_lon = gps->lon;
            state->nav_requested = 1;
            MAP_PRINTF("Menu: Start navigation to %.6f, %.6f", state->dest_lat, state->dest_lon);
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_NAVIGATION);
            return 2;
        }

        MAP_PRINTF("Menu: Cannot navigate - No GPS fix");
    }

    if (trmap_honey_gui_consume_key_press("Power"))
    {
        (void)trmap_map_control_zoom_in();
        MAP_PRINTF("Power: Zoom in %.1fx", state->zoom_factor);
    }

    if (trmap_honey_gui_touch_active(tp))
    {
        if (!state->touch_active || tp->pressed)
        {
            state->touch_active = 1;
            state->touch_start_x = tp->x;
            state->touch_start_y = tp->y;
            state->touch_last_x = tp->deltaX;
            state->touch_last_y = tp->deltaY;
        }
        else
        {
            int16_t dx = tp->deltaX - state->touch_last_x;
            int16_t dy = tp->deltaY - state->touch_last_y;

            if (dx != 0 || dy != 0)
            {
                float effective_radius = state->config.gps_view_radius * state->zoom_factor;
                float meters_per_pixel_lat = (2.0f * effective_radius) / state->config.height;
                float meters_per_pixel_lon = (2.0f * effective_radius) / state->config.width;
                float current_lat = state->dest_lat + state->pan_offset_lat;
                float lat_deg_per_meter = 1.0f / 111000.0f;
                float lon_deg_per_meter = 1.0f / (111000.0f * cosf(current_lat * 3.14159265f / 180.0f));

                (void)trmap_map_control_pan_delta(
                    dy * meters_per_pixel_lat * lat_deg_per_meter,
                    -dx * meters_per_pixel_lon * lon_deg_per_meter);

                state->touch_last_x = tp->deltaX;
                state->touch_last_y = tp->deltaY;
            }
        }
    }
    else if (trmap_honey_gui_touch_released(tp) && state->touch_active)
    {
        int16_t dist_x;
        int16_t dist_y;
        uint32_t distance_sq;

        state->touch_active = 0;
        dist_x = tp->deltaX;
        dist_y = tp->deltaY;
        distance_sq = (uint32_t)(dist_x * dist_x + dist_y * dist_y);

        if (distance_sq < (TOUCH_DOUBLE_TAP_DISTANCE * TOUCH_DOUBLE_TAP_DISTANCE))
        {
            (void)trmap_map_control_reset();
            MAP_PRINTF("Tap: Reset to %.6f, %.6f, Zoom 1x", state->dest_lat, state->dest_lon);
        }
        else
        {
            (void)trmap_map_control_pan_finish();
            MAP_PRINTF("Touch pan end: offset %.6f, %.6f", state->pan_offset_lat, state->pan_offset_lon);
        }
    }

    return 0;
}
#elif defined (_WIN32)
static int gps_map_handle_keyboard_pc(gps_map_state_t *state)
{
    if (!_kbhit())
    {
        return 0;
    }

    int ch = _getch();

    /* Handle arrow keys (they come as 0 or 0xE0 followed by actual code) */
    if (ch == 0 || ch == 0xE0)
    {
        ch = _getch();
        switch (ch)
        {
            case 72:  /* Up arrow - move destination north */
                (void)trmap_map_control_pan_north();
                break;
            case 80:  /* Down arrow - move destination south */
                (void)trmap_map_control_pan_south();
                break;
            case 75:  /* Left arrow - move destination west */
                (void)trmap_map_control_pan_west();
                break;
            case 77:  /* Right arrow - move destination east */
                (void)trmap_map_control_pan_east();
                break;
        }
        return 0;
    }

    switch (ch)
    {
        /* WASD keys for destination movement */
        case 'w':
        case 'W':  /* W - move destination north */
            (void)trmap_map_control_pan_north();
            break;

        case 's':
        case 'S':  /* S - move destination south */
            (void)trmap_map_control_pan_south();
            break;

        case 'a':
        case 'A':  /* A - move destination west */
            (void)trmap_map_control_pan_west();
            break;

        case 'd':
        case 'D':  /* D - move destination east */
            (void)trmap_map_control_pan_east();
            break;

        case 'z':
        case 'Z':
            (void)trmap_map_control_zoom_in();
            break;

        case 'x':
        case 'X':
            (void)trmap_map_control_zoom_out();
            break;

        case '0':
            (void)trmap_map_control_reset();
            break;
        case 13:  /* Enter - confirm destination and start navigation */
            {
                const gps_position_t *gps = gps_provider_get_position(state->gps_provider);
                if (gps && gps->valid)
                {
                    /* Store navigation parameters in state (config will be updated during mode switch) */
                    state->nav_start_lat = gps->lat;
                    state->nav_start_lon = gps->lon;
                    state->nav_requested = 1;
                    MAP_PRINTF("\n🎯 Destination confirmed: %.6f, %.6f\n", (double)state->dest_lat, (double)state->dest_lon);
                    MAP_PRINTF("   Starting navigation from GPS position: %.6f, %.6f\n", (double)gps->lat, (double)gps->lon);
                    (void)trmap_request_mode_switch(TRMAP_APP_MODE_NAVIGATION);
                    return 2;
                }
                else
                {
                    MAP_PRINTF("⚠️  Cannot start navigation: No valid GPS fix\n");
                }
                break;
            }

        case 'm':
        case 'M':  /* M - cycle to next application mode */
            (void)trmap_request_next_mode_switch();
            return 2;
        case '1':  /* 1 - switch to Track Record mode */
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_GPS_TRACK_RECORD);
            return 2;

        case '2':  /* 2 - switch to Track Replay mode */
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_GPS_TRACK_REPLAY);
            return 2;

        case '3':  /* 3 - stay in GPS Map mode (no-op) */
            break;

        case '4':  /* 4 - switch to Navigation mode */
            {
                const gps_position_t *gps = gps_provider_get_position(state->gps_provider);
                if (gps && gps->valid)
                {
                    state->nav_start_lat = gps->lat;
                    state->nav_start_lon = gps->lon;
                    state->nav_requested = 1;
                    MAP_PRINTF("\n🎯 Destination confirmed: %.6f, %.6f\n", (double)state->dest_lat, (double)state->dest_lon);
                    (void)trmap_request_mode_switch(TRMAP_APP_MODE_NAVIGATION);
                }
                else
                {
                    MAP_PRINTF("⚠️  Cannot start navigation: No valid GPS fix\n");
                }
                return 2;
            }

        case 'q':
        case 'Q':  /* Q - quit */
        case 27:   /* ESC */
            MAP_PRINTF("👋 Exiting...\n");
            return 1;
    }
    return 0;
}

#else
static int gps_map_handle_keyboard_mcu(gps_map_state_t *state)
{
    /* MCU GPIO Key Handling */

    /* KEY1 (P3_0): Zoom out (increase view radius) */
    if (g_key1_pressed)
    {
        g_key1_pressed = 0;
        (void)trmap_map_control_zoom_out();
        MAP_PRINTF("KEY1: Zoom out %.1fx", state->zoom_factor);
    }

    /* KEY2 (ADC_0): Reset zoom and destination to default */
    if (g_key2_pressed)
    {
        g_key2_pressed = 0;
        (void)trmap_map_control_reset();
        MAP_PRINTF("KEY2: Reset to %.6f, %.6f, Zoom 1x", state->dest_lat, state->dest_lon);
    }

    /* KEY3 (P3_1): Confirm destination and start navigation */
    if (g_key3_pressed)
    {
        g_key3_pressed = 0;
        const gps_position_t *gps = gps_provider_get_position(state->gps_provider);
        if (gps && gps->valid)
        {
            /* Store navigation parameters in state (config updated during mode switch) */
            state->nav_start_lat = gps->lat;
            state->nav_start_lon = gps->lon;
            state->nav_requested = 1;
            MAP_PRINTF("KEY3: Start navigation to %.6f, %.6f", state->dest_lat, state->dest_lon);
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_NAVIGATION);
            return 2;
        }
        else
        {
            MAP_PRINTF("KEY3: Cannot navigate - No GPS fix");
        }
    }    /* MFB: Zoom in (decrease view radius) */
    if (g_mfb_pressed)
    {
        g_mfb_pressed = 0;
        (void)trmap_map_control_zoom_in();
        MAP_PRINTF("MFB: Zoom in %.1fx", state->zoom_factor);
    }

    /* Touch screen pan handling */
    {
        TOUCH_DATA touch_data;
        uint32_t s = os_lock();
        touch_data = get_raw_touch_data();
        os_unlock(s);

        if (touch_data.is_press)
        {
            if (!state->touch_active)
            {
                /* Touch just started */
                state->touch_active = 1;
                state->touch_start_x = touch_data.x;
                state->touch_start_y = touch_data.y;
                state->touch_last_x = touch_data.x;
                state->touch_last_y = touch_data.y;
            }
            else
            {
                /* Touch is moving - calculate pan delta */
                int16_t dx = (int16_t)touch_data.x - (int16_t)state->touch_last_x;
                int16_t dy = (int16_t)touch_data.y - (int16_t)state->touch_last_y;

                if (dx != 0 || dy != 0)
                {
                    /* Convert screen pixels to map coordinates */
                    /* Screen Y increases downward, latitude increases northward (inverted) */
                    /* Screen X increases rightward, longitude increases eastward (normal) */
                    float effective_radius = state->config.gps_view_radius * state->zoom_factor;

                    /* Calculate degrees per pixel based on current view */
                    /* At current zoom, the view covers 2*effective_radius meters */
                    /* Screen height/width covers this range */
                    float meters_per_pixel_lat = (2.0f * effective_radius) / state->config.height;
                    float meters_per_pixel_lon = (2.0f * effective_radius) / state->config.width;

                    /* Convert meters to degrees */
                    /* 1 degree latitude ≈ 111km */
                    /* 1 degree longitude ≈ 111km * cos(lat) */
                    float current_lat = state->dest_lat + state->pan_offset_lat;
                    float lat_deg_per_meter = 1.0f / 111000.0f;
                    float lon_deg_per_meter = 1.0f / (111000.0f * cosf(current_lat * 3.14159265f / 180.0f));

                    /* Pan in opposite direction of drag (map follows finger) */
                    (void)trmap_map_control_pan_delta(
                        dy * meters_per_pixel_lat * lat_deg_per_meter,
                        -dx * meters_per_pixel_lon * lon_deg_per_meter);

                    state->touch_last_x = touch_data.x;
                    state->touch_last_y = touch_data.y;
                }
            }
        }
        else
        {
            if (state->touch_active)
            {
                /* Touch just ended - check if it was a tap (no pan movement) */
                state->touch_active = 0;

                /* Calculate distance from touch start to end */
                int16_t dist_x = (int16_t)touch_data.x - (int16_t)state->touch_start_x;
                int16_t dist_y = (int16_t)touch_data.y - (int16_t)state->touch_start_y;
                uint32_t distance_sq = (uint32_t)(dist_x * dist_x + dist_y * dist_y);
                /* If touch didn't move much, it's a tap - reset zoom, pan and destination */
                if (distance_sq < (TOUCH_DOUBLE_TAP_DISTANCE * TOUCH_DOUBLE_TAP_DISTANCE))
                {
                    /* Single tap detected - reset zoom, pan and destination to default */
                    (void)trmap_map_control_reset();
                    MAP_PRINTF("Tap: Reset to GPS %.6f, %.6f, Zoom 1x", state->dest_lat, state->dest_lon);
                }
                else
                {
                    /* Touch was a pan gesture - apply pan offset */
                    (void)trmap_map_control_pan_finish();
                    MAP_PRINTF("Touch pan end: Dest %.6f, %.6f", state->dest_lat, state->dest_lon);
                }
            }
        }
    }
    return 0;
}
#endif

static int gps_map_handle_keyboard(gps_map_state_t *state)
{
#ifdef USE_HONEY_GUI
    return gps_map_handle_keyboard_honey(state);
#elif defined (_WIN32)
    return gps_map_handle_keyboard_pc(state);

#else
    return gps_map_handle_keyboard_mcu(state);
#endif
}

/**
 * @brief Run one iteration of the GPS map display loop
 * @param state GPS map state
 * @return 0 to continue, 1 if completed, 2 if mode switch, -1 on error
 */
static int gps_map_loop(gps_map_state_t *state)
{
    const float delta_time = 0.5f;  /* Update every 0.5 seconds */
    static uint32_t no_fix_log_counter = 0;  /* Counter for throttling no-fix logs */

    /* Handle keyboard input */
    int kb_result = gps_map_handle_keyboard(state);
    if (kb_result == 1)
    {
        return 1;  /* User requested quit */
    }
    else if (kb_result == 2)
    {
        return 2;  /* Mode switch requested */
    }

    /* Update GPS provider */
    (void)gps_provider_update(state->gps_provider, delta_time);

    const gps_position_t *gps = gps_provider_get_position(state->gps_provider);

    if (gps && gps->valid)
    {
        /* Valid GPS fix - log and render */
        MAP_PRINTF("[Frame %d] GPS: %.6f, %.6f | Heading: %.0f° | Speed: %.1f km/h\n",
                   state->frame_count, (double)gps->lat, (double)gps->lon,
                   (double)gps->heading, (double)(gps->speed * 3.6f));
        no_fix_log_counter = 0;  /* Reset counter when we get a fix */

        /* Render frame only when we have valid GPS */
        render_gps_map_frame(state);
    }
    else
    {
        /* No valid GPS fix - throttle log output */
        no_fix_log_counter++;
        if (no_fix_log_counter == 1 || no_fix_log_counter % 20 == 0)
        {
            if (gps_provider_get_type(state->gps_provider) == GPS_PROVIDER_SERIAL)
            {
                gps_driver_t *driver = gps_provider_get_driver(state->gps_provider);
                if (driver)
                {
                    const gps_driver_data_t *data = gps_driver_get_data(driver);
                    MAP_PRINTF("⚠️  GPS: No Fix | Satellites: %d | NMEA: %u sentences | Waiting...\n",
                               data ? data->satellites_used : 0,
                               gps_driver_get_sentence_count(driver));
                }
                else
                {
                    MAP_PRINTF("⚠️  GPS: No Fix - Waiting for satellites...\n");
                }
            }
            else
            {
                MAP_PRINTF("⚠️  GPS: No Fix - Waiting for satellites...\n");
            }
        }
        /* Don't render frame when GPS is invalid */
    }

    /* Check frame limit */
    if (state->config.max_frames > 0 && state->frame_count >= state->config.max_frames)
    {
        MAP_PRINTF("\n⏹️  Maximum frame limit reached (%d)\n", state->config.max_frames);
        return 1;
    }

    /* Check if GPS provider is complete (simulator only) */
    if (gps_provider_is_complete(state->gps_provider))
    {
        MAP_PRINTF("\n📍 GPS path ended\n");
        return 1;
    }

    return 0;
}

/**
 * @brief Cleanup GPS map display mode resources
 * @param state GPS map state
 */
static void gps_map_cleanup(gps_map_state_t *state)
{
    MAP_PRINTF("\nNavigation setup ended, total %d frames generated\n", state->frame_count);

    if (state->gps_provider)
    {
        gps_provider_destroy(state->gps_provider);
        state->gps_provider = NULL;
    }

    if (state->renderer)
    {
        renderer_destroy(state->renderer);
        state->renderer = NULL;
    }
}

/* ============================================================================
 * GPS Track Mode Functions
 * ============================================================================
 */

/**
 * @brief Add a point to the track
 * @return true if point was added, false if track is full or point too close
 */
static bool gps_track_add_point(gps_track_state_t *state, float lat, float lon)
{
    /* Check if track array needs expansion */
    if (state->track_count >= state->track_capacity)
    {
        /* Track is full, don't add more */
        MAP_PRINTF("⚠️  Track is full (%u points)\n", state->track_capacity);
        return false;
    }

    /* Check minimum distance from last point */
    if (state->track_count > 0)
    {
        float last_lat = state->track_points[state->track_count - 1].lat;
        float last_lon = state->track_points[state->track_count - 1].lon;
        float dist = nav_calculate_distance(lat, lon, last_lat, last_lon);
        if (dist < GPS_TRACK_MIN_DISTANCE)
        {
            return false;  /* Too close to last point */
        }
    }

    /* Add the point */
    state->track_points[state->track_count].lat = lat;
    state->track_points[state->track_count].lon = lon;
    state->track_count++;

    /* Update bounding box */
    if (state->track_count == 1)
    {
        state->min_lat = state->max_lat = lat;
        state->min_lon = state->max_lon = lon;
    }
    else
    {
        if (lat < state->min_lat)
        {
            state->min_lat = lat;
        }
        if (lat > state->max_lat)
        {
            state->max_lat = lat;
        }
        if (lon < state->min_lon)
        {
            state->min_lon = lon;
        }
        if (lon > state->max_lon)
        {
            state->max_lon = lon;
        }
    }

    return true;
}

/**
 * @brief Calculate required view radius to show all track points
 */
static float gps_track_calc_view_radius(gps_track_state_t *state, float current_lat)
{
    if (state->track_count < 2)
    {
        return state->initial_radius;
    }

    /* Calculate bounding box size in meters */
    float lat_range = state->max_lat - state->min_lat;
    float lon_range = state->max_lon - state->min_lon;

    /* Convert to meters (approximate) */
    float lat_dist = lat_range * 111000.0f;
    float lon_dist = lon_range * 111000.0f * cosf(current_lat * 3.14159265f / 180.0f);

    /* Use the larger dimension with some padding */
    float max_dist = (lat_dist > lon_dist) ? lat_dist : lon_dist;
    float required_radius = max_dist * 0.6f;  /* Add 20% padding */

    /* Don't shrink below initial radius */
    if (required_radius < state->initial_radius)
    {
        required_radius = state->initial_radius;
    }

    return required_radius;
}

/**
 * @brief Set viewport to show entire track with proper margins
 *
 * IMPORTANT: Viewport only grows, never shrinks!
 * This ensures that when user returns to start point, all track history
 * remains visible on screen.
 */
static void gps_track_set_viewport(gps_track_state_t *state)
{
    renderer_t *r = state->renderer;

    if (state->track_count < 1)
    {
        return;
    }

    /* Get current position */
    const gps_position_t *gps = gps_provider_get_position(state->gps_provider);
    float current_lat = gps ? gps->lat : state->track_points[state->track_count - 1].lat;
    float current_lon = gps ? gps->lon : state->track_points[state->track_count - 1].lon;

    /*
     * Use track bounding box to calculate viewport
     * The bounding box (min_lat, max_lat, min_lon, max_lon) is updated
     * in gps_track_add_point() and only ever expands, never shrinks.
     */
    float bbox_min_lat = state->min_lat;
    float bbox_max_lat = state->max_lat;
    float bbox_min_lon = state->min_lon;
    float bbox_max_lon = state->max_lon;

    /* Include current GPS position in bounding box calculation */
    if (current_lat < bbox_min_lat)
    {
        bbox_min_lat = current_lat;
    }
    if (current_lat > bbox_max_lat)
    {
        bbox_max_lat = current_lat;
    }
    if (current_lon < bbox_min_lon)
    {
        bbox_min_lon = current_lon;
    }
    if (current_lon > bbox_max_lon)
    {
        bbox_max_lon = current_lon;
    }

    /* Calculate center of bounding box */
    float center_lat = (bbox_min_lat + bbox_max_lat) / 2.0f;
    float center_lon = (bbox_min_lon + bbox_max_lon) / 2.0f;

    /* Calculate half-extents with padding (25% margin on each side) */
    float lat_half_extent = (bbox_max_lat - bbox_min_lat) / 2.0f * 1.25f;
    float lon_half_extent = (bbox_max_lon - bbox_min_lon) / 2.0f * 1.25f;

    /* Convert initial_radius to degrees for minimum extent */
    float min_lat_extent = state->initial_radius / 111000.0f;
    float min_lon_extent = state->initial_radius / (111000.0f * cosf(center_lat * 3.14159265f / 180.0f));

    /* Ensure minimum viewport size based on initial_radius */
    if (lat_half_extent < min_lat_extent)
    {
        lat_half_extent = min_lat_extent;
    }
    if (lon_half_extent < min_lon_extent)
    {
        lon_half_extent = min_lon_extent;
    }

    /* Calculate new viewport bounds - not stored as viewport only grows */

    /*
     * KEY: Viewport only grows, never shrinks!
     * Compare with current_radius to track the maximum extent ever used.
     * We use current_radius to store the maximum radius seen so far.
     */
    float new_radius = gps_track_calc_view_radius(state, center_lat);
    if (new_radius > state->current_radius)
    {
        state->current_radius = new_radius;
    }

    /* Use the maximum radius ever seen for consistent viewport */
    float final_lat_extent = state->current_radius / 111000.0f;
    float final_lon_extent = state->current_radius / (111000.0f * cosf(center_lat * 3.14159265f / 180.0f));

    /* Ensure extents cover the bounding box with margin */
    if (lat_half_extent > final_lat_extent)
    {
        final_lat_extent = lat_half_extent;
    }
    if (lon_half_extent > final_lon_extent)
    {
        final_lon_extent = lon_half_extent;
    }
    /* Final viewport */
    float final_min_lat = center_lat - final_lat_extent;
    float final_max_lat = center_lat + final_lat_extent;
    float final_min_lon = center_lon - final_lon_extent;
    float final_max_lon = center_lon + final_lon_extent;

    /* Apply manual viewport controls if enabled */
    if (state->manual_view)
    {
        /* Apply manual zoom (multiply extents) */
        float zoom_factor = state->manual_zoom;
        final_lat_extent *= zoom_factor;
        final_lon_extent *= zoom_factor;

        /* Apply pan offset */
        center_lat += state->pan_offset_lat;
        center_lon += state->pan_offset_lon;

        /* Recalculate bounds with manual adjustments */
        final_min_lat = center_lat - final_lat_extent;
        final_max_lat = center_lat + final_lat_extent;
        final_min_lon = center_lon - final_lon_extent;
        final_max_lon = center_lon + final_lon_extent;
    }

    renderer_set_viewport(r, final_min_lat, final_min_lon, final_max_lat, final_max_lon);
}

/**
 * @brief Render GPS track replay frame
 * @param state GPS track state
 * @param replay_idx Current replay index
 */
static int render_gps_track_replay_frame(gps_track_state_t *state, uint32_t replay_idx)
{
    renderer_t *r = state->renderer;

    /* Handle case where there are not enough track points */
    if (state->track_count < 2)
    {
        /* Still render a frame with a message instead of black screen */
        renderer_clear(r, 0xFFFFFFFF);

        /* Render map if GPS position is available */
        const gps_position_t *gps = gps_provider_get_position(state->gps_provider);
        if (gps && gps->valid)
        {
            gps_track_set_viewport(state);
            map_theme_t theme = MAP_THEME_GOOGLE;
            render_options_t opts;
            setup_render_options(&opts, r);
            render_map_with_options(r, state->map, &theme, &opts);
        }

        /* Render title and message */
        render_text(r, 50.0f, 20.0f, "Track Replay", 28.0f, 0x9C27B0FF);
        render_text(r, 10.0f, 55.0f, "No track data available for replay", 18.0f, 0xFF5722FF);
        render_text(r, 10.0f, 80.0f, "Record some GPS points first (need at least 2)", 16.0f, 0x666666FF);
        char info[128];
        snprintf(info, sizeof(info), "Current track points: %u", state->track_count);
        render_text(r, 10.0f, 105.0f, info, 14.0f, 0x999999FF);

        /* Controls help */
#ifdef _WIN32
        render_text(r, 50.0f, state->config.height - 25.0f, "[R] Record | [M] Mode | [Q] Quit", 14.0f, 0x666666FF);
#else
        snprintf(info, sizeof(info), "[KEY3] Switch to Record Mode | Tap for Next Mode");
        float text_x = (state->config.width - strlen(info) * 5.0f) / 2.0f;
        render_text(r, text_x, state->config.height - 25.0f, info, 14.0f, 0x666666FF);
#endif

        /* Save frame */
        char filename[256];
        snprintf(filename, sizeof(filename), "frames/screen.png");
        render_save_png(r, filename);

        return 0;
    }

    if (replay_idx >= state->track_count)
    {
        replay_idx = state->track_count - 1;
    }

    /* Get the current replay position */
    float current_lat = state->track_points[replay_idx].lat;
    float current_lon = state->track_points[replay_idx].lon;

    /* Calculate heading from previous point */
    float heading = 0.0f;
    if (replay_idx > 0)
    {
        float prev_lat = state->track_points[replay_idx - 1].lat;
        float prev_lon = state->track_points[replay_idx - 1].lon;
        float dlat = current_lat - prev_lat;
        float dlon = current_lon - prev_lon;
        heading = atan2f(dlon, dlat) * 180.0f / 3.14159265f;
        if (heading < 0)
        {
            heading += 360.0f;
        }
    }

    /* Clear canvas */
    renderer_clear(r, 0xFFFFFFFF);

    /* Set viewport to show entire track */
    gps_track_set_viewport(state);

    /* Render map with theme */
    map_theme_t theme = MAP_THEME_GOOGLE;
    render_options_t opts;
    setup_render_options(&opts, r);
    render_map_with_options(r, state->map, &theme, &opts);

    /* Render full track path (grayed out) */
    if (state->track_count >= 2)
    {
        path_t full_track;
        full_track.points = state->track_points;
        full_track.count = state->track_count;
        full_track.total_distance = 0;

        render_style_t full_style =
        {
            .path_color = 0xBDBDBDFF,     /* Light gray for full track */
            .path_width = 3.0f,
            .start_color = 0x4CAF50FF,
            .end_color = 0x2196F3FF,
            .point_radius = 6.0f,
            .background_color = 0xFFFFFFFF,
            .min_segment_length = 1.0f
        };
        render_path(r, &full_track, &full_style);
    }

    /* Render traveled portion of track (colored) */
    if (replay_idx >= 1)
    {
        path_t traveled_track;
        traveled_track.points = state->track_points;
        traveled_track.count = replay_idx + 1;
        traveled_track.total_distance = 0;

        for (uint32_t i = 0; i < replay_idx; i++)
        {
            traveled_track.total_distance += nav_calculate_distance(
                                                 state->track_points[i].lat, state->track_points[i].lon,
                                                 state->track_points[i + 1].lat, state->track_points[i + 1].lon);
        }

        render_style_t traveled_style =
        {
            .path_color = 0xFF5722FF,     /* Deep Orange for traveled */
            .path_width = 5.0f,
            .start_color = 0x4CAF50FF,
            .end_color = 0x2196F3FF,
            .point_radius = 8.0f,
            .background_color = 0xFFFFFFFF,
            .min_segment_length = 1.0f
        };
        render_path(r, &traveled_track, &traveled_style);
    }

    /* Draw start point marker (green) */
    if (state->has_start)
    {
        float start_x, start_y;
        renderer_coord_to_screen(r, state->start_lat, state->start_lon, &start_x, &start_y);
#ifdef USE_TRVG
        trvg_fast_gps_marker(&r->trvg, (int)start_x, (int)start_y, 30, 0x4C, 0xAF, 0x50);
#else
        render_text(r, start_x - 8, start_y - 12, "S", 24.0f, 0x4CAF50FF);
#endif
    }

    /* Draw end point marker (blue) */
    if (state->track_count > 0)
    {
        float end_lat = state->track_points[state->track_count - 1].lat;
        float end_lon = state->track_points[state->track_count - 1].lon;
        float end_x, end_y;
        renderer_coord_to_screen(r, end_lat, end_lon, &end_x, &end_y);
#ifdef USE_TRVG
        trvg_fast_gps_marker(&r->trvg, (int)end_x, (int)end_y, 25, 0x21, 0x96, 0xF3);
#else
        render_text(r, end_x - 8, end_y - 12, "E", 24.0f, 0x2196F3FF);
#endif
    }

    /* Draw current replay position marker (red with heading) */
    float screen_x, screen_y;
    renderer_coord_to_screen(r, current_lat, current_lon, &screen_x, &screen_y);

#ifdef USE_TRVG
    trvg_fast_gps_marker_with_heading(&r->trvg,
                                      (int)screen_x, (int)screen_y, 40,
                                      heading,
                                      0xEA, 0x43, 0x35);
#else
    render_text(r, screen_x - 8, screen_y - 12, "O", 28.0f, 0xEA4335FF);
#endif

    /* Calculate traveled distance */
    float traveled_distance = 0;
    for (uint32_t i = 0; i < replay_idx && i < state->track_count - 1; i++)
    {
        traveled_distance += nav_calculate_distance(
                                 state->track_points[i].lat, state->track_points[i].lon,
                                 state->track_points[i + 1].lat, state->track_points[i + 1].lon);
    }

    /* Calculate total distance */
    float total_distance = 0;
    for (uint32_t i = 0; i < state->track_count - 1; i++)
    {
        total_distance += nav_calculate_distance(
                              state->track_points[i].lat, state->track_points[i].lon,
                              state->track_points[i + 1].lat, state->track_points[i + 1].lon);
    }    /* Render replay title overlay */
    char info[256];
    snprintf(info, sizeof(info), "▶ Track Replay %s", state->replay_paused ? "[PAUSED]" : "");
    render_text(r, 50.0f, 20.0f, info, 28.0f, 0x9C27B0FF);  /* Purple for replay *//* Progress info (main info line 1) */
    snprintf(info, sizeof(info), "Progress: %u / %u (%.1f%%) | Speed: %dx",
             replay_idx + 1, state->track_count,
             (double)((float)(replay_idx + 1) / state->track_count * 100.0f),
             state->replay_speed > 0 ? state->replay_speed : -state->replay_speed);
    render_text(r, 10.0f, 55.0f, info, 18.0f, 0x333333FF);

    /* Distance info (main info line 2) */
    snprintf(info, sizeof(info), "Traveled: %.2f / %.2f km",
             (double)(traveled_distance / 1000.0f), (double)(total_distance / 1000.0f));
    render_text(r, 10.0f, 80.0f, info, 16.0f, 0x666666FF);

    /* Position info (auxiliary info) */
    snprintf(info, sizeof(info), "Position: %.6f, %.6f | Heading: %.0f°%s",
             (double)current_lat, (double)current_lon, (double)heading,
             state->manual_view ? " | [Manual View]" : "");
    render_text(r, 10.0f, 105.0f, info, 14.0f, 0x999999FF);/* Controls help */
#ifdef _WIN32
    snprintf(info, sizeof(info), "[SPACE] Pause | [←/→] Step | [Z/X] Zoom | [WASD] Pan | [0] Reset | [Q] Quit");
    render_text(r, 50.0f, state->config.height - 25.0f, info, 14.0f, 0x666666FF);
#else
    snprintf(info, sizeof(info), "[KEY1-] [MFB+] Zoom | Tap Reset | [KEY3] Mode | Slide Pan");
    /* Center the text: screen_width / 2 - text_width / 2, estimate ~7 pixels per char at size 14 */
    float text_x = (state->config.width - strlen(info) * 5.0f) / 2.0f;
    render_text(r, text_x, state->config.height - 25.0f, info, 14.0f, 0x666666FF);
#endif

    /* Save frame */
    char filename[256];
    snprintf(filename, sizeof(filename), "frames/screen.png");
    render_save_png(r, filename);

    return 0;
}

/**
 * @brief Handle keyboard input for track mode
 * @param state GPS track state
 * @return 0=continue, 1=quit
 */
#ifdef USE_HONEY_GUI
static int gps_track_handle_keyboard_honey(gps_track_state_t *state)
{
    touch_info_t *tp = tp_get_info();

    if (trmap_honey_gui_consume_key_press("Home"))
    {
        (void)trmap_map_control_zoom_out();
        MAP_PRINTF("Home: Zoom out %.1fx", 1.0f / state->manual_zoom);
    }

    if (trmap_honey_gui_consume_key_press("Back"))
    {
        (void)trmap_map_control_reset();
        MAP_PRINTF("Back: Reset to auto viewport");
    }

    if (trmap_honey_gui_consume_key_press("Menu"))
    {
        MAP_PRINTF("Menu: Switch application mode");
        (void)trmap_request_next_mode_switch();
        return 2;
    }

    if (trmap_honey_gui_consume_key_press("Power"))
    {
        (void)trmap_map_control_zoom_in();
        MAP_PRINTF("Power: Zoom in %.1fx", 1.0f / state->manual_zoom);
    }

    if (trmap_honey_gui_touch_active(tp))
    {
        if (!state->touch_active || tp->pressed)
        {
            state->touch_active = 1;
            state->touch_start_x = tp->x;
            state->touch_start_y = tp->y;
            state->touch_last_x = tp->deltaX;
            state->touch_last_y = tp->deltaY;
        }
        else
        {
            int16_t dx = tp->deltaX - state->touch_last_x;
            int16_t dy = tp->deltaY - state->touch_last_y;

            if (dx != 0 || dy != 0)
            {
                state->manual_view = 1;

                float effective_radius = state->current_radius * state->manual_zoom;
                float meters_per_pixel_lat = (2.0f * effective_radius) / state->config.height;
                float meters_per_pixel_lon = (2.0f * effective_radius) / state->config.width;

                const gps_position_t *gps = gps_provider_get_position(state->gps_provider);
                float current_lat = (gps && gps->valid) ? gps->lat : state->start_lat;
                current_lat += state->pan_offset_lat;

                float lat_deg_per_meter = 1.0f / 111000.0f;
                float lon_deg_per_meter = 1.0f / (111000.0f * cosf(current_lat * 3.14159265f / 180.0f));

                (void)trmap_map_control_pan_delta(
                    dy * meters_per_pixel_lat * lat_deg_per_meter,
                    -dx * meters_per_pixel_lon * lon_deg_per_meter);

                state->touch_last_x = tp->deltaX;
                state->touch_last_y = tp->deltaY;
            }
        }
    }
    else if (trmap_honey_gui_touch_released(tp) && state->touch_active)
    {
        int16_t dist_x;
        int16_t dist_y;
        uint32_t distance_sq;

        state->touch_active = 0;
        dist_x = tp->deltaX;
        dist_y = tp->deltaY;
        distance_sq = (uint32_t)(dist_x * dist_x + dist_y * dist_y);

        if (distance_sq < (TOUCH_DOUBLE_TAP_DISTANCE * TOUCH_DOUBLE_TAP_DISTANCE))
        {
            (void)trmap_map_control_reset();
            MAP_PRINTF("Tap: Reset to auto viewport");
        }
        else
        {
            (void)trmap_map_control_pan_finish();
            MAP_PRINTF("Touch pan end: offset %.6f, %.6f", state->pan_offset_lat, state->pan_offset_lon);
        }
    }

    return 0;
}

#elif defined (_WIN32)
static int gps_track_handle_keyboard_pc(gps_track_state_t *state)
{
    if (!_kbhit())
    {
        return 0;
    }

    int ch = _getch();

    /* Handle arrow keys (they come as 0 or 0xE0 followed by actual code) */
    if (ch == 0 || ch == 0xE0)
    {
        ch = _getch();
        switch (ch)
        {
            case 75:  /* Left arrow */
                if (state->replay_mode && state->replay_index > 0)
                {
                    state->replay_index--;
                    MAP_PRINTF("⏪ Step back: %u / %u\n", state->replay_index + 1, state->track_count);
                }
                break;
            case 77:  /* Right arrow */
                if (state->replay_mode && state->replay_index < state->track_count - 1)
                {
                    state->replay_index++;
                    MAP_PRINTF("⏩ Step forward: %u / %u\n", state->replay_index + 1, state->track_count);
                }
                break;
            case 72:  /* Up arrow - increase speed */
                if (state->replay_speed < 8)
                {
                    if (state->replay_speed <= 0)
                    {
                        state->replay_speed = 1;
                    }
                    else
                    {
                        state->replay_speed *= 2;
                    }
                    MAP_PRINTF("⏩ Speed: %dx\n", state->replay_speed);
                }
                break;
            case 80:  /* Down arrow - decrease speed */
                if (state->replay_speed > 1)
                {
                    state->replay_speed /= 2;
                    MAP_PRINTF("⏪ Speed: %dx\n", state->replay_speed);
                }
                break;
            case 71:  /* Home key - reset viewport */
                state->manual_view = 0;
                state->manual_zoom = 1.0f;
                state->pan_offset_lat = 0.0f;
                state->pan_offset_lon = 0.0f;
                MAP_PRINTF("🏠 Viewport reset to auto mode\n");
                break;
        }
        return 0;
    }

    switch (ch)
    {
        case ' ':  /* Space - toggle pause */
            state->replay_paused = !state->replay_paused;
            MAP_PRINTF("%s\n", state->replay_paused ? "⏸️  Paused" : "▶️  Playing");
            break;

        case 'p':
        case 'P':  /* P - start replay */
            if (!state->replay_mode)
            {
                state->replay_mode = 1;
                state->replay_index = 0;
                state->replay_speed = 1;
                state->replay_paused = 0;
                MAP_PRINTF("\n▶️  Starting track replay (%u points)\n", state->track_count);
                if (state->track_count >= 2)
                {
                    MAP_PRINTF("   [SPACE] Pause | [←/→] Step | [↑/↓] Speed | [R] Record | [Q] Quit\n");
                }
                else
                {
                    MAP_PRINTF("   ⚠️  No track data yet - record some GPS points first\n");
                }
            }
            break;

        case 'r':
        case 'R':  /* R - return to recording mode */
            if (state->replay_mode)
            {
                state->replay_mode = 0;
                MAP_PRINTF("🔴 Returned to recording mode\n");
            }
            break;

        /* Map zoom controls */
        case 'z':
        case 'Z':  /* Z - zoom in (decrease zoom factor) */
            (void)trmap_map_control_zoom_in();
            MAP_PRINTF("🔍 Zoom in: %.1fx\n", (double)(1.0f / state->manual_zoom));
            break;

        case 'x':
        case 'X':  /* X - zoom out (increase zoom factor) */
            (void)trmap_map_control_zoom_out();
            MAP_PRINTF("🔍 Zoom out: %.1fx\n", (double)(1.0f / state->manual_zoom));
            break;

        /* Map pan controls (WASD) */
        case 'w':
        case 'W':  /* W - pan up (north) */
            (void)trmap_map_control_pan_north();
            MAP_PRINTF("⬆️  Pan north\n");
            break;

        case 's':
        case 'S':  /* S - pan down (south) */
            (void)trmap_map_control_pan_south();
            MAP_PRINTF("⬇️  Pan south\n");
            break;

        case 'a':
        case 'A':  /* A - pan left (west) */
            (void)trmap_map_control_pan_west();
            MAP_PRINTF("⬅️  Pan west\n");
            break;

        case 'd':
        case 'D':  /* D - pan right (east) */
            (void)trmap_map_control_pan_east();
            MAP_PRINTF("➡️  Pan east\n");
            break;

        /* Reset viewport */
        case '0':  /* 0 - reset viewport to auto mode */
            (void)trmap_map_control_reset();
            MAP_PRINTF("🏠 Viewport reset to auto mode\n");
            break;

        case '+':
        case '=':  /* + - increase replay speed */
            if (state->replay_mode && state->replay_speed < 8)
            {
                if (state->replay_speed <= 0)
                {
                    state->replay_speed = 1;
                }
                else
                {
                    state->replay_speed *= 2;
                }
                MAP_PRINTF("⏩ Replay speed: %dx\n", state->replay_speed);
            }
            break;

        case '-':
        case '_':  /* - - decrease replay speed */
            if (state->replay_mode && state->replay_speed > 1)
            {
                state->replay_speed /= 2;
                MAP_PRINTF("⏪ Replay speed: %dx\n", state->replay_speed);
            }
            break;

        case '[':  /* [ - jump back 10 points */
            if (state->replay_mode)
            {
                if (state->replay_index >= 10)
                {
                    state->replay_index -= 10;
                }
                else
                {
                    state->replay_index = 0;
                }
                MAP_PRINTF("⏪ Jump back: %u / %u\n", state->replay_index + 1, state->track_count);
            }
            break;

        case ']':  /* ] - jump forward 10 points */
            if (state->replay_mode)
            {
                state->replay_index += 10;
                if (state->replay_index >= state->track_count)
                {
                    state->replay_index = state->track_count - 1;
                }
                MAP_PRINTF("⏩ Jump forward: %u / %u\n", state->replay_index + 1, state->track_count);
            }
            break;
        case 'm':
        case 'M':  /* M - cycle to next application mode */
            {
                (void)trmap_request_next_mode_switch();
            }
            return 2;  /* Return 2 to signal mode switch */

        case '1':  /* 1 - switch to Track Record mode */
            {
                (void)trmap_request_mode_switch(TRMAP_APP_MODE_GPS_TRACK_RECORD);
            }
            return 2;

        case '2':  /* 2 - switch to Track Replay mode */
            {
                (void)trmap_request_mode_switch(TRMAP_APP_MODE_GPS_TRACK_REPLAY);
            }
            return 2;

        case '3':  /* 3 - switch to GPS Map mode */
            {
                (void)trmap_request_mode_switch(TRMAP_APP_MODE_GPS_MAP);
            }
            return 2;

        case '4':  /* 4 - switch to Navigation mode */
            {
                (void)trmap_request_mode_switch(TRMAP_APP_MODE_NAVIGATION);
            }
            return 2;

        case 'q':
        case 'Q':  /* Q - quit */
        case 27:   /* ESC */
            MAP_PRINTF("👋 Exiting...\n");
            return 1;
    }
    return 0;
}


#else
static int gps_track_handle_keyboard_mcu(gps_track_state_t *state)
{
    /* MCU GPIO Key Handling for GPS Track Mode */

    /* KEY1 (P3_0): Zoom out (increase zoom factor) */
    if (g_key1_pressed)
    {
        g_key1_pressed = 0;
        (void)trmap_map_control_zoom_out();
        MAP_PRINTF("KEY1: Zoom out %.1fx", 1.0f / state->manual_zoom);
    }    /* KEY2 (ADC_0): Reset zoom and pan to default (auto mode) */
    if (g_key2_pressed)
    {
        g_key2_pressed = 0;
        (void)trmap_map_control_reset();
        MAP_PRINTF("KEY2: Reset to auto viewport");
    }

    /* KEY3 (P3_1): Cycle to next application mode */
    if (g_key3_pressed)
    {
        g_key3_pressed = 0;
        MAP_PRINTF("KEY3: Switch application mode");
        (void)trmap_request_next_mode_switch();
        return 2;
    }

    /* MFB: Zoom in (decrease zoom factor) */
    if (g_mfb_pressed)
    {
        g_mfb_pressed = 0;
        (void)trmap_map_control_zoom_in();
        MAP_PRINTF("MFB: Zoom in %.1fx", 1.0f / state->manual_zoom);
    }

    /* Touch screen pan handling */
    {
        TOUCH_DATA touch_data;
        uint32_t s = os_lock();
        touch_data = get_raw_touch_data();
        os_unlock(s);

        if (touch_data.is_press)
        {
            if (!state->touch_active)
            {
                /* Touch just started */
                state->touch_active = 1;
                state->touch_start_x = touch_data.x;
                state->touch_start_y = touch_data.y;
                state->touch_last_x = touch_data.x;
                state->touch_last_y = touch_data.y;
            }
            else
            {
                /* Touch is moving - calculate pan delta */
                int16_t dx = (int16_t)touch_data.x - (int16_t)state->touch_last_x;
                int16_t dy = (int16_t)touch_data.y - (int16_t)state->touch_last_y;

                if (dx != 0 || dy != 0)
                {
                    /* Enable manual view mode when user pans */
                    state->manual_view = 1;

                    /* Convert screen pixels to map coordinates */
                    float effective_radius = state->current_radius * state->manual_zoom;
                    float meters_per_pixel_lat = (2.0f * effective_radius) / state->config.height;
                    float meters_per_pixel_lon = (2.0f * effective_radius) / state->config.width;

                    /* Get current center for longitude scaling */
                    const gps_position_t *gps = gps_provider_get_position(state->gps_provider);
                    float current_lat = (gps && gps->valid) ? gps->lat : state->start_lat;
                    current_lat += state->pan_offset_lat;

                    float lat_deg_per_meter = 1.0f / 111000.0f;
                    float lon_deg_per_meter = 1.0f / (111000.0f * cosf(current_lat * 3.14159265f / 180.0f));

                    /* Pan in opposite direction of drag (map follows finger) */
                    (void)trmap_map_control_pan_delta(
                        dy * meters_per_pixel_lat * lat_deg_per_meter,
                        -dx * meters_per_pixel_lon * lon_deg_per_meter);

                    state->touch_last_x = touch_data.x;
                    state->touch_last_y = touch_data.y;
                }
            }
        }
        else
        {
            if (state->touch_active)
            {
                /* Touch just ended - check if it was a tap (no pan movement) */
                state->touch_active = 0;

                /* Calculate distance from touch start to end */
                int16_t dist_x = (int16_t)touch_data.x - (int16_t)state->touch_start_x;
                int16_t dist_y = (int16_t)touch_data.y - (int16_t)state->touch_start_y;
                uint32_t distance_sq = (uint32_t)(dist_x * dist_x + dist_y * dist_y);
                /* If touch didn't move much, it's a tap - reset zoom and pan */
                if (distance_sq < (TOUCH_DOUBLE_TAP_DISTANCE * TOUCH_DOUBLE_TAP_DISTANCE))
                {
                    /* Single tap detected - reset zoom and pan to default (auto mode) */
                    (void)trmap_map_control_reset();
                    MAP_PRINTF("Tap: Reset to auto viewport");
                }
                else
                {
                    (void)trmap_map_control_pan_finish();
                    /* Touch was a pan gesture */
                    MAP_PRINTF("Touch pan end: offset %.6f, %.6f", state->pan_offset_lat, state->pan_offset_lon);
                }
            }
        }
    }
    return 0;
}
#endif

static int gps_track_handle_keyboard(gps_track_state_t *state)
{
#ifdef  USE_HONEY_GUI
    return gps_track_handle_keyboard_honey(state);
#elif defined (_WIN32)
    return gps_track_handle_keyboard_pc(state);
#else
    return gps_track_handle_keyboard_mcu(state);
#endif
}

/**
 * @brief Render GPS track mode frame
 */
static int render_gps_track_frame(gps_track_state_t *state)
{
    renderer_t *r = state->renderer;
    const gps_position_t *gps = gps_provider_get_position(state->gps_provider);

    if (!gps || !gps->valid)
    {
        return 0;
    }

    /* Add point to track */
    (void)gps_track_add_point(state, gps->lat, gps->lon);

    /* Clear canvas */
    renderer_clear(r, 0xFFFFFFFF);

    /* Set viewport to show entire track */
    gps_track_set_viewport(state);

    /* Render map with theme */
    map_theme_t theme = MAP_THEME_GOOGLE;
    render_options_t opts;
    setup_render_options(&opts, r);
    MAP_PRINTF("track1\n");
    render_map_with_options(r, state->map, &theme, &opts);
    MAP_PRINTF("track2\n");
    /* Render track path */
    if (state->track_count >= 2)
    {
        /* Create a temporary path structure for rendering */
        path_t track_path;
        track_path.points = state->track_points;
        track_path.count = state->track_count;
        track_path.total_distance = 0;

        /* Calculate total distance for display */
        for (uint32_t i = 0; i < state->track_count - 1; i++)
        {
            track_path.total_distance += nav_calculate_distance(
                                             state->track_points[i].lat, state->track_points[i].lon,
                                             state->track_points[i + 1].lat, state->track_points[i + 1].lon);
        }

        render_style_t track_style =
        {
            .path_color = 0xFF5722FF,     /* Deep Orange for track */
            .path_width = 5.0f,
            .start_color = 0x4CAF50FF,    /* Green for start */
            .end_color = 0x2196F3FF,      /* Blue for current position */
            .point_radius = 8.0f,
            .background_color = 0xFFFFFFFF,
            .min_segment_length = 1.0f
        };
        render_path(r, &track_path, &track_style);
    }
    MAP_PRINTF("track3\n");
    /* Draw start point marker (green) */
    if (state->has_start)
    {
        float start_x, start_y;
        renderer_coord_to_screen(r, state->start_lat, state->start_lon, &start_x, &start_y);
#ifdef USE_TRVG
        trvg_fast_gps_marker(&r->trvg, (int)start_x, (int)start_y, 30, 0x4C, 0xAF, 0x50);  /* Green */
#else
        render_text(r, start_x - 8, start_y - 12, "S", 24.0f, 0x4CAF50FF);
#endif
    }

    /* Draw current GPS position marker (red) */
    float screen_x, screen_y;
    renderer_coord_to_screen(r, gps->lat, gps->lon, &screen_x, &screen_y);

#ifdef USE_TRVG
    trvg_fast_gps_marker_with_heading(&r->trvg,
                                      (int)screen_x, (int)screen_y, 40,
                                      gps->heading,
                                      0xEA, 0x43, 0x35);  /* Google Maps red */
#else
    render_text(r, screen_x - 8, screen_y - 12, "O", 28.0f, 0xEA4335FF);
#endif    /* Render title overlay */
    MAP_PRINTF("track4\n");
    char info[256];
    snprintf(info, sizeof(info), "GPS Track Mode");
    render_text(r, 50.0f, 20.0f, info, 28.0f, 0xFF5722FF);  /* Deep Orange title */

    /* Track info line (main info line 1) */
    float track_distance = 0;
    if (state->track_count >= 2)
    {
        for (uint32_t i = 0; i < state->track_count - 1; i++)
        {
            track_distance += nav_calculate_distance(
                                  state->track_points[i].lat, state->track_points[i].lon,
                                  state->track_points[i + 1].lat, state->track_points[i + 1].lon);
        }
    }
    snprintf(info, sizeof(info), "Track: %u points | Distance: %.2f km | Radius: %.0f m",
             state->track_count, (double)(track_distance / 1000.0f), (double)state->current_radius);
    render_text(r, 10.0f, 55.0f, info, 18.0f, 0x333333FF);    /* GPS info line (main info line 2) */
    snprintf(info, sizeof(info), "GPS: %.6f, %.6f | Heading: %.0f° | Speed: %.1f km/h",
             (double)gps->lat, (double)gps->lon, (double)gps->heading, (double)(gps->speed * 3.6f));
    render_text(r, 10.0f, 80.0f, info, 16.0f, 0x666666FF);

    /* Frame info (auxiliary info) */
    snprintf(info, sizeof(info), "Frame: %d | Accuracy: %.1f m%s",
             state->frame_count, (double)gps->accuracy,             state->manual_view ? " | [Manual View]" : "");
    render_text(r, 10.0f, 105.0f, info, 14.0f, 0x999999FF);    /* Controls help */
#ifdef _WIN32
    snprintf(info, sizeof(info), "[Z/X] Zoom | [WASD] Pan | [0] Reset | [P] Replay | [Q] Quit");
    render_text(r, 50.0f, state->config.height - 25.0f, info, 14.0f, 0x666666FF);
#else
    snprintf(info, sizeof(info), "[KEY1-] [MFB+] Zoom | Tap Reset | [KEY3] Mode | Slide Pan");
    /* Center the text: screen_width / 2 - text_width / 2, estimate ~7 pixels per char at size 14 */
    float text_x = (state->config.width - strlen(info) * 5.0f) / 2.0f;
    render_text(r, text_x, state->config.height - 25.0f, info, 14.0f, 0x666666FF);
#endif

    /* Save frame */
    char filename[256];
    snprintf(filename, sizeof(filename), "frames/screen.png");
    render_save_png(r, filename);
    MAP_PRINTF("track5\n");
    state->frame_count++;

    return 0;
}

/**
 * @brief Initialize GPS track mode
 */
static int gps_track_init(gps_track_state_t *state, map_t *map, app_config_t *config)
{
    memset(state, 0, sizeof(gps_track_state_t));
    state->map = map;
    state->config = *config;

    /* Create renderer */
    state->renderer = renderer_create(config->width, config->height);
    if (!state->renderer)
    {
        MAP_FPRINTF("Error: Failed to create renderer\n");
        return 1;
    }

    /* Allocate track points array */
    state->track_capacity = GPS_TRACK_MAX_POINTS;
    state->track_points = (coord_t *)MAP_MALLOC(sizeof(coord_t) * state->track_capacity);
    if (!state->track_points)
    {
        MAP_FPRINTF("Error: Failed to allocate track points array\n");
        renderer_destroy(state->renderer);
        return 1;
    }
    state->track_count = 0;
    /* Initialize viewport settings */
    state->initial_radius = config->gps_view_radius;
    state->current_radius = config->gps_view_radius;
    state->has_start = 0;
    /* Initialize replay settings */
    state->replay_mode = 0;
    state->replay_paused = 0;
    state->replay_index = 0;
    state->replay_speed = 1;    /* Initialize manual viewport controls */
    state->manual_view = 0;
    state->manual_zoom = 1.0f;
    state->pan_offset_lat = 0.0f;
    state->pan_offset_lon = 0.0f;

#if !defined(_WIN32) || defined(USE_HONEY_GUI)
    /* Initialize touch pan control */
    state->touch_active = 0;
    state->touch_start_x = 0;
    state->touch_start_y = 0;
    state->touch_last_x = 0;
    state->touch_last_y = 0;
    /* Initialize double-tap detection */
    state->last_tap_time = 0;
    state->last_tap_x = 0;
    state->last_tap_y = 0;
#endif

    /* Initialize GPS Provider */
    gps_provider_config_t gps_prov_config;
    gps_provider_config_init(&gps_prov_config);
    gps_prov_config.type = config->gps_type;
    MAP_PRINTF("\n📍 GPS Track Mode\n");
    MAP_PRINTF("   GPS source: %s\n", gps_provider_type_str(config->gps_type));
    MAP_PRINTF("   Initial view radius: %.0f m\n", (double)config->gps_view_radius);
    MAP_PRINTF("   Max track points: %u\n", state->track_capacity);

    if (config->gps_type == GPS_PROVIDER_SIMULATOR)
    {
        gps_prov_config.sim_config.simulation_speed = 30.0f;
        gps_prov_config.sim_config.jitter_mode = GPS_JITTER_NORMAL;
        gps_prov_config.sim_config.jitter_amount_m = 3.0f;
    }
    else if (config->gps_type == GPS_PROVIDER_SERIAL)
    {
        gps_prov_config.serial_port = config->gps_serial_port;
        gps_prov_config.baudrate = config->gps_baudrate;
        MAP_PRINTF("   Port: %s @ %u baud\n", config->gps_serial_port, config->gps_baudrate);
    }

    /* Use dummy end point for GPS provider (track mode doesn't need navigation) */
    float end_lat = config->start_lat + 0.01f;
    float end_lon = config->start_lon + 0.01f;

    state->gps_provider = gps_provider_create(&gps_prov_config, map,
                          config->start_lat, config->start_lon,
                          end_lat, end_lon,
                          config->transport_mode);
    if (!state->gps_provider)
    {
        MAP_FPRINTF("Error: Failed to initialize GPS provider\n");
        MAP_FREE(state->track_points);
        renderer_destroy(state->renderer);
        return 1;
    }

    MAP_PRINTF("✓ GPS track mode initialized\n");

#if !defined(_WIN32) || defined(USE_HONEY_GUI)
    /* Initialize MCU GPIO keys */
    mcu_gpio_keys_init();
#endif

    return 0;
}

/**
 * @brief Run one iteration of the GPS track mode loop
 * @return 0=continue, 1=quit, 2=mode switch requested
 */
static int gps_track_loop(gps_track_state_t *state)
{
    const float delta_time = 0.5f;
    static uint32_t no_fix_log_counter = 0;

    /* Handle keyboard input */
    int kb_result = gps_track_handle_keyboard(state);
    if (kb_result == 1)
    {
        return 1;  /* User requested quit */
    }
    else if (kb_result == 2)
    {
        return 2;  /* Mode switch requested */
    }

    /* Replay mode */
    if (state->replay_mode)
    {
        if (!state->replay_paused)
        {
            /* Advance replay position based on speed */
            for (int i = 0; i < state->replay_speed && state->replay_index < state->track_count - 1; i++)
            {
                state->replay_index++;
            }

            /* Check if replay finished */
            if (state->replay_index >= state->track_count - 1)
            {
                state->replay_index = state->track_count - 1;
                state->replay_paused = 1;
                MAP_PRINTF("⏹️  Replay finished\n");
            }
        }

        /* Render replay frame */
        render_gps_track_replay_frame(state, state->replay_index);
        state->frame_count++;

        return 0;
    }

    /* Recording mode - Update GPS provider */
    (void)gps_provider_update(state->gps_provider, delta_time);
    const gps_position_t *gps = gps_provider_get_position(state->gps_provider);

    if (gps && gps->valid)
    {
        /* Record start point on first valid fix */        if (!state->has_start)
        {
            state->start_lat = gps->lat;
            state->start_lon = gps->lon;
            state->has_start = 1;
            MAP_PRINTF("📍 Starting point recorded: %.6f, %.6f\n", (double)gps->lat, (double)gps->lon);
        }

        MAP_PRINTF("[Frame %d] GPS: %.6f, %.6f | Track: %u pts | Radius: %.0f m\n",
                   state->frame_count, (double)gps->lat, (double)gps->lon,
                   state->track_count, (double)state->current_radius);
        no_fix_log_counter = 0;

        /* Render frame */
        render_gps_track_frame(state);
    }
    else
    {
        no_fix_log_counter++;
        if (no_fix_log_counter == 1 || no_fix_log_counter % 20 == 0)
        {
            MAP_PRINTF("⚠️  GPS: Waiting for fix signal...\n");
        }
    }

    /* Check frame limit */
    if (state->config.max_frames > 0 && state->frame_count >= state->config.max_frames)
    {
        MAP_PRINTF("\n⏹️  Maximum frame limit reached (%d)\n", state->config.max_frames);
        return 1;
    }

    return 0;
}

/**
 * @brief Cleanup GPS track mode resources
 */
static void gps_track_cleanup(gps_track_state_t *state)
{
    /* Calculate and display final statistics */
    float total_distance = 0;
    if (state->track_count >= 2)
    {
        for (uint32_t i = 0; i < state->track_count - 1; i++)
        {
            total_distance += nav_calculate_distance(
                                  state->track_points[i].lat, state->track_points[i].lon,
                                  state->track_points[i + 1].lat, state->track_points[i + 1].lon);
        }
    }
    MAP_PRINTF("\n📊 Track Statistics:\n");
    MAP_PRINTF("   Total frames: %d\n", state->frame_count);
    MAP_PRINTF("   Track points: %u\n", state->track_count);
    MAP_PRINTF("   Total distance: %.2f km\n", (double)(total_distance / 1000.0f));

    if (state->gps_provider)
    {
        gps_provider_destroy(state->gps_provider);
        state->gps_provider = NULL;
    }

    if (state->track_points)
    {
        MAP_FREE(state->track_points);
        state->track_points = NULL;
    }

    if (state->renderer)
    {
        renderer_destroy(state->renderer);
        state->renderer = NULL;
    }
}

/* ============================================================================
 * GPS Initialization Mode Functions
 * ============================================================================
 */

/* Required GPS valid count before switching to Track Record mode */
#define GPS_INIT_VALID_COUNT_THRESHOLD  3

/**
 * @brief Initialize GPS init mode
 * @param state GPS init state
 * @param map Map data
 * @param config Application configuration
 * @return 0 on success, non-zero on failure
 */
static int gps_init_init(gps_init_state_t *state, map_t *map, app_config_t *config)
{
    memset(state, 0, sizeof(gps_init_state_t));
    state->map = map;
    state->config = *config;

    /* Create renderer */
    state->renderer = renderer_create(config->width, config->height);
    if (!state->renderer)
    {
        MAP_FPRINTF("Error: Failed to create renderer for GPS init mode\n");
        return 1;
    }

    /* Initialize GPS Provider */
    gps_provider_config_t gps_prov_config;
    gps_provider_config_init(&gps_prov_config);
    gps_prov_config.type = config->gps_type;

    MAP_PRINTF("\n📡 GPS Initialization Mode\n");
    MAP_PRINTF("   GPS source: %s\n", gps_provider_type_str(config->gps_type));

    if (config->gps_type == GPS_PROVIDER_SIMULATOR)
    {
        gps_prov_config.sim_config.simulation_speed = 30.0f;
        gps_prov_config.sim_config.jitter_mode = GPS_JITTER_NORMAL;
        gps_prov_config.sim_config.jitter_amount_m = 3.0f;
    }
    else if (config->gps_type == GPS_PROVIDER_SERIAL)
    {
        gps_prov_config.serial_port = config->gps_serial_port;
        gps_prov_config.baudrate = config->gps_baudrate;
        MAP_PRINTF("   Port: %s @ %u baud\n", config->gps_serial_port, config->gps_baudrate);
    }

    /* Use dummy end point for GPS provider */
    float end_lat = config->start_lat + 0.01f;
    float end_lon = config->start_lon + 0.01f;

    state->gps_provider = gps_provider_create(&gps_prov_config, map,
                          config->start_lat, config->start_lon,
                          end_lat, end_lon,
                          config->transport_mode);
    if (!state->gps_provider)
    {
        MAP_FPRINTF("Error: Failed to initialize GPS provider\n");
        renderer_destroy(state->renderer);
        return 1;
    }

    state->init_start_time = 0;  /* Will be set on first frame */
    state->gps_valid_count = 0;

    MAP_PRINTF("✓ GPS init mode initialized - Waiting for GPS signal...\n");

#if !defined(_WIN32) || defined(USE_HONEY_GUI)
    /* Initialize MCU GPIO keys */
    mcu_gpio_keys_init();
#endif

    return 0;
}

/**
 * @brief Render GPS initialization status screen
 * @param state GPS init state
 * @return 0 on continue, 1 on quit, 2 on mode switch
 */
static int render_gps_init_frame(gps_init_state_t *state)
{
    renderer_t *r = state->renderer;
    char info[256];

    /* Clear canvas with light gray background */
    renderer_clear(r, 0xF0F0F0FF);

    /* Title */
    snprintf(info, sizeof(info), "GPS Initializing...");
    /* Center the title */
    float title_width = strlen(info) * 14.0f;  /* Approximate width at size 28 */
    float title_x = (state->config.width - title_width) / 2.0f;
    render_text(r, title_x, 60.0f, info, 28.0f, 0x333333FF);

    /* Get GPS data for status display */
    const gps_position_t *gps = gps_provider_get_position(state->gps_provider);
    
    /* Get detailed GPS data for satellite info */
    uint8_t satellites_used = 0;
    uint8_t satellites_view = 0;
    const char *fix_status = "No Fix";
    
    if (state->config.gps_type == GPS_PROVIDER_SERIAL)
    {
        gps_driver_t *driver = gps_provider_get_driver(state->gps_provider);
        if (driver)
        {
            const gps_driver_data_t *data = gps_driver_get_data(driver);
            if (data)
            {
                satellites_used = data->satellites_used;
                satellites_view = data->satellites_view;
                fix_status = gps_driver_fix_quality_str(data->fix_quality);
            }
        }
    }
    else
    {
        /* Simulator mode - fake satellite data */
        if (gps && gps->valid)
        {
            satellites_used = 8;
            satellites_view = 12;
            fix_status = "GPS Fix";
        }
    }

    /* GPS Status section */
    float y_offset = 120.0f;
    float line_height = 35.0f;

    /* Status indicator with color */
    uint32_t status_color = (gps && gps->valid) ? 0x4CAF50FF : 0xFF9800FF;  /* Green or Orange */
    snprintf(info, sizeof(info), "Status: %s", fix_status);
    render_text(r, 40.0f, y_offset, info, 22.0f, status_color);
    y_offset += line_height;

    /* Satellites info */
    snprintf(info, sizeof(info), "Satellites: %d used / %d in view", satellites_used, satellites_view);
    render_text(r, 40.0f, y_offset, info, 20.0f, 0x666666FF);
    y_offset += line_height;

    /* Signal quality indicator (visual bar) */
    snprintf(info, sizeof(info), "Signal Quality:");
    render_text(r, 40.0f, y_offset, info, 20.0f, 0x666666FF);
    
    /* Draw signal bars */
    int bar_count = satellites_used > 0 ? (satellites_used > 8 ? 5 : (satellites_used / 2 + 1)) : 0;
    for (int i = 0; i < 5; i++)
    {
        uint32_t bar_color = (i < bar_count) ? 0x4CAF50FF : 0xCCCCCCFF;
        float bar_x = 200.0f + i * 25.0f;
        float bar_height = 10.0f + i * 5.0f;
        float bar_y = y_offset + 25.0f - bar_height;
        /* Draw bar as text rectangle (simplified) */
        char bar_char = (i < bar_count) ? '|' : '.';
        char bar_str[2] = {bar_char, '\0'};
        render_text(r, bar_x, bar_y, bar_str, bar_height + 10.0f, bar_color);
    }
    y_offset += line_height + 10.0f;

    /* Position info if available */
    if (gps && gps->valid)
    {
        snprintf(info, sizeof(info), "Position: %.6f, %.6f", (double)gps->lat, (double)gps->lon);
        render_text(r, 40.0f, y_offset, info, 18.0f, 0x666666FF);
        y_offset += line_height;

        snprintf(info, sizeof(info), "Accuracy: %.1f m", (double)gps->accuracy);
        render_text(r, 40.0f, y_offset, info, 18.0f, 0x666666FF);
        y_offset += line_height;
    }
    else
    {
        snprintf(info, sizeof(info), "Searching for satellites...");
        render_text(r, 40.0f, y_offset, info, 18.0f, 0x999999FF);
        y_offset += line_height;
    }

    /* Waiting message */
    y_offset += 20.0f;
    if (gps && gps->valid)
    {
        snprintf(info, sizeof(info), "GPS signal acquired! Switching to Track mode...");
        render_text(r, 40.0f, y_offset, info, 18.0f, 0x4CAF50FF);
    }
    else
    {
        snprintf(info, sizeof(info), "Please wait for GPS signal...");
        render_text(r, 40.0f, y_offset, info, 18.0f, 0xFF9800FF);
    }

    /* Frame counter at bottom */
    snprintf(info, sizeof(info), "Frame: %d", state->frame_count);
    render_text(r, 10.0f, state->config.height - 30.0f, info, 14.0f, 0x999999FF);

    /* Save frame */
    char filename[256];
    snprintf(filename, sizeof(filename), "frames/screen.png");
    render_save_png(r, filename);

    state->frame_count++;
    return 0;
}

/**
 * @brief Handle keyboard input for GPS init mode
 * @param state GPS init state
 * @return 0=continue, 1=quit, 2=mode switch
 */
#ifdef USE_HONEY_GUI
static int gps_init_handle_keyboard_honey(gps_init_state_t *state)
{
    touch_info_t *tp = tp_get_info();

    (void)state;
    (void)tp;

    if (trmap_honey_gui_consume_key_press("Menu"))
    {
        MAP_PRINTF("Menu: Switch application mode");
        (void)trmap_request_next_mode_switch();
        return 2;
    }

    return 0;
}
#elif defined (_WIN32)
static int gps_init_handle_keyboard_pc(gps_init_state_t *state)
{
    (void)state;

    if (!_kbhit())
    {
        return 0;
    }

    int ch = _getch();

    /* Handle arrow keys (they come as 0 or 0xE0 followed by actual code) */
    if (ch == 0 || ch == 0xE0)
    {
        _getch();  /* Consume the second byte */
        return 0;
    }

    switch (ch)
    {
        case 'm':
        case 'M':  /* M - cycle to next application mode */
            (void)trmap_request_next_mode_switch();
            return 2;

        case '1':  /* 1 - switch to GPS Init mode (stay) */
            return 0;

        case '2':  /* 2 - switch to Track Record mode */
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_GPS_TRACK_RECORD);
            return 2;

        case '3':  /* 3 - switch to GPS Map mode */
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_GPS_MAP);
            return 2;

        case '4':  /* 4 - switch to Navigation mode */
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_NAVIGATION);
            return 2;

        case 'q':
        case 'Q':  /* Q - quit */
        case 27:   /* ESC */
            MAP_PRINTF("Exiting...\n");
            return 1;
    }
    return 0;
}

#else
static int gps_init_handle_keyboard_mcu(gps_init_state_t *state)
{
    (void)state;

    /* MCU GPIO Key Handling for GPS Init Mode */

    /* KEY3 (P3_1): Cycle to next application mode */
    if (g_key3_pressed)
    {
        g_key3_pressed = 0;
        MAP_PRINTF("KEY3: Switch application mode");
        (void)trmap_request_next_mode_switch();
        return 2;
    }
    return 0;
}
#endif

static int gps_init_handle_keyboard(gps_init_state_t *state)
{
#ifdef USE_HONEY_GUI
    return gps_init_handle_keyboard_honey(state);
#elif defined (_WIN32)
    return gps_init_handle_keyboard_pc(state);

#else
    return gps_init_handle_keyboard_mcu(state);
#endif
}

/**
 * @brief Run one iteration of GPS init mode loop
 * @param state GPS init state
 * @return 0=continue, 1=quit, 2=mode switch requested
 */
static int gps_init_loop(gps_init_state_t *state)
{
    const float delta_time = 0.5f;

    /* Handle keyboard input */
    int kb_result = gps_init_handle_keyboard(state);
    if (kb_result != 0)
    {
        return kb_result;
    }

    /* Update GPS provider */
    gps_provider_update(state->gps_provider, delta_time);
    const gps_position_t *gps = gps_provider_get_position(state->gps_provider);

    /* Check if GPS is valid */
    if (gps && gps->valid)
    {
        state->gps_valid_count++;
        MAP_PRINTF("GPS Valid! Count: %d/%d\n", state->gps_valid_count, GPS_INIT_VALID_COUNT_THRESHOLD);

        /* After enough consecutive valid readings, switch to Track Record mode */
        if (state->gps_valid_count >= GPS_INIT_VALID_COUNT_THRESHOLD)
        {
            MAP_PRINTF("\n✓ GPS signal acquired! Switching to Track Record mode...\n");
            app_request_mode_switch(APP_MODE_GPS_INIT, APP_MODE_GPS_TRACK_RECORD);
            return 2;
        }
    }
    else
    {
        state->gps_valid_count = 0;  /* Reset counter if signal lost */
    }

    /* Render the init screen */
    render_gps_init_frame(state);

    return 0;
}

/**
 * @brief Cleanup GPS init mode resources
 * @param state GPS init state
 */
static void gps_init_cleanup(gps_init_state_t *state)
{
    MAP_PRINTF("Cleaning up GPS init mode...\n");

    if (state->gps_provider)
    {
        gps_provider_destroy(state->gps_provider);
        state->gps_provider = NULL;
    }

    if (state->renderer)
    {
        renderer_destroy(state->renderer);
        state->renderer = NULL;
    }
}

/* ============================================================================
 * Map View Mode Functions
 * ============================================================================
 */

/**
 * @brief Initialize Map View mode
 * @param state Map view state (must be zero-initialized by caller)
 * @param map Map data
 * @param config Application configuration
 * @return 0 on success, non-zero on failure
 */
static int map_view_init(map_view_state_t *state, map_t *map, app_config_t *config)
{
    memset(state, 0, sizeof(map_view_state_t));
    state->map = map;
    state->config = *config;

    /* Calculate map center point from map bounds */
    float map_center_lat = (map->header.min_lat + map->header.max_lat) / 2.0f;
    float map_center_lon = (map->header.min_lon + map->header.max_lon) / 2.0f;

    /* Calculate map radius (approximate, using latitude span) */
    float lat_span = map->header.max_lat - map->header.min_lat;
    float lon_span = map->header.max_lon - map->header.min_lon;
    /* Convert degrees to meters (approximately 111km per degree latitude) */
    float lat_radius_m = (lat_span / 2.0f) * 111000.0f;
    float lon_radius_m = (lon_span / 2.0f) * 111000.0f * cosf(map_center_lat * 3.14159265f / 180.0f);
    float map_radius_m = (lat_radius_m > lon_radius_m) ? lat_radius_m : lon_radius_m;

    /* Initialize view position to map center */
    state->view_lat = map_center_lat;
    state->view_lon = map_center_lon;
    /* Set view radius to 1/4 of map radius */
    state->config.gps_view_radius = map_radius_m / 4.0f;
    state->zoom_factor = 1.0f;
    state->needs_redraw = 1;

#if !defined(_WIN32) || defined(USE_HONEY_GUI)
    /* Initialize touch pan control */
    state->touch_active = 0;
    state->touch_start_x = 0;
    state->touch_start_y = 0;
    state->touch_last_x = 0;
    state->touch_last_y = 0;
    state->pan_offset_lat = 0.0f;
    state->pan_offset_lon = 0.0f;
    /* Initialize double-tap detection */
    state->last_tap_time = 0;
    state->last_tap_x = 0;
    state->last_tap_y = 0;
#endif

    /* Create renderer */
    state->renderer = renderer_create(config->width, config->height);
    if (!state->renderer)
    {
        MAP_FPRINTF("Error: Failed to create renderer for Map View mode\n");
        return 1;
    }

    MAP_PRINTF("\n🗺️  Map View Mode\n");
    MAP_PRINTF("   View center: %.6f, %.6f\n", (double)state->view_lat, (double)state->view_lon);
    MAP_PRINTF("   View radius: %.0f m\n", (double)config->gps_view_radius);
    MAP_PRINTF("   Controls: [WASD]/Arrow pan | [Z/X] zoom (also +/-) | [0] reset | [M] mode | [1/2/3/4] switch | [Q] quit\n");
    MAP_PRINTF("✓ Map View mode initialized\n");

#if !defined(_WIN32) || defined(USE_HONEY_GUI)
    /* Initialize MCU GPIO keys */
    mcu_gpio_keys_init();
#endif

    return 0;
}

/**
 * @brief Render Map View frame
 * @param state Map view state
 * @return 0 on success
 */
static int render_map_view_frame(map_view_state_t *state)
{
    renderer_t *r = state->renderer;

    /* Clear canvas */
    renderer_clear(r, 0xFFFFFFFF);

    /* Set viewport centered on view position */
    float effective_radius = state->config.gps_view_radius * state->zoom_factor;

    /* Calculate view center including any active pan offset */
    float view_center_lat = state->view_lat;
    float view_center_lon = state->view_lon;
#if !defined(_WIN32) || defined(USE_HONEY_GUI)
    /* Apply touch pan offset during drag */
    view_center_lat += state->pan_offset_lat;
    view_center_lon += state->pan_offset_lon;
#endif
    set_viewport_around_point(r, view_center_lat, view_center_lon, effective_radius);

    /* Render map with theme */
    map_theme_t theme = MAP_THEME_GOOGLE;
    render_options_t opts;
    setup_render_options(&opts, r);
    render_map_with_options(r, state->map, &theme, &opts);

    /* Draw mode indicator and zoom info */
    char info[128];
    snprintf(info, sizeof(info), "Map View | Zoom: %.0f%%", (double)(100.0f / state->zoom_factor));
    render_text(r, 10.0f, 10.0f, info, 16.0f, 0x333333FF);

    /* Draw crosshair at center */
    float center_x = state->config.width / 2.0f;
    float center_y = state->config.height / 2.0f;
    render_text(r, center_x - 5, center_y - 10, "+", 20.0f, 0x666666FF);

    /* Controls help */
#ifdef _WIN32
    snprintf(info, sizeof(info), "[WASD/Arrows] Pan | [Z/X] Zoom | [0] Reset | [M] Mode | [1/2/3/4] Switch | [Q] Quit");
    render_text(r, 10.0f, state->config.height - 25.0f, info, 14.0f, 0x666666FF);
#else
    snprintf(info, sizeof(info), "[KEY1-] Zoom Out | [KEY2+] Zoom In | Tap Reset | [KEY3] Mode | Slide Pan");
    {
        float text_x = (state->config.width - strlen(info) * 5.0f) / 2.0f;
        render_text(r, text_x, state->config.height - 25.0f, info, 14.0f, 0x666666FF);
    }
#endif

    /* Save frame */
    char filename[256];
    snprintf(filename, sizeof(filename), "frames/screen.png");
    render_save_png(r, filename);

    state->needs_redraw = 0;
    state->frame_count++;

    return 0;
}

/**
 * @brief Handle keyboard input for Map View mode
 * @param state Map view state
 * @return 0=continue, 1=quit, 2=mode switch
 */
#ifdef USE_HONEY_GUI
static int map_view_handle_keyboard_honey(map_view_state_t *state)
{
    touch_info_t *tp = tp_get_info();

    if (trmap_honey_gui_consume_key_press("Home"))
    {
        (void)trmap_map_control_zoom_out();
        MAP_PRINTF("Home: Zoom out - %.0f%%\n", (double)(100.0f / state->zoom_factor));
    }

    if (trmap_honey_gui_consume_key_press("Back"))
    {
        (void)trmap_map_control_zoom_in();
        MAP_PRINTF("Back: Zoom in - %.0f%%\n", (double)(100.0f / state->zoom_factor));
    }

    if (trmap_honey_gui_consume_key_press("Menu"))
    {
        MAP_PRINTF("Menu: Switch application mode\n");
        (void)trmap_request_next_mode_switch();
        return 2;
    }

    if (trmap_honey_gui_consume_key_press("Power"))
    {
        (void)trmap_map_control_reset();
        MAP_PRINTF("Power: Map View reset: %.6f, %.6f | Zoom: 100%%\n",
                   (double)state->view_lat, (double)state->view_lon);
    }

    if (trmap_honey_gui_touch_active(tp))
    {
        if (!state->touch_active || tp->pressed)
        {
            state->touch_active = 1;
            state->touch_start_x = tp->x;
            state->touch_start_y = tp->y;
            state->touch_last_x = tp->deltaX;
            state->touch_last_y = tp->deltaY;
        }
        else
        {
            int16_t dx = tp->deltaX - state->touch_last_x;
            int16_t dy = tp->deltaY - state->touch_last_y;

            if (dx != 0 || dy != 0)
            {
                float effective_radius = state->config.gps_view_radius * state->zoom_factor;
                float meters_per_pixel_lat = (2.0f * effective_radius) / state->config.height;
                float meters_per_pixel_lon = (2.0f * effective_radius) / state->config.width;
                float current_lat = state->view_lat + state->pan_offset_lat;
                float lat_deg_per_meter = 1.0f / 111000.0f;
                float lon_deg_per_meter = 1.0f / (111000.0f * cosf(current_lat * 3.14159265f / 180.0f));

                (void)trmap_map_control_pan_delta(
                    dy * meters_per_pixel_lat * lat_deg_per_meter,
                    -dx * meters_per_pixel_lon * lon_deg_per_meter);

                state->touch_last_x = tp->deltaX;
                state->touch_last_y = tp->deltaY;
            }
        }
    }
    else if (trmap_honey_gui_touch_released(tp) && state->touch_active)
    {
        int16_t dist_x;
        int16_t dist_y;
        uint32_t distance_sq;

        state->touch_active = 0;
        dist_x = tp->deltaX;
        dist_y = tp->deltaY;
        distance_sq = (uint32_t)(dist_x * dist_x + dist_y * dist_y);

        if (distance_sq < (TOUCH_DOUBLE_TAP_DISTANCE * TOUCH_DOUBLE_TAP_DISTANCE))
        {
            (void)trmap_map_control_reset();
            MAP_PRINTF("Tap: Reset map view\n");
        }
        else
        {
            (void)trmap_map_control_pan_finish();
            MAP_PRINTF("Touch pan end: center %.6f, %.6f\n",
                       (double)state->view_lat, (double)state->view_lon);
        }
    }

    return 0;
}
#elif defined (_WIN32)
static int map_view_handle_keyboard_pc(map_view_state_t *state)
{
    /* PC Keyboard Controls */
    if (!_kbhit())
    {
        return 0;
    }

    int ch = _getch();

    /* Handle arrow keys (they come as 0 or 0xE0 followed by actual code) */
    if (ch == 0 || ch == 0xE0)
    {
        ch = _getch();
        switch (ch)
        {
            case 72:  /* Up arrow */
                (void)trmap_map_control_pan_north();
                break;
            case 80:  /* Down arrow */
                (void)trmap_map_control_pan_south();
                break;
            case 75:  /* Left arrow */
                (void)trmap_map_control_pan_west();
                break;
            case 77:  /* Right arrow */
                (void)trmap_map_control_pan_east();
                break;
        }
        return 0;
    }

    switch (ch)
    {
        case 'w':
        case 'W':
            (void)trmap_map_control_pan_north();
            break;

        case 's':
        case 'S':
            (void)trmap_map_control_pan_south();
            break;

        case 'a':
        case 'A':
            (void)trmap_map_control_pan_west();
            break;

        case 'd':
        case 'D':
            (void)trmap_map_control_pan_east();
            break;

        case 'z':
        case 'Z':
        case '+':
        case '=':
            (void)trmap_map_control_zoom_in();
            MAP_PRINTF("Zoom: %.0f%%\n", (double)(100.0f / state->zoom_factor));
            break;

        case 'x':
        case 'X':
        case '-':
        case '_':
            (void)trmap_map_control_zoom_out();
            MAP_PRINTF("Zoom: %.0f%%\n", (double)(100.0f / state->zoom_factor));
            break;

        case '0':
            (void)trmap_map_control_reset();
            MAP_PRINTF("Map View reset: %.6f, %.6f | Zoom: 100%%\n",
                       (double)state->view_lat, (double)state->view_lon);
            break;

        case 'm':
        case 'M':  /* M - cycle to next mode */
            (void)trmap_request_next_mode_switch();
            return 2;

        case '1':  /* 1 - switch to GPS Init mode */
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_GPS_INIT);
            return 2;

        case '2':  /* 2 - switch to GPS Track mode */
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_GPS_TRACK_RECORD);
            return 2;

        case '3':  /* 3 - switch to Nav Setup mode */
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_GPS_MAP);
            return 2;

        case '4':  /* 4 - switch to Navigation mode */
            (void)trmap_request_mode_switch(TRMAP_APP_MODE_NAVIGATION);
            return 2;

        case 'q':
        case 'Q':
        case 27:   /* ESC */
            MAP_PRINTF("Exiting...\n");
            return 1;
    }
    return 0;
}

#else
static int map_view_handle_keyboard_mcu(map_view_state_t *state)
{
    /* MCU GPIO Key Handling for Map View Mode */

    /* KEY1 (P3_0): Zoom out */
    if (g_key1_pressed)
    {
        g_key1_pressed = 0;
        (void)trmap_map_control_zoom_out();
        MAP_PRINTF("KEY1: Zoom out - %.0f%%\n", (double)(100.0f / state->zoom_factor));
    }

    /* KEY2 (ADC_0): Zoom in */
    if (g_key2_pressed)
    {
        g_key2_pressed = 0;
        (void)trmap_map_control_zoom_in();
        MAP_PRINTF("KEY2: Zoom in - %.0f%%\n", (double)(100.0f / state->zoom_factor));
    }

    /* KEY3 (P3_1): Cycle to next application mode */
    if (g_key3_pressed)
    {
        g_key3_pressed = 0;
        MAP_PRINTF("KEY3: Switch application mode\n");
        (void)trmap_request_next_mode_switch();
        return 2;
    }

    /* Touch screen pan handling */
    {
        TOUCH_DATA touch_data;
        uint32_t s = os_lock();
        touch_data = get_raw_touch_data();
        os_unlock(s);

        if (touch_data.is_press)
        {
            if (!state->touch_active)
            {
                state->touch_active = 1;
                state->touch_start_x = touch_data.x;
                state->touch_start_y = touch_data.y;
                state->touch_last_x = touch_data.x;
                state->touch_last_y = touch_data.y;
            }
            else
            {
                int16_t dx = (int16_t)touch_data.x - state->touch_last_x;
                int16_t dy = (int16_t)touch_data.y - state->touch_last_y;

                if (dx != 0 || dy != 0)
                {
                    float effective_radius = state->config.gps_view_radius * state->zoom_factor;
                    float meters_per_pixel_lat = (2.0f * effective_radius) / state->config.height;
                    float meters_per_pixel_lon = (2.0f * effective_radius) / state->config.width;
                    float current_lat = state->view_lat + state->pan_offset_lat;
                    float lat_deg_per_meter = 1.0f / 111000.0f;
                    float lon_deg_per_meter = 1.0f / (111000.0f * cosf(current_lat * 3.14159265f / 180.0f));

                    (void)trmap_map_control_pan_delta(
                        dy * meters_per_pixel_lat * lat_deg_per_meter,
                        -dx * meters_per_pixel_lon * lon_deg_per_meter);

                    state->touch_last_x = touch_data.x;
                    state->touch_last_y = touch_data.y;
                }
            }
        }
        else if (state->touch_active)
        {
            int16_t dist_x;
            int16_t dist_y;
            uint32_t distance_sq;

            state->touch_active = 0;
            dist_x = (int16_t)touch_data.x - state->touch_start_x;
            dist_y = (int16_t)touch_data.y - state->touch_start_y;
            distance_sq = (uint32_t)(dist_x * dist_x + dist_y * dist_y);

            if (distance_sq < (TOUCH_DOUBLE_TAP_DISTANCE * TOUCH_DOUBLE_TAP_DISTANCE))
            {
                (void)trmap_map_control_reset();
                MAP_PRINTF("Tap: Reset map view\n");
            }
            else
            {
                (void)trmap_map_control_pan_finish();
                MAP_PRINTF("Touch pan end: center %.6f, %.6f\n",
                           (double)state->view_lat, (double)state->view_lon);
            }
        }
    }
    return 0;
}
#endif

static int map_view_handle_keyboard(map_view_state_t *state)
{
#ifdef  USE_HONEY_GUI
    return map_view_handle_keyboard_honey(state);
#elif defined(_WIN32)
    return map_view_handle_keyboard_pc(state);

#else
    return map_view_handle_keyboard_mcu(state);
#endif
}

/**
 * @brief Run one iteration of Map View mode loop
 * @param state Map view state
 * @return 0=continue, 1=quit, 2=mode switch requested
 */
static int map_view_loop(map_view_state_t *state)
{
    /* Handle keyboard input */
    int kb_result = map_view_handle_keyboard(state);
    if (kb_result != 0)
    {
        return kb_result;
    }

    /* Render only when view changed */
    if (state->needs_redraw)
    {
        render_map_view_frame(state);
    }

    return 0;
}

/**
 * @brief Cleanup Map View mode resources
 * @param state Map view state
 */
static void map_view_cleanup(map_view_state_t *state)
{
    MAP_PRINTF("Cleaning up Map View mode...\n");

    if (state->renderer)
    {
        renderer_destroy(state->renderer);
        state->renderer = NULL;
    }
}

/**
 * @brief Run GPS init mode main loop
 * @param state GPS init state
 * @return 0 on normal exit, 1 on error, 2 on mode switch
 */
static int app_gps_init_run_loop(gps_init_state_t *state)
{
    int result = 0;

    /* Main GPS init loop */
    while (1)
    {
        int loop_result = gps_init_loop(state);
        if (loop_result != 0)
        {
            if (loop_result == 2)
            {
                return 2;  /* Signal mode switch to caller */
            }
            if (loop_result < 0)
            {
                result = 1;
            }
            break;
        }

        /* Check running flag */
        if (!state->running)
        {
            break;
        }

        sleep_ms(GPS_TRACK_UPDATE_INTERVAL_MS);
    }

    return result;
}

/**
 * @brief Run the Map View mode main loop (pure loop, no init/cleanup)
 * @param state Map view state (must be initialized)
 * @return 0 on normal exit, 1 on error, 2 on mode switch request
 */
static int app_map_view_run_loop(map_view_state_t *state)
{
    int result = 0;

    /* Main map view loop */
    while (1)
    {
        int loop_result = map_view_loop(state);
        if (loop_result != 0)
        {
            if (loop_result == 2)
            {
                return 2;  /* Signal mode switch to caller */
            }
            if (loop_result < 0)
            {
                result = 1;
            }
            break;
        }

        /* Check running flag */
        if (!state->running)
        {
            break;
        }

        sleep_ms(MAP_VIEW_UPDATE_INTERVAL_MS);
    }

    return result;
}

/* ============================================================================
 * Main Entry Point - Refactored Functions
 * ============================================================================
 */

/**
 * @brief Parse and validate command line arguments
 * @param config Output configuration structure (will be initialized)
 * @param argc Argument count
 * @param argv Argument values
 * @return 0 on success, 1 if help shown (exit normally), -1 on error
 */
static int parse_arguments(app_config_t *config, int argc, char *argv[])
{
    /* Initialize configuration with defaults */
    config_init(config);

    /* Parse command line arguments */
    int parse_result = config_parse_args(config, argc, argv);
    if (parse_result != 0)
    {
        return parse_result;  /* 1 for help, -1 for error */
    }

    return 0;
}

/**
 * @brief Initialize application resources
 * @param config Application configuration (will be updated with default coords if needed)
 * @param map_out Output pointer for loaded map
 * @param nav_app Output pointer for navigation app state (if nav mode)
 * @param gps_state Output pointer for GPS map state (if GPS map mode)
 * @param track_state Output pointer for GPS track state (if track mode)
 * @param init_state Output pointer for GPS init state (if init mode)
 * @return 0 on success, non-zero on failure
 */
static int app_initialize(app_config_t *config, map_t **map_out,
                          app_state_t *nav_app, gps_map_state_t *gps_state,
                          gps_track_state_t *track_state, gps_init_state_t *init_state,
                          map_view_state_t *view_state)
{
    MAP_PRINTF("=== TrMap Navigation Simulator ===\n\n");

    /* Initialize memory monitoring */
    memory_monitor_init();
    memory_monitor_print("Startup");

    /* Load map */
    MAP_PRINTF("Loading map: %s\n", config->map_file);
    map_t *map = map_load(config->map_file);
    if (!map)
    {
        MAP_FPRINTF("Error: Failed to load map\n");
        return 1;
    }
    memory_monitor_print("After Map Load");

    /* Set default coordinates from map if not specified by user */
    if (!config->has_start)
    {
        config->start_lat = map->nodes[0].lat;
        config->start_lon = map->nodes[0].lon;
        MAP_PRINTF("Using default start from map: %.6f, %.6f\n", (double)config->start_lat, (double)config->start_lon);
    }

    if (!config->has_end)
    {
        uint32_t last = map->header.node_count - 1;
        config->end_lat = map->nodes[last].lat;
        config->end_lon = map->nodes[last].lon;
        MAP_PRINTF("Using default end from map: %.6f, %.6f\n", (double)config->end_lat, (double)config->end_lon);
    }
    *map_out = map;    /* Initialize mode-specific state */
    if (config->app_mode == APP_MODE_MAP_VIEW)
    {
        /* Map View Mode */
        if (map_view_init(view_state, map, config) != 0)
        {
            map_free(map);
            *map_out = NULL;
            return 1;
        }
        /* Initialize loop state */
        view_state->running = 1;
        view_state->frame_count = 0;
        view_state->needs_redraw = 1;
    }
    else if (config->app_mode == APP_MODE_GPS_INIT)
    {
        /* GPS Initialization Mode */
        if (gps_init_init(init_state, map, config) != 0)
        {
            map_free(map);
            *map_out = NULL;
            return 1;
        }
        /* Initialize loop state */
        init_state->running = 1;
        init_state->frame_count = 0;
    }
    else if (config->app_mode == APP_MODE_GPS_MAP)
    {
        /* GPS Map Display Mode initialization */
        if (gps_map_init(gps_state, map, config) != 0)
        {
            map_free(map);
            *map_out = NULL;
            return 1;
        }
        /* Initialize loop state */
        gps_state->running = 1;
        gps_state->frame_count = 0;
    }
    else if (config->app_mode == APP_MODE_GPS_TRACK_RECORD || config->app_mode == APP_MODE_GPS_TRACK_REPLAY)
    {
        /* GPS Track Mode initialization */
        if (gps_track_init(track_state, map, config) != 0)
        {
            map_free(map);
            *map_out = NULL;
            return 1;
        }
        /* Set replay mode based on app_mode */
        track_state->replay_mode = (config->app_mode == APP_MODE_GPS_TRACK_REPLAY) ? 1 : 0;
        /* Initialize loop state */
        track_state->running = 1;
        track_state->frame_count = 0;
    }
    else
    {
        /* Navigation Mode initialization */
        if (nav_init(nav_app, map, config) != 0)
        {
            map_free(map);
            return 1;
        }
        /* Initialize loop state */
        nav_app->running = 1;
        nav_app->frame_count = 0;
        nav_app->needs_redraw = 1;
    }

    return 0;
}

/* Note: app_init_mode, app_cleanup_mode, and app_do_mode_switch are defined
 * after the global variables (map, config, nav_app, gps_state, gps_track_state)
 * because they need access to these globals.
 */

/**
 * @brief Run the navigation mode main loop (pure loop, no init/cleanup)
 * @param app Application state (must be initialized)
 * @return 0 on normal exit, 1 on error, 2 on mode switch request
 */
static int app_nav_run_loop(app_state_t *app)
{
    int result = 0;

    MAP_PRINTF("\n🚀 Starting continuous navigation mode...\n");
    MAP_PRINTF("   Max frames: %d (0=unlimited)\n", app->config.max_frames);
    MAP_PRINTF("   Map controls: [WASD/Arrows] pan | [Z/X] zoom | [0] reset\n");
    MAP_PRINTF("   Press [M] to cycle modes, [1/2/3] for direct switch\n");
    MAP_PRINTF("   Press Ctrl+C to stop\n\n");

    /* Main navigation loop */
    while (1)
    {
        int loop_result = nav_loop(app);
        if (loop_result != 0)
        {
            /* loop_result == 2: mode switch requested */
            if (loop_result == 2)
            {
                return 2;  /* Signal mode switch to caller */
            }
            /* loop_result == 1: completed, loop_result < 0: error */
            if (loop_result < 0)
            {
                result = 1;
            }
            break;
        }

        /* Check running flag */
        if (!app->running)
        {
            break;
        }

        /* Wait for next navigation update */
        sleep_ms(NAV_UPDATE_INTERVAL_MS);
    }

    return result;
}

/**
 * @brief Run the GPS map display mode main loop (pure loop, no init/cleanup)
 * @param state GPS map state (must be initialized)
 * @return 0 on normal exit, 1 on error, 2 on mode switch request
 */
static int app_gps_map_run_loop(gps_map_state_t *state)
{
    int result = 0;
    MAP_PRINTF("\n🚀 Starting Navigation Setup mode...\n");
    MAP_PRINTF("   Max frames: %d (0=unlimited)\n", state->config.max_frames);
    MAP_PRINTF("   View radius: %.0f m\n", (double)state->config.gps_view_radius);
    MAP_PRINTF("   Map controls: [WASD/Arrows] move | [Z/X] zoom | [0] reset\n");
    MAP_PRINTF("   Press [Enter] to confirm and start navigation\n");
    MAP_PRINTF("   Press [M] to cycle modes, [Q] to quit\n\n");

    /* Main GPS map loop */
    while (1)
    {
        int loop_result = gps_map_loop(state);
        if (loop_result != 0)
        {
            /* loop_result == 2: mode switch requested */
            if (loop_result == 2)
            {
                return 2;  /* Signal mode switch to caller */
            }
            if (loop_result < 0)
            {
                result = 1;
            }
            break;
        }

        /* Check running flag */
        if (!state->running)
        {
            break;
        }

        sleep_ms(GPS_MAP_UPDATE_INTERVAL_MS);
    }

    return result;
}

/**
 * @brief Run the GPS track mode main loop (pure loop, no init/cleanup)
 * @param state GPS track state (must be initialized)
 * @return 0 on normal exit, 1 on error, 2 on mode switch request
 */
static int app_gps_track_run_loop(gps_track_state_t *state)
{
    int result = 0;
    MAP_PRINTF("\n🚀 Starting GPS track mode...\n");
    MAP_PRINTF("   Max frames: %d (0=unlimited)\n", state->config.max_frames);
    MAP_PRINTF("   Initial view radius: %.0f m\n", (double)state->initial_radius);
    MAP_PRINTF("   Max track points: %u\n", state->track_capacity);
    MAP_PRINTF("\n   Keyboard Controls:\n");
    MAP_PRINTF("   [P] Start replay | [R] Resume recording\n");
    MAP_PRINTF("   [SPACE] Pause/Resume | [←/→] Step | [↑/↓] Speed\n");
    MAP_PRINTF("   [WASD] Pan | [Z/X] Zoom | [0] Reset\n");
    MAP_PRINTF("   [+/-] Speed | [Q/ESC] Quit\n");
    MAP_PRINTF("   [M] Cycle mode | [1/2/3/4] Switch mode\n\n");

    /* Main GPS track loop */
    while (1)
    {
        int loop_result = gps_track_loop(state);
        if (loop_result != 0)
        {
            /* loop_result == 2: mode switch requested */
            if (loop_result == 2)
            {
                return 2;  /* Signal mode switch to caller */
            }
            if (loop_result < 0)
            {
                result = 1;
            }
            break;
        }

        /* Check running flag */
        if (!state->running)
        {
            break;
        }

        sleep_ms(GPS_TRACK_UPDATE_INTERVAL_MS);
    }

    return result;
}

/**
 * @brief Cleanup all resources and check for leaks
 * @param config Application configuration (to determine mode)
 * @param map Map to MAP_FREE (can be NULL)
 * @param nav_app Navigation app state (can be NULL)
 * @param gps_state GPS map state (can be NULL)
 * @param track_state GPS track state (can be NULL)
 * @param init_state GPS init state (can be NULL)
 */
static void app_cleanup(app_config_t *config, map_t *map,
                        app_state_t *nav_app, gps_map_state_t *gps_state,
                        gps_track_state_t *track_state, gps_init_state_t *init_state,
                        map_view_state_t *view_state)
{
    /* Cleanup mode-specific resources */
    if (config->app_mode == APP_MODE_MAP_VIEW)
    {
        if (view_state)
        {
            map_view_cleanup(view_state);
        }
    }
    else if (config->app_mode == APP_MODE_GPS_INIT)
    {
        if (init_state)
        {
            gps_init_cleanup(init_state);
        }
    }
    else if (config->app_mode == APP_MODE_GPS_MAP)
    {
        if (gps_state)
        {
            gps_map_cleanup(gps_state);
        }
    }
    else if (config->app_mode == APP_MODE_GPS_TRACK_RECORD || config->app_mode == APP_MODE_GPS_TRACK_REPLAY)
    {
        if (track_state)
        {
            gps_track_cleanup(track_state);
        }
    }
    else
    {
        if (nav_app)
        {
            nav_cleanup(nav_app);
        }
    }

    /* Cleanup map */
    if (map)
    {
        map_free(map);
    }
    memory_monitor_print("After Cleanup");

    /* Check for memory leaks */
    do_leak_check();

    MAP_PRINTF("\n=== Done ===\n");
}
static   map_t *map = NULL;
static    app_config_t config;
static    app_state_t nav_app = {0};
static    gps_map_state_t gps_state = {0};
static    gps_track_state_t gps_track_state = {0};
static    gps_init_state_t gps_init_state = {0};
static    map_view_state_t map_view_state = {0};

/* ============================================================================
 * Shared Map Control API
 * ============================================================================
 */

static void app_map_control_get_map_center(const map_t *map_data, float *lat, float *lon)
{
    if (!map_data || !lat || !lon)
    {
        return;
    }

    *lat = (map_data->header.min_lat + map_data->header.max_lat) / 2.0f;
    *lon = (map_data->header.min_lon + map_data->header.max_lon) / 2.0f;
}

static int trmap_map_control_pan_internal(trmap_map_control_pan_direction_t direction)
{
    switch (config.app_mode)
    {
        case APP_MODE_MAP_VIEW:
        {
            float pan_amount = 0.001f * map_view_state.zoom_factor;
            switch (direction)
            {
                case TRMAP_MAP_CONTROL_PAN_NORTH:
                    map_view_state.view_lat += pan_amount;
                    break;
                case TRMAP_MAP_CONTROL_PAN_SOUTH:
                    map_view_state.view_lat -= pan_amount;
                    break;
                case TRMAP_MAP_CONTROL_PAN_WEST:
                    map_view_state.view_lon -= pan_amount;
                    break;
                case TRMAP_MAP_CONTROL_PAN_EAST:
                    map_view_state.view_lon += pan_amount;
                    break;
            }
            map_view_state.needs_redraw = 1;
            return 1;
        }

        case APP_MODE_GPS_MAP:
        {
            float pan_step = NAV_SETUP_PAN_STEP * (gps_state.config.gps_view_radius / GPS_MAP_VIEW_RADIUS);
            switch (direction)
            {
                case TRMAP_MAP_CONTROL_PAN_NORTH:
                    gps_state.dest_lat += pan_step;
                    break;
                case TRMAP_MAP_CONTROL_PAN_SOUTH:
                    gps_state.dest_lat -= pan_step;
                    break;
                case TRMAP_MAP_CONTROL_PAN_WEST:
                    gps_state.dest_lon -= pan_step;
                    break;
                case TRMAP_MAP_CONTROL_PAN_EAST:
                    gps_state.dest_lon += pan_step;
                    break;
            }
            return 1;
        }

        case APP_MODE_GPS_TRACK_RECORD:
        case APP_MODE_GPS_TRACK_REPLAY:
        {
            float pan_step_lat = gps_track_state.current_radius / 111000.0f * VIEWPORT_PAN_STEP * gps_track_state.manual_zoom;
            float pan_step_lon = gps_track_state.current_radius / (111000.0f * 0.7f) * VIEWPORT_PAN_STEP * gps_track_state.manual_zoom;
            gps_track_state.manual_view = 1;

            switch (direction)
            {
                case TRMAP_MAP_CONTROL_PAN_NORTH:
                    gps_track_state.pan_offset_lat += pan_step_lat;
                    break;
                case TRMAP_MAP_CONTROL_PAN_SOUTH:
                    gps_track_state.pan_offset_lat -= pan_step_lat;
                    break;
                case TRMAP_MAP_CONTROL_PAN_WEST:
                    gps_track_state.pan_offset_lon -= pan_step_lon;
                    break;
                case TRMAP_MAP_CONTROL_PAN_EAST:
                    gps_track_state.pan_offset_lon += pan_step_lon;
                    break;
            }
            return 1;
        }

        case APP_MODE_NAVIGATION:
        {
            float lat_range;
            float lon_range;
            float center_lat = nav_app.config.start_lat;

            if (nav_app.renderer)
            {
                lat_range = nav_app.renderer->view_max_lat - nav_app.renderer->view_min_lat;
                lon_range = nav_app.renderer->view_max_lon - nav_app.renderer->view_min_lon;
                center_lat = (nav_app.renderer->view_min_lat + nav_app.renderer->view_max_lat) / 2.0f;
            }
            else
            {
                float radius_m = nav_app.config.gps_view_radius * nav_app.zoom_factor;
                lat_range = (radius_m / 111000.0f) * 2.0f;
                lon_range = (radius_m / (111000.0f * cosf(center_lat * 3.14159265f / 180.0f))) * 2.0f;
            }

            switch (direction)
            {
                case TRMAP_MAP_CONTROL_PAN_NORTH:
                    nav_app.pan_offset_lat += lat_range * VIEWPORT_PAN_STEP;
                    break;
                case TRMAP_MAP_CONTROL_PAN_SOUTH:
                    nav_app.pan_offset_lat -= lat_range * VIEWPORT_PAN_STEP;
                    break;
                case TRMAP_MAP_CONTROL_PAN_WEST:
                    nav_app.pan_offset_lon -= lon_range * VIEWPORT_PAN_STEP;
                    break;
                case TRMAP_MAP_CONTROL_PAN_EAST:
                    nav_app.pan_offset_lon += lon_range * VIEWPORT_PAN_STEP;
                    break;
            }

            nav_app.needs_redraw = 1;
            return 1;
        }

        default:
            return 0;
    }
}

int trmap_map_control_pan_north(void)
{
    return trmap_map_control_pan_internal(TRMAP_MAP_CONTROL_PAN_NORTH);
}

trmap_app_mode_t trmap_get_current_mode(void)
{
    return trmap_public_mode_from_internal(config.app_mode);
}

int trmap_request_mode_switch(trmap_app_mode_t target_mode)
{
    app_mode_t internal_mode;

    if (!trmap_internal_mode_from_public(target_mode, &internal_mode))
    {
        return 0;
    }

    app_request_mode_switch(config.app_mode, internal_mode);
    return 1;
}

int trmap_request_next_mode_switch(void)
{
    app_request_mode_switch(config.app_mode, -1);
    return 1;
}

int trmap_map_control_pan_south(void)
{
    return trmap_map_control_pan_internal(TRMAP_MAP_CONTROL_PAN_SOUTH);
}

int trmap_map_control_pan_west(void)
{
    return trmap_map_control_pan_internal(TRMAP_MAP_CONTROL_PAN_WEST);
}

int trmap_map_control_pan_east(void)
{
    return trmap_map_control_pan_internal(TRMAP_MAP_CONTROL_PAN_EAST);
}

int trmap_map_control_pan_delta(float delta_lat, float delta_lon)
{
    switch (config.app_mode)
    {
        case APP_MODE_MAP_VIEW:
#if !defined(_WIN32) || defined(USE_HONEY_GUI)
            map_view_state.pan_offset_lat += delta_lat;
            map_view_state.pan_offset_lon += delta_lon;
#else
            map_view_state.view_lat += delta_lat;
            map_view_state.view_lon += delta_lon;
#endif
            map_view_state.needs_redraw = 1;
            return 1;

        case APP_MODE_GPS_MAP:
#if !defined(_WIN32) || defined(USE_HONEY_GUI)
            gps_state.pan_offset_lat += delta_lat;
            gps_state.pan_offset_lon += delta_lon;
#else
            gps_state.dest_lat += delta_lat;
            gps_state.dest_lon += delta_lon;
#endif
            return 1;

        case APP_MODE_GPS_TRACK_RECORD:
        case APP_MODE_GPS_TRACK_REPLAY:
            gps_track_state.manual_view = 1;
            gps_track_state.pan_offset_lat += delta_lat;
            gps_track_state.pan_offset_lon += delta_lon;
            return 1;

        case APP_MODE_NAVIGATION:
            nav_app.pan_offset_lat += delta_lat;
            nav_app.pan_offset_lon += delta_lon;
            nav_app.needs_redraw = 1;
            return 1;

        default:
            return 0;
    }
}

int trmap_map_control_pan_finish(void)
{
    switch (config.app_mode)
    {
        case APP_MODE_MAP_VIEW:
#if !defined(_WIN32) || defined(USE_HONEY_GUI)
            map_view_state.view_lat += map_view_state.pan_offset_lat;
            map_view_state.view_lon += map_view_state.pan_offset_lon;
            map_view_state.pan_offset_lat = 0.0f;
            map_view_state.pan_offset_lon = 0.0f;
#endif
            map_view_state.needs_redraw = 1;
            return 1;

        case APP_MODE_GPS_MAP:
#if !defined(_WIN32) || defined(USE_HONEY_GUI)
            gps_state.dest_lat += gps_state.pan_offset_lat;
            gps_state.dest_lon += gps_state.pan_offset_lon;
            gps_state.pan_offset_lat = 0.0f;
            gps_state.pan_offset_lon = 0.0f;
#endif
            return 1;

        case APP_MODE_GPS_TRACK_RECORD:
        case APP_MODE_GPS_TRACK_REPLAY:
        case APP_MODE_NAVIGATION:
            return 1;

        default:
            return 0;
    }
}

int trmap_map_control_zoom_in(void)
{
    switch (config.app_mode)
    {
        case APP_MODE_MAP_VIEW:
            if (map_view_state.zoom_factor > 0.1f)
            {
                map_view_state.zoom_factor *= 0.8f;
                map_view_state.needs_redraw = 1;
            }
            return 1;

        case APP_MODE_GPS_MAP:
            if (gps_state.zoom_factor > VIEWPORT_ZOOM_MIN)
            {
                gps_state.zoom_factor /= VIEWPORT_ZOOM_STEP;
                if (gps_state.zoom_factor < VIEWPORT_ZOOM_MIN)
                {
                    gps_state.zoom_factor = VIEWPORT_ZOOM_MIN;
                }
            }
            return 1;

        case APP_MODE_GPS_TRACK_RECORD:
        case APP_MODE_GPS_TRACK_REPLAY:
            gps_track_state.manual_view = 1;
            gps_track_state.manual_zoom /= VIEWPORT_ZOOM_STEP;
            if (gps_track_state.manual_zoom < VIEWPORT_ZOOM_MIN)
            {
                gps_track_state.manual_zoom = VIEWPORT_ZOOM_MIN;
            }
            return 1;

        case APP_MODE_NAVIGATION:
            nav_app.zoom_factor /= VIEWPORT_ZOOM_STEP;
            if (nav_app.zoom_factor < VIEWPORT_ZOOM_MIN)
            {
                nav_app.zoom_factor = VIEWPORT_ZOOM_MIN;
            }
            nav_app.needs_redraw = 1;
            return 1;

        default:
            return 0;
    }
}

int trmap_map_control_zoom_out(void)
{
    switch (config.app_mode)
    {
        case APP_MODE_MAP_VIEW:
            if (map_view_state.zoom_factor < 10.0f)
            {
                map_view_state.zoom_factor *= 1.25f;
                map_view_state.needs_redraw = 1;
            }
            return 1;

        case APP_MODE_GPS_MAP:
            if (gps_state.zoom_factor < VIEWPORT_ZOOM_MAX)
            {
                gps_state.zoom_factor *= VIEWPORT_ZOOM_STEP;
                if (gps_state.zoom_factor > VIEWPORT_ZOOM_MAX)
                {
                    gps_state.zoom_factor = VIEWPORT_ZOOM_MAX;
                }
            }
            return 1;

        case APP_MODE_GPS_TRACK_RECORD:
        case APP_MODE_GPS_TRACK_REPLAY:
            gps_track_state.manual_view = 1;
            gps_track_state.manual_zoom *= VIEWPORT_ZOOM_STEP;
            if (gps_track_state.manual_zoom > VIEWPORT_ZOOM_MAX)
            {
                gps_track_state.manual_zoom = VIEWPORT_ZOOM_MAX;
            }
            return 1;

        case APP_MODE_NAVIGATION:
            nav_app.zoom_factor *= VIEWPORT_ZOOM_STEP;
            if (nav_app.zoom_factor > VIEWPORT_ZOOM_MAX)
            {
                nav_app.zoom_factor = VIEWPORT_ZOOM_MAX;
            }
            nav_app.needs_redraw = 1;
            return 1;

        default:
            return 0;
    }
}

int trmap_map_control_reset(void)
{
    switch (config.app_mode)
    {
        case APP_MODE_MAP_VIEW:
            app_map_control_get_map_center(map_view_state.map, &map_view_state.view_lat, &map_view_state.view_lon);
            map_view_state.zoom_factor = 1.0f;
#if !defined(_WIN32) || defined(USE_HONEY_GUI)
            map_view_state.pan_offset_lat = 0.0f;
            map_view_state.pan_offset_lon = 0.0f;
#endif
            map_view_state.needs_redraw = 1;
            return 1;

        case APP_MODE_GPS_MAP:
        {
            const gps_position_t *gps = gps_provider_get_position(gps_state.gps_provider);
            gps_state.zoom_factor = 1.0f;
#if !defined(_WIN32) || defined(USE_HONEY_GUI)
            gps_state.pan_offset_lat = 0.0f;
            gps_state.pan_offset_lon = 0.0f;
#endif
            if (gps && gps->valid)
            {
                gps_state.dest_lat = gps->lat;
                gps_state.dest_lon = gps->lon;
            }
            else
            {
                gps_state.dest_lat = gps_state.config.start_lat;
                gps_state.dest_lon = gps_state.config.start_lon;
            }
            return 1;
        }

        case APP_MODE_GPS_TRACK_RECORD:
        case APP_MODE_GPS_TRACK_REPLAY:
            gps_track_state.manual_view = 0;
            gps_track_state.manual_zoom = 1.0f;
            gps_track_state.pan_offset_lat = 0.0f;
            gps_track_state.pan_offset_lon = 0.0f;
            return 1;

        case APP_MODE_NAVIGATION:
            nav_app.zoom_factor = 1.0f;
            nav_app.pan_offset_lat = 0.0f;
            nav_app.pan_offset_lon = 0.0f;
            nav_app.needs_redraw = 1;
            return 1;

        default:
            return 0;
    }
}

/* ============================================================================
 * Mode Switch Functions (defined after globals)
 * ============================================================================
 */

/**
 * @brief Initialize a specific mode (for mode switching)
 * @param target_mode Target mode to initialize
 * @return 0 on success, non-zero on failure
 */
static int app_init_mode(app_mode_t target_mode)
{
    MAP_PRINTF("\n🔄 Initializing %s mode...\n", app_mode_to_string(target_mode));
    if (target_mode == APP_MODE_MAP_VIEW)
    {
        if (map_view_init(&map_view_state, map, &config) != 0)
        {
            MAP_FPRINTF("Error: Failed to initialize Map View mode\n");
            return 1;
        }
        map_view_state.running = 1;
        map_view_state.frame_count = 0;
        map_view_state.needs_redraw = 1;
    }
    else if (target_mode == APP_MODE_GPS_INIT)
    {
        if (gps_init_init(&gps_init_state, map, &config) != 0)
        {
            MAP_FPRINTF("Error: Failed to initialize GPS Init mode\n");
            return 1;
        }
        gps_init_state.running = 1;
        gps_init_state.frame_count = 0;
    }
    else if (target_mode == APP_MODE_GPS_MAP)
    {
        if (gps_map_init(&gps_state, map, &config) != 0)
        {
            MAP_FPRINTF("Error: Failed to initialize GPS Map mode\n");
            return 1;
        }
        gps_state.running = 1;
        gps_state.frame_count = 0;
    }
    else if (target_mode == APP_MODE_GPS_TRACK_RECORD || target_mode == APP_MODE_GPS_TRACK_REPLAY)
    {
        if (gps_track_init(&gps_track_state, map, &config) != 0)
        {
            MAP_FPRINTF("Error: Failed to initialize GPS Track mode\n");
            return 1;
        }
        gps_track_state.running = 1;
        gps_track_state.frame_count = 0;
        /* Set replay mode based on target mode */
        gps_track_state.replay_mode = (target_mode == APP_MODE_GPS_TRACK_REPLAY) ? 1 : 0;
    }
    else /* APP_MODE_NAVIGATION */
    {
        if (nav_init(&nav_app, map, &config) != 0)
        {
            MAP_FPRINTF("Error: Failed to initialize Navigation mode\n");
            return 1;
        }
        nav_app.running = 1;
        nav_app.frame_count = 0;
        nav_app.needs_redraw = 1;
    }

    MAP_PRINTF("✅ %s mode initialized\n", app_mode_to_string(target_mode));
    return 0;
}

/**
 * @brief Cleanup current mode resources (for mode switching)
 * @param current_mode Current mode to cleanup
 */
static void app_cleanup_mode(app_mode_t current_mode)
{
    MAP_PRINTF("🧹 Cleaning up %s mode...\n", app_mode_to_string(current_mode));

    if (current_mode == APP_MODE_MAP_VIEW)
    {
        map_view_cleanup(&map_view_state);
    }
    else if (current_mode == APP_MODE_GPS_INIT)
    {
        gps_init_cleanup(&gps_init_state);
    }
    else if (current_mode == APP_MODE_GPS_MAP)
    {
        gps_map_cleanup(&gps_state);
    }
    else if (current_mode == APP_MODE_GPS_TRACK_RECORD || current_mode == APP_MODE_GPS_TRACK_REPLAY)
    {
        gps_track_cleanup(&gps_track_state);
    }
    else /* APP_MODE_NAVIGATION */
    {
        nav_cleanup(&nav_app);
    }
}

/**
 * @brief Execute application mode switch
 * Called from main loop when mode switch is requested.
 * @return 0 on success, non-zero on failure
 */
static int app_do_mode_switch(void)
{
    app_mode_t old_mode = config.app_mode;
    app_mode_t new_mode = g_mode_switch_target;

    MAP_PRINTF("\n════════════════════════════════════════\n");
    MAP_PRINTF("🔄 Switching mode: %s -> %s\n",
               app_mode_to_string(old_mode),
               app_mode_to_string(new_mode));
    MAP_PRINTF("════════════════════════════════════════\n");

    /* Special case: switching between Track Record and Track Replay modes
     * Only toggle replay_mode flag, don't reinitialize (preserve track data) */
    if ((old_mode == APP_MODE_GPS_TRACK_RECORD && new_mode == APP_MODE_GPS_TRACK_REPLAY) ||
            (old_mode == APP_MODE_GPS_TRACK_REPLAY && new_mode == APP_MODE_GPS_TRACK_RECORD))
    {
        if (new_mode == APP_MODE_GPS_TRACK_REPLAY)
        {
            /* Switch to replay mode - allow even with no track points */
            gps_track_state.replay_mode = 1;
            gps_track_state.replay_index = 0;
            gps_track_state.replay_speed = 1;
            gps_track_state.replay_paused = 0;
            MAP_PRINTF("▶️  Starting track replay (%u points)\n", gps_track_state.track_count);
            if (gps_track_state.track_count < 2)
            {
                MAP_PRINTF("   ⚠️  No track data yet - record some GPS points first\n");
            }
        }
        else
        {
            /* Switch back to recording mode */
            gps_track_state.replay_mode = 0;
            MAP_PRINTF("🔴 Returned to recording mode\n");
        }
        config.app_mode = new_mode;
        app_clear_mode_switch_request();
        MAP_PRINTF("\n🎮 Now in %s mode\n", app_mode_to_string(new_mode));
        return 0;
    }

    /* If switching from Nav Setup to Navigation,
     * always carry the currently configured destination into Navigation mode.
     * When a valid GPS fix exists, also use the current GPS position as the
     * navigation start point. This avoids falling back to the default config
     * end coordinate when the user reaches Navigation via mode cycling. */
    if (old_mode == APP_MODE_GPS_MAP && new_mode == APP_MODE_NAVIGATION)
    {
        const gps_position_t *gps = gps_provider_get_position(gps_state.gps_provider);

        if (gps_state.nav_requested)
        {
            config.start_lat = gps_state.nav_start_lat;
            config.start_lon = gps_state.nav_start_lon;
        }
        else if (gps && gps->valid)
        {
            config.start_lat = gps->lat;
            config.start_lon = gps->lon;
        }

        config.end_lat = gps_state.dest_lat;
        config.end_lon = gps_state.dest_lon;
        config.has_start = 1;
        config.has_end = 1;
        gps_state.nav_requested = 0;
        MAP_PRINTF("📍 Navigation: %.6f,%.6f -> %.6f,%.6f\n",
                   (double)config.start_lat, (double)config.start_lon,
                   (double)config.end_lat, (double)config.end_lon);
    }

    /* 1. Cleanup current mode */
    app_cleanup_mode(old_mode);

    /* 2. Update config */
    config.app_mode = new_mode;

    /* 3. Initialize new mode */
    if (app_init_mode(new_mode) != 0)
    {
        MAP_FPRINTF("Error: Failed to switch to %s mode\n", app_mode_to_string(new_mode));
        /* Try to restore previous mode */
        config.app_mode = old_mode;
        if (app_init_mode(old_mode) != 0)
        {
            MAP_FPRINTF("Critical: Failed to restore previous mode!\n");
            return -1;
        }
        return 1;
    }

    /* 4. Clear switch request */
    app_clear_mode_switch_request();

    MAP_PRINTF("\n🎮 Now in %s mode\n", app_mode_to_string(new_mode));
    MAP_PRINTF("   Press [M] to cycle modes, [1/2/3] for direct switch\n");
    MAP_PRINTF("   [1]=Navigation, [2]=Nav Setup, [3]=GPS Track\n\n");

    return 0;
}
#ifdef _WIN32
#include <windows.h>

#endif
/**
 * @brief Application main entry point (called from main.c)
 */
int app_main(int argc, char *argv[])
{
    int result = 0;


#ifdef _WIN32
    /* Set Windows console to UTF-8 encoding for proper character display */
    SetConsoleOutputCP(65001);  /* CP_UTF8 = 65001 */
#endif

    /* 1. Parse command line arguments */
    int parse_result = parse_arguments(&config, argc, argv);
    if (parse_result != 0)
    {
        return (parse_result > 0) ? 0 : 1;  /* 0 for help, 1 for error */
    }

    /* 2. Initialize application (includes mode-specific init) */
    if (app_initialize(&config, &map, &nav_app, &gps_state, &gps_track_state, &gps_init_state, &map_view_state) != 0)
    {
        return 1;
    }    /* 3. Run main application loop with mode switching support */
    while (1)
    {
        /* Run current mode loop */
        if (config.app_mode == APP_MODE_MAP_VIEW)
        {
            result = app_map_view_run_loop(&map_view_state);
        }
        else if (config.app_mode == APP_MODE_GPS_INIT)
        {
            result = app_gps_init_run_loop(&gps_init_state);
        }
        else if (config.app_mode == APP_MODE_GPS_MAP)
        {
            result = app_gps_map_run_loop(&gps_state);
        }
        else if (config.app_mode == APP_MODE_GPS_TRACK_RECORD || config.app_mode == APP_MODE_GPS_TRACK_REPLAY)
        {
            result = app_gps_track_run_loop(&gps_track_state);
        }
        else
        {
            result = app_nav_run_loop(&nav_app);
        }

        /* Check if mode switch was requested (result == 2) */
        if (result == 2 && app_is_mode_switch_requested())
        {
            /* Perform mode switch */
            if (app_do_mode_switch() == 0)
            {
                /* Mode switch successful, continue with new mode */
                continue;
            }
            else
            {
                /* Mode switch failed, exit */
                MAP_FPRINTF("Error: Mode switch failed\n");
                result = 1;
                break;
            }
        }

        /* Normal exit or error */
        break;
    }

    /* 4. Cleanup resources (includes mode-specific cleanup) */
    app_cleanup(&config, map, &nav_app, &gps_state, &gps_track_state, &gps_init_state, &map_view_state);

    return result;
}

int map_config(void)
{
    int parse_result = parse_arguments(&config, 0, 0);
    if (parse_result != 0)
    {
        return (parse_result > 0) ? 0 : 1;  /* 0 for help, 1 for error */
    }
    return 0;
}
int map_init(void)
{
    if (app_initialize(&config, &map, &nav_app, &gps_state, &gps_track_state, &gps_init_state, &map_view_state) != 0)
    {
        return 1;
    }
    return 0;
}
int map_loop(void)
{
    int result = 0;

    /* Check for mode switch request */
    if (app_is_mode_switch_requested())
    {
        if (app_do_mode_switch() != 0)
        {
            MAP_FPRINTF("Warning: Mode switch failed\n");
        }
        return 0;  /* Continue after mode switch */
    }    /* Run current mode loop */
    if (config.app_mode == APP_MODE_MAP_VIEW)
    {
        result = map_view_loop(&map_view_state);
    }
    else if (config.app_mode == APP_MODE_GPS_INIT)
    {
        result = gps_init_loop(&gps_init_state);
    }
    else if (config.app_mode == APP_MODE_GPS_MAP)
    {
        result = gps_map_loop(&gps_state);
    }
    else if (config.app_mode == APP_MODE_GPS_TRACK_RECORD || config.app_mode == APP_MODE_GPS_TRACK_REPLAY)
    {
        result = gps_track_loop(&gps_track_state);
    }
    else
    {
        result = nav_loop(&nav_app);
    }

    /* Handle mode switch return value (2) */
    if (result == 2)
    {
        /* Mode switch was requested, process it in next iteration */
        return 0;
    }

    return result;
}
int map_exit(void)
{
    app_cleanup(&config, map, &nav_app, &gps_state, &gps_track_state, &gps_init_state, &map_view_state);
    return 0;
}
const unsigned char *map_get_pixels(void)
{
    if (config.app_mode == APP_MODE_MAP_VIEW)
    {
        return map_view_state.renderer->pixels;
    }
    else if (config.app_mode == APP_MODE_GPS_INIT)
    {
        return gps_init_state.renderer->pixels;
    }
    else if (config.app_mode == APP_MODE_GPS_MAP)
    {
        return gps_state.renderer->pixels;
    }
    else if (config.app_mode == APP_MODE_GPS_TRACK_RECORD || config.app_mode == APP_MODE_GPS_TRACK_REPLAY)
    {
        return gps_track_state.renderer->pixels;
    }
    else
    {
        return nav_app.renderer->pixels;
    }

}
