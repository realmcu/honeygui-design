import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'out/designer/webview',
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'src/webview/index.tsx'),
      name: 'HoneyGUIDesigner',
      formats: ['cjs'],
      fileName: 'webview'
    },
    rollupOptions: {
      external: ['vscode']
    }
  }
});
