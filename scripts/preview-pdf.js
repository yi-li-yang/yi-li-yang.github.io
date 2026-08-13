// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/preview-pdf.js — `npm run pdf -- <slug>`
//
// Compiles an application's tailored CV and cover letter LOCALLY with Tectonic, so you can
// look at the layout without a push-and-wait cycle. Roughly one second once Tectonic has
// cached its package bundle.
//
// It writes ONLY into build/<slug>/, which is gitignored. It deliberately does NOT put a PDF
// next to the manifest, because CI writes those and invariant 2 says no byte has two authors:
// a locally-built cv.pdf sitting in applications/ would be indistinguishable from the one an
// employer actually received, and the two would silently disagree about the date stamp.
//
// So: this is a preview. CI remains the only thing that produces a document of record.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/data.js';
import { requireApplication } from './lib/applications.js';

const slug = process.argv[2];
if (!slug) {
  console.error('usage: npm run pdf -- <slug>');
  console.error('       run `npm run apps` to list them');
  process.exit(2);
}
requireApplication(slug, 'npm run pdf -- <slug>');

const dir = join(ROOT, 'build', slug);
if (!existsSync(join(dir, 'cv.tex'))) {
  console.error(`no build/${slug}/cv.tex — run \`npm run tailor -- ${slug}\` first.`);
  process.exit(1);
}

// Tectonic is a single binary and may well not be on PATH; say how to get it rather than
// letting node throw ENOENT at someone who has never heard of it.
try {
  execFileSync('tectonic', ['--version'], { stdio: 'ignore', windowsHide: true });
} catch {
  console.error('tectonic not found on PATH.');
  console.error('  Get the single binary from https://github.com/tectonic-typesetting/tectonic/releases');
  console.error('  (CI installs the same version — see TECTONIC_VERSION in tailor-cv.yml.)');
  process.exit(1);
}

for (const doc of ['cv.tex', 'letter.tex']) {
  if (!existsSync(join(dir, doc))) continue; // letter.json is optional
  execFileSync('tectonic', ['--keep-logs', doc], {
    cwd: dir,
    stdio: 'inherit',
    windowsHide: true,
  });
}

// The one-page rule is asserted in CI, but finding out here costs nothing and saves a round
// trip. Read from the log rather than the PDF so no PDF tooling is needed.
import { readFileSync } from 'node:fs';
const log = join(dir, 'cv.log');
if (existsSync(log)) {
  const m = [...readFileSync(log, 'utf8').matchAll(/Output written on \S+ \((\d+) pages?,/g)].pop();
  const pages = m ? Number(m[1]) : null;
  if (pages && pages !== 1) {
    console.error(`\n  ${pages} pages — CI will reject this. Trim the manifest:`);
    console.error('    fewer experience bullets, fewer skill lines, fewer publications,');
    console.error('    or drop the academic collaborations block.');
    process.exit(1);
  }
  console.log(`\n  one page ✓   build/${slug}/cv.pdf`);
}
