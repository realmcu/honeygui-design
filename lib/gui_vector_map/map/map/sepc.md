# Overall Requirements
- Implement navigation path display functionality similar to mobile map applications on MCU platform
- Develop and simulate on Windows PC
- Store map dataset in flash memory
- Use C language API with start and end coordinates as input, output path point sequence
- Finally use TRVG library to draw the path image

## AGENT Constraints
- Use TRVG library (ultra-fast drawing API) for rendering
- If current TRVG doesn't meet drawing requirements, develop new TRVG interfaces (also ultra-fast drawing APIs)


## Tool Requirements
- Python tool to download map data and convert it to dataset for MCU platform, for flashing to flash memory

### Download and Convert GUI (Implemented)
- ✅ View map (using tkintermapview online map)
- ✅ Drag to browse, zoom
- ✅ Jump to specified coordinates
- ✅ Quick selection of recommended cities
- ✅ Select download range on map (blue rectangle)
- ✅ Select conversion range on map (green rectangle)
- ✅ Graphical download settings options
- ✅ Graphical conversion settings options

#### New Files
- `tools/map_gui.py` - Map download and conversion GUI

#### Dependencies
- tkintermapview>=1.29

#### Usage

```bash
cd tools
python map_gui.py
```

#### Features

| Feature | Description |
|---------|-------------|
| City Jump | Dropdown to select recommended cities, quickly navigate to Suzhou, Shanghai, Beijing, etc. |
| Coordinate Input | Manually enter latitude/longitude, click "Jump" button to navigate |
| Zoom Control | +/- buttons to control map zoom level |
| Select Download Range | Click button then drag on map to select rectangular area |
| Select Conversion Range | Click button to select conversion area on map (optional) |
| Download Settings | Select features to download: roads, water, parks, buildings |
| Conversion Settings | Select features to convert, simplification parameters, input/output files |
| Log Panel | Display operation logs and progress information |

#### Recommended Cities List

| City | Default Coordinates | Zoom Level |
|------|---------------------|------------|
| Suzhou | 31.30, 120.58 | 12 |
| Shanghai | 31.23, 121.47 | 11 |
| Beijing | 39.90, 116.40 | 11 |
| Hangzhou | 30.27, 120.15 | 12 |
| Nanjing | 32.06, 118.79 | 12 |
| Shenzhen | 22.54, 114.06 | 12 |
| Guangzhou | 23.13, 113.26 | 11 |
| Chengdu | 30.57, 104.07 | 12 |
| Wuhan | 30.59, 114.30 | 12 |
| Xi'an | 34.26, 108.94 | 12 |
| Tokyo | 35.68, 139.69 | 11 |
| New York | 40.71, -74.01 | 11 |
| London | 51.51, -0.13 | 11 |
| Paris | 48.86, 2.35 | 12 |

#### Interface Layout

```
┌────────────────────────────────────────────────────────────────┐
│ File  Help                                                      │
├─────────────────────────────────┬──────────────────────────────┤
│ [City Select▼] Lat:___ Lon:___ [Jump]  [+] [-]                  │
├─────────────────────────────────┼──────────────────────────────┤
│                                 │ ┌─────────────────────────┐  │
│                                 │ │ 📥 Download Settings   │  │
│                                 │ ├─────────────────────────┤  │
│        Map Display Area         │ │ Download Area: ...      │  │
│     (drag, zoom)                │ │ ☑ Roads  ☑ Water       │  │
│                                 │ │ ☑ Parks  ☐ Buildings   │  │
│                                 │ │ Output: .../map.osm     │  │
│                                 │ │ [Start Download]        │  │
│                                 │ └─────────────────────────┘  │
│                                 │ ┌─────────────────────────┐  │
│                                 │ │ 🔄 Conversion Settings │  │
│                                 │ └─────────────────────────┘  │
│                                 │ ┌─────────────────────────┐  │
│                                 │ │ 📋 Log                 │  │
│                                 │ └─────────────────────────┘  │
├─────────────────────────────────┴──────────────────────────────┤
│ [📥Select Download Range] [🔄Select Convert Range] [❌Clear]    │
├────────────────────────────────────────────────────────────────┤
│ Status: Ready                                                   │
└────────────────────────────────────────────────────────────────┘
```



