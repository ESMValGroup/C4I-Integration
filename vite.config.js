import { defineConfig } from "vite";

export default defineConfig(({ command, isPreview }) => ({
  // Relative asset paths, so the site can be served from any directory
  base: "./",
  // The manifest and recipe output live on the web server, not in dist/, so
  // they can be updated without a rebuild. During development, data/ stands
  // in for them.
  publicDir: command === "serve" && !isPreview ? "data" : false,
  build: {
    // Vega and Vega-Lite alone are about 800 kB
    chunkSizeWarningLimit: 1000,
  },
}));
