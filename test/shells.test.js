// SOURCE — you own this file. Edit freely, by hand or by agent.
// The .tex shells hold layout only: every fact they print arrives through a generated partial.
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { loadData, ROOT } from '../scripts/lib/data.js';
import { env } from '../scripts/lib/render.js';
import { canonicalJobs } from '../scripts/lib/cv-jobs.js';

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const data = loadData();
const jobs = canonicalJobs(data);
const render = (suffix) => {
  const job = jobs.find((j) => j.out.endsWith(suffix));
  assert.ok(job, `no canonical job writes ${suffix}`);
  return env.render(job.template, job.context);
};
// Comment lines are documentation, not output.
const body = (tex) => tex.split('\n').filter((l) => !/^\s*%/.test(l)).join('\n');

const SHELLS = {
  'cv/onepage/ONE-PAGE.tex': {},
  'cv/biosketch/BIOSKETCH.tex': { todo: 'Task 3 moves the biosketch facts out' },
};

for (const [shell, opts] of Object.entries(SHELLS)) {
  test(`${shell}: no hand-typed facts outside comments`, opts, () => {
    const tex = body(read(shell));
    assert.doesNotMatch(tex, /\b(19|20)\d{2}\b/, 'a year');
    assert.doesNotMatch(tex, /@|\+44/, 'an email or phone number');
    assert.doesNotMatch(tex, /0000-0002|8I00Dow|yiliyang|github\.com\/yi-li-yang/, 'a profile id');
    assert.doesNotMatch(tex, /\\nocite\{/, 'a hand-kept citation list');
  });

  test(`${shell}: every \\input{generated/X} has a generator`, opts, () => {
    const outs = new Set(jobs.map((j) => j.out));
    for (const [, name] of read(shell).matchAll(/\\input\{generated\/([\w-]+)\.tex\}/g)) {
      if (name === 'metrics') continue; // written by scripts/emit-metrics-tex.js
      assert.ok(outs.has(`${dirname(shell)}/generated/${name}.tex`), `generated/${name}.tex`);
    }
  });
}

test('one-pager education prints the end year of each degree', () => {
  const tex = render('onepage/generated/education.tex');
  assert.match(tex, /\\subsection\{University of Edinburgh\}/);
  assert.match(tex, /\\descript\{PhD Petrophysics, 2021\}/);
  assert.match(tex, /\\descript\{MSc Geology, 2016\}/);
  assert.match(tex, /\\descript\{BSc Geology, 2015\}/);
});

test('one-pager header carries name, email, phone and city from the profile', () => {
  const tex = render('onepage/generated/header.tex');
  assert.match(tex, /\\textbf\{YILI YANG\}, PhD/);
  assert.match(tex, /\\href\{mailto:yyl\.eli@gmail\.com\}\{yyl\.eli@gmail\.com\}/);
  assert.match(tex, /\+44 7490334233 \| \\faMapMarker London, UK/);
});

test('one-pager links are built from the profile ids', () => {
  const tex = render('onepage/generated/links.tex');
  for (const url of [
    'https://yi-li-yang.github.io/',
    'https://www.linkedin.com/in/yiliyang',
    'https://orcid.org/0000-0002-1791-3899',
    'https://scholar.google.com/citations?&user=8I00DowAAAAJ',
    'https://github.com/yi-li-yang',
  ]) {
    assert.ok(tex.includes(`\\href{${url}}`), url);
  }
});