## Firmware Requirements
- C language, pure English
- Navigation API: Input start and end coordinates, output path point sequence
- Path drawing API: Using TRVG library, input path point sequence, output path image

## MCU Platform
- 4MB RAM
- 200MHz CPU
- 128MB Flash

## Junction Lane Navigation

- Features required to add junction lane guidance similar to mainstream map navigation apps (the lane arrow panel in the top-left corner showing turns, straight, meters to exit ramp, etc.)

### Phase 1 - Basic Features (Implemented)

#### New Files
- `firmware/include/lane_guidance.h` - Lane guidance API header file
- `firmware/src/lane_guidance.c` - Lane guidance implementation

#### Data Structures

```c
// Maneuver type enumeration
typedef enum {
    MANEUVER_NONE,          // No action
    MANEUVER_STRAIGHT,      // Straight
    MANEUVER_LEFT,          // Left turn
    MANEUVER_RIGHT,         // Right turn
    MANEUVER_SLIGHT_LEFT,   // Slight left
    MANEUVER_SLIGHT_RIGHT,  // Slight right
    MANEUVER_SHARP_LEFT,    // Sharp left
    MANEUVER_SHARP_RIGHT,   // Sharp right
    MANEUVER_UTURN_LEFT,    // U-turn left
    MANEUVER_UTURN_RIGHT,   // U-turn right
    MANEUVER_RAMP_LEFT,     // Left ramp
    MANEUVER_RAMP_RIGHT,    // Right ramp
    MANEUVER_MERGE,         // Merge
    MANEUVER_ARRIVE,        // Arrive at destination
} maneuver_type_t;

// Junction guidance information
typedef struct {
    float distance;             // Distance to next junction (meters)
    maneuver_type_t maneuver;   // Maneuver type
    float turn_angle;           // Turn angle (-180 to 180 degrees)
    uint32_t segment_index;     // Current path segment index
} junction_guidance_t;
```

#### Core API

```c
// Initialize guidance state
map_error_t guidance_init(guidance_state_t *state, const path_t *path);

// Update current position
map_error_t guidance_update(guidance_state_t *state, float lat, float lon);

// Get next junction guidance
map_error_t guidance_get_next_junction(const guidance_state_t *state,
                                       junction_guidance_t *guidance);

// Render lane guidance panel
void render_lane_guidance(renderer_t *renderer,
                          const junction_guidance_t *guidance,
                          const guidance_style_t *style,
                          float x, float y, float width, float height);

// Render turn arrow
void render_turn_arrow(renderer_t *renderer,
                       maneuver_type_t maneuver,
                       uint32_t color,
                       float cx, float cy, float size);

// Format distance display
void guidance_format_distance(float distance, char *buffer, int buffer_size);

// Initialize guidance style (preset styles)
void guidance_style_init_preset(guidance_style_t *style, guidance_style_preset_t preset);

// Initialize guidance style from map theme
void guidance_style_init_from_theme(guidance_style_t *style, const map_theme_t *map_theme);
```

#### Style Preset Types

```c
typedef enum {
    GUIDANCE_STYLE_DEFAULT,  // Default black semi-transparent style
    GUIDANCE_STYLE_GOOGLE,   // Google Maps style (green background)
    GUIDANCE_STYLE_DARK,     // Dark mode style
    GUIDANCE_STYLE_AMAP,     // Amap style (blue background)
    GUIDANCE_STYLE_BAIDU,    // Baidu Maps style
} guidance_style_preset_t;
```

#### Style Color Schemes

