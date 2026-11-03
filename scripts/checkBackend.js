const { readdirSync } = require("fs");
const { join } = require("path");
const { execFileSync } = require("child_process");
const scan = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? scan(join(dir, entry.name)) : /\.(?:js|mjs)$/.test(entry.name) ? [join(dir, entry.name)] : []);
const files = ["app.js", "server.js", ...["config", "models", "controllers", "services", "routes", "middleware", "validators", "utils", "seeders", "scripts"].flatMap(scan)];
for (const file of files) execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
console.log(`Syntax checked ${files.length} backend files.`);
