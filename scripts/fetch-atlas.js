#!/usr/bin/env node
// SOURCE — you own this file. Edit freely, by hand or by agent.

/**
 * Reads the Livability Atlas's live data bundle and writes the numbers the website's Featured
 * card prints (hex cells, indicators, factors, datasets, stations) to data/livability-atlas.json.
 * The Atlas keeps growing, so these numbers are never typed by hand: data/flagships.json refers
 * to them as {atlas.cells}, {atlas.indicators} and so on, and js/modules/flagships.js fills them.
 *
 * Usage: node scripts/fetch-atlas.js   (npm run ingest:atlas)
 *
 * Optional env vars:
 *   ATLAS_BASE — the site the bundle is read from (default: the live app). For tests.
 *
 * Fails safe, like update-stats.js: on any error, or a count that is not a positive whole
 * number, the last good file is left untouched and the run still exits 0. Nothing is written
 * when the content is unchanged, so a run that finds nothing new produces no commit.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, '..', 'data', 'livability-atlas.json');

const BASE = (process.env.ATLAS_BASE || 'https://yi-li-yang.github.io/Livability-Atlas/').replace(/\/?$/, '/');
const REGION = 'london';
const TIMEOUT_MS = 20000;

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'fetch-atlas-script' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

// The four numbers the card prints must be there, or the run keeps the last good file.
const count = (value, name) => {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} is ${JSON.stringify(value)}, not a positive whole number`);
  return value;
};
// The rest only feed a line of the "How it was built" story; a missing one is left out (and
// that line with it), so it never holds back the four above.
const optional = (value) => (Number.isInteger(value) && value > 0 ? value : undefined);

async function main() {
  const previous = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf-8') : null;

  // latest.json names the bundle version the live app loads; the manifest beside it holds the counts.
  const { version } = await getJson(`${BASE}bundles/${REGION}/latest.json`);
  if (!version) throw new Error('latest.json names no version');
  const manifestUrl = `${BASE}bundles/${REGION}/${version}/manifest.json`;
  const manifest = await getJson(manifestUrl);

  const output = {
    _edit: 'DERIVED — written by scripts/fetch-atlas.js (npm run ingest:atlas) from the Livability Atlas\'s live data bundle. Never edit; the next run reverts you.',
    source: manifestUrl,
    version,
    region: manifest.region?.name ?? REGION,
    cells: count(manifest.cell_count, 'cell_count'),
    indicators: count(manifest.indicators?.length, 'indicators'),
    factors: count(manifest.factors?.length, 'factors'),
    datasets: count(manifest.datasets?.length, 'datasets'),
    presets: optional(manifest.presets?.length),
    stations: optional(manifest.travel?.station_count),
    resolution: optional(manifest.grid?.resolution),
  };

  const text = JSON.stringify(output, null, 2) + '\n';
  if (text === previous) {
    console.log(`Atlas numbers unchanged (bundle ${version}).`);
    return;
  }
  writeFileSync(OUTPUT, text);
  console.log(`Wrote ${OUTPUT}: bundle ${version}, ${output.cells} cells, ${output.indicators} indicators, ${output.factors} factors, ${output.datasets} datasets.`);
}

main().catch((err) => {
  console.error('Atlas fetch failed, keeping last good data/livability-atlas.json:', err.message);
});