| Style | Background | Arrow | Text | Accent |
|-------|------------|-------|------|--------|
| DEFAULT | Black 75% transparent | White | White | Green |
| GOOGLE | Google Green | White | White | Google Blue |
| DARK | Dark gray-blue | Bright blue | Light gray | Blue |
| AMAP | Amap Blue | White | White | Yellow |
| BAIDU | Baidu Blue | White | White | Orange |

#### Angle Threshold Definitions
- **Straight**: -20° ~ 20°
- **Slight turn**: 20° ~ 45°
- **Normal turn**: 45° ~ 120°
- **Sharp turn**: 120° ~ 160°
- **U-turn**: > 160°

#### Distance Formatting Rules
- < 100m: In 10-meter units (e.g., "50 m")
- 100-1000m: In 50-meter units (e.g., "250 m")
- 1-10km: One decimal place (e.g., "1.5 km")
- > 10km: Round to km (e.g., "15 km")

#### Resource Usage
- Code size: ~15KB
- RAM: ~1KB (runtime state)
- No additional Flash data

### Phase 2 - Multi-lane Display (Implemented)

- Display lane count for current road
- Allowed directions per lane (straight/left/right/combined)
- Recommended lane highlighting
- Map data format extension required for lane information

#### New Data Structures (map_types.h)

```c
// Lane direction flags (bitmask)
typedef enum {
    LANE_DIR_NONE         = 0x00,   // No direction
    LANE_DIR_STRAIGHT     = 0x01,   // Straight
    LANE_DIR_LEFT         = 0x02,   // Left turn
    LANE_DIR_RIGHT        = 0x04,   // Right turn
    LANE_DIR_SLIGHT_LEFT  = 0x08,   // Slight left
    LANE_DIR_SLIGHT_RIGHT = 0x10,   // Slight right
    LANE_DIR_SHARP_LEFT   = 0x20,   // Sharp left
    LANE_DIR_SHARP_RIGHT  = 0x40,   // Sharp right
    LANE_DIR_UTURN        = 0x80,   // U-turn
} lane_direction_t;

#define MAX_LANES_PER_ROAD  8

// Single lane information
typedef struct {
    uint8_t directions;     // Allowed directions bitmask
    uint8_t is_recommended; // Whether this is recommended lane
    uint8_t reserved[2];
} lane_info_t;

// Road lane configuration
typedef struct {
    uint8_t lane_count;                     // Lane count
    uint8_t recommended_lane;               // Recommended lane index
    uint8_t reserved[2];
    lane_info_t lanes[MAX_LANES_PER_ROAD];  // Lane array
} lane_config_t;
```

#### New API (lane_guidance.h)

```c
// Multi-lane display information
typedef struct {
    uint8_t lane_count;
    uint8_t recommended_lane;
    uint8_t current_lane;
    uint8_t reserved;
    lane_display_info_t lanes[MAX_LANES_PER_ROAD];
} lane_guidance_info_t;

// Extended junction guidance (with lane information)
typedef struct {
    float distance;
    maneuver_type_t maneuver;
    float turn_angle;
    uint32_t segment_index;
    lane_guidance_info_t lane_info;
    uint8_t has_lane_info;
    uint8_t reserved[3];
} junction_guidance_ext_t;

// Lane display style
typedef struct {
    uint32_t lane_bg_color;
    uint32_t lane_recommended_color;
    uint32_t lane_current_color;
    uint32_t lane_arrow_color;
    uint32_t lane_arrow_inactive_color;
    uint32_t lane_separator_color;
    float lane_width;
    float lane_height;
    float lane_spacing;
    float lane_arrow_size;
    float separator_width;
} lane_display_style_t;

// Get extended junction guidance with lane information
map_error_t guidance_get_next_junction_ext(const guidance_state_t *state,
                                           junction_guidance_ext_t *guidance,
                                           const lane_config_t *lane_config);

// Calculate recommended lane
uint8_t guidance_calculate_recommended_lane(const lane_config_t *lane_config,
                                            maneuver_type_t next_maneuver);

// Initialize lane display style
void lane_display_style_init(lane_display_style_t *style);
void lane_display_style_init_preset(lane_display_style_t *style, 
                                    guidance_style_preset_t preset);
void lane_display_style_init_from_theme(lane_display_style_t *style,
                                        const map_theme_t *map_theme);

// Render multi-lane guidance panel
void render_lane_guidance_panel(renderer_t *renderer,
                                const lane_guidance_info_t *lane_info,
                                const lane_display_style_t *style,
                                float x, float y);

// Render single lane icon
void render_lane_icon(renderer_t *renderer,
                      const lane_display_info_t *lane,
                      const lane_display_style_t *style,
                      float x, float y, float width, float height);

// Render lane direction arrows
void render_lane_direction_arrows(renderer_t *renderer,
                                  uint8_t directions,
                                  uint32_t color,
                                  float cx, float cy, float size);

// Render full navigation panel (turn arrow + lane guidance)
void render_full_lane_guidance(renderer_t *renderer,
                               const junction_guidance_ext_t *guidance,
                               const guidance_style_t *turn_style,
                               const lane_display_style_t *lane_style,
                               float x, float y, float width);
```

