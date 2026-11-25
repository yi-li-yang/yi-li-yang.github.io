// SOURCE — you own this file. Edit freely, by hand or by agent.
// Tests for scripts/fetch-previews.js. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../scripts/fetch-previews.js';

// A WebP container: "RIFF", the size of what follows, "WEBP", then the payload.
function webp(payload) {
  const body = Buffer.concat([Buffer.from('WEBP'), Buffer.from(payload)]);
  const head = Buffer.alloc(8);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

const ONE = 'https://github.com/yi-li-yang/app-one';
const TWO = 'https://github.com/yi-li-yang/app-two';
const THREE = 'https://github.com/yi-li-yang/app-three';

// A site folder with data/show_repo.json: two repos opt in (one private), one does not.
function newSite() {
  const root = mkdtempSync(join(tmpdir(), 'previews-site-'));
  mkdirSync(join(root, 'data'));
  writeFileSync(join(root, 'data', 'show_repo.json'), JSON.stringify({
    _edit: 'SOURCE',
    repos: [
      { group: 'Tools', url: ONE, image: 'assets/projects/app-one.webp', preview: true },
      { group: 'Skills', expand: 'data/claude-skills.json' },
      { group: 'Tools', url: TWO, private: true, preview: true },
      { group: 'Tools', url: THREE, image: '' },
    ],
  }));
  return root;
}

// A folder standing in for GitHub: <base>/<repo>/docs/<file>.
function newBase(files) {
  const base = mkdtempSync(join(tmpdir(), 'previews-base-'));
  for (const [rel, bytes] of Object.entries(files)) {
    mkdirSync(join(base, rel, '..'), { recursive: true });
    writeFileSync(join(base, rel), bytes);
  }
  return base;
}

const A = webp('image of app one');
const B = webp('animation of app one');
const C = webp('image of app two');
const D = webp('image of app three');

const quiet = () => {};
const manifestOf = (root) => JSON.parse(readFileSync(join(root, 'data', 'previews.json'), 'utf8'));

test('opted-in repos get their image and animation, and data/previews.json names them by repo URL', async () => {
  const root = newSite();
  const base = newBase({
    'app-one/docs/preview.webp': A,
    'app-one/docs/preview-anim.webp': B,
    'app-two/docs/preview.webp': C,
    'app-three/docs/preview.webp': D,
  });
  await run({ root, base, log: quiet });
  assert.deepEqual(readFileSync(join(root, 'assets/previews/app-one.webp')), A);
  assert.deepEqual(readFileSync(join(root, 'assets/previews/app-one-anim.webp')), B);
  assert.deepEqual(readFileSync(join(root, 'assets/previews/app-two.webp')), C);
  assert.equal(existsSync(join(root, 'assets/previews/app-three.webp')), false);
  const m = manifestOf(root);
  assert.match(m._edit, /^DERIVED — written by scripts\/fetch-previews\.js/);
  assert.deepEqual(m.previews[ONE], {
    image: 'assets/previews/app-one.webp',
    anim: 'assets/previews/app-one-anim.webp',
    sha256: sha(A),
    bytes: A.length,
    source: 'app-one/docs/preview.webp',
  });
  assert.equal(m.previews[TWO].image, 'assets/previews/app-two.webp');
  assert.equal(m.previews[TWO].anim, undefined);
  assert.equal(m.previews[THREE], undefined);
});

test('a second run with nothing new writes nothing', async () => {
  const root = newSite();
  const base = newBase({ 'app-one/docs/preview.webp': A, 'app-two/docs/preview.webp': C });
  await run({ root, base, log: quiet });
  const image = statSync(join(root, 'assets/previews/app-one.webp')).mtimeMs;
  const manifest = readFileSync(join(root, 'data/previews.json'), 'utf8');
  const lines = [];
  await run({ root, base, log: (l) => lines.push(l) });
  assert.equal(statSync(join(root, 'assets/previews/app-one.webp')).mtimeMs, image);
  assert.equal(readFileSync(join(root, 'data/previews.json'), 'utf8'), manifest);
  assert.match(lines.join('\n'), /unchanged/);
});

test('a repo with no preview yet is logged and left out', async () => {
  const root = newSite();
  const base = newBase({ 'app-one/docs/preview.webp': A });
  const lines = [];
  await run({ root, base, log: (l) => lines.push(l) });
  assert.match(lines.join('\n'), /app-two: no preview yet/);
  assert.equal(manifestOf(root).previews[TWO], undefined);
});

test('a broken download keeps the last good file and its entry', async () => {
  const root = newSite();
  const good = newBase({ 'app-one/docs/preview.webp': A });
  await run({ root, base: good, log: quiet });
  const broken = newBase({ 'app-one/docs/preview.webp': Buffer.from('<html>not an image</html>') });
  const lines = [];
  await run({ root, base: broken, log: (l) => lines.push(l) });
  assert.deepEqual(readFileSync(join(root, 'assets/previews/app-one.webp')), A);
  assert.equal(manifestOf(root).previews[ONE].sha256, sha(A));
  assert.match(lines.join('\n'), /app-one: .*kept last good/);
});

test('a repo whose preview disappears keeps its last good file and entry', async () => {
  const root = newSite();
  await run({ root, base: newBase({ 'app-one/docs/preview.webp': A }), log: quiet });
  await run({ root, base: newBase({}), log: quiet });
  assert.deepEqual(readFileSync(join(root, 'assets/previews/app-one.webp')), A);
  assert.equal(manifestOf(root).previews[ONE].sha256, sha(A));
});

test('an image over the size limit is rejected', async () => {
  const root = newSite();
  const base = newBase({ 'app-one/docs/preview.webp': webp(Buffer.alloc(400_000, 7)) });
  await run({ root, base, log: quiet });
  assert.equal(existsSync(join(root, 'assets/previews/app-one.webp')), false);
});

// A server standing in for raw.githubusercontent.com and api.github.com.
async function fakeGitHub() {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push({ url: req.url, accept: req.headers.accept, auth: req.headers.authorization });
    if (req.url === '/yi-li-yang/app-one/HEAD/docs/preview.webp') return res.end(A);
    if (req.url === '/repos/yi-li-yang/app-two/contents/docs/preview.webp') {
      if (req.headers.accept !== 'application/vnd.github.raw' || req.headers.authorization !== 'Bearer t0ken') {
        res.statusCode = 404;
        return res.end();
      }
      return res.end(C);
    }
    res.statusCode = 404;
    return res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { seen, origin, close: () => new Promise((r) => server.close(r)) };
}

test('a public repo is read from its raw URL; a private repo through the contents API with the token', async () => {
  const gh = await fakeGitHub();
  try {
    const root = newSite();
    await run({ root, token: 't0ken', rawOrigin: gh.origin, apiOrigin: gh.origin, log: quiet });
    assert.deepEqual(readFileSync(join(root, 'assets/previews/app-one.webp')), A);
    assert.deepEqual(readFileSync(join(root, 'assets/previews/app-two.webp')), C);
    const privateCall = gh.seen.find((s) => s.url === '/repos/yi-li-yang/app-two/contents/docs/preview.webp');
    assert.equal(privateCall.auth, 'Bearer t0ken');
  } finally {
    await gh.close();
  }
});

test('with no token, a private repo is not requested at all', async () => {
  const gh = await fakeGitHub();
  try {
    const root = newSite();
    const lines = [];
    await run({ root, rawOrigin: gh.origin, apiOrigin: gh.origin, log: (l) => lines.push(l) });
    assert.equal(gh.seen.some((s) => s.url.includes('app-two')), false);
    assert.equal(existsSync(join(root, 'assets/previews/app-two.webp')), false);
    assert.match(lines.join('\n'), /app-two: .*GH_USER_TOKEN/);
  } finally {
    await gh.close();
  }
});
