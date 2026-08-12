// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/render-cv.js
//
// PURE, OFFLINE. Renders the DEFAULT (untailored) CVs: every prose block on the one-pager
// plus the biosketch experience, from the hand-authored data layer into LaTeX partials that
// the .tex shells \input. The same facts feed both PDFs and the website from one source.
// Generated files are script-written and must never be hand-edited.
//
// Per-application tailoring lives in scripts/tailor.js, not here. This file has exactly one
// job: build the canonical CV. The Nunjucks environment and the write helper are shared,
// in scripts/lib/render.js.

import { loadData } from './lib/data.js';
import { renderPartial } from './lib/render.js';

const { experience, skills, awards, collaborations, taglines } = loadData();

// The default tagline is `null` in data/taglines.json, so the one-pager renders none —
// matching the CV as it stood before the tagline became a tailoring lever.
const defaultTagline =
  (taglines.options ?? []).find((t) => t.id === taglines.default) ?? null;

const jobs = [
  {
    template: 'onepage-tagline.tex.njk',
    out: 'cv/onepage/generated/tagline.tex',
    src: 'data/taglines.json',
    context: { tagline: defaultTagline },
  },
  {
    template: 'onepage-skills.tex.njk',
    out: 'cv/onepage/generated/skills.tex',
    src: 'data/skills.json',
    context: { skills },
  },
  {
    template: 'onepage-experience.tex.njk',
    out: 'cv/onepage/generated/experience.tex',
    src: 'data/experience.json',
    context: { experience },
  },
  {
    // Deliberately empty on the canonical CV: the one-pager reports publication COUNTS
    // (\journalpapers etc.) and has no room for a list too. Tailored variants select a few.
    template: 'onepage-publications.tex.njk',
    out: 'cv/onepage/generated/publications.tex',
    src: 'cv/publications.bib',
    context: { publications: [] },
  },
  {
    template: 'onepage-awards.tex.njk',
    out: 'cv/onepage/generated/awards.tex',
    src: 'data/awards.json',
    context: { awards: awards.awards },
  },
  {
    template: 'onepage-collaborations.tex.njk',
    out: 'cv/onepage/generated/collaborations.tex',
    src: 'data/collaborations.json',
    context: { collaborations },
  },
  {
    template: 'biosketch-experience.tex.njk',
    out: 'cv/biosketch/generated/experience.tex',
    src: 'data/experience.json',
    context: { experience },
  },
];

for (const job of jobs) renderPartial(job);
