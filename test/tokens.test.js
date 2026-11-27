// SOURCE — you own this file. Edit freely, by hand or by agent.
// Citation tokens (scripts/lib/tokens.js) and the cover-letter sender (scripts/lib/applications.js).
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../scripts/lib/data.js';
import { makeResolver, normaliseToken } from '../scripts/lib/tokens.js';
import { senderBlock, letterContext } from '../scripts/lib/applications.js';

const data = loadData();
const resolve = makeResolver(data, { jobText: '' });
const cite = (token) => resolve(normaliseToken(token));

test('the new lists can be cited', () => {
  assert.match(cite('edu:bsc').text, /BSc in Geology/);
  assert.match(cite('talk:esri-uc').text, /Esri UC Spatial Analytics Summit/);
  assert.match(cite('mentor:multi-domain-ts').text, /Sandeep Poudel/);
  assert.match(cite('init:pdg').text, /Permafrost Discovery Gateway/);
  assert.match(cite('profile.email').text, /yyl\.eli@gmail\.com/);
});

test('derived counts can be cited and carry their value', () => {
  assert.match(cite('derived.menteeCount').text, /= 8$/);
  assert.match(cite('derived.invitedTalksPanels').text, /= 5$/);
  assert.match(cite('derived.fundingTotal').text, /= 99749$/);
  assert.match(cite('derived.conferenceEvents').text, /= 15$/);
  assert.equal(cite('derived.conferences'), null, 'ambiguous with the abstract count');
});

test('an unknown id in a new scheme does not resolve', () => {
  for (const t of ['edu:dphil', 'talk:nope', 'mentor:nope', 'init:nope', 'profile.nope', 'derived.nope']) {
    assert.equal(cite(t), null, t);
  }
});

test('service keys that became derived no longer resolve', () => {
  for (const k of ['menteesSupervised', 'invitedTalks', 'fundingAwarded', 'proposalFunders']) {
    assert.equal(cite(`service.${k}`), null, k);
  }
  assert.match(cite('service.peerReviews').text, /= 8$/);
});

test('the cover-letter sender comes from the profile', () => {
  assert.deepEqual(senderBlock(data.profile), {
    name: 'Yili Yang, PhD',
    contact: 'yyl.eli@gmail.com \\textbar{} +44 7490334233 \\textbar{} London, UK',
  });
});

test('a sender left in letter.json is ignored, with one warning', () => {
  const warnings = [];
  const ctx = letterContext(
    { sender: { name: 'Someone Else', contact: 'x' }, recipient: { name: 'R' }, date: 'D', letter: { body: [] } },
    data.profile,
    (w) => warnings.push(w),
  );
  assert.equal(ctx.sender.name, 'Yili Yang, PhD');
  assert.deepEqual(ctx.recipient, { name: 'R' });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /sender/);
});

test('a letter without sender produces no warning', () => {
  const warnings = [];
  letterContext({ recipient: {}, date: 'D', letter: {} }, data.profile, (w) => warnings.push(w));
  assert.equal(warnings.length, 0);
});