#### Map Data Extension (convert_map.py)

Parse lane information from OSM:
- `lanes` - Lane count
- `lanes:forward` / `lanes:backward` - Lane count per direction
- `turn:lanes` / `turn:lanes:forward` - Lane turn information

OSM lane direction format: `"left|through|through;right|right"`
- `|` separates each lane
- `;` separates multiple allowed directions within a lane

#### Binary Map Format v5 (Lane Data Support)

```
Header (80 bytes):
  magic[4]           "TMAP"
  version            5
  node_count         uint32
  edge_count         uint32
  min_lat/lon        float x2
  max_lat/lon        float x2
  features           uint32
  area_count         uint32
  area_points_count  uint32
  reserved           uint32
  label_count        uint32
  label_text_size    uint32
  adj_list_count     uint32
  lane_data_size     uint32    <- v5 new field
  reserved2[4]       uint32 x4

Edge (16 bytes):
  from_node          uint32
  to_node            uint32
  distance           float
  road_type          uint8
  flags              uint8
  lane_offset        uint16    <- v5: lane data offset (0xFFFF=none)

Lane Data Section:
  [lane_count, dir0, dir1, ..., dirN]  <- variable length, each unique config
```

#### Lane Data Query API (nav_api.h)

```c
// Query lane configuration based on route segment coordinates
bool nav_get_lane_config(const map_t *map,
                         float lat1, float lon1,
                         float lat2, float lon2,
                         lane_config_t *config);

// Get lane configuration from edge (map_types.h inline function)
bool map_get_edge_lane_config(const map_t *map, 
                              const map_edge_t *edge,
                              lane_config_t *config);
```

#### Style Color Schemes

| Style | Lane Background | Recommended Lane | Active Arrow | Inactive Arrow |
|-------|-----------------|------------------|--------------|----------------|
| DEFAULT | Dark gray semi-transparent | Green | White | Gray |
| GOOGLE | Dark gray | Google green | White | Light gray |
| DARK | Dark blue-black | Bright blue | Light gray | Dark gray |
| AMAP | Dark purple-blue | Amap blue | White | Gray |
| BAIDU | Dark purple-blue | Baidu blue | White | Gray |

#### Recommended Lane Algorithm

1. Convert the next turn action to required lane direction
2. Find all lanes that allow that direction
3. Scoring criteria:
   - Lanes allowing only a single direction get priority
   - Left turn prefers left lane, right turn prefers right lane
4. Return the lane with highest score

#### Resource Usage
- Code increment: ~8KB
- RAM increment: ~512 bytes (runtime state)
- Flash data increment: Depends on map lane coverage

### Phase 3 - Advanced Features (To be developed)

