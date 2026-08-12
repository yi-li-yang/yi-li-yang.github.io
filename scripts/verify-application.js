// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/verify-application.js
//
// THE FIREWALL. Invariant 6 says the model never mints facts. This script is what makes that
// checkable rather than aspirational.
//
//   npm run verify:app -- <slug>
//
// On a CV the dangerous failure is not a typo — it is a clean-sounding fabricated achievement
// that reads too well to catch. So every claim in applications/<slug>/{manifest,letter}.json
// carries `src` tokens naming where it came from, and this script:
//
//   1. FAILS on any token that does not resolve against the data layer, and on any selected
//      id that does not exist. A dangling citation means the claim has no source.
//   2. Prints a PROVENANCE REPORT — each generated sentence beside its source text — so the
//      human review is a side-by-side comparison instead of a hunt through a diff.
//   3. WARNS on unsourced sentences carrying numerals or unknown capitalised terms. That is
//      the smell test: invented claims almost always arrive as an unsourced number.
//   4. Prints a GAP REPORT — requirements in job.md that nothing in the data layer supports.
//      Gaps are named, never filled. Knowing you cannot claim something is the point.
//
// PURE and OFFLINE. Exit 0 = every claim traced. Nonzero = do not compile.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadData,
  indexSkills,
  indexExperienceBullets,
  indexCollaborations,
  resolveStatsPath,
} from './lib/data.js';
import { requireApplication } from './lib/applications.js';

const args = process.argv.slice(2);
// --strict promotes smell-test warnings to hard failures. Locally the warnings are advisory:
// a human is reading the report and decides. In CI nobody reads a warning, so CI runs strict —
// otherwise an unsourced fabricated claim compiles into a PDF with a green tick beside it.
const strict = args.includes('--strict');
const slug = args.find((a) => !a.startsWith('-'));
if (!slug) {
  console.error('usage: npm run verify:app -- <slug> [--strict]   (a directory under applications/)');
  process.exit(2);
}

// Resolved by slug, never by path: an application's status folder is free to change without
// this command (or your muscle memory) changing with it.
const app = requireApplication(slug, 'npm run verify:app -- <slug> [--strict]');
// Line endings are normalised on read. .gitattributes sets `* text=auto`, so on Windows these
// files check out CRLF while CI sees LF — and JS `.` does not match `\r`, which silently broke
// every `^#…$` match in the gap report. A checker that quietly no-ops is worse than no checker,
// so this is fixed at the boundary rather than in each regex.
const read = (name) => {
  const p = join(app.dir, name);
  return existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n?/g, '\n') : null;
};

const manifestRaw = read('manifest.json');
if (!manifestRaw) {
  console.error(`no ${app.rel}/manifest.json`);
  process.exit(2);
}
const manifest = JSON.parse(manifestRaw);
const letterRaw = read('letter.json');
const letterDoc = letterRaw ? JSON.parse(letterRaw) : null;
const jobText = read('job.md');

const data = loadData();
const skillById = indexSkills(data.skills);
const bulletById = indexExperienceBullets(data.experience);
const collabById = indexCollaborations(data.collaborations);
const pubByKey = new Map(data.publications.map((p) => [p.key, p]));
const awardById = new Map((data.awards.awards ?? []).map((a) => [a.id, a]));
const taglineById = new Map((data.taglines.options ?? []).map((t) => [t.id, t]));

const errors = [];
const warnings = [];
const provenance = [];

// ── Token resolution ─────────────────────────────────────────────────────────
// Returns the source TEXT a token points at, or null when it does not resolve.
function resolveToken(token) {
  if (token === 'none') return { text: '(no factual claim)', kind: 'none' };

  const [scheme, ...rest] = token.split(':');
  const arg = rest.join(':');

  switch (scheme) {
    case 'exp': {
      const b = bulletById.get(arg);
      return b ? { text: b.text, kind: `experience/${b.job}` } : null;
    }
    case 'pub': {
      const p = pubByKey.get(arg);
      return p ? { text: `${p.title} — ${p.venue} (${p.year})`, kind: 'publication' } : null;
    }
    case 'skill': {
      const s = skillById.get(arg);
      return s ? { text: s.label, kind: 'skill' } : null;
    }
    case 'award': {
      const a = awardById.get(arg);
      return a ? { text: `${a.title}: ${a.project} (${a.period})`, kind: 'award' } : null;
    }
    case 'collab': {
      const c = collabById.get(arg);
      return c ? { text: c.partners ?? c.label, kind: 'collaboration' } : null;
    }
    case 'tagline': {
      const t = taglineById.get(arg);
      return t ? { text: t.text, kind: 'tagline' } : null;
    }
    case 'job': {
      // Naming the company/role you are applying to is not a claim about yourself.
      if (!jobText) return null;
      return { text: `(from job.md: ${arg})`, kind: 'job posting' };
    }
    case 'stats': {
      const v = resolveStatsPath(data.stats, arg);
      return v === undefined ? null : { text: `${arg} = ${JSON.stringify(v)}`, kind: 'stats' };
    }
    case 'service': {
      // Funding, mentees, talks, reviews — the figures you maintain by hand. Previously
      // reachable as `stats.static.*`; that path no longer exists.
      const v = resolveStatsPath(data.service, arg);
      return v === undefined ? null : { text: `${arg} = ${JSON.stringify(v)}`, kind: 'service' };
    }
    default:
      return null;
  }
}

