// SOURCE — you own this file. Edit freely, by hand or by agent.
// The CV workflow rebuilds whenever anything `npm run build` runs changes. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../scripts/lib/data.js';

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

test('build-cv.yml triggers on every script that npm run build runs', () => {
  const build = JSON.parse(read('package.json')).scripts.build;
  const scripts = [...build.matchAll(/node (scripts\/[\w-]+\.js)/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 4, 'found the build scripts');
  const workflow = read('.github/workflows/build-cv.yml');
  const paths = [...workflow.matchAll(/^\s+- '([^']+)'/gm)].map((m) => m[1]);
  for (const s of scripts) {
    assert.ok(paths.includes(s), `${s} is missing from build-cv.yml paths`);
  }
});
