# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HoneyGUI Visual Designer is a VS Code extension that provides a visual drag-and-drop interface for creating HoneyGUI (HoneyGUI Markup Language) UI interfaces. It generates C++/C code for embedded applications with support for protected code regions.

**Key Technologies:**
- TypeScript 5.3
- React 18 + ReactDOM + Zustand (for webview UI)
- VS Code Extension API
- Webpack 5 (webview build)
- HML (HoneyGUI Markup Language - custom XML-like format)

## Development Commands

### Build Commands
```bash
# Install dependencies
npm install

# Compile extension TypeScript (main process)
npm run compile

# Watch extension TypeScript for changes
npm run watch

# Build webview React app (production)
npm run build:webview

# Build webview React app (development)
npm run build:webview:dev

# Watch webview for changes
npm run watch:webview

# Serve webview with dev server (port 3000)
npm run serve:webview

# Lint code
npm run lint

# Run tests
npm test

# Full build before publishing
npm run vscode:prepublish
```

### Testing/Running
```bash
# Press F5 in VS Code to launch extension in debug mode
# OR use watch mode during development:
npm run watch

# Run tests
npm test
```

### Packaging
```bash
# Generate VSIX file (requires vsce installed)
vsce package

# Output will be: honeygui-visual-designer-{version}.vsix
```

## Architecture Overview

### Module Structure

The project follows a modular architecture with clear separation between extension logic and webview UI:

```
src/
├── extension.ts                    # Extension entry point
├── webview/                        # React webview UI
│   ├── index.tsx                   # React app entry
│   ├── App.tsx                     # Main app component
│   ├── store.ts                    # Zustand state management
│   ├── types.ts                    # TypeScript types
│   ├── components/                 # UI components
│   │   ├── Toolbar.tsx
│   │   ├── ComponentLibrary.tsx
│   │   ├── DesignerCanvas.tsx
│   │   ├── PropertiesPanel.tsx
│   │   ├── ComponentTree.tsx
│   │   └── ResourceManager.tsx
│   └── utils/
│       └── undoRedo.ts             # Command pattern undo/redo
├── designer/
│   ├── DesignerPanel.ts            # Webview panel management
│   └── DesignerModel.ts            # Designer data model
├── hml/
│   ├── HmlController.ts            # HML file operations
│   ├── HmlParser.ts                # Parse HML to components
│   └── HmlSerializer.ts            # Serialize components to HML
├── codegen/
│   ├── CodeGenerator.ts            # Abstract generator base
│   └── cpp/
│       └── CppCodeGenerator.ts     # C++ code generation
├── preview/
│   ├── PreviewService.ts           # Preview management
│   └── PreviewRunner.ts            # HoneyGUI Runner integration
├── template/
│   ├── TemplateManager.ts
│   ├── ProjectWizard.ts
│   └── ProjectTemplate.ts
└── config/
    └── ConfigManager.ts
```

### State Management

**Extension-side**: State managed directly through HmlController and config managers
**Webview-side**: React + Zustand for UI state management

**Key Zustand store features:**
- Component CRUD operations
- Selection state
- Undo/redo (Command pattern with 50-step history)
- Canvas state (zoom, pan, grid settings)

### Communication Flow

1. **Extension → Webview**: Via `postMessage()` with typed messages
   - `loadHml`: Load designer with HML content
   - `showMessage`: Display notifications
   - `error`: Display error messages

2. **Webview → Extension**: Via `vscode.postMessage()`
   - `save`: Request save operation
   - `codegen`: Request code generation
   - `addComponent`/`removeComponent`/`updateComponent`: Component changes
   - `notify`: User notifications

### Build Output

```
out/
├── extension.js                    # Compiled extension
├── extension.js.map
├── hml/
├── designer/
│   └── designerPanel.js
├── codegen/
│   └── cpp/
│       └── CppCodeGenerator.js
└── designer/
    └── webview/                    # React build output
        ├── index.html
        ├── styles.css
        └── webview.js              # 791 KiB React bundle
```

## Development Guidelines

### Adding New UI Components

1. **Component Definition** (`src/webview/types.ts`):
   - Add component type to `ComponentDefinition`
   - Define property schema

2. **Component Library** (`ComponentLibrary.tsx`):
   - Add entry to `COMPONENT_LIBRARY`
   - Provide icon, name, description

