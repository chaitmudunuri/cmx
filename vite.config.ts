import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  clearScreen: false,
  server: {
    // Pin IPv4 loopback: "localhost" can resolve to ::1 while the server
    // listens on 127.0.0.1 (or vice versa), leaving the Tauri window with
    // a white screen + "Could not connect to the server".
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep the synchronous CodeMirror core in one cacheable vendor chunk;
        // language packs, marked, and fonts already split via dynamic import().
        manualChunks: {
          "cm-vendor": [
            "@codemirror/state",
            "@codemirror/view",
            "@codemirror/commands",
            "@codemirror/language",
            "@codemirror/search",
            "@codemirror/autocomplete",
            "@lezer/highlight",
            "@replit/codemirror-vim",
          ],
        },
      },
    },
  },
});
