// SOURCE — you own this file. Edit freely, by hand or by agent.
// The .tex shells hold layout only: every fact they print arrives through a generated partial.
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { loadData, sortPublications, ROOT } from '../scripts/lib/data.js';
import { env } from '../scripts/lib/render.js';
import { canonicalJobs, sharedJobs, TAILORED_BLOCKS, SHARED_BLOCKS } from '../scripts/lib/cv-jobs.js';

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

const SHELLS = ['cv/onepage/ONE-PAGE.tex', 'cv/biosketch/BIOSKETCH.tex'];

for (const shell of SHELLS) {
  test(`${shell}: no hand-typed facts outside comments`, () => {
    const tex = body(read(shell));
    assert.doesNotMatch(tex, /\b(19|20)\d{2}\b/, 'a year');
    assert.doesNotMatch(tex, /@|\+44/, 'an email or phone number');
    assert.doesNotMatch(tex, /0000-0002|8I00Dow|yiliyang|github\.com\/yi-li-yang/, 'a profile id');
    assert.doesNotMatch(tex, /\\nocite\{/, 'a hand-kept citation list');
  });

  test(`${shell}: every \\input{generated/X} has a generator`, () => {
    const outs = new Set(jobs.map((j) => j.out));
    for (const [, name] of read(shell).matchAll(/\\input\{generated\/([\w-]+)\.tex\}/g)) {
      if (name === 'metrics') continue; // written by scripts/emit-metrics-tex.js
      assert.ok(outs.has(`${dirname(shell)}/generated/${name}.tex`), `generated/${name}.tex`);
    }
  });
}

// A template's line endings become the output's. On Windows, `* text=auto` checks text files
// out with CRLF, so without a rule in .gitattributes the same data renders differently there
// than in CI.
test('templates are checked out with LF line endings', () => {
  for (const name of readdirSync(join(ROOT, 'cv/templates'))) {
    assert.ok(!read(`cv/templates/${name}`).includes('\r'), `cv/templates/${name} has CRLF; see .gitattributes`);
  }
});

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

test('one-pager prints each award with its own amount, not the total', () => {
  const second = { id: 'x', title: 'Second Grant', location: 'Somewhere', org: 'Org',
    amount: { value: 50000, currency: 'USD' }, period: '2026', project: 'P' };
  const more = { ...data, awards: { awards: [...data.awards.awards, second] } };
  const job = canonicalJobs(more).find((j) => j.out.endsWith('onepage/generated/awards.tex'));
  const tex = env.render(job.template, job.context);
  assert.ok(tex.includes('\\$99,749 |'), 'first award, its own amount');
  assert.ok(tex.includes('\\$50,000 |'), 'second award, its own amount');
  assert.ok(!tex.includes('\\funding'), 'never the total macro');
});

test('a tailored build covers every partial the one-pager inputs', () => {
  const covered = new Set([...TAILORED_BLOCKS, ...SHARED_BLOCKS, 'metrics']);
  for (const [, name] of read('cv/onepage/ONE-PAGE.tex').matchAll(/\\input\{generated\/([\w-]+)\.tex\}/g)) {
    assert.ok(covered.has(name), `tailor.js does not produce ${name}.tex`);
  }
});

test('shared partials are rendered fresh into the build folder', () => {
  const shared = sharedJobs(data, 'build/x');
  assert.deepEqual(shared.map((j) => j.out).sort(), SHARED_BLOCKS.map((b) => `build/x/${b}.tex`).sort());
  const header = shared.find((j) => j.out === 'build/x/header.tex');
  assert.match(env.render(header.template, header.context), /yyl\.eli@gmail\.com/);
});

test('biosketch talks list marks invited events by role and prints every year', () => {
  const tex = render('biosketch/generated/services.tex');
  assert.match(tex, /\\item Manuscripts review: \\peerreviews/);
  assert.match(tex, /\\item Invited panel: Esri UC Spatial Analytics Summit, US \\hfill 2024/);
  assert.match(tex, /\\item Invited talk: Arctic Carbon Flux Upscaling Workshop, Sweden \\hfill 2024/);
  assert.match(tex, /\\item Invited: Tropical Forest Forever Facility/);
  assert.match(tex, /\\item Invited talk: Permafrost Discovery Gateway Webinar \\hfill 2022/);
  assert.match(tex, /\\item European Geosciences Union General Assembly, EU \\hfill 2022, 2023, 2024/);
  assert.equal((tex.match(/\\item Invited/g) ?? []).length, 7);
  assert.equal((tex.match(/\\item /g) ?? []).length, 2 + 15);
});

test("biosketch talks list runs newest first by each event's latest year", () => {
  const years = [...render('biosketch/generated/services.tex').matchAll(/\\hfill ([\d, ]+)/g)].map((m) =>
    Math.max(...m[1].split(', ').map(Number)),
  );
  assert.deepEqual(years, [...years].sort((a, b) => b - a));
  assert.equal(years[0], 2026);
  assert.equal(years.at(-1), 2018);
});

test('biosketch cites every bib entry, in the website order', () => {
  const keys = [...render('biosketch/generated/nocite.tex').matchAll(/\\nocite\{([^}]+)\}/g)].map((m) => m[1]);
  assert.equal(keys.length, data.publications.length);
  assert.deepEqual(keys, sortPublications(data.publications).map((p) => p.key));
});

test('biosketch funding prints the award amount and no pending applications', () => {
  const tex = render('biosketch/generated/funding.tex');
  assert.ok(
    tex.includes(
      'Funding for Climate Solutions: A Generic Climate AI Framework for Multi-domain Time Series ' +
        'Prediction, Woodwell Climate Research Center, \\$99,749',
    ),
  );
  assert.match(tex, /Overall Objectives: This project will attempt/);
  assert.doesNotMatch(tex, /Pending|Bezos/);
});

test('biosketch education prints the long form with dates', () => {
  const tex = render('biosketch/generated/education.tex');
  assert.ok(tex.includes('{\\bf University of Edinburgh, UK}'));
  assert.ok(tex.includes('\\textbf{MSc (Research) in Geology, Distinction} \\hfill {Aug 2015 - Aug 2016}'));
  assert.ok(tex.includes('\\textbf{BSc in Geology} \\hfill {Sep 2011 - May 2015}'));
});

test('biosketch mentorship names each person under each project', () => {
  const tex = render('biosketch/generated/mentorship.tex');
  assert.ok(
    tex.includes(
      'Multi-domain Timeseries Forecasting\n\\begin{indentpar}{0.5cm}\n' +
        'Sandeep Poudel \\hfill2026\\\\\nDogukan Teber \\hfill2025\n\\end{indentpar}',
    ),
  );
  assert.equal((tex.match(/Marly Bartkus/g) ?? []).length, 2);
  assert.equal(new Set([...tex.matchAll(/^(.+?) \\hfill\d{4}/gm)].map((m) => m[1])).size, 8);
});

test('biosketch header, scope and initiatives come from the data', () => {
  assert.ok(
    render('biosketch/generated/header.tex').includes(
      '\\name{YILI YANG}\n\\address{+44 7490334233\\textbar\\textbar yyang@woodwellclimate.org' +
        '\\textbar\\textbar ORCID 0000-0002-1791-3899}',
    ),
  );
  assert.match(render('biosketch/generated/scope.tex'), /^My research develops\/applies advanced AI/m);
  assert.ok(
    render('biosketch/generated/initiatives.tex').includes(
      '\\textbf{Permafrost Discovery Gateway} Funded by Google.org',
    ),
  );
});
