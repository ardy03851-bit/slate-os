#!/usr/bin/env node
/**
 * WebPad manifest builder.
 *
 * Scans every apps/<name>/app.json and writes apps/manifest.json — the static catalog
 * the App Store falls back to (the primary path is the GitHub API, which
 * picks up any new folder automatically).
 *
 * Run:  node build.js
 */
const fs = require('fs');
const path = require('path');

const appsDir = path.join(__dirname, 'apps');
const out = { generated: new Date().toISOString(), apps: [] };

for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const metaPath = path.join(appsDir, entry.name, 'app.json');
  if (!fs.existsSync(metaPath)) continue;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (!meta.id || !meta.name) {
      console.warn(`⚠ ${entry.name}/app.json is missing id or name — skipped`);
      continue;
    }
    if (meta.id !== entry.name) {
      console.warn(`⚠ ${entry.name}: folder name and "id" differ (${meta.id}) — using folder name`);
      meta.id = entry.name;
    }
    out.apps.push(meta);
  } catch (e) {
    console.warn(`⚠ ${entry.name}/app.json is not valid JSON — skipped`);
  }
}

fs.writeFileSync(path.join(appsDir, 'manifest.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`✓ apps/manifest.json — ${out.apps.length} app(s): ${out.apps.map(a => a.id).join(', ')}`);
