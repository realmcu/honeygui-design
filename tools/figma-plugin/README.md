# Figma Plugin: Export to HML

A Figma plugin that exports designs directly to HoneyGUI HML projects.

## Quick Start

1. **Build the plugin:**
   ```bash
   cd tools/figma-plugin
   npm install
   npm run build
   ```

2. **Load in Figma Desktop:**
   - Open the Figma Desktop App
   - Menu → Plugins → Development → **Import plugin from manifest...**
   - Select `tools/figma-plugin/manifest.json`

3. **Run the plugin:**
   - In any Figma file: **Right-click → Plugins → Development → Figma to HML**
   - Or press `Ctrl/Cmd + /`, search for **"Export to HML"**

4. **Export your design:**
   - Select the Page and check the Frames you want to export
   - Configure project name, resolution, pixel format, etc.
   - Click **Export to HML** → wait for conversion
   - Click **Download ZIP** → get the complete HML project

## Release Notes

### v1.0.0

**Supported Features:**

- Export top-level Frames from a Figma Page as HML `hg_view`
- Convert nested Frame / Group / Component / Instance to `hg_window` containers
- Text → `hg_label`, Rectangle → `hg_rect`, Ellipse → `hg_circle`
- Automatically export image fills and vector shapes as `hg_image` assets
- Prototype interaction export:
  - `ON_CLICK` → `onClick` event
  - `ON_PRESS` / `MOUSE_DOWN` → `onTouchDown` event
  - `MOUSE_UP` → `onTouchUp` event
  - `ON_DRAG` → `onSwipeLeft` / `onSwipeRight` / `onSwipeUp` / `onSwipeDown` (automatically derived from transition direction)
  - `NAVIGATE` action → `switchView`, with automatic target view resolution and transition animation mapping
- Export configuration: resolution, pixel format, image format/scale, default font
- ZIP download of a complete HML project (includes project.json, HML file, image assets)
- Fully offline — no network dependency

**Known Limitations:**

- ⚠️ **Exported projects are not guaranteed to run directly in the simulator.** The export serves as a starting point from design to code — manual adjustments to attribute values, font files, and hierarchy structure may be required before it can compile and run successfully
- Overlay / Swap / Back / URL interaction types are not yet supported
- Figma effects (shadows, blur, etc.) are not converted
- Auto Layout is converted to absolute coordinates — flexible layout semantics are not preserved
- Font files must be prepared by the user and placed in the assets directory

## Features

- **One-click export** — Export the current design to an HML project ZIP directly within Figma
- **Visual configuration** — Select Pages, Frames, and set resolution, pixel format, and other parameters
- **Image asset export** — Automatically export image fills and vector shapes as image files
- **ZIP download** — Download a ZIP containing the complete HML project directory structure
- **Offline** — No network connection required; all conversion happens locally

## Installation

### Development Mode

1. **Build the plugin:**
   ```bash
   cd tools/figma-plugin
   npm install
   npm run build
   ```

2. **Load in Figma Desktop:**
   - Open the Figma Desktop App
   - Menu → Plugins → Development → Import plugin from manifest...
   - Select `tools/figma-plugin/manifest.json`

3. **Run the plugin:**
   - In any Figma file: Right-click → Plugins → Development → Figma to HML
   - Or use Quick Actions (Ctrl/Cmd + /), search for "Export to HML"

### Publish to Figma Community (Optional)

1. Go to the [Figma Plugin submission page](https://www.figma.com/developers/submit-plugin)
2. Upload `manifest.json` + the `dist/` directory

## Usage

1. **Open a Figma file** and run the plugin
2. **Select a Page** — the plugin automatically lists all Pages
3. **Check the Frames to export** — each top-level Frame maps to an `hg_view`
4. **Configure parameters:**
   - Project name
   - Target resolution (e.g., 454x454)
   - Pixel format (RGB565 / ARGB8888)
   - Image format and scale
   - Default font filename
5. **Click Export** → wait for conversion to complete
6. **Download ZIP** → get the complete HML project

## Output Structure

```
MyProject.zip
└── MyProject/
    ├── project.json          # Project configuration
    ├── ui/
    │   └── MyProject.hml     # HML design file
    ├── assets/               # Image assets
    │   ├── image_0.png
    │   ├── image_1.png
    │   └── ...
    └── src/
        └── user/             # User code directory
            └── .gitkeep
```

## Conversion Mapping

| Figma Node | HML Component | Description |
|------------|---------------|-------------|
| FRAME (top-level) | `hg_view` | Independent page/view |
| FRAME (nested) | `hg_window` | Nested container |
| GROUP | `hg_window` | Group |
| COMPONENT / INSTANCE | `hg_window` | Component |
| TEXT | `hg_label` | Text |
| RECTANGLE | `hg_rect` | Rectangle |
| RECTANGLE (image fill) | `hg_image` | Image |
| ELLIPSE | `hg_circle` | Circle |
| VECTOR / STAR / LINE | `hg_image` | Vector exported as image |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode (auto-rebuild on changes)
npm run watch
```

### Directory Structure

```
figma-plugin/
├── manifest.json           # Figma plugin manifest
├── package.json
├── tsconfig.json
├── scripts/
│   └── build-ui.js         # UI build script
├── src/
│   ├── code.ts             # Plugin backend (Figma sandbox)
│   ├── converter.ts        # Node conversion logic
│   ├── image-exporter.ts   # Image export
│   └── ui.html             # Plugin UI
└── dist/                   # Build output
    ├── code.js
    └── ui.html
```

### Architecture

- **code.ts** — Runs in the Figma sandbox; accesses `figma.*` API to read node data and export images
- **ui.html** — Runs in an iframe; provides the user interface and communicates with code.ts via `postMessage`
- **converter.ts** — Pure conversion logic; transforms the Figma node tree into HML XML
- **ZIP packaging** — Uses an embedded SimpleZip class in the UI layer to generate ZIPs (pure JS, no external dependencies)

## Limitations

- The Figma plugin sandbox does not support filesystem access — ZIP can only be downloaded via browser
- Complex vector paths (SVG curves) are exported as bitmaps
- Figma effects (shadows, blur) are not converted to HML
- Auto Layout is converted using absolute positions
- Font files must be prepared by the user and placed in the assets directory
