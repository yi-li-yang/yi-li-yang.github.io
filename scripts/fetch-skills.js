#!/usr/bin/env node
// SOURCE — you own this file. Edit freely, by hand or by agent.

/**
 * Lists the skills in the master skills repo and writes them to data/claude-skills.json, which the
 * website's Projects atlas renders as the "Claude Code skills" track. Adding a skill folder
 * to that repo is all it takes for a tile to appear on the next run.
 *
 * Usage: node scripts/fetch-skills.js   (npm run ingest:skills)
 *
 * Optional env vars:
 *   GH_USER_TOKEN  — authenticates the GitHub API (higher rate limit)
 *
 * Fails safe, like update-stats.js: on any error, or an empty result, the last good file is
 * left untouched. Nothing is written when the content is unchanged, so a run that finds
 * nothing new produces no commit.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, '..', 'data', 'claude-skills.json');

const REPO = 'yi-li-yang/skills';
const SKILL_PATH = /^plugins\/([^/]+)\/skills\/([^/]+)\/SKILL\.md$/;

const headers = { 'User-Agent': 'fetch-skills-script' };
if (process.env.GH_USER_TOKEN) headers.Authorization = `Bearer ${process.env.GH_USER_TOKEN}`;

async function getText(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

const raw = (path) => getText(`https://raw.githubusercontent.com/${REPO}/HEAD/${path}`);

// Reads `description` from SKILL.md frontmatter, including the folded `>-` form.
function frontmatterDescription(markdown) {
  const block = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  if (!block) return '';
  const lines = block.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith('description:'));
  if (start < 0) return '';
  const first = lines[start].slice('description:'.length).trim();
  if (!/^[>|][+-]?$/.test(first)) return first.replace(/^(["'])([\s\S]*)\1$/, '$2');
  const folded = [];
  for (const line of lines.slice(start + 1)) {
    if (line && !/^\s/.test(line)) break;
    folded.push(line.trim());
  }
  return folded.join(' ').replace(/\s+/g, ' ').trim();
}

// The README's skills table carries the hand-written "what it does" line for each skill (the
// repo's own "Add a skill" steps require a row), which reads better than a trigger-oriented
// frontmatter description. Returns skill name -> that line.
function readmeSummaries(readme) {
  const summaries = new Map();
  for (const line of readme.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    const name = cells[0]?.match(/^\[([^\]]+)\]/)?.[1];
    if (name && cells[1]) summaries.set(name, cells[1]);
  }
  return summaries;
}

const firstSentence = (text) => text.split(/(?<=[.!?])\s/)[0];

async function main() {
  let previous = null;
  if (existsSync(OUTPUT)) {
    try {
      previous = readFileSync(OUTPUT, 'utf-8');
    } catch { /* fall through: nothing to preserve */ }
  }

  const tree = JSON.parse(await getText(`https://api.github.com/repos/${REPO}/git/trees/HEAD?recursive=1`));
  const found = tree.tree
    .map((entry) => entry.path.match(SKILL_PATH))
    .filter(Boolean)
    .map(([path, plugin, name]) => ({ path, plugin, name }));
  if (!found.length) throw new Error('no SKILL.md files found');

  const [readme, marketplace] = await Promise.all([
    raw('README.md').catch(() => ''),
    raw('.claude-plugin/marketplace.json').then(JSON.parse),
  ]);
  const summaries = readmeSummaries(readme);

  const skills = await Promise.all(found.map(async ({ path, plugin, name }) => {
    const description = summaries.get(name) ?? firstSentence(frontmatterDescription(await raw(path)));
    return {
      name,
      owner: plugin,
      description,
      url: `https://github.com/${REPO}/tree/HEAD/${path.replace(/\/SKILL\.md$/, '')}`,
      image: '',
    };
  }));
  skills.sort((a, b) => a.owner.localeCompare(b.owner) || a.name.localeCompare(b.name));

  const plugins = [...new Set(skills.map((s) => s.owner))];
  const output = {
    _edit: 'DERIVED — written by scripts/fetch-skills.js (npm run ingest:skills). Never edit; the next run reverts you. The skills live in https://github.com/' + REPO + '.',
    repo: REPO,
    install: [
      `/plugin marketplace add ${REPO}`,
      ...plugins.map((p) => `/plugin install ${p}@${marketplace.name}`),
    ],
    skills,
  };

  const text = JSON.stringify(output, null, 2) + '\n';
  if (text === previous) {
    console.log(`Skills unchanged (${skills.length}).`);
    return;
  }
  writeFileSync(OUTPUT, text);
  console.log(`Wrote ${skills.length} skills to ${OUTPUT}: ${skills.map((s) => s.name).join(', ')}`);
}

main().catch((err) => {
  console.error('Skills fetch failed, keeping last good data/claude-skills.json:', err.message);
});