// `stats.foo.bar` / `service.foo` are written without a second colon; normalise to scheme form.
const normalise = (t) =>
  t.startsWith('stats.')
    ? `stats:${t.slice('stats.'.length)}`
    : t.startsWith('service.')
      ? `service:${t.slice('service.'.length)}`
      : t;

// ── The smell test ───────────────────────────────────────────────────────────
// An unsourced sentence that carries a number, a percentage, or a capitalised term the data
// layer has never heard of is where a fabricated achievement hides. Warn, don't fail — a
// human still decides, but they decide with the suspect sentence pointed at.
const KNOWN_WORDS = new Set(
  [
    ...[...skillById.values()].map((s) => s.label),
    ...[...collabById.values()].map((c) => c.partners ?? c.label),
    ...data.experience.map((j) => j.org),
    ...data.publications.flatMap((p) => [p.venue, p.title]),
  ]
    .join(' ')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase()),
);
// Words that are structural English or refer to the application itself, not to a credential.
const IGNORE = new Set(
  `i my me the a an and or of to in on for with at by as is are was were be been being this that these those
   your you we our us it its from into over under about after before during while which who whom whose what when
   where why how not no yes if then than so such both each few more most other some any all can will would should
   could may might must dear sincerely regards yours role position team company firm work working experience
   background please thank thanks best kind regard hiring manager application applying apply letter cv resume
   january february march april may june july august september october november december monday`
    .split(/\s+/)
    .filter(Boolean),
);

function smellTest(text, label) {
  const numerals = text.match(/\b\d[\d,.]*\+?%?\b/g) ?? [];
  if (numerals.length) {
    warnings.push(
      `${label}: unsourced sentence contains ${numerals.length === 1 ? 'a number' : 'numbers'} ` +
        `(${numerals.join(', ')}) — numbers are claims. Cite it or remove it.\n      "${text}"`,
    );
  }
  const unknownProper = (text.match(/\b[A-Z][A-Za-z.&-]{2,}\b/g) ?? [])
    .filter((w, i) => !(i === 0 && !text.slice(1).includes(w))) // sentence-initial word is fine
    .map((w) => w.replace(/[.&-]+$/, ''))
    .filter((w) => !KNOWN_WORDS.has(w.toLowerCase()) && !IGNORE.has(w.toLowerCase()));
  if (unknownProper.length) {
    warnings.push(
      `${label}: unsourced sentence names ${[...new Set(unknownProper)].join(', ')} — ` +
        `not found anywhere in the data layer. Verify this is not invented.\n      "${text}"`,
    );
  }
}

// ── Check one cited claim ────────────────────────────────────────────────────
function checkClaim({ text, src, label }) {
  const tokens = (Array.isArray(src) ? src : [src]).filter(Boolean).map(normalise);
  if (!tokens.length) {
    errors.push(`${label}: no \`src\` at all. Every claim must cite a source, or say "none".`);
    return;
  }
  const sources = [];
  for (const t of tokens) {
    const r = resolveToken(t);
    if (!r) {
      errors.push(`${label}: \`src\` token "${t}" does not resolve against the data layer.`);
    } else {
      sources.push({ token: t, ...r });
    }
  }
  if (sources.length && sources.every((s) => s.kind === 'none')) smellTest(text, label);
  provenance.push({ label, text, sources });
}

// ── Selections: ids only, no prose, so existence is the whole check ──────────
const checkIds = (ids, prefix, index, what) => {
  for (const id of ids ?? []) {
    if (!index.has(id)) errors.push(`${what}: "${prefix}${id}" is not in the data layer.`);
  }
};

if (manifest.tagline && !taglineById.has(manifest.tagline)) {
  errors.push(`tagline: "${manifest.tagline}" is not in data/taglines.json.`);
}
checkIds(manifest.publications, 'pub:', pubByKey, 'publications');
checkIds(manifest.awards, 'award:', awardById, 'awards');
checkIds(manifest.collaborations?.industry, 'collab:', collabById, 'collaborations.industry');
checkIds(manifest.collaborations?.academic, 'collab:', collabById, 'collaborations.academic');
for (const g of manifest.skills ?? []) {
  if (!data.skills.groups.some((x) => x.id === g.group)) {
    errors.push(`skills: group "${g.group}" is not in data/skills.json.`);
  }
  for (const line of g.lines ?? []) checkIds(line, 'skill:', skillById, `skills.${g.group}`);
}

