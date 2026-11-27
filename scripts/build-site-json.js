// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/build-site-json.js — part of `npm run build`
//
// PURE, OFFLINE. Writes data/site.json: the plain-text, site-ready view of the facts the
// website shows beside the CVs — the service counts, the current job title and the two logo
// walls. The data layer's prose is LaTeX on purpose, and the counts are derived; doing both
// here, once, in Node, keeps the browser code simple and gives the site the same numbers as
// the PDFs (scripts/lib/derive.js).
//
// data/site.json is DERIVED: never edit it. CI regenerates and commits it on main.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadData, ROOT } from './lib/data.js';
import { derivedFacts } from './lib/derive.js';
import { untex } from './lib/text.js';

const logoOf = ({ logo }) => ({
  name: logo.name,
  url: logo.url,
  src: logo.src,
  width: logo.width,
  height: logo.height,
});

export function buildSiteJson(data) {
  const facts = derivedFacts(data);
  const withLogo = (items) => items.filter((x) => x.logo).map(logoOf);
  return {
    _edit:
      'DERIVED — written by scripts/build-site-json.js. Never edit; run `npm run build`. ' +
      'Edit data/*.json instead.',
    // The current job is the first in data/experience.json.
    role: untex(data.experience[0]?.role ?? ''),
    service: {
      peerReviews: data.service.peerReviews ?? null,
      nsfProposalReviews: data.service.nsfProposalReviews ?? null,
      mentees: facts.menteeCount,
      invitedTalksPanels: facts.invitedTalksPanels,
      conferences: facts.conferences,
      invited: facts.invitedCount,
      funding: { value: facts.fundingTotal, display: facts.fundingDisplay },
    },
    logoWalls: {
      // Oldest first, like a timeline: education, then jobs. data/experience.json lists jobs
      // newest first, so they are reversed here.
      experience: [
        ...withLogo(data.education.institutions ?? []),
        ...withLogo([...data.experience].reverse()),
      ],
      collaborations: withLogo(data.collaborations.industry ?? []),
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const rel = 'data/site.json';
  writeFileSync(join(ROOT, rel), `${JSON.stringify(buildSiteJson(loadData()), null, 2)}\n`, 'utf8');
  console.log(`wrote ${rel}`);
}