- Complex intersections (overpasses, ramps)
- Dynamic arrow animations
- Voice announcement integration interface
- Speed limit alerts

## GPS Features

### GPS Simulator (Provides all current coordinate data) - Implemented

#### Feature Overview
- ✅ Remove existing config_set_default_coords (default coordinates), sample_navigation_points (navigation waypoints) and similar functions that generate current coordinate data.
- ✅ Use GPS simulator to provide initial coordinates at navigation start and subsequent coordinate points. (These subsequent points are generated at GPS simulator initialization, using the sample_navigation_points method - doing path planning at start and sampling points as simulated movement points.)
- ✅ Must ensure the data flow of current coordinate points is GPS simulator -> Navigation program
- ✅ Current coordinates have some jitter to simulate real-world scenarios, verifying navigation program's off-route re-routing functionality

#### New Files
- `firmware/include/gps_simulator.h` - GPS simulator API header file
- `firmware/src/gps_simulator.c` - GPS simulator implementation

#### Data Structures

```c
// GPS position output structure
typedef struct {
    float lat;              // Latitude (degrees)
    float lon;              // Longitude (degrees)
    float speed;            // Speed (m/s)
    float heading;          // Heading angle (degrees, 0 = North, clockwise)
    float accuracy;         // Position accuracy (meters)
    bool valid;             // GPS signal validity
    time_t timestamp;       // Unix timestamp
    uint32_t update_count;  // Position update count
} gps_position_t;

// GPS jitter mode
typedef enum {
    GPS_JITTER_NONE = 0,        // No jitter (perfect GPS)
    GPS_JITTER_NORMAL,          // Normal jitter (~3m)
    GPS_JITTER_HIGH,            // High jitter (~8m, urban canyon simulation)
    GPS_JITTER_EXTREME,         // Extreme jitter (~15m, off-route testing)
    GPS_JITTER_CUSTOM           // Custom jitter amount
} gps_jitter_mode_t;

// GPS simulator configuration
typedef struct {
    float simulation_speed;     // Movement speed (m/s)
    uint32_t max_waypoints;     // Maximum waypoint count
    gps_jitter_mode_t jitter_mode;  // Jitter mode
    float jitter_amount_m;      // Custom jitter amount (meters)
    float jitter_change_rate;   // Jitter change rate (0-1)
    bool enable_deviation;      // Enable off-route simulation
    float deviation_probability;// Off-route probability (0-1)
    float deviation_distance_m; // Off-route distance (meters)
} gps_simulator_config_t;
```

#### Core API

```c
// Initialize configuration
void gps_simulator_config_init(gps_simulator_config_t *config);

// Initialize GPS simulator (with path planning)
bool gps_simulator_init(gps_simulator_t *sim,
                        const map_t *map,
                        float start_lat, float start_lon,
                        float end_lat, float end_lon,
                        transport_mode_t mode,
                        const gps_simulator_config_t *config);

// Initialize GPS simulator (using pre-computed path)
bool gps_simulator_init_with_path(gps_simulator_t *sim,
                                   const path_t *path,
                                   const gps_simulator_config_t *config);

// Destroy GPS simulator
void gps_simulator_destroy(gps_simulator_t *sim);

// Get current GPS position (sole source of position data)
const gps_position_t* gps_simulator_get_position(const gps_simulator_t *sim);

// Update GPS position (advance simulation)
bool gps_simulator_update(gps_simulator_t *sim, float delta_time);

// Check if destination reached
bool gps_simulator_is_complete(const gps_simulator_t *sim);

// Re-route path (call after off-route)
bool gps_simulator_reroute(gps_simulator_t *sim,
                           const map_t *map,
                           transport_mode_t mode);

// Get planned route
const coord_t* gps_simulator_get_route(const gps_simulator_t *sim, uint32_t *count);

// Set jitter mode
void gps_simulator_set_jitter_mode(gps_simulator_t *sim, gps_jitter_mode_t mode);

// Force off-route (for testing)
void gps_simulator_force_deviation(gps_simulator_t *sim,
                                    float distance_m, float angle_deg);
```

