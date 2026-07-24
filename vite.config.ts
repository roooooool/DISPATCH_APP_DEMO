import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { powerApps } from "@microsoft/power-apps-vite/plugin"
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), powerApps(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets', // Keeps images in dist/assets
    assetsInlineLimit: 500000, 
    rollupOptions: {
        output: {
          assetFileNames: `assets/[name].[ext]`,
        },
    },
  }
});
