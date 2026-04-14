# Webview Designer Knowledge Base

**Parent:** [src/AGENTS.md](../AGENTS.md)  
**Generated:** 2026-04-14 08:28 UTC

## OVERVIEW

React-based visual GUI designer running in VSCode webview. State management via Zustand, canvas via Fabric.js, 3D rendering via Three.js.

## STRUCTURE

```
webview/
├── App.tsx           # Main component
├── store.ts          # Zustand store (50-step undo/redo)
├── index.tsx         # Entry point → renders App
├── index.html        # Webview HTML template
├── global.css        # Global styles
├── components/       # UI components
│   ├── DesignerCanvas.tsx    # Fabric.js canvas
│   ├── ComponentLibrary.tsx # Component palette
│   ├── ComponentTree.tsx    # Hierarchy tree
│   ├── PropertiesPanel.tsx  # Property editors
│   ├── AssetsPanel.tsx      # Asset manager
│   ├── Toolbar.tsx          # Action toolbar
│   ├── widgets/             # Component renderers
│   └── properties/          # Property input components
├── hooks/            # Custom React hooks
├── i18n/             # Translations (en, zh-cn)
├── services/         # Frontend services
├── utils/            # Utilities
├── constants/        # Constants
└── config/           # Configuration
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add component type | `components/ComponentLibrary.tsx` | componentDefinitions array |
| Component rendering | `components/widgets/` | Each widget has its own file |
| State management | `store.ts` | useDesignerStore hook |
| i18n strings | `i18n/locales/` | en.ts, zh-cn.ts |
| Canvas interactions | `components/DesignerCanvas.tsx` | Fabric.js events |
| Property editing | `components/properties/` | Dynamic editors by type |

## CONVENTIONS

- **Entry**: `index.tsx` → `App.tsx` → renders panels
- **State**: Single Zustand store with undo/redo
- **Styling**: CSS modules (per-component) + global.css
- **VSCode theme**: Use `var(--vscode-*)` CSS variables
- **Messages**: Send to extension via `vscode.postMessage()`
- **i18n**: Use `t('key')` from `../i18n`

## BUILD

```bash
npm run build:webview      # Production
npm run build:webview:dev  # Development
npm run watch:webview      # Hot reload
```

## ANTI-PATTERNS

- **DO NOT** use external fonts or CDN resources (offline-only)
- **NEVER** add network calls to external APIs
- **NEVER** bypass the store for state management