#### Data Flow

```
GPS Simulator (gps_simulator)
    │
    ├─ gps_simulator_init() ─── Path planning, generate waypoints
    │
    ├─ gps_simulator_update() ─ Update position, add jitter
    │
    └─ gps_simulator_get_position() ─── Provide position data
                                            │
                                            ▼
                                    Navigation Program
                                            │
                                            ├─ Position update
                                            ├─ Off-route detection
                                            └─ Re-routing
```

#### GPS Jitter Implementation
- Uses smoothly interpolated random offset
- Jitter change rate is configurable (default 0.3)
- Jitter range depends on mode:
  - NORMAL: ±3m
  - HIGH: ±8m
  - EXTREME: ±15m

#### Off-route Simulation
- Supports probability-triggered off-route
- Supports specified interval triggered off-route
- Off-route direction is perpendicular to current heading
- Manual off-route trigger for testing

#### Resource Usage
- Code size: ~8KB
- RAM: ~4KB (waypoint storage, depends on max_waypoints)
- No additional Flash data




### GPS Map Display Feature (Implemented)

Add a mode in main function that doesn't enable navigation, but renders the map centered on current GPS coordinates (with loop update).

#### Feature Overview
- ✅ Added `--gps-map` command line argument to switch to GPS map display mode
- ✅ Display map centered on current GPS coordinates
- ✅ Support configurable display radius (`--view-radius` parameter)
- ✅ Loop update GPS position and map display
- ✅ Display current GPS info (coordinates, heading, speed, accuracy)

#### Command Line Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--gps-map` | Enable GPS map display mode | Off (navigation mode) |
| `--view-radius <m>` | Map display radius (meters) | 500 |
| `--start <lat,lon>` | GPS starting coordinates | First map node |

#### Usage Examples

```bash
# GPS map display mode, display radius 1000 meters
./trmap_sim --gps-map --start 31.30,120.58 --view-radius 1000

# GPS map display mode, using default coordinates and radius
./trmap_sim --gps-map

# Limit frame count
./trmap_sim --gps-map --frames 50 --view-radius 800
```

#### Data Structures

```c
// GPS map display state structure
typedef struct {
    gps_simulator_t gps_sim;    /* GPS simulator */
    app_config_t config;        /* Configuration */
    map_t *map;                 /* Map */
    renderer_t *renderer;       /* Renderer */
    int running;                /* Running flag */
    int frame_count;            /* Frame count */
} gps_map_state_t;

// Application mode enumeration
typedef enum {
    APP_MODE_NAVIGATION,    /* Navigation mode */
    APP_MODE_GPS_MAP,       /* GPS map display mode */
} app_mode_t;
```

#### Core API

```c
// Initialize GPS map display mode
static int gps_map_init(gps_map_state_t *state, map_t *map, app_config_t *config);

// GPS map display main loop
static int gps_map_loop(gps_map_state_t *state);

// Clean up GPS map display mode resources
static void gps_map_cleanup(gps_map_state_t *state);

// Render GPS map frame
static int render_gps_map_frame(gps_map_state_t *state);

// Set viewport centered on specified point
static void set_viewport_around_point(renderer_t *renderer, 
                                       float lat, float lon, 
                                       float radius_m);
```

#### Viewport Calculation

Calculate viewport range based on GPS coordinates and display radius:
- Latitude range: `lat ± (radius_m / 111000)`
- Longitude range: `lon ± (radius_m / (111000 * cos(lat)))`

#### Rendering Content

1. **Base map**: Render roads, water, parks, etc. using Google theme
2. **GPS position marker**: Blue circle showing current position
3. **Information panel**:
   - Mode title
   - GPS coordinates, heading, speed
   - Display radius, accuracy, frame count

#### Output Files

Frames saved to `frames/gps_map_XXXX.png`

