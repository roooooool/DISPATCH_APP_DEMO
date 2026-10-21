
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { powerApps } from "@microsoft/power-apps-vite/plugin";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  base: "/DISPATCH_APP_DEMO/",

  plugins: [
    react(),
    powerApps(),
    tailwindcss(),
    tsconfigPaths(),
  ],

  build: {
    outDir: "dist",
    assetsDir: "assets",
    assetsInlineLimit: 500000,

    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        microsoftCallback: path.resolve(
          __dirname,
          "microsoft-callback.html"
        ),
      },

      output: {
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

