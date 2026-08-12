// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/fetch-pdfs.js — `npm run pdfs [-- <slug>]`
//
// LaTeX never runs on this machine. PDFs are compiled by GitHub Actions in a full TeX Live
// container and uploaded as artifacts — which GitHub serves only as zip bundles behind the
// Actions run page. That is a poor place to go looking for a CV you are about to send, so this
// fetches them and tells you exactly where they landed.
//
// Requires the `gh` CLI, authenticated.

import { execFileSync } from 'node:child_process';
import { rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from './lib/data.js';
import { findApplication } from './lib/applications.js';

const slug = process.argv.slice(2).find((a) => !a.startsWith('-'));
const OUT = join(ROOT, '_artifacts');

const gh = (args) =>
  execFileSync('gh', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

try {
  gh(['auth', 'status']);
} catch {
  console.error('the `gh` CLI is not available or not authenticated. Run: gh auth login');
  process.exit(2);
}

if (slug && !findApplication(slug)) {
  console.error(`no application "${slug}".  Run \`npm run apps\` to list them.`);
  process.exit(2);
}

console.log('finding the most recent successful Tailor CV run…');
let runId;
try {
  runId = gh([
    'run', 'list',
    '--workflow', 'Tailor CV',
    '--status', 'success',
    '--limit', '1',
    '--json', 'databaseId',
    '-q', '.[0].databaseId',
  ]);
} catch (err) {
  console.error('could not list workflow runs:', err.message);
  process.exit(1);
}

if (!runId) {
  console.error('no successful Tailor CV run yet — push your application first.');
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });

// One artifact per application, named application-<slug>. Without a slug, take them all.
const args = ['run', 'download', runId, '-D', OUT];
if (slug) args.push('-n', `application-${slug}`);

try {
  execFileSync('gh', args, { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.error(
    slug
      ? `run ${runId} has no artifact for "${slug}" — it may not have been built yet.`
      : `could not download artifacts from run ${runId}.`,
  );
  process.exit(1);
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

if (!existsSync(OUT)) {
  console.error('nothing downloaded.');
  process.exit(1);
}

const files = walk(OUT).sort();
console.log(`\nfrom run ${runId} → _artifacts/  (gitignored)\n`);
for (const f of files) {
  const kb = Math.round(statSync(f).size / 1024);
  console.log(`  ${relative(ROOT, f).replace(/\\/g, '/')}  (${kb} KB)`);
}
console.log();