#### Resource Usage
- Code increment: ~3KB
- RAM increment: ~1KB (gps_map_state_t)
- No additional Flash data

### GPS Driver
- Step 1: Implement a standalone EXE for verification. The GPS module sends data to the program via serial port, and the program parses and outputs common GPS information.

#### Step 1 - Serial GPS Verification Program (Implemented)


##### Feature Overview
- ✅ Standalone Windows EXE program for GPS module verification
- ✅ Receive GPS NMEA data via serial port
- ✅ Parse standard NMEA 0183 sentences (GGA, RMC, GSA, GSV, VTG)
- ✅ Real-time GPS information display
- ✅ Simulation mode support for hardware-free testing

##### File Structure
```
tools/gps_driver/
├── CMakeLists.txt     # CMake build configuration
├── build.bat          # Windows build script
├── README.md          # Documentation
├── gps_driver.c       # Main program
├── nmea_parser.h      # NMEA parser header
├── nmea_parser.c      # NMEA parser implementation
├── serial_port.h      # Serial port header
└── serial_port.c      # Serial port implementation (Windows)
```

##### Data Structures

```c
/* GPS fix quality */
typedef enum {
    GPS_FIX_INVALID = 0,    /* Invalid */
    GPS_FIX_GPS = 1,        /* GPS fix */
    GPS_FIX_DGPS = 2,       /* Differential GPS */
    GPS_FIX_RTK = 4,        /* RTK fixed */
    GPS_FIX_FLOAT_RTK = 5,  /* RTK float */
} gps_fix_quality_t;

/* GPS data structure */
typedef struct {
    /* Position information */
    double latitude;        /* Latitude (degrees, North positive, South negative) */
    double longitude;       /* Longitude (degrees, East positive, West negative) */
    float altitude;         /* Altitude (meters) */
    
    /* Time information */
    uint8_t hour, minute, second;   /* UTC time */
    uint8_t day, month;             /* Date */
    uint16_t year;
    
    /* Movement information */
    float speed_knots;      /* Speed (knots) */
    float speed_kmh;        /* Speed (km/h) */
    float course;           /* Course (degrees) */
    
    /* Fix quality */
    gps_fix_quality_t fix_quality;
    gps_fix_mode_t fix_mode;
    uint8_t satellites_used;
    float hdop, vdop, pdop;
    
    /* Status */
    bool valid;
} gps_data_t;
```

##### Command Line Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `-p, --port <name>` | Serial port name (e.g., COM3) | None |
| `-b, --baud <rate>` | Baud rate | 9600 |
| `-l, --list` | List available serial ports | - |
| `-r, --raw` | Show raw NMEA sentences | Off |
| `-s, --simulate` | Simulation mode | Off |
| `-a, --satellites` | Show satellite details | Off |

##### Usage Examples

```batch
# List available serial ports
gps_driver.exe -l

# Read GPS data from COM3
gps_driver.exe -p COM3

# Use 115200 baud rate
gps_driver.exe -p COM3 -b 115200

# Show raw NMEA sentences
gps_driver.exe -p COM3 -r

# Simulation mode (no real GPS hardware required)
gps_driver.exe -s
```

##### Supported NMEA Sentences

| Sentence | Description | Parsed Content |
|----------|-------------|----------------|
| GGA | Global Positioning System Fix Data | Position, time, altitude, satellite count, HDOP |
| RMC | Recommended Minimum Specific GPS Data | Position, time, date, speed, course |
| GSA | GPS DOP and Active Satellites | Fix mode, DOP values, satellites used |
| GSV | GPS Satellites in View | Visible satellite count and details |
| VTG | Course Over Ground and Ground Speed | Course, speed |

##### Output Example

