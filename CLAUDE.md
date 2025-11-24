# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HoneyGUI Visual Designer is a VS Code extension that provides a visual drag-and-drop interface designer for creating HoneyGUI (HoneyGUI Markup Language) UI interfaces. It generates C++/C code for embedded applications.

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

### Testing
No formal testing framework is implemented. Manual testing is required through VS Code extension development host.

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
├── extension.ts          # Extension activation and command registration
├── webview/              # React frontend
│   ├── components/       # UI components (Toolbar, Canvas, PropertyPanel)
│   ├── store.ts         # Zustand state management
│   └── types.ts         # TypeScript interfaces
├── hml/                  # HML parsing and handling
├── codegen/              # Code generation logic
├── designer/             # Visual designer backend logic
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

## HML File Format

HML files use XML syntax to describe UI components:
- Root element contains project metadata
- Component elements define widgets with properties
- Supports nested component hierarchies
- Custom attributes for positioning and styling

## Development Notes

- The project uses relaxed ESLint rules - focus on functionality over strict code style
- No automated tests - manual testing required through VS Code development environment
- Frontend and backend communicate through VS Code webview API
- State synchronization between React frontend and extension backend
- File watchers handle external changes to HML files