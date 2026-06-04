// scripts/lib/data.js
//
// The keystone "single load step" (CLAUDE.md / ARCHITECTURE.md): one place assembles
// the in-memory data object that every PURE render script reads. emit-metrics-tex.js,
// bib-to-json.js and render-cv.js all call loadData() so there is exactly one shape and
// one set of parsing rules. Malformed input fails loudly here, once, at build time.
//
// This module is OFFLINE and PURE: it only reads files already on disk
// (data/*.json written by the networked ingest, cv/publications.bib hand-curated).
// It never makes a network call — rendering must succeed when ORCID/Scholar are down.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse as parseBibtex } from '@retorquere/bibtex-parser';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const readJsonIfExists = (rel) =>
  existsSync(join(ROOT, rel)) ? readJson(rel) : null;

// The bibtex-parser decodes LaTeX accents to Unicode and renders \textbf{} as <b>..</b>.
// We strip those HTML-ish tags everywhere; the owner is flagged in data, never as markup.
const stripTags = (s) => String(s ?? '').replace(/<\/?[a-z]+>/gi, '').trim();

// `\textbf{Yang, Yili}` is how the owner marks themselves in the .bib. After parsing it
// arrives as a bolded chunk. The owner is flagged ONLY when the bolded surname is actually
// "Yang" — guarding against stray bolding (e.g. one entry bolds the "and others" et-al
// token, which must NOT become the owner). Genuine owner variants ("Yang, Y") canonicalize
// to "Yili Yang".
const OWNER_NAME = 'Yili Yang';

function formatAuthor(a) {
  const rawLast = a.lastName ?? '';
  const rawFirst = a.firstName ?? '';
  const bolded = /<b>/i.test(rawLast) || /<b>/i.test(rawFirst);
  const last = stripTags(rawLast);
  const first = stripTags(rawFirst);

  // BibTeX "and others" -> et al. (never a real author, never the owner).
  if (!first && /^others$/i.test(last)) {
    return { name: 'et al.', isOwner: false, etAl: true };
  }

  let name;
  if (last.includes(',') && !first) {
    // "Yang, Yili" (a single braced chunk) -> "Yili Yang"
    const [l, f] = last.split(',').map((x) => x.trim());
    name = (f ? `${f} ` : '') + l;
  } else {
    name = `${first ? `${first} ` : ''}${last}`;
  }
  name = name.trim();

  const isOwner = bolded && /\byang\b/i.test(last);
  return { name: isOwner ? OWNER_NAME : name, isOwner };
}

const DOI_RE = /10\.\d{4,9}\/[^\s,}]+/i;
function extractDoi(fields) {
  if (fields.doi) return String(fields.doi).replace(/^doi:/i, '').trim();
  for (const v of [fields.note, fields.url, fields.howpublished]) {
    const m = v && String(v).match(DOI_RE);
    if (m) return m[0];
  }
  return '';
}

function venueOf(entry) {
  const f = entry.fields;
  switch (entry.type) {
    case 'article':
      return stripTags(f.journal ?? '');
    case 'inproceedings':
      return stripTags(f.booktitle ?? f.journal ?? '');
    default:
      return stripTags(f.howpublished ?? f.journal ?? f.booktitle ?? '');
  }
}

// Normalize one raw bibtex entry into the shape outputs consume. No LaTeX/HTML markup
// survives into this object; the owner is a boolean per author.
function normalizeEntry(entry) {
  const f = entry.fields;
  const keywords = (Array.isArray(f.keywords) ? f.keywords : [f.keywords])
    .filter(Boolean)
    .map((k) => stripTags(k).toLowerCase());
  const doi = extractDoi(f);
  const yearNum = parseInt(f.year, 10);

  return {
    key: entry.key,
    type: entry.type,
    title: stripTags(f.title ?? '').replace(/\s+/g, ' '),
    authors: (f.author ?? []).map(formatAuthor),
    venue: venueOf(entry),
    year: Number.isFinite(yearNum) ? yearNum : null,
    doi,
    url: f.url ? stripTags(f.url) : doi ? `https://doi.org/${doi}` : '',
    dataset: keywords.includes('dataset'),
  };
}

export function loadData() {
  const stats = readJson('data/stats.json');

  const parsed = parseBibtex(readFileSync(join(ROOT, 'cv/publications.bib'), 'utf8'));
  if (parsed.errors?.length) {
    throw new Error(
      `cv/publications.bib has ${parsed.errors.length} parse error(s): ` +
        JSON.stringify(parsed.errors.slice(0, 3)),
    );
  }
  const publications = parsed.entries.map(normalizeEntry);

  // Hand-authored prose sources (Phase C). Optional so Phase B works before they exist.
  const experience = readJsonIfExists('data/experience.json') ?? [];

  return { stats, publications, experience };
}

// Counts derived BY BIB TYPE (the chosen rule): each number means exactly what its label
// says, and stays consistent with the publication list it is counted from.
export function pubCounts(publications) {
  return {
    journalPapers: publications.filter((p) => p.type === 'article').length,
    conferences: publications.filter((p) => p.type === 'inproceedings').length,
    datasets: publications.filter((p) => p.dataset).length,
    total: publications.length,
  };
}