```
========================================
         GPS Driver v1.0.0              
========================================

Status: VALID
Fix:    GPS (3D Fix)

--- Position ---
Latitude:    31.500000 N
Longitude:  120.966667 E
Altitude:      545.4 m

--- Time (UTC) ---
Date:       2026-01-27
Time:       12:35:19.000

--- Movement ---
Speed:       41.5 km/h (  22.4 knots)
Course:      84.4 deg

--- Quality ---
Satellites: 8 used / 8 visible
HDOP:       0.9
VDOP:       0.5
PDOP:       1.0
```

##### Build Instructions

```batch
cd tools\gps_driver
mkdir build && cd build
cmake -G "MinGW Makefiles" ..
mingw32-make
# Output: build\bin\gps_driver.exe
```

##### Resource Usage
- Code size: ~25KB
- RAM: ~2KB




#### Step 2 - Integration into Map Main Program (Implemented)

##### Feature Overview
- ✅ Added GPS provider abstraction layer to unify GPS simulator and GPS driver interfaces
- ✅ GPS driver has the same status as GPS simulator, both can provide coordinates to navigation program
- ✅ Select GPS data source via command line arguments
- ✅ Support listing available serial ports

##### New Files
```
firmware/
├── include/
│   ├── gps_provider.h  # GPS provider abstract interface
│   └── gps_driver.h    # GPS driver header
└── src/
    ├── gps_provider.c  # GPS provider implementation
    └── gps_driver.c    # GPS driver implementation (serial + NMEA parsing)
```

##### GPS Provider Interface

```c
/* GPS provider type */
typedef enum {
    GPS_PROVIDER_SIMULATOR,     /* GPS simulator (for testing) */
    GPS_PROVIDER_SERIAL,        /* Serial GPS driver (real hardware) */
} gps_provider_type_t;

/* GPS provider configuration */
typedef struct {
    gps_provider_type_t type;           /* Provider type */
    gps_simulator_config_t sim_config;  /* Simulator configuration */
    const char *serial_port;            /* Serial port name (e.g., "COM3") */
    uint32_t baudrate;                  /* Baud rate (default: 9600) */
} gps_provider_config_t;

/* Core API */
gps_provider_t* gps_provider_create(...);   /* Create GPS provider */
void gps_provider_destroy(...);              /* Destroy GPS provider */
const gps_position_t* gps_provider_get_position(...);  /* Get current position */
bool gps_provider_update(...);               /* Update GPS data */
bool gps_provider_is_complete(...);          /* Check if complete */
bool gps_provider_reroute(...);              /* Reroute path (simulator only) */
```

##### Command Line Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--gps-sim` | Use GPS simulator | Default |
| `--gps-serial <port>` | Use serial GPS driver | - |
| `--gps-baud <rate>` | Serial baud rate | 9600 |
| `--list-ports` | List available ports and exit | - |

##### Usage Examples

```batch
# List available serial ports
trmap_sim.exe --list-ports

# Navigate using GPS simulator (default)
trmap_sim.exe --start 31.30,120.58 --end 31.35,120.65 --mode car

# Navigate using serial GPS (real GPS hardware)
trmap_sim.exe --gps-serial COM3 --end 31.35,120.65

# Serial GPS with custom baud rate
trmap_sim.exe --gps-serial COM3 --gps-baud 115200 --end 31.35,120.65

# GPS map display mode with serial GPS
trmap_sim.exe --gps-map --gps-serial COM3 --view-radius 1000
```

##### Data Flow

```
┌─────────────────┐     ┌─────────────────┐
│  GPS Simulator  │     │ Serial GPS Drvr │
│ (gps_simulator) │     │  (gps_driver)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │GPS Provider │
              │(gps_provider)│
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  Navigation │
              │ (app.c)     │
              └─────────────┘
```

##### GPS Driver Features
- Serial communication (Windows)
- NMEA 0183 parsing (GGA, RMC, GSA, GSV, VTG)
- Auto-convert to `gps_position_t` format
- Fully compatible with GPS simulator output format

##### Resource Usage
- GPS Provider: ~2KB code
- GPS Driver: ~12KB code
- RAM: ~1KB (parsing buffer and state)