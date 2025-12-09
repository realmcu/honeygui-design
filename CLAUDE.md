# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HoneyGUI Visual Designer is a VS Code extension that provides a visual drag-and-drop interface designer for creating HoneyGUI (HoneyGUI Markup Language) UI interfaces. It generates C++/C code for embedded applications.

**Key Technologies:**
- VS Code Extension API (TypeScript backend)
- React + TypeScript frontend with Zustand state management
- Webpack for frontend builds
- Custom XML-based HML format for UI descriptions
- C/C++ code generation with protected user code sections

## Development Commands

### Build and Development
```bash
npm install                    # Install dependencies
npm run compile               # Compile TypeScript extension code
npm run build:webview         # Build React frontend with webpack
npm run watch                 # Watch and compile TypeScript changes
npm run watch:webview         # Watch and rebuild frontend changes
npm run lint                  # Run ESLint
npm run clean                 # Clear build cache
npm run rebuild               # Full clean rebuild (clean + compile + build:webview)
```

### Testing and Quality
- `npm run test:e2e` - End-to-end testing
- `npm run lint` - ESLint code quality checks
- No formal unit testing framework - manual testing through VS Code development host required

**Testing Workflow:** Press F5 in VS Code to launch extension development host for manual testing

## Architecture Overview

### Extension Structure
The extension follows a clear separation between backend (TypeScript) and frontend (React):

- **Backend (`src/`)**: VS Code extension API handling file operations, HML parsing, code generation
- **Frontend (`src/webview/`)**: React-based visual designer interface using Zustand for state management

### Key Architectural Components

1. **HML (HoneyGUI Markup Language)**: Custom XML-based markup for UI description
   - Parser in `src/hml/HmlParser.ts`
   - Language configuration in `hml.language-configuration.json`
   - Custom text editor provider for `.hml` files

2. **Code Generation System**: Modular C++/C code generation
   - Generator base in `src/codegen/`
   - Language-specific generators for C++ and C
   - Preserves custom code in protected comment blocks

3. **Visual Designer**: React-based drag-and-drop interface
   - Component library with widgets (Button, Label, Container, etc.)
   - Canvas system for layout and positioning
   - Property panel for component configuration
   - Grid system and snap-to-grid functionality

4. **State Management**: Zustand store for frontend state
   - Components and their properties
   - Canvas state (selection, zoom, grid)
   - Project configuration

### File Organization
```
src/
├── core/                 # Extension management and command handling
│   ├── ExtensionManager.ts   # Extension lifecycle management
│   └── CommandManager.ts     # Command registration and handling
├── extension.ts          # Extension activation and command registration
├── webview/              # React frontend
│   ├── components/       # UI components (Toolbar, Canvas, PropertyPanel)
│   │   ├── DesignerCanvas.tsx    # Main design canvas
│   │   ├── ComponentLibrary.tsx  # Draggable component palette
│   │   └── PropertiesPanel.tsx   # Component property editor
│   ├── store.ts         # Zustand state management
│   └── types.ts         # TypeScript interfaces
├── hml/                  # HML parsing and handling
│   ├── HmlController.ts      # HML file control and operations
│   ├── HmlParser.ts          # XML parsing for HML format
│   └── HmlSerializer.ts      # HML serialization
├── codegen/              # Code generation logic
│   └── honeygui/        # HoneyGUI-specific generators
│       └── HoneyGuiCCodeGenerator.ts  # C code generation
├── designer/             # Visual designer backend logic
│   ├── DesignerPanel.ts      # Webview panel management
│   └── MessageHandler.ts     # Frontend-backend communication
├── simulation/           # Compilation and simulation services
│   ├── SimulationService.ts  # Simulation orchestration
│   ├── BuildCore.ts          # Build system core
│   └── EnvironmentChecker.ts # Development environment validation
├── preview/              # Preview functionality
└── utils/                # Utility functions
```

### Key Extension Points

1. **Command Registration**: Commands defined in `package.json` and registered in `extension.ts`
2. **Custom Editor Provider**: HML files handled by custom editor provider
3. **View Containers**: Explorer view for project management
4. **Configuration**: VS Code settings for code generation and UI preferences