// ── Experience bullets: the one place the manifest carries prose ─────────────
for (const job of manifest.experience ?? []) {
  for (const b of job.onepage?.bullets ?? []) {
    checkClaim({
      text: b.text,
      src: b.src,
      label: `experience[${job.role ?? '?'}] "${(b.label ? b.label + ': ' : '') + b.text.slice(0, 48)}…"`,
    });
  }
}

// ── Cover letter: generated prose, the highest-risk surface ──────────────────
if (letterDoc) {
  const paras = letterDoc.letter?.paragraphs ?? [];
  if (!paras.length) errors.push('letter.json has no paragraphs.');
  paras.forEach((p, i) => {
    checkClaim({ text: p.text, src: p.src, label: `letter ¶${i + 1}` });
  });
}

// ── Gap report ───────────────────────────────────────────────────────────────
// Flag requirements in job.md that nothing in the data layer supports.
//
// Precision matters more than recall here. A gap report that flags nine things — most of them
// company boilerplate and generic job-ad verbs — gets skimmed, and the one requirement that
// genuinely cannot be met gets skimmed with it. So: only requirement-bearing sections, only
// distinctive terms, and a high missing-ratio before anything is reported.

// Only these sections state what the candidate must have or do.
const REQUIREMENT_SECTION = /qualification|requirement|responsibilit|who we (look|are looking)|what you|skills|experience|you (will|should) (have|bring)/i;
// These describe the company, not the candidate. Scanning them produces pure noise.
const BOILERPLATE_SECTION = /^(about|what we do|our culture|culture|benefits|diversity|equal opportunit|why join|perks|compensation)/i;

// Generic job-ad vocabulary. A requirement made only of these words says nothing checkable,
// so its absence from the data layer is not evidence of a gap.
const GENERIC = new Set(
  `experience strong minimum years degree equivalent relevant industry including limited various etc
   ability able skills skill knowledge understanding proficiency familiarity expertise track record
   building build built maintaining maintain create creating creation develop developing development
   design designing designed work working works collaborate collaborating collaboration effectively
   colleagues team teams cross-team project projects deliver delivering high-quality quality
   production production-ready code software systems system application applications solution solutions
   technology technologies technical tool tools platform platforms framework frameworks library libraries
   underpin reliable testable scalable robust efficient effective complex challenging
   demonstrating demonstrate demonstrates leadership lead leading taking charge role responsibilities
   opportunity opportunities contribute contributing help helping support supporting drive driving
   adoption advance advancing assess assessing assessment conceptualizing experimenting experiment
   represent representing within communities community conferences conference open-source
   join joining seeking seek look looking part integral pivotal play various unique arise arises
   domain domains area areas field fields cutting-edge state-of-the-art advanced modern
   master masters phd doctorate bachelor computer science mathematics statistics physics engineering
   candidate applicant position job hiring firm company organisation organization business
   preferred required must should would could plus bonus nice good great excellent
   new well also more most other others such using used use uses via across into over
   real solutions immediate dynamic environment innovative strategic thinking`
    .split(/\s+/)
    .filter(Boolean),
);

// Crude stemming so "frameworks" matches a corpus that says "framework", "modelling" matches
// "model". Good enough to stop trivial morphology from reading as a missing capability.
const stems = (t) => {
  const out = new Set([t]);
  for (const suf of ['s', 'es', 'ing', 'ed', 'ion', 'ions', 'al', 'ly']) {
    if (t.length - suf.length >= 4 && t.endsWith(suf)) out.add(t.slice(0, -suf.length));
  }
  if (t.length >= 6) out.add(t.slice(0, Math.max(5, t.length - 2)));
  return [...out];
};

// How many requirement lines the last gapReport() actually examined. Reported alongside the
// result so "no gaps" can never be confused with "nothing was read" — the failure mode that
// hid a CRLF parsing bug behind a reassuring green message.
let gapLinesScanned = 0;

