// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/score-job.js
//
// THE SCREEN. Decides whether a posting is worth the /apply workflow at all, BEFORE any
// tailoring work is spent on it. It sits in front of verify-application.js, not beside it:
// the firewall checks what you CLAIM; this checks whether the job is worth claiming anything for.
//
//   npm run score -- <slug>            # an application's job.md
//   npm run score -- path/to/posting.md
//   npm run score -- -                 # posting text on stdin (e.g. pasted from an alert)
//   npm run score -- <...> --json      # machine-readable, for the email watch
//
// Rules live in data/job-search.json (SOURCE, hand-written). This script only applies them.
// It also lists which of YOUR skills (data/skills.json) the posting names, as evidence for the
// human reading the verdict. That list is a lookup, never a claim: nothing here writes data.
//
// PURE and OFFLINE. Deterministic: the same posting and the same rules give the same score.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/data.js';
import { findApplication } from './lib/applications.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const target = args.find((a) => !a.startsWith('--'));

if (!target) {
  console.error('usage: npm run score -- <slug | path/to/posting.md | -> [--json]');
  process.exit(2);
}

function readPosting(t) {
  if (t === '-') return readFileSync(0, 'utf8');
  if (existsSync(t)) return readFileSync(t, 'utf8');
  const app = findApplication(t);
  if (app) {
    const p = join(app.dir, 'job.md');
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  console.error(`No application slug or file named "${t}".`);
  process.exit(2);
}

// Archive notes in job.md are blockquotes (see docs/APPLICATIONS.md). They are ours, not the
// employer's, so they must not move the score.
const clean = (text) =>
  text
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('>'))
    .join('\n')
    .toLowerCase();

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toRegex = (term) =>
  term.startsWith('re:')
    ? new RegExp(term.slice(3), 'i')
    : new RegExp(`(?<![a-z0-9])${escape(term.toLowerCase())}(?![a-z0-9])`, 'i');

const matches = (text, terms) => terms.filter((t) => toRegex(t).test(text));

// LaTeX labels in data/skills.json ("Scientific Data \\& Image Processing") → plain words.
const plain = (label) =>
  label
    .replace(/\\&/g, '&')
    .replace(/\\[a-z]+\{([^}]*)\}/gi, '$1')
    .replace(/[{}\\]/g, '')
    .trim();

export function score(text, rules, skills) {
  const body = clean(text);

  const groups = rules.groups.map((g) => {
    const hits = matches(body, g.terms);
    const sat = g.saturate ?? 1;
    const points = Math.round(g.weight * Math.min(1, hits.length / sat));
    return { id: g.id, label: g.label, weight: g.weight, points, hits };
  });

  const penalties = (rules.penalties ?? [])
    .map((p) => ({ id: p.id, label: p.label, points: p.points, hits: matches(body, p.terms) }))
    .filter((p) => p.hits.length);

  const dealbreakers = (rules.dealbreakers ?? [])
    .map((d) => ({ id: d.id, label: d.label, hits: matches(body, d.terms) }))
    .filter((d) => d.hits.length);

  const raw =
    groups.reduce((s, g) => s + g.points, 0) - penalties.reduce((s, p) => s + p.points, 0);
  const total = Math.max(0, Math.min(100, raw));

  const verdict = dealbreakers.length
    ? 'skip'
    : total >= rules.tiers.apply
      ? 'apply'
      : total >= rules.tiers.consider
        ? 'consider'
        : 'skip';

  const evidence = [];
  for (const g of skills.groups ?? []) {
    for (const line of g.lines ?? []) {
      for (const item of line.items ?? []) {
        const label = plain(item.label);
        if (label && toRegex(label).test(body)) evidence.push(`skill:${item.id}`);
      }
    }
  }

  return { total, verdict, groups, penalties, dealbreakers, evidence, status: rules.status };
}

const rules = JSON.parse(readFileSync(join(ROOT, 'data', 'job-search.json'), 'utf8'));
const skills = JSON.parse(readFileSync(join(ROOT, 'data', 'skills.json'), 'utf8'));
const result = score(readPosting(target), rules, skills);

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`\nScore ${result.total}/100 → ${result.verdict.toUpperCase()}`);
  if (result.status !== 'confirmed') console.log(`(rules status: ${result.status})`);
  console.log('');
  for (const g of result.groups) {
    const hit = g.hits.length ? g.hits.join(', ') : '—';
    console.log(`  ${String(g.points).padStart(2)}/${g.weight}  ${g.label}: ${hit}`);
  }
  for (const p of result.penalties) {
    console.log(`  -${p.points}     ${p.label}: ${p.hits.join(', ')}`);
  }
  for (const d of result.dealbreakers) {
    console.log(`  DEALBREAKER  ${d.label}: ${d.hits.join(', ')}`);
  }
  if (result.evidence.length) {
    console.log(`\n  Your skills it names: ${result.evidence.join(', ')}`);
  }
  console.log('');
}
