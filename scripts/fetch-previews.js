#!/usr/bin/env node
// SOURCE — you own this file. Edit freely, by hand or by agent.

/**
 * Copies each opted-in project's preview image from its own repo into assets/previews/, and
 * writes data/previews.json, which names the files. A project opts in with "preview": true in
 * data/show_repo.json. Each repo owns its image (docs/preview.webp, and docs/preview-anim.webp
 * when it has an animation), made by github.com/yi-li-yang/auto-generate-preview-image, so the
 * site's thumbnail and the repo's README can never drift apart. This script never makes an image.
 *
 * Usage: node scripts/fetch-previews.js   (npm run ingest:previews)
 *
 * Optional env vars:
 *   GH_USER_TOKEN — reads a private repo ("private": true) through the GitHub contents API.
 *   PREVIEW_BASE  — a local folder that replaces GitHub: <PREVIEW_BASE>/<repo>/docs/<file>. For tests.
 *
 * Fails safe, like update-stats.js: each repo fails on its own. A missing, broken or oversized
 * download keeps that repo's last good file and entry; nothing is ever deleted; the run exits 0.
 * Nothing is written when the bytes are unchanged, so a run that finds nothing new produces no commit.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TIMEOUT_MS = 20000;
const IMAGE = 'preview.webp';
const ANIM = 'preview-anim.webp';
const LIMITS = { [IMAGE]: 300_000, [ANIM]: 3_000_000 };
const OUT_DIR = 'assets/previews';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// A WebP file is a RIFF container: "RIFF", the size of what follows, then "WEBP".
export function isWebp(bytes) {
  return bytes.length >= 12
    && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP'
    && bytes.readUInt32LE(4) + 8 === bytes.length;
}

function check(bytes, file) {
  if (!isWebp(bytes)) throw new Error(`${file} is not a WebP image`);
  if (bytes.length > LIMITS[file]) throw new Error(`${file} is ${bytes.length} bytes, over the ${LIMITS[file]}-byte limit`);
}

function repoOf(url) {
  const m = String(url).match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/);
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/, '') } : null;
}

// The bytes of docs/<file> in the repo, or null when it has no such file.
async function download(source, file, { base, token, rawOrigin, apiOrigin }) {
  if (base) {
    const path = join(base, source.repo, 'docs', file);
    return { bytes: existsSync(path) ? readFileSync(path) : null, from: `${source.repo}/docs/${file}` };
  }
  let url;
  const headers = { 'User-Agent': 'fetch-previews-script' };
  if (source.private) {
    if (!token) throw new Error('private repo, and GH_USER_TOKEN is not set');
    url = `${apiOrigin}/repos/${source.owner}/${source.repo}/contents/docs/${file}`;
    headers.Accept = 'application/vnd.github.raw';
    headers.Authorization = `Bearer ${token}`;
  } else {
    url = `${rawOrigin}/${source.owner}/${source.repo}/HEAD/docs/${file}`;
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) return { bytes: null, from: url };
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return { bytes: Buffer.from(await res.arrayBuffer()), from: url };
}

// Writes through a temp file and a rename, and only when the bytes changed.
function writeIfChanged(path, bytes) {
  if (existsSync(path) && readFileSync(path).equals(bytes)) return false;
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, bytes);
  renameSync(temp, path);
  return true;
}

export async function run({
  root,
  base = null,
  token = null,
  rawOrigin = 'https://raw.githubusercontent.com',
  apiOrigin = 'https://api.github.com',
  log = console.log,
}) {
  const { repos } = JSON.parse(readFileSync(join(root, 'data', 'show_repo.json'), 'utf8'));
  const manifestPath = join(root, 'data', 'previews.json');
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')).previews ?? {} : {};
  const previews = {};
  const options = { base, token, rawOrigin, apiOrigin };

  for (const item of repos.filter((r) => r.preview === true && r.url)) {
    const source = repoOf(item.url);
    if (!source) {
      log(`${item.url}: not a GitHub repo URL, skipped`);
      continue;
    }
    source.private = item.private === true;
    const last = previous[item.url] ?? null;
    const keep = (why) => {
      if (last) previews[item.url] = last;
      log(`${source.repo}: ${why}; ${last ? 'kept last good' : 'no preview yet'}`);
    };
    const absent = () => {
      if (last) keep('no docs/preview.webp found');
      else log(`${source.repo}: no preview yet`);
    };
    try {
      const image = await download(source, IMAGE, options);
      if (!image.bytes) {
        absent();
        continue;
      }
      check(image.bytes, IMAGE);
      const anim = await download(source, ANIM, options);
      if (anim.bytes) check(anim.bytes, ANIM);

      const imageRel = `${OUT_DIR}/${source.repo}.webp`;
      const animRel = `${OUT_DIR}/${source.repo}-anim.webp`;
      const wroteImage = writeIfChanged(join(root, imageRel), image.bytes);
      const wroteAnim = anim.bytes ? writeIfChanged(join(root, animRel), anim.bytes) : false;
      previews[item.url] = {
        image: imageRel,
        ...(anim.bytes ? { anim: animRel } : {}),
        sha256: sha256(image.bytes),
        bytes: image.bytes.length,
        source: image.from,
      };
      log(`${source.repo}: ${wroteImage || wroteAnim ? 'updated' : 'unchanged'}`);
    } catch (err) {
      keep(err.message);
    }
  }

  const manifest = {
    _edit: 'DERIVED — written by scripts/fetch-previews.js (npm run ingest:previews) from each repo\'s docs/preview.webp. Never edit; the next run reverts you.',
    previews,
  };
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  const before = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : null;
  if (text === before) {
    log('data/previews.json unchanged.');
  } else {
    writeIfChanged(manifestPath, Buffer.from(text));
    log(`Wrote data/previews.json: ${Object.keys(previews).length} preview(s).`);
  }
  return manifest;
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  await run({ root, base: process.env.PREVIEW_BASE || null, token: process.env.GH_USER_TOKEN || null });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error('Previews fetch failed, keeping the last good files:', err.message);
  });
}