3. **Component Rendering** (`DesignerCanvas.tsx`):
   - Add rendering case in `renderComponent`
   - Implement component-specific rendering

4. **Code Generation** (`src/codegen/cpp/CppCodeGenerator.ts`):
   - Add generate method for new component type
   - Register in main generate loop

### HML File Format

HML is a custom XML-like format:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hone:HoneyGUI xmlns:hone="http://www.honeygui.com"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xsi:schemaLocation="http://www.honeygui.com honeygui.xsd">
    <HoneyGUI version="1.0">
        <Plugin name="com.honeygui.designer" version="1.1.0"/>
        <Window width="800" height="600" title="Main Window">
            <Button id="button1" x="100" y="50" width="120" height="40" text="Click Me"/>
            <Label id="label1" x="100" y="120" width="200" height="30" text="Hello HoneyGUI"/>
        </Window>
    </HoneyGUI>
</hone:HoneyGUI>
```

### Protected Code Regions

When generating C++/C code, users can add protected regions using special comments:

```cpp
// HONEYGUI PROTECTED START [unique-id]
// Your custom code here - preserved during regeneration
int customVariable = 42;
// HONEYGUI PROTECTED END [unique-id]
```

The code generator (`CppCodeGenerator`) parses existing files and merges protected regions into new generated code.

## Key Implementation Details

### Undo/Redo System

Implements Command Pattern:
- `AddComponentCommand`
- `DeleteComponentCommand`
- `MoveComponentCommand`
- `UpdatePropertyCommand`

Managed by `CommandManager` with 50-step history. Integrated into Zustand store.

### Designer Canvas

Supports:
- Drag-and-drop from component library
- Component selection with visual feedback
- Position snapping to grid (8px default)
- Zoom (25% - 800%)
- Multi-level component nesting

### Keyboard Shortcuts

Implemented via React hook (`useKeyboardShortcuts`):
- Ctrl+S: Save
- Ctrl+Z: Undo
- Ctrl+Shift+Z/Ctrl+Y: Redo
- Delete: Delete selected
- Ctrl+D: Duplicate
- Arrow keys: Nudge (1px)
- Shift+Arrow: Nudge (10px)

### Extension Commands

- `honeygui.newProject`: Create new project with wizard
- `honeygui.openDesigner`: Open visual designer
- `honeygui.codegen`: Generate C++/C code
- `honeygui.preview`: Launch preview with HoneyGUI Runner
- `honeygui.openResourceManager`: Open resource browser
- `honeygui.openDocs`: Open documentation
- `honeygui.migrateXmlToHml`: Migrate XML files to HML

## VS Code Configuration Settings

The extension contributes these settings (prefix: `honeygui.`):

- `codegen.language`: Target language (cpp/c)
- `codegen.outputDir`: Code generation output directory
- `codegen.outputPath`: Code output path (default: "src")
- `codegen.cppVersion`: C++ version (default: "c++17")
- `codegen.enableDebugInfo`: Include debug info in generated code
- `hml.outputDir`: HML file output directory
- `preview.runnerPath`: Path to HoneyGUI Runner executable
- `preview.autoDownload`: Auto-download runner if missing
- `preview.timeoutMs`: Preview timeout in milliseconds
- `ui.gridSize`: Grid size for snapping (default: 8)
- `ui.snapToGrid`: Enable grid snapping
- `telemetry.enabled`: Enable telemetry collection
- `preview.autoReload`: Auto-reload preview on changes

## Testing

Tests are located in `test/` directory:
- Unit tests: `test/unit/`
- Integration tests: `test/integration/`

Run tests:
```bash
npm test
```

This compiles TypeScript then runs the test suite.

## Known Limitations

1. **Bundle Size**: React bundle is 791 KiB (larger than recommended 244 KiB). Consider code splitting for production.

2. **Communication**: Webview <-> extension communication needs completion for certain features.

3. **Performance**: React.memo not widely used; consider optimizations for large component trees.

4. **File System**: Resource manager uses mock data; needs real file system integration.

## Build System

Uses dual build system:
- **Extension**: TypeScript compiler (tsc) to `out/`
- **Webview**: Webpack 5 to `out/designer/webview/`

**Webpack features:**
- ts-loader for TypeScript compilation
- css-loader + style-loader (dev) / MiniCssExtractPlugin (prod)
- HtmlWebpackPlugin for HTML generation
- Source maps for debugging

Dev server available on port 3000 for webview development.
