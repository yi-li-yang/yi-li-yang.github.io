// SOURCE — you own this file. Edit freely, by hand or by agent.
// The site's derived data/site.json, the LaTeX-to-text converter it uses, and the facts that
// must stay static in index.html for crawlers. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadData, pubCounts, ROOT } from '../scripts/lib/data.js';
import { untex } from '../scripts/lib/text.js';
import { buildSiteJson } from '../scripts/build-site-json.js';
import { categoryOf } from '../js/modules/pub-category.js';

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const data = loadData();
const site = buildSiteJson(data);

test('site.json carries the plain-text job title', () => {
  assert.equal(site.role, 'AI Scientist – Geospatial & Remote Sensing');
});

test('site.json service counts match the CV', () => {
  const s = site.service;
  assert.deepEqual(
    { peer: s.peerReviews, nsf: s.nsfProposalReviews, mentees: s.mentees, invited: s.invitedTalksPanels,
      conferences: s.conferenceEvents, anyInvited: s.invited, funding: s.funding },
    { peer: 8, nsf: 1, mentees: 8, invited: 5, conferences: 15, anyInvited: 7,
      funding: { value: 99749, display: '~$100K' } },
  );
});

test('site.json logo walls: education first, then jobs; partners with a logo only', () => {
  assert.deepEqual(
    site.logoWalls.experience.map((l) => l.name),
    ['University of Edinburgh', 'Faculty.ai', 'Woodwell Climate Research Center'],
  );
  assert.deepEqual(site.logoWalls.collaborations.map((l) => l.name), ['Petrobras', 'Google', 'Esri']);
  assert.deepEqual(site.logoWalls.experience[0], {
    name: 'University of Edinburgh',
    url: 'https://www.ed.ac.uk',
    src: 'assets/logos/edinburgh.png',
    width: 831,
    height: 199,
  });
});

test('site.json says it is derived', () => {
  assert.match(site._edit, /^DERIVED/);
});

test('untex turns LaTeX dashes and escapes into plain text', () => {
  assert.equal(untex('a -- b --- c'), 'a – b — c');
  assert.equal(untex('Geospatial \\& Remote Sensing'), 'Geospatial & Remote Sensing');
  assert.equal(untex('\\$99,749'), '$99,749');
});

test('the site publication chips count what the CV counts', () => {
  // From the .bib in memory, not the derived data/publications.json, which a checkout can
  // hold stale until `npm run build` runs.
  const pubs = data.publications;
  const n = (c) => pubs.filter((p) => categoryOf(p) === c).length;
  const cv = pubCounts(data.publications);
  assert.deepEqual(
    { journal: n('journal'), conference: n('conference'), dataset: n('dataset') },
    { journal: cv.journalPapers, conference: cv.conferences, dataset: cv.datasets },
  );
});

test('static index.html facts match the data', () => {
  const html = read('index.html');
  const words = (s) => s.replace(/&amp;/g, '&').match(/[A-Za-z]+/g).join(' ');
  for (const meta of ['name="description"', 'property="og:description"']) {
    const content = html.match(new RegExp(`<meta ${meta} content="([^"]+)"`))[1];
    assert.ok(words(content).includes(words(site.role)), `${meta} names the current role`);
  }
  const p = data.profile;
  for (const href of [
    `mailto:${p.email}`,
    `linkedin.com/in/${p.profiles.linkedin}`,
    `github.com/${p.profiles.github}`,
    `user=${p.profiles.scholar}`,
    `orcid.org/${p.profiles.orcid}`,
  ]) {
    assert.ok(html.includes(href), href);
  }
});
