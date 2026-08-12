// scripts/tailor.js
//
// PURE, OFFLINE. Renders ONE job application: a tailored one-pager plus its cover letter in
// both LaTeX and plain text.
//
//   npm run tailor -- <slug>        (reads applications/<slug>/)
//
// The manifest SELECTS facts by id from the data layer and may compress the wording of an
// experience bullet. It cannot introduce a fact: skills, awards, collaborations, taglines and
// publications are chosen by id and their text comes from data/, never from the manifest.
// Only experience bullets and cover-letter paragraphs carry prose, and each of those must
// name its source — enforced by scripts/verify-application.js, which CI runs before this.
//
// Run the verifier first. This script renders; it does not police.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadData, indexSkills, indexCollaborations, ROOT } from './lib/data.js';
import { renderPartial } from './lib/render.js';

const slug = process.argv[2];
if (!slug) {
  console.error('usage: npm run tailor -- <slug>   (a directory under applications/)');
  process.exit(2);
}

const appDir = `applications/${slug}`;
const manifestPath = join(ROOT, appDir, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`no manifest at ${appDir}/manifest.json`);
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const letterPath = join(ROOT, appDir, 'letter.json');
const letterDoc = existsSync(letterPath) ? JSON.parse(readFileSync(letterPath, 'utf8')) : null;

const data = loadData();
const skillById = indexSkills(data.skills);
const collabById = indexCollaborations(data.collaborations);
const pubByKey = new Map(data.publications.map((p) => [p.key, p]));
const awardById = new Map((data.awards.awards ?? []).map((a) => [a.id, a]));
const taglineById = new Map((data.taglines.options ?? []).map((t) => [t.id, t]));

// A selection that doesn't resolve is a bug in the manifest, not something to render around.
// verify-application.js reports these properly; this is the belt-and-braces stop.
const must = (value, token) => {
  if (value === undefined || value === null) {
    console.error(`unresolvable selection: ${token} — run \`npm run verify:app -- ${slug}\` first`);
    process.exit(1);
  }
  return value;
};

const outDir = `cv/onepage/generated/app-${slug}`;
const src = `${appDir}/manifest.json`;

// ── Skills ───────────────────────────────────────────────────────────────────
// The manifest gives, per group, ordered lines of skill ids. Labels come from
// data/skills.json. Tailored lines always use `break` (\\) rather than the canonical CV's
// mix of break/paragraph styles — it is the more compact of the two, and fitting one page
// matters more on a tailored variant than matching the original's vertical rhythm.
const skills = {
  groups: (manifest.skills ?? []).map((g) => ({
    id: g.group,
    title: g.title ?? must(data.skills.groups.find((x) => x.id === g.group), `skill group ${g.group}`).title,
    lines: g.lines.map((ids, i) => ({
      id: `${g.group}-${i}`,
      after: i === g.lines.length - 1 ? undefined : 'break',
      items: ids.map((id) => must(skillById.get(id), `skill:${id}`)),
    })),
  })),
};

// ── Publications ─────────────────────────────────────────────────────────────
const publications = (manifest.publications ?? []).map((key) =>
  must(pubByKey.get(key), `pub:${key}`),
);

// ── Awards ───────────────────────────────────────────────────────────────────
const awards = (manifest.awards ?? []).map((id) => must(awardById.get(id), `award:${id}`));

// ── Collaborations ───────────────────────────────────────────────────────────
// Academic ids arrive flat and are chunked three per line, matching the canonical layout's
// widest row. Industry entries keep their order.
const chunk = (arr, n) =>
  arr.reduce((rows, x, i) => (i % n ? rows[rows.length - 1].push(x) : rows.push([x]), rows), []);
const collaborations = {
  industry: (manifest.collaborations?.industry ?? []).map((id) =>
    must(collabById.get(id), `collab:${id}`),
  ),
  academic: chunk(
    (manifest.collaborations?.academic ?? []).map((id) => must(collabById.get(id), `collab:${id}`)),
    3,
  ),
};

// ── Tagline ──────────────────────────────────────────────────────────────────
const tagline = manifest.tagline ? must(taglineById.get(manifest.tagline), `tagline:${manifest.tagline}`) : null;

// ── Render the tailored partials ─────────────────────────────────────────────
const blocks = ['tagline', 'skills', 'experience', 'publications', 'awards', 'collaborations'];

const emit = (block, context) =>
  renderPartial({
    script: 'tailor.js',
    cmd: `npm run tailor -- ${slug}`,
    template: `onepage-${block}.tex.njk`,
    out: `${outDir}/${block}.tex`,
    src,
    context,
  });

emit('tagline', { tagline });
emit('skills', { skills });
emit('experience', { experience: manifest.experience ?? [] });
emit('publications', { publications });
emit('awards', { awards });
emit('collaborations', { collaborations });

// ── Variant shell ────────────────────────────────────────────────────────────
// A copy of ONE-PAGE.tex whose \input paths point at this application's partials. Only the
// tailorable blocks are redirected — generated/metrics.tex is deliberately left alone, since
// the derived counts are the same regardless of who is reading the CV.
let shell = readFileSync(join(ROOT, 'cv/onepage/ONE-PAGE.tex'), 'utf8');
for (const b of blocks) {
  shell = shell.replace(`\\input{generated/${b}.tex}`, `\\input{generated/app-${slug}/${b}.tex}`);
}
const shellOut = `cv/onepage/app-${slug}.tex`;
writeFileSync(join(ROOT, shellOut), shell, 'utf8');
console.log(`wrote ${shellOut}  (compile this for the tailored one-pager)`);

// ── Cover letter ─────────────────────────────────────────────────────────────
if (letterDoc) {
  const context = {
    sender: letterDoc.sender,
    recipient: letterDoc.recipient,
    date: letterDoc.date,
    letter: letterDoc.letter,
  };
  const lsrc = `${appDir}/letter.json`;
  renderPartial({
    template: 'coverletter.tex.njk',
    out: `cv/coverletter/generated/${slug}.tex`,
    src: lsrc,
    context,
    script: 'tailor.js',
    cmd: `npm run tailor -- ${slug}`,
  });
  // No banner: this file gets pasted into application forms verbatim.
  renderPartial({
    template: 'coverletter.txt.njk',
    out: `cv/coverletter/generated/${slug}.txt`,
    src: lsrc,
    context,
    banner: false,
  });
} else {
  console.log(`no ${appDir}/letter.json — skipped the cover letter`);
}