## Code Generation Architecture

The code generation system supports both C++ and C output:
- Template-based generation with variable substitution
- Protection of custom code sections between special comment blocks
- Support for multiple output files and directory structures
- Integration with embedded system conventions

**File Generation Strategy:**
| File Type | Strategy | Location | Purpose |
|-----------|----------|----------|---------|
| `*_ui.h/c` | Overwrite | `src/autogen/` | Pure UI code, fully controlled by designer |
| `*_callbacks.c` | Protected | `src/autogen/` | Callback implementations with user code preservation |
| `user/*.c` | One-time | `src/user/` | User-controlled application logic |

**Protected Code Blocks:**
```c
/* @protected start callback_name */
void callback_name(gui_obj_t *obj) {
    // User code preserved during regeneration
}
/* @protected end callback_name */
```

## HML File Format

HML files use XML syntax to describe UI components:
- Root element contains project metadata
- Component elements define widgets with properties
- Supports nested component hierarchies
- Custom attributes for positioning and styling

## Preview & Execution Architecture

The extension implements three distinct preview strategies to balance development speed and fidelity:

1. **Webview Preview (Layout Preview)**
   - **Mechanism**: React-based rendering within the VS Code Webview panel.
   - **Use Case**: Real-time layout adjustment, property tweaking, drag-and-drop design.
   - **Pros**: Zero latency, integrated with designer UI.
   - **Cons**: Approximation of the engine; not pixel-perfect with C renderer.

2. **Simulator Preview (Engine Preview)**
   - **Mechanism**: External `runner` process (C-based engine simulator) loading HML directly.
   - **Communication**: IPC (TCP/WebSocket) for real-time property updates without restarting.
   - **Use Case**: Verifying engine-specific rendering (fonts, anti-aliasing) during design.
   - **Status**: Currently implemented as basic file-watch-restart; planned upgrade to IPC hot-reload.

3. **Compilation Run (Target Preview)**
   - **Mechanism**: Full compilation chain (HML -> C Code -> GCC/MinGW -> Native EXE).
   - **Use Case**: Verifying generated C code logic, callbacks, and performance.
   - **Pros**: 100% fidelity to final output; validates C compilation.
   - **Cons**: High latency (requires compilation); state reset on update.

## Development Notes

**Code Style Guidelines:**
- Relaxed ESLint rules - prioritize functionality over strict code style
- TypeScript strict mode enabled for type safety
- Focus on practical solutions for embedded development workflows

**Communication Architecture:**
- Frontend-backend communication through VS Code webview API
- State synchronization between React frontend and extension backend
- File watchers handle external changes to HML files
- Message-based protocol for component updates and code generation

**Development Environment:**
- Requires VS Code extension development environment
- Manual testing through F5 development host launch
- E2E tests available but require HoneyGUI SDK installation
- No unit testing framework - functional testing preferred

**Key Dependencies:**
- VS Code Extension API for IDE integration
- React + Zustand for frontend state management
- Webpack for frontend bundling
- TypeScript for type safety throughout
- XML parsing for HML format handling

**Common Development Tasks:**
- Add new components: Update component library in `src/webview/components/ComponentLibrary.tsx`
- Modify code generation: Edit `src/codegen/honeygui/HoneyGuiCCodeGenerator.ts`
- Add new commands: Register in `package.json` and implement in `src/core/CommandManager.ts`
- Update HML format: Modify parser in `src/hml/HmlParser.ts` and serializer in `src/hml/HmlSerializer.ts`

**Project Structure Generated:**
```
my-project/
├── ui/main/
│   └── main.hml          # HML design file
├── src/autogen/main/     # Generated C code (auto-managed)
├── src/user/main/        # User application code
├── assets/               # Resource files (images, fonts)
└── project.json          # Project configuration
```

**External Dependencies:**
- HoneyGUI SDK: Install to `~/.HoneyGUI-SDK`
- SCons: `pip install scons` (build tool)
- GCC/MinGW: C compiler for compilation
- SDL2: Graphics library (runtime only)