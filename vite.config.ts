import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { demoPortsPlugin } from "./demo/ports-plugin";

const demo = process.env.WATCHTOWER_DEMO === "1";
const demoAlias = demo
  ? {
      "@tauri-apps/api/core": path.resolve(__dirname, "demo/shims/core.ts"),
      "@tauri-apps/api/event": path.resolve(__dirname, "demo/shims/event.ts"),
      "@tauri-apps/api/window": path.resolve(__dirname, "demo/shims/window.ts"),
      "@tauri-apps/api/path": path.resolve(__dirname, "demo/shims/path.ts"),
      "@tauri-apps/api/tray": path.resolve(__dirname, "demo/shims/tray.ts"),
      "@tauri-apps/api/image": path.resolve(__dirname, "demo/shims/image.ts"),
      "@tauri-apps/api/app": path.resolve(__dirname, "demo/shims/app.ts"),
      "@tauri-apps/api/menu": path.resolve(__dirname, "demo/shims/menu.ts"),
      "@tauri-apps/plugin-store": path.resolve(__dirname, "demo/shims/store.ts"),
      "@tauri-apps/plugin-log": path.resolve(__dirname, "demo/shims/log.ts"),
      "@tauri-apps/plugin-opener": path.resolve(__dirname, "demo/shims/opener.ts"),
      "@tauri-apps/plugin-updater": path.resolve(__dirname, "demo/shims/updater.ts"),
      "@tauri-apps/plugin-process": path.resolve(__dirname, "demo/shims/process.ts"),
      "@tauri-apps/plugin-autostart": path.resolve(__dirname, "demo/shims/autostart.ts"),
      "@tauri-apps/plugin-notification": path.resolve(__dirname, "demo/shims/notification.ts"),
    }
  : {};

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), ...(demo ? [demoPortsPlugin()] : [])],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      ...demoAlias,
    },
  },

  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "plugins/**/*.test.js"],
    exclude: ["**/node_modules/**", "**/src-tauri/target/**"],
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "plugins/**/*.js"],
      exclude: [
        "**/*.d.ts",
        "**/*.css",
        "public/**",
        "scripts/**",
        "src-tauri/**",
        "src-tauri/resources/**",
        "src-tauri/icons/**",
        // Test-only helpers (not production code)
        "plugins/test-helpers.js",
        // Entry point bootstrap (side-effect heavy, hard to unit test)
        "src/main.tsx",
        // SSR guard branch untestable in jsdom
        "src/hooks/use-dark-mode.ts",
      ],
      reporter: ["text", "html", "lcov"],
      thresholds: {
        perFile: false,
        branches: 100,
        lines: 100,
        functions: 100,
        statements: 100,
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    // Bind IPv4 explicitly so the Tauri webview (and local tooling) can reach
    // the Vite server on Linux environments where localhost resolves to ::1.
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
