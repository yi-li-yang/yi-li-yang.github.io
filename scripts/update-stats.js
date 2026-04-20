#!/usr/bin/env node

/**
 * Fetches stats from ORCID, GitHub, and Google Scholar,
 * then writes them to data/stats.json.
 *
 * Usage: node scripts/update-stats.js
 *
 * Optional env vars:
 *   SERPAPI_KEY    — uses SerpAPI for Scholar (reliable in CI)
 *   GH_USER_TOKEN  — enables GraphQL: language breakdown across all repos + all-time commits
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, '..', 'data', 'stats.json');

const PROFILES = {
  orcid:    '0000-0002-1791-3899',
  github:   'yi-li-yang',
  scholar:  '8I00DowAAAAJ',
  linkedin: 'yiliyang'
};

// ── ORCID ────────────────────────────────────────────────
async function fetchOrcid() {
  console.log('Fetching ORCID...');

  const worksRes = await fetch(`https://pub.orcid.org/v3.0/${PROFILES.orcid}/works`, {
    headers: { Accept: 'application/json' }
  });
  if (!worksRes.ok) throw new Error(`ORCID works API ${worksRes.status}`);
  const works = (await worksRes.json()).group?.length ?? null;

  // Peer reviews: sum individual peer-review-summary items across all journal groups
  // (.group.length counts journals, not reviews)
  const profileRes = await fetch(`https://pub.orcid.org/v3.0/${PROFILES.orcid}`, {
    headers: { Accept: 'application/json' }
  });
  if (!profileRes.ok) throw new Error(`ORCID profile API ${profileRes.status}`);
  const profileData = await profileRes.json();

  const reviews = (profileData['activities-summary']?.['peer-reviews']?.group ?? [])
    .flatMap(g => g['peer-review-group'] ?? [])
    .reduce((sum, g) => sum + (g['peer-review-summary']?.length ?? 0), 0) || null;

  console.log(`  ORCID: ${works} publications, ${reviews} peer reviews`);
  return { works, reviews };
}

// ── GitHub REST (owned non-fork repo count, primary-language fallback) ──
async function fetchGitHub() {
  console.log('Fetching GitHub (REST)...');

  let allRepos = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.github.com/users/${PROFILES.github}/repos?per_page=100&page=${page}`,
      { headers: { 'User-Agent': 'update-stats-script' } }
    );
    if (!res.ok) throw new Error(`GitHub repos API ${res.status}`);
    const batch = await res.json();
    if (!batch.length) break;
    allRepos = allRepos.concat(batch);
    if (batch.length < 100) break;
    page++;
  }

  const owned = allRepos.filter(r => !r.fork);

  // Approximate language distribution by repo count (REST can't give byte sizes without N+1 calls)
  const langCount = {};
  for (const r of owned) {
    if (r.language) langCount[r.language] = (langCount[r.language] ?? 0) + 1;
  }
  const total = Object.values(langCount).reduce((s, v) => s + v, 0);
  const languages = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({
      name,
      percent: Math.round((count / total) * 1000) / 10
    }));

  console.log(`  Repos (public total): ${allRepos.length}`);
  return { repos: allRepos.length, languages };
}

// ── GitHub GraphQL (language bytes across all repos + all-time commits) ──
async function fetchGitHubGraphQL() {
  const token = process.env.GH_USER_TOKEN;
  if (!token) {
    console.log('Skipping GitHub GraphQL (no GH_USER_TOKEN)');
    return null;
  }
  console.log('Fetching GitHub (GraphQL)...');

  const headers = {
    Authorization: `bearer ${token}`,
    'Content-Type': 'application/json'
  };
  const gql = async (query, variables) => {
    const r = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables })
    });
    if (!r.ok) throw new Error(`GraphQL HTTP ${r.status}`);
    const json = await r.json();
    if (json.errors) throw new Error(json.errors[0].message);
    return json;
  };

  // Paginate through all owned non-fork repos, collecting language byte sizes
  const langBytes = {};
  let repos = 0;
  let after = null;

  while (true) {
    const res = await gql(
      `query($after:String){
        viewer {
          repositories(
            first: 100
            after: $after
            ownerAffiliations: [OWNER]
          ) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes {
              isFork
              languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
                edges { size node { name } }
              }
            }
          }
        }
      }`,
      { after }
    );

    const conn = res.data.viewer.repositories;
    repos = conn.totalCount;

    for (const repo of conn.nodes) {
      if (repo.isFork) continue;
      for (const edge of repo.languages.edges) {
        langBytes[edge.node.name] = (langBytes[edge.node.name] ?? 0) + edge.size;
      }
    }

    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }

  // Build sorted language list; group tail into "Other"
  const totalBytes = Object.values(langBytes).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(langBytes).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 8);
  const otherBytes = sorted.slice(8).reduce((s, [, b]) => s + b, 0);

  const languages = top.map(([name, bytes]) => ({
    name,
    bytes,
    percent: Math.round((bytes / totalBytes) * 1000) / 10
  }));
  if (otherBytes > 0) {
    languages.push({
      name: 'Other',
      bytes: otherBytes,
      percent: Math.round((otherBytes / totalBytes) * 1000) / 10
    });
  }

  const topNames = languages.slice(0, 5).map(l => l.name).join(', ');
  console.log(`  Repos: ${repos}, top languages: ${topNames}`);

  // All-time commits across all orgs
  const yearsRes = await gql(
    '{ viewer { contributionsCollection { contributionYears } } }'
  );
  const years = yearsRes.data.viewer.contributionsCollection.contributionYears;

  let commits = 0;
  for (const year of years) {
    const from = `${year}-01-01T00:00:00Z`;
    const to   = `${year + 1}-01-01T00:00:00Z`;
    const res  = await gql(
      `query($from:DateTime!,$to:DateTime!){
        viewer{contributionsCollection(from:$from,to:$to){totalCommitContributions}}
      }`,
      { from, to }
    );
    commits += res.data.viewer.contributionsCollection.totalCommitContributions;
  }

  console.log(`  All-time commits: ${commits}`);
  return { repos, languages, commits };
}

// ── Google Scholar ───────────────────────────────────────
async function fetchScholar() {
  const serpApiKey = process.env.SERPAPI_KEY;

  if (serpApiKey) {
    console.log('Fetching Google Scholar (SerpAPI)...');
    const url =
      `https://serpapi.com/search?engine=google_scholar_author` +
      `&author_id=${PROFILES.scholar}&api_key=${serpApiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SerpAPI ${res.status}`);
    const data = await res.json();
    const table = data.cited_by?.table;
    if (!table) throw new Error('SerpAPI: cited_by.table not found');
    const citations = table.find(r => r.citations)?.citations?.all  ?? null;
    const hIndex    = table.find(r => r.h_index)?.h_index?.all      ?? null;
    const i10Index  = table.find(r => r.i10_index)?.i10_index?.all  ?? null;
    console.log(`  Citations: ${citations}, h-index: ${hIndex}, i10-index: ${i10Index}`);
    return { citations, hIndex, i10Index };
  }

  console.log('Fetching Google Scholar (direct scrape)...');
  const res = await fetch(
    `https://scholar.google.com/citations?user=${PROFILES.scholar}&hl=en`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }
  );
  if (!res.ok) throw new Error(`Scholar ${res.status}`);
  const html = await res.text();

  const tableMatch = html.match(/<table id="gsc_rsb_st"[\s\S]*?<\/table>/);
  if (!tableMatch) throw new Error('Scholar stats table not found — may be rate-limited');

  const rows = [
    ...tableMatch[0].matchAll(/<tr>[\s\S]*?<td class="gsc_rsb_std">(\d+)<\/td>/g)
  ];
  const [citations, hIndex, i10Index] = rows.map(m => parseInt(m[1], 10));

  console.log(`  Citations: ${citations}, h-index: ${hIndex}, i10-index: ${i10Index}`);
  return { citations, hIndex, i10Index };
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  let previous = {};
  if (existsSync(OUTPUT)) {
    try {
      previous = JSON.parse(readFileSync(OUTPUT, 'utf-8'));
    } catch {
      console.warn('Could not parse existing stats.json, starting fresh');
    }
  }

  const [orcid, githubRest, githubGql, scholar] = await Promise.all([
    fetchOrcid().catch(e         => { console.error('  ORCID failed:', e.message);        return null; }),
    fetchGitHub().catch(e        => { console.error('  GitHub REST failed:', e.message);  return null; }),
    fetchGitHubGraphQL().catch(e => { console.error('  GitHub GraphQL failed:', e.message); return null; }),
    fetchScholar().catch(e       => { console.error('  Scholar failed:', e.message);      return null; })
  ]);

  const publications = orcid
    ? { count: orcid.works }
    : (previous.publications ?? null);

  const prevGithub = previous.github ?? { repos: null, commits: null, languages: [] };
  const github = {
    repos:     githubGql?.repos     ?? githubRest?.repos     ?? prevGithub.repos,
    commits:   githubGql?.commits   ?? prevGithub.commits,
    languages: githubGql?.languages ?? githubRest?.languages ?? prevGithub.languages ?? []
  };

  const prevStatic = previous.static ?? {};
  const staticData = {
    fundingAwarded:    prevStatic.fundingAwarded    ?? null,
    menteesSupervised: prevStatic.menteesSupervised ?? null,
    invitedTalks:      prevStatic.invitedTalks      ?? null
  };

  const stats = {
    profiles: PROFILES,
    publications,
    orcid:   orcid   ?? previous.orcid   ?? { works: null, reviews: null },
    github,
    scholar: scholar ?? previous.scholar ?? { citations: null, hIndex: null, i10Index: null },
    static:  staticData,
    lastUpdated: new Date().toISOString()
  };

  writeFileSync(OUTPUT, JSON.stringify(stats, null, 2) + '\n');
  console.log(`\nWritten to ${OUTPUT}`);
}

main();
