#!/usr/bin/env node

/**
 * Fetches stats from ORCID, GitHub, and Google Scholar,
 * then writes them to data/stats.json.
 *
 * Usage: node scripts/update-stats.js
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, '..', 'data', 'stats.json');

const PROFILES = {
  orcid: '0000-0002-1791-3899',
  github: 'yi-li-yang',
  scholar: '8I00DowAAAAJ',
  linkedin: 'yiliyang'
};

// ── ORCID ───────────────────────────────────────────────
async function fetchOrcid() {
  console.log('Fetching ORCID...');
  const res = await fetch(`https://pub.orcid.org/v3.0/${PROFILES.orcid}`, {
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`ORCID API ${res.status}`);
  const data = await res.json();
  const works = data['activities-summary']?.works?.group?.length ?? null;
  const reviews = data['activities-summary']?.['peer-reviews']?.group?.length ?? null;
  console.log(`  Publications: ${works}, Peer reviews: ${reviews}`);
  return { works, reviews };
}

// ── GitHub ──────────────────────────────────────────────
async function fetchGitHub() {
  console.log('Fetching GitHub...');
  const userRes = await fetch(`https://api.github.com/users/${PROFILES.github}`, {
    headers: { 'User-Agent': 'update-stats-script' }
  });
  if (!userRes.ok) throw new Error(`GitHub user API ${userRes.status}`);
  const user = await userRes.json();

  const reposRes = await fetch(
    `https://api.github.com/users/${PROFILES.github}/repos?per_page=100`,
    { headers: { 'User-Agent': 'update-stats-script' } }
  );
  if (!reposRes.ok) throw new Error(`GitHub repos API ${reposRes.status}`);
  const repos = await reposRes.json();
  const stars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);

  console.log(`  Repos: ${user.public_repos}, Stars: ${stars}`);
  return { repos: user.public_repos, stars };
}

// ── Google Scholar ──────────────────────────────────────
async function fetchScholar() {
  console.log('Fetching Google Scholar...');
  const res = await fetch(
    `https://scholar.google.com/citations?user=${PROFILES.scholar}&hl=en`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }
  );
  if (!res.ok) throw new Error(`Scholar ${res.status}`);
  const html = await res.text();

  const tableMatch = html.match(/<table id="gsc_rsb_st"[\s\S]*?<\/table>/);
  if (!tableMatch) throw new Error('Scholar stats table not found — may be rate-limited');

  // Extract the "All" column values (first <td class="gsc_rsb_std"> in each row)
  const rows = [...tableMatch[0].matchAll(
    /<tr>[\s\S]*?<td class="gsc_rsb_std">(\d+)<\/td>/g
  )];
  const [citations, hIndex, i10Index] = rows.map(m => parseInt(m[1], 10));

  console.log(`  Citations: ${citations}, h-index: ${hIndex}, i10-index: ${i10Index}`);
  return { citations, hIndex, i10Index };
}

// ── Main ────────────────────────────────────────────────
async function main() {
  const [orcid, github, scholar] = await Promise.all([
    fetchOrcid().catch(e => { console.error('  ORCID failed:', e.message); return null; }),
    fetchGitHub().catch(e => { console.error('  GitHub failed:', e.message); return null; }),
    fetchScholar().catch(e => { console.error('  Scholar failed:', e.message); return null; })
  ]);

  const stats = {
    profiles: PROFILES,
    orcid: orcid ?? { works: null, reviews: null },
    github: github ?? { repos: null, stars: null },
    scholar: scholar ?? { citations: null, hIndex: null, i10Index: null },
    lastUpdated: new Date().toISOString()
  };

  writeFileSync(OUTPUT, JSON.stringify(stats, null, 2) + '\n');
  console.log(`\nWritten to ${OUTPUT}`);
}

main();
