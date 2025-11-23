/**
 * Keyboard Shortcuts Handler
 * Manages all keyboard shortcuts for the designer
 */

import { useEffect } from 'react';
import { useDesignerStore } from '../store';

export const useKeyboardShortcuts = () => {
  const {
    selectedComponent,
    removeComponent,
    duplicateComponent,
  } = useDesignerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModKey = e.ctrlKey || e.metaKey; // Ctrl on Windows/Linux, Command on Mac
      const isShift = e.shiftKey;

      // Prevent default behavior for our shortcuts
      let handled = true;

      switch (e.key) {
        // Save (Ctrl+S)
        case 's':
        case 'S':
          if (isModKey) {
            e.preventDefault();
            window.vscodeAPI?.postMessage({
              command: 'save',
              content: {},
            });
          }
          break;

        // Undo (Ctrl+Z or Command+Z) - TODO: Implement command manager
        // case 'z':
        // case 'Z':
        //   if (isModKey && !isShift) {
        //     e.preventDefault();
        //     if (commandManager.canUndo()) {
        //       commandManager.undo();
        //     }
        //   }
        //   // Redo (Ctrl+Shift+Z or Command+Shift+Z)
        //   else if (isModKey && isShift) {
        //     e.preventDefault();
        //     if (commandManager.canRedo()) {
        //       commandManager.redo();
        //     }
        //   }
        //   break;

        // Redo (Ctrl+Y or Command+Y) - TODO: Implement command manager
        // case 'y':
        // case 'Y':
        //   if (isModKey) {
        //     e.preventDefault();
        //     if (commandManager.canRedo()) {
        //       commandManager.redo();
        //     }
        //   }
        //   break;

        // Delete (Delete or Backspace)
        case 'Delete':
        case 'Backspace':
          if (selectedComponent) {
            e.preventDefault();
            removeComponent(selectedComponent);
          }
          break;

        // Copy (Ctrl+C)
        case 'c':
        case 'C':
          if (isModKey) {
            e.preventDefault();
            // TODO: Implement copy to clipboard
            console.log('Copy component:', selectedComponent);
          }
          break;

        // Paste (Ctrl+V)
        case 'v':
        case 'V':
          if (isModKey) {
            e.preventDefault();
            // TODO: Implement paste from clipboard
            console.log('Paste component');
          }
          break;

        // Duplicate (Ctrl+D)
        case 'd':
        case 'D':
          if (isModKey) {
            e.preventDefault();
            if (selectedComponent) {
              duplicateComponent(selectedComponent);
            }
          }
          break;

        // Nudge (Arrow keys)
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          if (selectedComponent) {
            e.preventDefault();
            const nudgeDistance = isShift ? 10 : 1; // Shift+Arrow for 10px, Arrow for 1px
            nudgeComponent(e.key, nudgeDistance);
          }
          break;

        // Generate Code (Ctrl+G)
        case 'g':
        case 'G':
          if (isModKey) {
            e.preventDefault();
            window.vscodeAPI?.postMessage({
              command: 'codegen',
              language: 'cpp',
              content: {},
            });
          }
          break;

        // Preview (F5)
        case 'F5':
          e.preventDefault();
          window.vscodeAPI?.postMessage({
            command: 'preview',
            content: {},
          });
          break;

        // Escape (Deselect)
        case 'Escape':
          e.preventDefault();
          // TODO: Deselect component
          break;

        default:
          handled = false;
          break;
      }

      if (handled) {
        e.stopPropagation();
      }
    };

    const nudgeComponent = (key: string, distance: number) => {
      if (!selectedComponent) return;

      const { components, updateComponent } = useDesignerStore.getState();
      const component = components.find(c => c.id === selectedComponent);
      if (!component) return;

      let deltaX = 0;
      let deltaY = 0;

      switch (key) {
        case 'ArrowUp':
          deltaY = -distance;
          break;
        case 'ArrowDown':
          deltaY = distance;
          break;
        case 'ArrowLeft':
          deltaX = -distance;
          break;
        case 'ArrowRight':
          deltaX = distance;
          break;
      }

      updateComponent(selectedComponent, {
        position: {
          ...component.position,
          x: Math.max(0, component.position.x + deltaX),
          y: Math.max(0, component.position.y + deltaY),
        },
      });
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedComponent, removeComponent, duplicateComponent]);
};

export default useKeyboardShortcuts;
