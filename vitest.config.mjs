import { defineConfig } from "vitest/config";
export default defineConfig({ oxc: { jsx: { runtime: "automatic" } }, test: { environment: "jsdom", include: ["frontend/src/**/*.test.jsx"], globals: true, restoreMocks: true } });
