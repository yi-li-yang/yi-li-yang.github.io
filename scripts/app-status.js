// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/app-status.js — `npm run app:status -- <slug> <status>`
//
// Moves an application between status folders. Uses `git mv` so history follows the rename
// instead of showing a delete plus an add — the application's past is part of the record.
//
// This exists so status is a command rather than a directory drag: it validates the status
// name, refuses no-ops, and keeps the move atomic. Nothing else in the system needs updating
// afterwards, because every other command resolves applications by slug (lib/applications.js).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/data.js';
import { findApplication, STATUSES } from './lib/applications.js';

const [slug, status] = process.argv.slice(2);

const usage = () => {
  console.error(`usage: npm run app:status -- <slug> <${STATUSES.join('|')}>`);
  console.error('       run `npm run apps` to list applications');
  process.exit(2);
};

if (!slug || !status) usage();

if (!STATUSES.includes(status)) {
  console.error(`"${status}" is not a status. Use one of: ${STATUSES.join(', ')}`);
  process.exit(2);
}

const app = findApplication(slug);
if (!app) {
  console.error(`no application "${slug}".  Run \`npm run apps\` to list them.`);
  process.exit(2);
}

if (app.status === status) {
  console.log(`${slug} is already ${status} — nothing to do.`);
  process.exit(0);
}

const dest = `applications/${status}/${slug}`;
if (existsSync(join(ROOT, dest))) {
  console.error(`${dest} already exists. Resolve that before moving.`);
  process.exit(1);
}

// `git mv` will not create intermediate directories, and a status folder legitimately may not
// exist yet (nothing has been closed before, say). Create it first rather than failing at the
// user for a directory this script knows the name of.
mkdirSync(join(ROOT, 'applications', status), { recursive: true });
execFileSync('git', ['mv', app.rel, dest], { cwd: ROOT, stdio: 'inherit' });

console.log(`${slug}:  ${app.status} → ${status}`);
console.log(`  ${app.rel}\n  ${dest}`);
if (status === 'closed') {
  console.log('\n  closed applications are skipped by CI — no further builds.');
}
