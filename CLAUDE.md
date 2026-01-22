# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

- **Install Dependencies**: `npm install`
- **Build Extension**: `npm run compile` (Output: `out/`)
- **Build Webview**: `npm run build:webview` (Production) or `npm run build:webview:dev` (Development)
- **Watch Extension**: `npm run watch` (Compiles TS on change)
- **Watch Webview**: `npm run watch:webview` (Rebuilds Webpack on change)
- **Lint**: `npm run lint` (ESLint)
- **Run Tests**: `npm run test`
- **Package Extension**: `npm run package` (Builds everything and creates .vsix)
- **Clean**: `npm run clean`

## Architecture and Structure

This project is a VS Code extension ("HoneyGUI Visual Designer") for embedded GUI development.

### Core Components
- **Extension Host** (`src/`): Runs in VS Code's Node.js process.
  - **Entry Point**: `src/extension.ts` initializes `ExtensionManager`.
  - **Core Logic**: `src/core/` manages extension lifecycle and providers.
  - **HML Handling**: `src/hml/` parses and processes the `.hml` (HoneyGUI Markup Language) files.
  - **Code Generation**: `src/codegen/` generates C code from the design.
  - **Simulation**: `src/simulation/` handles the compile-run-debug cycle for embedded simulation.
  - **Tools**: `src/tools/` contains resource converters (images, fonts, 3D models).

### Webview Designer
- **Location**: `src/webview/`
- **Tech Stack**: React 19, TypeScript, Zustand (State Management), Fabric.js (Canvas), Three.js (3D).
- **Build**: Built with Webpack into `out/designer/webview`.
- **Entry**: `src/webview/index.tsx`.
- **Communication**: Uses `vscode.postMessage` and window event listeners to exchange data with the Extension Host.

### Key Directories
- `src/`: Source code for extension and webview.
- `out/`: Compiled output (JS files).
- `resources/`: Icons and static assets.
- `l10n/`: Localization files.
- `scripts/`: Build and utility scripts.
- `test/`: Test files.

## Style and Conventions
- **Language**: TypeScript is used for both the extension and the webview.
- **UI Framework**: React with Hooks for the designer interface.
- **State Management**: Zustand is used for global state in the React app.
- **Internationalization**: Uses `vscode.l10n` for the extension and a custom i18n solution (`src/webview/i18n.ts`) for the webview.
- **Formatting**: Adheres to standard Prettier/ESLint rules defined in the project.
