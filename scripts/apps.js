// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/apps.js — `npm run apps`
//
// The portfolio view: every application, its status, and where it was aimed.
//
// This reads the DIRECTORY TREE rather than an index file. Status is the folder an application
// sits in, so the tree cannot disagree with itself — which is why there is no applications/
// log.json to keep in sync. Adding one would create a second source of truth for a fact the
// filesystem already holds.

import { listApplications, STATUSES } from './lib/applications.js';

const apps = listApplications();

if (!apps.length) {
  console.log('\nNo applications yet.  `/apply` in Claude Code creates one.\n');
  process.exit(0);
}

const pad = (s, n) => String(s ?? '').padEnd(n);
const trunc = (s, n) => (String(s ?? '').length > n ? String(s).slice(0, n - 1) + '…' : s ?? '');

const w = {
  slug: Math.max(4, ...apps.map((a) => a.slug.length)),
  company: Math.min(28, Math.max(7, ...apps.map((a) => (a.meta.company ?? '').length))),
  role: Math.min(34, Math.max(4, ...apps.map((a) => (a.meta.role ?? '').length))),
};

const LABEL = {
  drafting: 'drafting ',
  submitted: 'SUBMITTED',
  closed: 'closed   ',
};

console.log();
for (const status of STATUSES) {
  const group = apps.filter((a) => a.status === status);
  if (!group.length) continue;

  console.log(`  ${LABEL[status].trim()}  (${group.length})`);
  for (const a of group) {
    console.log(
      `    ${pad(trunc(a.meta.company, w.company), w.company)}  ` +
        `${pad(trunc(a.meta.role, w.role), w.role)}  ` +
        `${pad(a.meta.date ?? '', 10)}  ` +
        `${a.hasLetter ? '+letter' : '       '}  ` +
        `${a.slug}`,
    );
  }
  console.log();
}

const counts = STATUSES.map((s) => `${apps.filter((a) => a.status === s).length} ${s}`).join(' · ');
console.log(`  ${apps.length} total — ${counts}`);
console.log(`  build one:  npm run tailor -- <slug>`);
console.log(`  move one:   npm run app:status -- <slug> <${STATUSES.join('|')}>\n`);
