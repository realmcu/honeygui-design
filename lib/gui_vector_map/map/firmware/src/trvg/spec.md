# TRVG - Triton Vector Graphics Library

C language vector graphics library, optimized for MCU and map rendering.

## Design Goals

- ✅ Adapted for trmap map rendering (render_api.c), excels at drawing large numbers of elements
- ✅ Optimized memory usage and rendering speed for map elements
- ✅ Adapted for MCU runtime environment
- ✅ Use static memory whenever possible
- ✅ Low memory footprint
- ✅ Fast rendering speed
- ✅ Support BGRA/BGR565 color formats
- ✅ Anti-aliasing not required
- ✅ Completely avoid memory leaks and illegal memory access
- ✅ Only retain ultra-fast drawing API (no anti-aliasing, MCU optimized)

## File Structure

```
trvg/
├── trvg.h           # Core API header file (ultra-fast drawing API)
├── trvg.c           # Core implementation
├── trvg_render.h    # Map rendering adapter layer header
├── trvg_render.c    # Map rendering adapter layer implementation
├── trvg_test.c      # Unit tests
└── spec.md          # This document
```

## Core Features

### 1. Ultra-Simple Context

No complex memory configuration needed, just provide pixel buffer:

```c
trvg_context_t ctx;
trvg_init(&ctx, pixels, width, height, 0, TRVG_PIXEL_RGBA8888);
```

### 2. Multiple Pixel Format Support

```c
typedef enum {
    TRVG_PIXEL_BGRA8888,    // 32-bit BGRA (8 bits per channel)
    TRVG_PIXEL_RGBA8888,    // 32-bit RGBA (8 bits per channel)
    TRVG_PIXEL_BGR565,      // 16-bit BGR565
    TRVG_PIXEL_RGB565       // 16-bit RGB565
} trvg_pixel_format_t;
```

### 3. Ultra-Fast Drawing API

All drawing functions are non-anti-aliased, use integer coordinates, optimized for MCU:

```c
// Clear screen
trvg_fast_clear(&ctx, 255, 255, 255);  // White background

// Pixel, lines
trvg_fast_pixel(&ctx, x, y, r, g, b);
trvg_fast_hline(&ctx, x0, x1, y, r, g, b);
trvg_fast_vline(&ctx, x, y0, y1, r, g, b);
trvg_fast_line(&ctx, x0, y0, x1, y1, r, g, b);
trvg_fast_thick_line(&ctx, x0, y0, x1, y1, thickness, r, g, b);

// Rectangle
trvg_fast_fill_rect(&ctx, x, y, w, h, r, g, b);
trvg_fast_stroke_rect(&ctx, x, y, w, h, r, g, b);

// Circle
trvg_fast_fill_circle(&ctx, cx, cy, radius, r, g, b);
trvg_fast_stroke_circle(&ctx, cx, cy, radius, r, g, b);

// Polygon (point array format: [x0, y0, x1, y1, ...])
int16_t points[] = {100, 100, 200, 100, 150, 200};
trvg_fast_fill_polygon(&ctx, points, 3, r, g, b);
trvg_fast_stroke_polygon(&ctx, points, 3, true, r, g, b);
trvg_fast_thick_polygon(&ctx, points, 3, true, thickness, r, g, b);

// Triangle (specially optimized)
trvg_fast_fill_triangle(&ctx, x0, y0, x1, y1, x2, y2, r, g, b);
```

### 4. Clipping Support

```c
trvg_set_clip(&ctx, x, y, w, h);  // Set clipping region
trvg_reset_clip(&ctx);            // Reset to entire canvas
```

## Map Rendering Adapter Layer

`trvg_render.h/c` provides optimized interfaces specifically for map rendering:

### Initialization

```c
trvg_map_renderer_t renderer;
trvg_map_renderer_init(&renderer, pixels, width, height, stride, format);
trvg_map_set_viewport(&renderer, min_lat, min_lon, max_lat, max_lon);
```

### Drawing Map Elements

```c
// Draw road
trvg_map_draw_road(&renderer, points, count, ROAD_PRIMARY, &TRVG_THEME_DAY);

// Draw area
trvg_map_draw_area(&renderer, points, count, AREA_WATER, &TRVG_THEME_DAY);

// Draw navigation path
trvg_map_draw_path(&renderer, points, count, trvg_rgb(0, 128, 255), 5.0f);

// Draw position marker
trvg_map_draw_marker(&renderer, lat, lon, trvg_rgb(255, 0, 0), 10.0f);

// Draw direction arrow
trvg_map_draw_direction_arrow(&renderer, lat, lon, heading, trvg_rgb(0, 0, 255), 12.0f);
```

### Predefined Themes

```c
extern const trvg_map_theme_t TRVG_THEME_DAY;   // Day theme
extern const trvg_map_theme_t TRVG_THEME_NIGHT; // Night theme
```

## Performance Optimization

### 1. No Anti-aliasing

All drawing uses integer coordinates, no anti-aliasing calculations, greatly improves performance.

### 2. Optimized Algorithms

