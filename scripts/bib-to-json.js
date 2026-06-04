// scripts/bib-to-json.js
//
// PURE, OFFLINE. Renders cv/publications.bib (the human-curated publications SSOT) into
// data/publications.json for the website to fetch. The .bib stays the single source; this
// file is script-written and must never be hand-edited.
//
// No LaTeX/HTML markup survives into the JSON: accents are decoded to Unicode and the
// owner (\textbf{Yang, ...} in the .bib) is flagged per-author as `isOwner` so the site
// bolds it via CSS — never by storing \textbf or <b> in the data.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadData, pubCounts, ROOT } from './lib/data.js';

const { publications } = loadData();

// Newest first; entries with no year (in-prep / submitted) sort to the top as "current".
const sorted = [...publications].sort((a, b) => (b.year ?? Infinity) - (a.year ?? Infinity));

const out = {
  generatedBy: 'scripts/bib-to-json.js',
  generatedAt: new Date().toISOString(),
  counts: pubCounts(publications),
  publications: sorted,
};

const rel = 'data/publications.json';
writeFileSync(join(ROOT, rel), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(`wrote ${rel}: ${sorted.length} publications`);
