// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/render-cv.js
//
// PURE, OFFLINE. Renders the DEFAULT (untailored) CVs: every partial that the two .tex shells
// \input, from the hand-authored data layer. The same facts feed both PDFs and the website
// from one source. Generated files are script-written and must never be hand-edited.
//
// Which partials exist, and what data each gets, is decided in scripts/lib/cv-jobs.js, so the
// tests can render the same list in memory. Per-application tailoring lives in
// scripts/tailor.js. The Nunjucks environment and the write helper are in scripts/lib/render.js.

import { loadData } from './lib/data.js';
import { renderPartial } from './lib/render.js';
import { canonicalJobs } from './lib/cv-jobs.js';

for (const job of canonicalJobs(loadData())) renderPartial(job);
