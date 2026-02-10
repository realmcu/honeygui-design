# VSCode Extension Source Knowledge Base

**Parent:** [honeygui-design](../AGENTS.md)  
**Purpose:** Extension implementation and webview UI

## OVERVIEW

TypeScript source for VSCode extension providing visual GUI designer, code generation, and simulation.

## STRUCTURE

```
src/
├── extension.ts         # Entry point
├── core/                # ExtensionManager, commands
├── hml/                 # HML parser/serializer
├── codegen/honeygui/    # C code generator
├── designer/            # Webview panel management
├── simulation/          # Build + run system
├── tools/               # Image/font/3D/video converters
├── services/            # High-level services
└── webview/             # React designer UI
    ├── App.tsx          # Main application
    ├── store.ts         # Zustand state management
    └── components/      # UI components
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add command | `core/CommandManager.ts` | Register all commands |
| Parse HML | `hml/HmlParser.ts` | XML → component tree |
| Generate C code | `codegen/honeygui/` | Component generators |
| Webview UI | `webview/App.tsx` | React designer |
| Build system | `simulation/BuildManager.ts` | SCons integration |
| Add component | `webview/components/ComponentLibrary.tsx` | Widget definitions |

## CONVENTIONS

### Extension Entry
```typescript
export async function activate(context: vscode.ExtensionContext) {
    const manager = new ExtensionManager(context);
    await manager.initialize();
}
```

### Code Generation
- **UI files** (`*_ui.c/h`): Overwritten each time
- **Callback files** (`*_callbacks.c`): Protected regions preserved
- **User files** (`user/*.c`): Never overwritten

### Message Protocol
Extension ↔ Webview:
```typescript
panel.webview.postMessage({ type: 'loadHml', data: hmlData });
vscodeAPI.postMessage({ type: 'save', data: componentTree });
```

## ANTI-PATTERNS

- **DO NOT** add network dependencies (offline-only)
- **DO NOT** use PowerShell-specific syntax (CMD only)
- **NEVER** overwrite `user/` directory files
- **NEVER** modify protected region markers in generated code

## NOTES

- **Distributed architecture:** No centralized `commands/` or `providers/`
- **Chinese i18n required:** Use `vscode.l10n.t()` (extension) and `t()` (webview)
- **Webpack bundling:** Single-file output for webview (no code splitting)
- **State management:** Zustand with 50-step undo/redo