- Lines: Bresenham algorithm
- Circles: Midpoint Circle algorithm
- Polygons: Scanline fill algorithm
- Triangles: Specially optimized scanline algorithm

### 3. ARM MVE (Helium) SIMD Acceleration

TRVG supports ARM Cortex-M55/M85 MVE (M-Profile Vector Extension) hardware acceleration:

**Supported Compiler:** armclang 6.22+

**Compile Options:**
```bash
-march=armv8.1-m.main+dsp+mve.fp+fp.dp -mfloat-abi=hard
```

**Automatically Optimized Functions:**
| Function | MVE Optimization | Speedup |
|----------|------------------|---------|
| `trvg_fast_clear` | 128-bit vector fill | 4-8x |
| `trvg_fast_hline` | 128-bit vector fill | 2-4x |
| `trvg_fast_fill_rect` | Per-row MVE fill | 2-4x |
| `trvg_fast_fill_circle` | Symmetric hline MVE | 2-3x |
| `trvg_fast_fill_triangle` | Scanline MVE fill | 2-3x |

**Feature Detection:**
```c
#include "trvg_mve.h"

#if TRVG_USE_MVE
    // MVE acceleration enabled
#endif
```

**Note:** When MVE is not available (PC simulation or older MCU), the code automatically falls back to scalar implementation.

### 4. Line Segment Simplification

Automatically skip line segments too short on screen:

```c
renderer.min_road_segment_length = 2.0f;  // Road segments smaller than 2 pixels are skipped
renderer.min_area_segment_length = 1.0f;  // Area boundaries smaller than 1 pixel are skipped
```

### 5. Clipping Optimization

All drawing functions have built-in clipping checks to avoid out-of-bounds access.

## Memory Usage

New simplified version doesn't require pre-allocating large buffers:

| Item | Size |
|------|------|
| trvg_context_t | ~32 bytes |
| Temporary point buffer (render layer) | 1 KB |
| **Total** | **~1 KB** |

## Usage Examples

### Basic Drawing

```c
#include "trvg.h"

// Frame buffer
uint8_t pixels[800 * 600 * 4];

int main() {
    trvg_context_t ctx;
    trvg_init(&ctx, pixels, 800, 600, 0, TRVG_PIXEL_RGBA8888);
    
    // Clear background
    trvg_fast_clear(&ctx, 255, 255, 255);
    
    // Draw red rectangle
    trvg_fast_fill_rect(&ctx, 100, 100, 200, 150, 255, 0, 0);
    
    // Draw blue circle
    trvg_fast_fill_circle(&ctx, 400, 300, 80, 0, 0, 255);
    
    // Draw green line
    trvg_fast_thick_line(&ctx, 500, 100, 700, 400, 3, 0, 128, 0);
    
    return 0;
}
```

### Map Rendering

```c
#include "trvg_render.h"

int main() {
    uint8_t pixels[800 * 600 * 4];
    
    trvg_map_renderer_t renderer;
    trvg_map_renderer_init(&renderer, pixels, 800, 600, 0, TRVG_PIXEL_RGBA8888);
    
    // Set viewport (Suzhou area)
    trvg_map_set_viewport(&renderer, 31.2, 120.5, 31.4, 120.7);
    
    // Clear background
    trvg_fast_clear(&renderer.ctx, 
                    TRVG_THEME_DAY.background.r,
                    TRVG_THEME_DAY.background.g,
                    TRVG_THEME_DAY.background.b);
    
    // Draw map elements...
    coord_t road_points[] = {{31.25, 120.55}, {31.30, 120.60}, {31.35, 120.65}};
    trvg_map_draw_road(&renderer, road_points, 3, ROAD_PRIMARY, &TRVG_THEME_DAY);
    
    return 0;
}
```

## Compile and Test

```bash
# Compile test program
gcc -o trvg_test trvg.c trvg_test.c -lm

# Run tests
./trvg_test
```

## Integration with Existing Code

TRVG can be used as a replacement or supplementary backend for `render_api.c`:

1. Replace NanoVG/AGGE in scenarios requiring software rendering
2. Use ultra-fast drawing API in MCU environment
3. Support more pixel formats for specific display devices

## API Change Notes

### Removed APIs (Old Version)

The following APIs have been removed, use new ultra-fast drawing APIs instead:

- Path operations (trvg_begin_path, trvg_move_to, trvg_line_to, etc.)
- Bezier curves (trvg_quad_to, trvg_cubic_to)
- Transform matrices (trvg_save, trvg_restore, trvg_translate, trvg_scale, trvg_rotate)
- Gradients (trvg_gradient_*, trvg_set_fill_gradient, etc.)
- Style settings (trvg_set_stroke_*, trvg_set_fill_*, etc.)
- Anti-aliased drawing (trvg_fill, trvg_stroke, trvg_fill_rect, etc.)
- Memory configuration (trvg_memory_config_t)

### New Ultra-Fast Drawing APIs

All drawing functions are prefixed with `trvg_fast_`, using integer coordinates and RGB component parameters.

