import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL("./frontend", import.meta.url)),
  define: { "process.env.NODE_ENV": JSON.stringify(command === "build" ? "production" : "development") },
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  build: { outDir: "dist" },
}));
