import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths, so the site can be served from any directory
  base: "./",
  build: {
    // Vega and Vega-Lite alone are about 800 kB
    chunkSizeWarningLimit: 1000,
  },
});
