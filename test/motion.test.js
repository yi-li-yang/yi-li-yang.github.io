// SOURCE — you own this file. Edit freely, by hand or by agent.
// The motion of the Featured images: the timeline arithmetic (js/modules/motion-timeline.js),
// the lengths in css/variables.css, the frames that data/flagships.json names, and the record
// of their capture (scripts/capture-featured.js).
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZOOM_RATIO, playLength, positionAt, layersAt, frameAt } from '../js/modules/motion-timeline.js';
import { isWebp } from '../scripts/fetch-previews.js';
import { RECORD, status } from '../scripts/capture-featured.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const { flagships } = JSON.parse(read('data/flagships.json'));
const moving = flagships.filter((item) => item.motion);

// The --motion-* lengths in css/variables.css: [normal, reduced motion].
const [normalCss, reducedCss] = read('css/variables.css').split('@media (prefers-reduced-motion: reduce)');
const lengths = (css) => Object.fromEntries([...css.matchAll(/--motion-([\w-]+):\s*(\d+)ms/g)].map(([, name, ms]) => [name, Number(ms)]));
const normal = lengths(normalCss);
const timingsOf = (kind) => (kind === 'zoom'
  ? { lead: normal.lead, move: normal.dive, hold: 0, back: normal.back }
  : { lead: normal.lead, move: normal.dissolve, hold: normal['dissolve-hold'], back: normal.back });

// The widest soft edge of a frame, as a share of its width (css/components.css).
const EDGE = Number(read('css/components.css').match(/var\(--soft, 0\) \* (\d+)%/)[1]) / 100;

const FIRST_FRAME_BYTES = 250_000;
const CARD_BYTES = 1_200_000;

test('a zoom keeps its frames on the same place and leaves no hole', () => {
  const count = 13;
  for (let u = 0; u <= count - 1; u += 0.01) {
    const layers = layersAt('zoom', count, u);
    assert.ok(layers.length >= 1 && layers.length <= 3, `${layers.length} frames at ${u}`);
    for (let i = 1; i < layers.length; i++) {
      assert.equal(layers[i].index, layers[i - 1].index + 1);
      assert.ok(Math.abs(layers[i - 1].scale / layers[i].scale - ZOOM_RATIO) < 1e-9, `scales at ${u}`);
    }
    // The lowest frame covers the image: opaque, at least full size, its soft edge out of view.
    const [lowest] = layers;
    assert.equal(lowest.opacity, 1);
    assert.ok(lowest.scale >= 1);
    assert.ok(lowest.soft === 0 || lowest.scale * (0.5 - EDGE) >= 0.5, `the soft edge shows at ${u}`);
  }
});

test('a play starts on the first frame and ends on the last, whole', () => {
  for (const kind of ['zoom', 'dissolve']) {
    const timings = timingsOf(kind);
    const start = frameAt(kind, 5, timings, 0);
    assert.deepEqual(start, { layers: [{ index: 0, scale: 1, opacity: 1, soft: 0 }], label: 0 });
    const end = frameAt(kind, 5, timings, playLength(kind, 5, timings));
    assert.deepEqual(end.layers.at(-1), { index: 4, scale: 1, opacity: 1, soft: 0 });
    assert.equal(end.label, 4);
  }
});

test('a replay first fades the last frame back to the first', () => {
  for (const kind of ['zoom', 'dissolve']) {
    const timings = timingsOf(kind);
    assert.equal(playLength(kind, 5, timings, true), playLength(kind, 5, timings) + timings.back);
    const start = frameAt(kind, 5, timings, 0, true);
    assert.deepEqual(start.layers.map((layer) => [layer.index, layer.opacity]), [[0, 1], [4, 1]]);
    assert.equal(start.label, 4);
    const half = frameAt(kind, 5, timings, timings.back / 2, true);
    assert.equal(half.layers[1].opacity, 0.5);
    assert.deepEqual(frameAt(kind, 5, timings, timings.back, true), frameAt(kind, 5, timings, 0));
  }
});

