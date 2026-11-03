import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig(({ command, mode, isPreview }) => {
  const development = command === "serve" && !isPreview;
  const values = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "VITE_");
  const api = process.env.VITE_API_BASE_URL || values.VITE_API_BASE_URL;
  const apiOrigin = api && /^https?:\/\//.test(api) ? new URL(api).origin : "";
  const headers = { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Content-Security-Policy": `default-src 'self'; script-src 'self'${development ? " 'unsafe-inline'" : ""}; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' ${apiOrigin}${development ? " http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*" : ""}; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` };
  return {
  root: fileURLToPath(new URL("./frontend", import.meta.url)),
  define: { "process.env.NODE_ENV": JSON.stringify(command === "build" ? "production" : "development") },
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  build: { outDir: "dist" },
  server: { headers }, preview: { headers },
  };
});
