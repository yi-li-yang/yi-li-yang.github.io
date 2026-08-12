// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/tailor.js
//
// PURE, OFFLINE. Renders ONE job application into build/<slug>/: a tailored one-pager plus its
// cover letter in both LaTeX and plain text.
//
//   npm run tailor -- <slug>
//
// Verification runs FIRST, here, not as a separate step you have to remember. A dangling
// citation aborts before a single file is written. The firewall can be declined deliberately
// (--skip-verify) but never skipped by forgetting.
//
// The manifest SELECTS facts by id from the data layer and may compress the wording of an
// experience bullet. It cannot introduce a fact: skills, awards, collaborations, taglines and
// publications are chosen by id and their text comes from data/, never from the manifest.
//
// build/<slug>/ is SELF-CONTAINED: the .cls and fonts/ are copied in, because
// deedy-resume-openfont.cls resolves `Path = fonts/lato/` against the compile working
// directory rather than against itself. Copying them is what lets the directory compile
// standalone — in CI, or locally if a TeX toolchain ever gets installed.

import { readFileSync, existsSync, writeFileSync, cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadData, indexSkills, indexCollaborations, ROOT } from './lib/data.js';
import { requireApplication } from './lib/applications.js';
import { renderPartial } from './lib/render.js';

const args = process.argv.slice(2);
const skipVerify = args.includes('--skip-verify');
const slug = args.find((a) => !a.startsWith('-'));

if (!slug) {
  console.error('usage: npm run tailor -- <slug> [--skip-verify]');
  console.error('       run `npm run apps` to list applications');
  process.exit(2);
}

const app = requireApplication(slug, 'npm run tailor -- <slug>');

// ── The firewall, folded in ──────────────────────────────────────────────────
// Runs as a child process so there is exactly one implementation of the checks and one
// report format, shared with `npm run verify:app`.
if (!skipVerify) {
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts/verify-application.js'), slug], {
      stdio: 'inherit',
    });
  } catch {
    console.error('\nverification failed — nothing was rendered. Fix the citations and retry.');
    process.exit(1);
  }
}

const manifest = JSON.parse(readFileSync(join(app.dir, 'manifest.json'), 'utf8'));
const letterPath = join(app.dir, 'letter.json');
const letterDoc = existsSync(letterPath) ? JSON.parse(readFileSync(letterPath, 'utf8')) : null;

const data = loadData();
const skillById = indexSkills(data.skills);
const collabById = indexCollaborations(data.collaborations);
const pubByKey = new Map(data.publications.map((p) => [p.key, p]));
const awardById = new Map((data.awards.awards ?? []).map((a) => [a.id, a]));
const taglineById = new Map((data.taglines.options ?? []).map((t) => [t.id, t]));

// Belt-and-braces: verify-application.js reports unresolvable selections properly. This only
// fires if that was skipped.
const must = (value, token) => {
  if (value === undefined || value === null) {
    console.error(`unresolvable selection: ${token} — run \`npm run verify:app -- ${slug}\``);
    process.exit(1);
  }
  return value;
};

const outDir = `build/${slug}`;
const src = `${app.rel}/manifest.json`;
const cmd = `npm run tailor -- ${slug}`;

// ── Skills ───────────────────────────────────────────────────────────────────
// Tailored lines always use `break` (\\) rather than the canonical CV's mix of break and
// paragraph styles — it is the more compact of the two, and fitting one page matters more on
// a variant than matching the original's vertical rhythm.
const skills = {
  groups: (manifest.skills ?? []).map((g) => ({
    id: g.group,
    title:
      g.title ??
      must(data.skills.groups.find((x) => x.id === g.group), `skill group ${g.group}`).title,
    lines: g.lines.map((ids, i) => ({
      id: `${g.group}-${i}`,
      after: i === g.lines.length - 1 ? undefined : 'break',
      items: ids.map((id) => must(skillById.get(id), `skill:${id}`)),
    })),
  })),
};

const publications = (manifest.publications ?? []).map((key) =>
  must(pubByKey.get(key), `pub:${key}`),
);
const awards = (manifest.awards ?? []).map((id) => must(awardById.get(id), `award:${id}`));

// Academic ids arrive flat and are chunked three per line, matching the canonical layout.
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

const tagline = manifest.tagline
  ? must(taglineById.get(manifest.tagline), `tagline:${manifest.tagline}`)
  : null;

// ── Render the tailored partials ─────────────────────────────────────────────
const BLOCKS = ['tagline', 'skills', 'experience', 'publications', 'awards', 'collaborations'];

const emit = (block, context) =>
  renderPartial({
    script: 'tailor.js',
    cmd,
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

// ── Self-contained compile context ───────────────────────────────────────────
// The class and fonts must sit beside the shell, since fontspec resolves the class's
// `Path = fonts/lato/` against the compile working directory. Copied only when absent, so
// re-running tailor on the same slug stays fast.
const abs = join(ROOT, outDir);
mkdirSync(abs, { recursive: true });
for (const asset of ['deedy-resume-openfont.cls', 'fonts']) {
  const dest = join(abs, asset);
  if (!existsSync(dest)) {
    cpSync(join(ROOT, 'cv/onepage', asset), dest, { recursive: true });
    console.log(`copied ${asset} into ${outDir}/`);
  }
}

// ── The shell ────────────────────────────────────────────────────────────────
// A copy of ONE-PAGE.tex whose \input paths point at this application's partials, which now
// sit beside it — so the redirect is simply dropping the `generated/` prefix.
// generated/metrics.tex is the exception: the derived counts are identical for every reader,
// so it is copied in rather than re-rendered.
let shell = readFileSync(join(ROOT, 'cv/onepage/ONE-PAGE.tex'), 'utf8');
for (const b of BLOCKS) {
  shell = shell.replace(`\\input{generated/${b}.tex}`, `\\input{${b}.tex}`);
}
shell = shell.replace('\\input{generated/metrics.tex}', '\\input{metrics.tex}');
cpSync(join(ROOT, 'cv/onepage/generated/metrics.tex'), join(abs, 'metrics.tex'));

writeFileSync(join(abs, 'cv.tex'), shell, 'utf8');
console.log(`wrote ${outDir}/cv.tex  (compile this for the tailored one-pager)`);

// ── Cover letter ─────────────────────────────────────────────────────────────
if (letterDoc) {
  const context = {
    sender: letterDoc.sender,
    recipient: letterDoc.recipient,
    date: letterDoc.date,
    letter: letterDoc.letter,
  };
  const lsrc = `${app.rel}/letter.json`;
  renderPartial({
    template: 'coverletter.tex.njk',
    out: `${outDir}/letter.tex`,
    src: lsrc,
    context,
    script: 'tailor.js',
    cmd,
  });
  // No banner: this file gets pasted into application forms verbatim.
  renderPartial({
    template: 'coverletter.txt.njk',
    out: `${outDir}/letter.txt`,
    src: lsrc,
    context,
    banner: false,
  });
} else {
  console.log(`no ${app.rel}/letter.json — skipped the cover letter`);
}

console.log(`\n${app.status}/${slug} → ${outDir}/`);