test('a dissolve holds each frame between the first and the last', () => {
  const timings = { lead: 100, move: 200, hold: 300, back: 100 };
  const at = (t) => positionAt('dissolve', 3, timings, t);
  assert.deepEqual([at(100), at(200), at(300), at(450), at(600), at(700), at(800)], [0, 0.5, 1, 1, 1, 1.5, 2]);
  assert.equal(playLength('dissolve', 3, timings), 100 + 2 * 200 + 300);
  const [under, over] = layersAt('dissolve', 3, 1.5);
  assert.deepEqual([under.index, under.opacity, over.index, over.opacity], [1, 1, 2, 0.5]);
});

test('one frame has no motion', () => {
  assert.equal(playLength('zoom', 1, timingsOf('zoom')), 0);
});

test('no play of a Featured image runs for more than 5 seconds', () => {
  assert.ok(moving.length > 0);
  for (const item of moving) {
    const { kind, frames } = item.motion;
    const replay = playLength(kind, frames.length, timingsOf(kind), true);
    assert.ok(replay > 0 && replay <= 5000, `${item.id}: ${replay} ms`);
  }
});

test('reduced motion sets every motion length to 0', () => {
  const reduced = lengths(reducedCss);
  assert.deepEqual(Object.keys(reduced).sort(), Object.keys(normal).sort());
  for (const [name, ms] of Object.entries(reduced)) assert.equal(ms, 0, name);
});

test('the frames are the WebP files on record, within the byte budget', () => {
  const record = JSON.parse(read(RECORD));
  assert.match(record._edit, /^DERIVED — written by scripts\/capture-featured\.js/);
  const onRecord = new Map([...record.rts.frames, ...record.atlas.frames].map((frame) => [frame.file, frame]));
  for (const item of moving) {
    const { frames } = item.motion;
    assert.ok(['zoom', 'dissolve'].includes(item.motion.kind), item.id);
    assert.equal(frames[0].src, item.image.src, `${item.id}: the image is the first frame`);
    let total = 0;
    for (const frame of frames) {
      assert.ok(existsSync(join(root, frame.src)), frame.src);
      const bytes = readFileSync(join(root, frame.src));
      assert.ok(isWebp(bytes), `${frame.src} is not a WebP image`);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), onRecord.get(frame.src)?.sha256, `${frame.src} is not the file that the capture wrote`);
      total += bytes.length;
    }
    assert.ok(readFileSync(join(root, frames[0].src)).length <= FIRST_FRAME_BYTES, `${frames[0].src} is over ${FIRST_FRAME_BYTES} bytes`);
    assert.ok(total <= CARD_BYTES, `${item.id}: ${total} bytes of frames, over ${CARD_BYTES}`);
  }
});

test('a credit names every provider that the map named for that frame', () => {
  const record = JSON.parse(read(RECORD));
  const rts = flagships.find((item) => item.id === 'rts');
  for (const taken of record.rts.frames) {
    const frame = rts.motion.frames.find((entry) => entry.src === taken.file);
    const credit = frame.credit ?? rts.image.credit;
    // "CNES / Airbus" names two providers; "Maxar Technologies" is credited as Maxar.
    const names = (taken.providers ?? '').split(/,|\//).map((name) => name.trim().split(' ')[0]).filter(Boolean);
    for (const name of names) assert.ok(credit.includes(name), `${taken.file}: the credit "${credit}" leaves out ${name}`);
  }
});

test('the status says when the Atlas frames are older than the app', () => {
  const repo = 'https://github.com/yi-li-yang/Livability-Atlas';
  const record = { rts: { capturedAt: '2026-11-28T10:00:00.000Z' }, atlas: { capturedAt: '2026-11-28T10:00:00.000Z', appPreview: 'aaa' } };
  assert.match(status(record, { [repo]: { sha256: 'aaa' } })[1], /fresh/);
  assert.match(status(record, { [repo]: { sha256: 'bbb' } })[1], /stale/);
  assert.match(status({}, {})[0], /no frames on record/);
});
