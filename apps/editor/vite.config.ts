import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri serves this dev server and loads dist/ in production.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { outDir: "dist", target: "chrome105", sourcemap: true },
});
