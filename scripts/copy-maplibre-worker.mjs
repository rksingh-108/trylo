#!/usr/bin/env node
// Copies maplibre-gl's CSP worker script into a consuming app's public/
// folder so it can be referenced as a plain static asset path
// (`/maplibre-gl-csp-worker.js`) - webpack's `new URL(spec, import.meta.url)`
// asset-rewriting does NOT intercept a bare cross-package specifier like
// "maplibre-gl/dist/...", it just evaluates as a literal (broken) runtime URL,
// so this file must be served as-is instead. Run automatically via each
// consuming app's predev/prebuild script, never committed (see .gitignore) -
// always copied fresh from whatever maplibre-gl version is installed.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appName = process.argv[2];
if (!appName) {
  console.error("Usage: node copy-maplibre-worker.mjs <app-name>");
  process.exit(1);
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
// pnpm's strict (non-hoisted) node_modules means maplibre-gl only resolves
// from packages/ui (the package that actually depends on it), not from the
// repo root - resolve it the same way Node/webpack would, rather than
// guessing a path.
const require = createRequire(join(repoRoot, "packages/ui/package.json"));
const source = require.resolve("maplibre-gl/dist/maplibre-gl-csp-worker.js");
const destDir = join(repoRoot, "apps", appName, "public");
const dest = join(destDir, "maplibre-gl-csp-worker.js");

mkdirSync(destDir, { recursive: true });
copyFileSync(source, dest);
console.log(`Copied maplibre-gl-csp-worker.js to apps/${appName}/public/`);
