#!/usr/bin/env node

/**
 * Fetches stats from ORCID, GitHub, and Google Scholar,
 * then writes them to data/stats.json.
 *
 * Usage: node scripts/update-stats.js
 *
 * Optional env vars:
 *   SERPAPI_KEY    — uses SerpAPI for Scholar (reliable in CI)
 *   GH_USER_TOKEN — enables GraphQL contribution stats across orgs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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

// ── GitHub REST (repos + stars) ─────────────────────────
async function fetchGitHub() {
  console.log('Fetching GitHub (REST)...');
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

// ── GitHub GraphQL (repos, stars, commits across orgs) ──
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

  // Fetch repos + stars only for repositories the viewer has contributed to.
  // This includes personal and organization repos where the user has commit/pull request/etc. activity.
  let repos = 0;
  let stars = 0;
  let after = null;

  while (true) {
    const repoRes = await gql(
      `query($after:String){
        viewer {
          repositoriesContributedTo(first: 100, after: $after, includeUserRepositories: true) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes { stargazerCount }
          }
        }
      }`,
      { after }
    );

    const connection = repoRes.data.viewer.repositoriesContributedTo;
    repos = connection.totalCount;
    stars += connection.nodes.reduce((s, r) => s + r.stargazerCount, 0);
    if (!connection.pageInfo.hasNextPage) break;
    after = connection.pageInfo.endCursor;
  }

  console.log(`  Repos contributed to: ${repos}, Stars on contributed repos: ${stars}`);

  // Get contribution years
  const yearsRes = await gql(
    '{ viewer { contributionsCollection { contributionYears } } }'
  );
  const years = yearsRes.data.viewer.contributionsCollection.contributionYears;

  // Query each year and sum commits
  let commits = 0;
  for (const year of years) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year + 1}-01-01T00:00:00Z`;
    const res = await gql(
      `query($from:DateTime!,$to:DateTime!){viewer{contributionsCollection(from:$from,to:$to){totalCommitContributions}}}`,
      { from, to }
    );
    commits += res.data.viewer.contributionsCollection.totalCommitContributions;
  }

  console.log(`  All-time commits: ${commits}`);
  return { repos, stars, commits };
}

// ── Google Scholar ──────────────────────────────────────
// Google blocks datacenter IPs, so this direct scraper typically fails
// in GitHub Actions. When SERPAPI_KEY is set, we use SerpAPI instead.
// Previous-value preservation in main() ensures the last locally-fetched
// Scholar data is retained when both methods fail.
async function fetchScholar() {
  const serpApiKey = process.env.SERPAPI_KEY;

  if (serpApiKey) {
    console.log('Fetching Google Scholar (SerpAPI)...');
    const url = `https://serpapi.com/search?engine=google_scholar_author&author_id=${PROFILES.scholar}&api_key=${serpApiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SerpAPI ${res.status}`);
    const data = await res.json();
    const table = data.cited_by?.table;
    if (!table) throw new Error('SerpAPI: cited_by.table not found');
    const citations = table.find(r => r.citations)?.citations?.all ?? null;
    const hIndex = table.find(r => r.h_index)?.h_index?.all ?? null;
    const i10Index = table.find(r => r.i10_index)?.i10_index?.all ?? null;
    console.log(`  Citations: ${citations}, h-index: ${hIndex}, i10-index: ${i10Index}`);
    return { citations, hIndex, i10Index };
  }

  console.log('Fetching Google Scholar (direct scrape)...');
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

  const rows = [...tableMatch[0].matchAll(
    /<tr>[\s\S]*?<td class="gsc_rsb_std">(\d+)<\/td>/g
  )];
  const [citations, hIndex, i10Index] = rows.map(m => parseInt(m[1], 10));

  console.log(`  Citations: ${citations}, h-index: ${hIndex}, i10-index: ${i10Index}`);
  return { citations, hIndex, i10Index };
}

// ── Main ────────────────────────────────────────────────
async function main() {
  // Load previous stats for fallback
  let previous = {};
  if (existsSync(OUTPUT)) {
    try {
      previous = JSON.parse(readFileSync(OUTPUT, 'utf-8'));
    } catch {
      console.warn('Could not parse existing stats.json, starting fresh');
    }
  }

  const [orcid, githubRest, githubGql, scholar] = await Promise.all([
    fetchOrcid().catch(e => { console.error('  ORCID failed:', e.message); return null; }),
    fetchGitHub().catch(e => { console.error('  GitHub REST failed:', e.message); return null; }),
    fetchGitHubGraphQL().catch(e => { console.error('  GitHub GraphQL failed:', e.message); return null; }),
    fetchScholar().catch(e => { console.error('  Scholar failed:', e.message); return null; })
  ]);

  // Merge REST + GraphQL github stats
  // Prefer GraphQL values (include orgs) over REST (user-only) as fallback
  const prevGithub = previous.github ?? { repos: null, stars: null, commits: null };
  const github = {
    repos: githubGql?.repos ?? githubRest?.repos ?? prevGithub.repos,
    stars: githubGql?.stars ?? githubRest?.stars ?? prevGithub.stars,
    commits: githubGql?.commits ?? prevGithub.commits
  };

  const stats = {
    profiles: PROFILES,
    orcid: orcid ?? previous.orcid ?? { works: null, reviews: null },
    github,
    scholar: scholar ?? previous.scholar ?? { citations: null, hIndex: null, i10Index: null },
    // Edit these manually when they change
    static: previous.static ?? {
      fundingAwarded: null,
      firstAuthorPapers: null,
      menteesSupervised: null,
      invitedTalks: null
    },
    lastUpdated: new Date().toISOString()
  };

  writeFileSync(OUTPUT, JSON.stringify(stats, null, 2) + '\n');
  console.log(`\nWritten to ${OUTPUT}`);
}

main();
