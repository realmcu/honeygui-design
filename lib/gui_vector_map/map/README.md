# TrMap - MCU Navigation Map System

A lightweight navigation map system designed for MCU platforms with limited resources.

## Features

- Download and convert OpenStreetMap data for MCU use
- A* pathfinding algorithm optimized for embedded systems
- NanoVG-based path rendering
- Windows PC simulation support

## Project Structure

```
trmap/
├── tools/              # Python tools for map data processing
│   ├── download_map.py # Download OSM data
│   ├── convert_map.py  # Convert to MCU format
│   └── requirements.txt
├── firmware/           # C firmware for MCU
│   ├── include/        # Header files
│   ├── src/            # Source files
│   └── sim/            # Windows simulation
├── data/               # Map data storage
└── docs/               # Documentation
```

## Hardware Requirements

- 4MB RAM
- 200MHz CPU
- 128MB Flash

## Quick Start

### 0. Clone and Initialize Submodules

```bash
git clone <repository-url>
cd trmap
git submodule update --init --recursive
```

### 1. Setup Python Environment

```bash
cd tools
pip install -r requirements.txt
```

### 2. Download Map Data

```bash
# Download only roads (default, smallest file size)
python download_map.py --bbox "120.5,31.2,120.7,31.4" --output ../data/suzhou.osm

# Download roads and water
python download_map.py --bbox "120.5,31.2,120.7,31.4" --features roads,water -o ../data/suzhou.osm

# Download all features (roads, water, parks, buildings)
python download_map.py --bbox "120.5,31.2,120.7,31.4" --features all -o ../data/suzhou_full.osm
```

### 3. Convert to MCU Format

```bash
# Convert with only roads (default)
python convert_map.py --input ../data/suzhou.osm --output ../data/suzhou.bin

# Convert with roads and water (for colored map)
python convert_map.py -i ../data/suzhou.osm -o ../data/suzhou.bin --features roads,water

# Convert with all features
python convert_map.py -i ../data/suzhou_full.osm -o ../data/suzhou_full.bin --features all
```

### 4. Build Firmware (Windows Simulation)

```bash
cd firmware/sim
mkdir build && cd build
cmake ..
cmake --build .
```

### 5. Run Simulation

```bash
./trmap_sim
```

## API Usage

### Navigation API

```c
#include "nav_api.h"

// Initialize map
map_t* map = map_load("map.bin");

// Find path
path_t* path = nav_find_path(map, start_lat, start_lon, end_lat, end_lon);

// Use path points
for (int i = 0; i < path->count; i++) {
    MAP_PRINTF("Point %d: %.6f, %.6f\n", i, path->points[i].lat, path->points[i].lon);
}

// Cleanup
path_free(path);
map_free(map);
```

### Rendering API

```c
#include "render_api.h"

// Create renderer
renderer_t* renderer = renderer_create(800, 600);

// Set viewport to fit path
renderer_fit_path(renderer, path, 0.15f);

// Option 1: Simple rendering (gray roads)
renderer_clear(renderer, 0xFFFFFFFF);
render_roads(renderer, map, 0xCCCCCCFF, 1.0f);

// Option 2: Themed rendering (Google Maps style)
map_theme_t theme = MAP_THEME_GOOGLE;  // or MAP_THEME_DARK
render_map_themed(renderer, map, &theme);

// Draw navigation path on top
render_style_t style = RENDER_STYLE_DEFAULT;
render_path(renderer, path, &style);

// Save to image
render_save_png(renderer, "path.bmp");

// Cleanup
renderer_destroy(renderer);
```

## Map Features

The system supports different levels of map detail:

| Feature | Description | Impact on File Size |
|---------|-------------|---------------------|
| `roads` | Road network for navigation | Required |
| `water` | Lakes, rivers, ponds | +10-20% |
| `parks` | Parks, forests, grass | +10-30% |
| `buildings` | Building footprints | +50-200% |

## Themes

Two built-in themes are available:

- `MAP_THEME_GOOGLE` - Google Maps style with colored roads
- `MAP_THEME_DARK` - Dark mode theme

## Code Quality Tools

### Static Analysis with Cppcheck

Run static code analysis to find potential bugs and issues:

```bash
# Run cppcheck analysis
.\build_and_test.bat check

# Report is saved to: firmware\sim\build\cppcheck\report.txt
```

Requirements:
- Install cppcheck: https://cppcheck.sourceforge.io/
- Windows: `choco install cppcheck` or download installer

### Code Formatting with AStyle

Format source code to maintain consistent style:

```bash
# Format all source files
.\build_and_test.bat format

# Check formatting without modifying files
.\build_and_test.bat format --check
```

Requirements:
- Install astyle: http://astyle.sourceforge.net/
- Windows: `choco install astyle` or download installer

Configuration:
- `.astylerc` - AStyle configuration file (Allman style, 4-space indent)
- `cppcheck.cfg` - Cppcheck project configuration

## License

MIT License
