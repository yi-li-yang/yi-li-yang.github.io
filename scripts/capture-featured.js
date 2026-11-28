#!/usr/bin/env node
// SOURCE — you own this file. Edit freely, by hand or by agent.

/**
 * Takes the frames of the Featured images' motion (data/flagships.json, `motion`) from the two
 * live apps, and writes them to assets/showcase/ with a record of what it took.
 *
 *   rts    13 stills of the Earth Engine map, zoom 3 to zoom 15, all centred on one thaw slump.
 *          Each still waits for its tiles, so the zoom that the site builds from them is clean.
 *   atlas  One still of the Livability Atlas for each preset below, coloured by rank in London.
 *          Rank spreads the colours over the whole city, so a change of preset is easy to see;
 *          by score, most of London sits in one band and the presets look alike.
 *
 * Usage:
 *   node scripts/capture-featured.js [rts] [atlas]   (npm run capture:featured; both by default)
 *   node scripts/capture-featured.js --status        (npm run featured:status)
 *
 * This is a manual step, like `auto-generate-preview-image capture`; nothing in CI runs it.
 * Look at the frames, then commit them. It borrows Playwright and sharp from that tool, so
 * this repo needs no browser of its own:
 *   PREVIEW_TOOL — the tool's folder. Default: ../auto-generate-preview-image.
 *
 * `--status` says whether the Atlas frames are older than the app. It compares the app's own
 * preview image (data/previews.json, copied every day) with the one on record. The Earth Engine
 * map has no such image, so its frames have a date only.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const RECORD = 'assets/showcase/featured-record.json';
const WIDTH = 1200;
const HEIGHT = 750;

const RTS = {
  dir: 'assets/showcase/rts-zoom',
  app: 'https://abruptthawmapping.projects.earthengine.app/view/south-rts-map',
  // rts_id 9480 of the south products, the example in the methods paper's tiling figure.
  lon: 134.77,
  lat: 67.58,
  zooms: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  // The app's side panel covers this much of the right of the map, and the map centres on
  // the part that shows.
  panel: 340,
  // The first frame shows before the motion and the last is where the image rests, so those
  // two get the most bytes. The frames between show for a fraction of a second, in motion.
  encode: (zoom) => {
    if (zoom === 3) return { width: 1200, quality: 80 };
    if (zoom === 15) return { width: 1200, quality: 78 };
    if (zoom === 14) return { width: 1200, quality: 64 };
    if (zoom === 13) return { width: 960, quality: 60 };
    return { width: 800, quality: 55 };
  },
};

const ATLAS = {
  dir: 'assets/showcase/atlas-presets',
  app: 'https://yi-li-yang.github.io/Livability-Atlas/',
  repo: 'https://github.com/yi-li-yang/Livability-Atlas',
  view: 'Rank in London',
  // In this order, each step changes the map more than Student, Family, Retired would.
  presets: ['Student', 'Retired', 'Family with children'],
  quality: 80,
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

function tools() {
  const dir = resolve(process.env.PREVIEW_TOOL || join(root, '..', 'auto-generate-preview-image'));
  if (!existsSync(join(dir, 'node_modules', 'playwright'))) {
    throw new Error(`auto-generate-preview-image is not installed at ${dir}. Clone github.com/yi-li-yang/auto-generate-preview-image there and run npm install, or set PREVIEW_TOOL to its folder.`);
  }
  const require = createRequire(join(dir, 'package.json'));
  return { chromium: require('playwright').chromium, sharp: require('sharp') };
}

async function write(sharp, png, path, { width, quality }) {
  const bytes = await sharp(png)
    .resize(width, Math.round(width * HEIGHT / WIDTH), { fit: 'cover', kernel: 'lanczos3' })
    .webp({ quality, effort: 6 })
    .toBuffer();
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), bytes);
  return { file: path, bytes: bytes.length, sha256: sha256(bytes) };
}

// The providers in the map's own credit line, such as "Airbus, CNES / Airbus, Maxar Technologies".
function providers(texts) {
  for (const text of texts) {
    const named = text.match(/Imagery ©\d{4}\s*(.+)$/);
    if (named) return named[1].trim();
  }
  return null;
}

async function captureRts({ chromium, sharp }, log) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 2000, height: 1250 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  let inFlight = 0;
  let lastChange = Date.now();
  const change = (by) => { inFlight = Math.max(0, inFlight + by); lastChange = Date.now(); };
  page.on('request', () => change(1));
  page.on('requestfinished', () => change(-1));
  page.on('requestfailed', () => change(-1));

  const frames = [];
  for (const zoom of RTS.zooms) {
    // The app reads its link once, when it starts, so each zoom is a fresh page.
    await page.goto('about:blank');
    inFlight = 0;
    await page.goto(`${RTS.app}#lon=${RTS.lon};lat=${RTS.lat};z=${zoom}`, { waitUntil: 'load', timeout: 90_000 });
    let box = null;
    for (const start = Date.now(); !box && Date.now() - start < 60_000;) {
      for (const frame of page.frames()) {
        const map = frame.locator('.gm-style').first();
        if (await map.count().catch(() => 0)) box = await map.boundingBox().catch(() => null);
        if (box) break;
      }
      if (!box) await page.waitForTimeout(500);
    }
    if (!box) throw new Error(`zoom ${zoom}: the map did not appear`);
    // Wait for the tiles: no request for three seconds, or 45 seconds at most.
    await page.waitForTimeout(6000);
    for (const start = Date.now(); Date.now() - start < 45_000;) {
      await page.waitForTimeout(250);
      if (inFlight === 0 && Date.now() - lastChange > 3000) break;
    }
    await page.mouse.move(5, 5);
    await page.waitForTimeout(800);

    const credits = [];
    for (const frame of page.frames()) credits.push(...await frame.locator('.gm-style-cc').allTextContents().catch(() => []));
    const clip = {
      x: Math.round(box.x + (box.width - RTS.panel) / 2 - WIDTH / 2),
      y: Math.round(box.y + box.height / 2 - HEIGHT / 2),
      width: WIDTH,
      height: HEIGHT,
    };
    if (clip.x < 0 || clip.y < 0) throw new Error(`zoom ${zoom}: the map is smaller than the frame`);
    const png = await page.screenshot({ clip, type: 'png' });
    const written = await write(sharp, png, `${RTS.dir}/z${String(zoom).padStart(2, '0')}.webp`, RTS.encode(zoom));
    frames.push({ ...written, zoom, providers: providers(credits) });
    log(`rts zoom ${zoom}: ${written.bytes} bytes, imagery ${frames.at(-1).providers ?? 'not named'}`);
  }
  await browser.close();
  return { capturedAt: new Date().toISOString(), app: RTS.app, lon: RTS.lon, lat: RTS.lat, frames };
}

async function captureAtlas({ chromium, sharp }, log) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2, colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto(ATLAS.app, { timeout: 120_000 });
  await page.waitForFunction("Number(document.querySelector('[data-testid=map]')?.dataset.cells) > 0", null, { timeout: 120_000 });
  await page.waitForSelector('aside[aria-label="Your preferences"]');
  await page.waitForFunction("document.fonts.status === 'loaded'");
  await page.mouse.move(8, 8);
  await page.waitForTimeout(5000);
  await page.getByText(ATLAS.view, { exact: true }).first().click();
  await page.waitForTimeout(800);

  // All the frames come from one page, so the basemap under them is the same picture.
  const frames = [];
  for (const preset of ATLAS.presets) {
    await page.getByRole('combobox', { name: 'Start from' }).selectOption({ label: preset });
    await page.mouse.move(8, 8);
    await page.waitForTimeout(2200);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    const png = await page.screenshot({ type: 'png' });
    const written = await write(sharp, png, `${ATLAS.dir}/${slug(preset)}.webp`, { width: WIDTH, quality: ATLAS.quality });
    frames.push({ ...written, preset });
    log(`atlas ${preset}: ${written.bytes} bytes`);
  }
  await browser.close();
  return {
    capturedAt: new Date().toISOString(),
    app: ATLAS.app,
    view: ATLAS.view,
    // The app's own preview image when these frames were taken; --status compares it.
    appPreview: readJson('data/previews.json').previews?.[ATLAS.repo]?.sha256 ?? null,
    frames,
  };
}

export function status(record, previews) {
  const lines = [];
  if (record.rts) lines.push(`rts: taken ${record.rts.capturedAt.slice(0, 10)}; the live map has no image to compare, so look at it.`);
  else lines.push('rts: no frames on record.');
  if (!record.atlas) lines.push('atlas: no frames on record.');
  else {
    const now = previews?.[ATLAS.repo]?.sha256 ?? null;
    const same = now && now === record.atlas.appPreview;
    lines.push(`atlas: taken ${record.atlas.capturedAt.slice(0, 10)}; ${same ? 'fresh' : 'stale: the app\'s own preview changed since then. Run npm run capture:featured -- atlas.'}`);
  }
  return lines;
}

async function main() {
  const args = process.argv.slice(2);
  const record = existsSync(join(root, RECORD)) ? readJson(RECORD) : {};
  if (args.includes('--status')) {
    for (const line of status(record, readJson('data/previews.json').previews)) console.log(line);
    return;
  }
  const wanted = args.filter((arg) => !arg.startsWith('-'));
  const all = wanted.length === 0;
  const kit = tools();
  if (all || wanted.includes('rts')) record.rts = await captureRts(kit, console.log);
  if (all || wanted.includes('atlas')) record.atlas = await captureAtlas(kit, console.log);
  const next = {
    _edit: 'DERIVED — written by scripts/capture-featured.js (npm run capture:featured) with the frames beside it. Never edit; the next capture rewrites it.',
    rts: record.rts,
    atlas: record.atlas,
  };
  writeFileSync(join(root, RECORD), `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Wrote ${RECORD}. Look at the frames before you commit them.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error('Capture failed:', err.message);
    process.exitCode = 1;
  });
}
