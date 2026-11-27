// SOURCE — you own this file. Edit freely, by hand or by agent.
// Tests for the counting rules in scripts/lib/derive.js and the data checks loadData() runs.
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData, sortPublications } from '../scripts/lib/data.js';
import {
  menteeCount,
  talkCounts,
  fundingDisplay,
  derivedFacts,
  validateMentorship,
  validateTalks,
  assertNoBareSpecials,
} from '../scripts/lib/derive.js';

const entry = (id, occurrences) => ({ id, name: 'E', place: 'X', kind: 'conference', occurrences });
const talks = (...entries) => ({ entries });
const projects = (...mentees) => ({
  projects: mentees.map((names, i) => ({
    id: `p${i}`,
    title: 'T',
    mentees: names.map((name) => ({ name, year: 2025 })),
  })),
});

test('real data: the counts the CV and the site print', () => {
  const data = loadData();
  const f = derivedFacts(data);
  assert.equal(f.menteeCount, 8);
  assert.equal(f.invitedTalksPanels, 5);
  assert.equal(f.conferences, 15);
  assert.equal(f.invitedCount, 7);
  assert.equal(f.fundingTotal, 99749);
  assert.equal(f.fundingDisplay, '~$100K');
  assert.equal(talkCounts(data.talks).occurrences, 20);
});

test('a person mentored on two projects counts once', () => {
  assert.equal(menteeCount(projects(['X Y'], ['X Y', 'Z W'])), 2);
});

test('one person spelled two ways fails the check', () => {
  assert.throws(
    () => validateMentorship(projects(['Marly Bartkus'], ['marly  bartkus'])),
    /Marly Bartkus.*marly {2}bartkus/,
  );
});

test('invited talks and panels exclude invited participation and uninvited talks', () => {
  const t = talks(
    entry('a', [{ year: 2024, role: 'talk', invited: true }]),
    entry('b', [{ year: 2024, role: 'panel', invited: true }]),
    entry('c', [{ year: 2026, role: 'participant', invited: true }]),
    entry('d', [
      { year: 2023, role: 'talk', invited: false },
      { year: 2024, role: 'participant', invited: false },
    ]),
  );
  assert.deepEqual(talkCounts(t), { occurrences: 5, invited: 3, invitedTalksPanels: 2, conferences: 3 });
});

test('an entry whose years disagree on invited fails the check', () => {
  const t = talks(
    entry('e1', [
      { year: 2023, role: 'talk', invited: true },
      { year: 2024, role: 'talk', invited: false },
    ]),
  );
  assert.throws(() => validateTalks(t), /e1/);
});

test('an invited entry with mixed roles fails the check', () => {
  const t = talks(
    entry('e2', [
      { year: 2023, role: 'talk', invited: true },
      { year: 2024, role: 'panel', invited: true },
    ]),
  );
  assert.throws(() => validateTalks(t), /e2/);
});

test('an unknown role fails the check', () => {
  assert.throws(() => validateTalks(talks(entry('e3', [{ year: 2024, role: 'keynote', invited: false }]))), /e3/);
});

test('the same year twice in one entry fails the check', () => {
  const t = talks(
    entry('e4', [
      { year: 2024, role: 'talk', invited: false },
      { year: 2024, role: 'participant', invited: false },
    ]),
  );
  assert.throws(() => validateTalks(t), /e4/);
});

test('a bare LaTeX special in prose fails, URLs and escaped forms pass', () => {
  assert.throws(() => assertNoBareSpecials({ text: 'A & B' }, 'x.json'), /x\.json.*text/);
  assert.throws(() => assertNoBareSpecials({ list: [{ title: '50% done' }] }, 'y.json'), /y\.json.*title/);
  assert.doesNotThrow(() =>
    assertNoBareSpecials({ text: 'A \\& B, 50\\%', url: 'https://a.b/c_d#e', logo: { src: 'a_b.png' } }, 'x.json'),
  );
});

test('fundingDisplay rounds to two significant figures', () => {
  assert.equal(fundingDisplay(0), null);
  assert.equal(fundingDisplay(45000), '~$45K');
  assert.equal(fundingDisplay(99749), '~$100K');
  assert.equal(fundingDisplay(1250000), '~$1.3M');
});

test('sortPublications puts undated work first, then newest first, keeping file order on ties', () => {
  const pubs = [
    { key: 'old', year: 2018 },
    { key: 'new-a', year: 2025 },
    { key: 'undated', year: null },
    { key: 'new-b', year: 2025 },
  ];
  assert.deepEqual(sortPublications(pubs).map((p) => p.key), ['undated', 'new-a', 'new-b', 'old']);
});