function gapReport() {
  gapLinesScanned = 0;
  if (!jobText) return [];

  const corpus = [
    ...data.experience.flatMap((j) => [
      j.org,
      j.role,
      ...(j.onepage?.bullets ?? []).map((b) => b.text),
      ...(j.biosketch?.bullets ?? []).map((b) => b.text),
    ]),
    ...[...skillById.values()].map((s) => s.label),
    ...[...collabById.values()].map((c) => c.partners ?? c.label),
    ...data.publications.flatMap((p) => [p.title, p.venue]),
    ...(data.awards.awards ?? []).map((a) => `${a.title} ${a.project}`),
  ]
    .join(' ')
    .toLowerCase();

  // The hiring company's own name is not a capability you can lack. Drop it before scoring,
  // or every posting reports a gap for being written by a company you have not worked at.
  const companyWords = new Set(
    String(manifest.meta?.company ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2),
  );

  // Walk job.md section by section, keeping only requirement-bearing ones. Blockquotes are
  // the archive's own notes-to-self, never the posting.
  const gaps = [];
  let heading = '';
  let inRequirements = false;

  for (const raw of jobText.split('\n')) {
    const h = raw.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      heading = h[1].trim();
      inRequirements = REQUIREMENT_SECTION.test(heading) && !BOILERPLATE_SECTION.test(heading);
      continue;
    }
    if (!inRequirements) continue;
    if (/^\s*>/.test(raw)) continue; // archive annotation, not the posting

    const line = raw.replace(/^[\s*+-]+/, '').trim();
    if (line.length < 25 || line.length > 400) continue;
    gapLinesScanned++;

    const terms = [
      ...new Set(
        line
          .toLowerCase()
          .replace(/[^a-z0-9+#/. -]/g, ' ')
          .split(/[\s/]+/)
          .map((w) => w.replace(/^[.+-]+|[.+-]+$/g, ''))
          .filter(
            (w) => w.length > 3 && !GENERIC.has(w) && !IGNORE.has(w) && !companyWords.has(w),
          ),
      ),
    ];
    if (terms.length < 2) continue;

    const missing = terms.filter((t) => !stems(t).some((s) => corpus.includes(s)));
    // Report only when essentially none of the distinctive terms land anywhere in the data.
    if (missing.length >= 2 && missing.length / terms.length >= 0.75) {
      gaps.push({ line, section: heading, missing });
    }
  }
  return gaps;
}

// ── Report ───────────────────────────────────────────────────────────────────
const bar = (c = '─') => c.repeat(78);
console.log(`\n${bar('═')}\n  APPLICATION: ${slug}   [${app.status}]`);
if (manifest.meta) {
  console.log(`  ${manifest.meta.company ?? '?'} — ${manifest.meta.role ?? '?'}`);
}
console.log(bar('═'));

console.log('\nPROVENANCE — every generated claim beside its source\n' + bar());
for (const p of provenance) {
  console.log(`\n  ${p.label}`);
  console.log(`    says : ${p.text}`);
  for (const s of p.sources) {
    console.log(`    from : [${s.token}] ${s.kind === 'none' ? '(connective prose — no claim)' : s.text}`);
  }
}
if (!provenance.length) console.log('\n  (nothing with prose to trace)');

const gaps = gapReport();
console.log(`\n\nGAPS — what the posting asks for that your data cannot support\n${bar()}`);
if (!jobText) {
  console.log('\n  ! No job.md — nothing to check against. Archive the posting to enable this.');
} else if (!gapLinesScanned) {
  // Distinguishing "found nothing" from "read nothing" is the whole point: the second is a
  // bug wearing the first one's clothes.
  console.log(
    '\n  ! job.md has no requirement-bearing sections that could be scanned.\n' +
      '    Give it headings like "## Required Qualifications" / "## Responsibilities".',
  );
} else if (!gaps.length) {
  console.log(
    `\n  None detected across ${gapLinesScanned} requirement lines.` +
      '\n  (Absence of a detected gap is not proof of a fit.)',
  );
} else {
  for (const g of gaps) {
    console.log(`\n  ! [${g.section}]`);
    console.log(`    ${g.line}`);
    console.log(`    nothing in the data layer mentions: ${g.missing.join(', ')}`);
  }
  console.log('\n  These are NEVER auto-filled. Decide whether to address them openly or not apply.');
}

if (warnings.length) {
  console.log(`\n\nSMELL TEST — unsourced sentences that look like claims\n${bar()}`);
  for (const w of warnings) console.log(`\n  ? ${w}`);
  if (strict) {
    console.log('\n  --strict: these count as failures.');
    errors.push(...warnings.map((w) => `[smell test] ${w.split('\n')[0]}`));
  }
}

if (errors.length) {
  console.log(`\n\nERRORS — claims with no traceable source\n${bar()}`);
  for (const e of errors) console.log(`\n  x ${e}`);
  console.log(`\n${bar('═')}\n  FAILED: ${errors.length} unsourced claim(s). Do not compile.\n${bar('═')}\n`);
  process.exit(1);
}

console.log(
  `\n${bar('═')}\n  OK: ${provenance.length} claim(s) traced, ` +
    `${warnings.length} warning(s), ${gaps.length} gap(s).\n${bar('═')}\n`,
);
