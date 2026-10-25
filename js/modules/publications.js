// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/publications.js
//
// Renders the publication list from data/publications.json (generated from the .bib SSOT
// by scripts/bib-to-json.js). The owner is bolded from the per-author `isOwner` flag in
// the data — never from markup stored in the JSON. Vanilla, no framework, matching the
// existing dark card design (.publication-card / .publication-meta in components.css).
//
// Work in progress (no year) still comes first, as bib-to-json sorts it, but as its own
// compact group of rows, so the published papers below aren't pushed behind "Show all".
// Filter chips carry counts derived from each entry's type, year and dataset flag.

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderAuthors(authors) {
  return authors
    .map((a) => {
      const name = escapeHtml(a.name);
      if (a.etAl) return `<span class="pub-etal">${name}</span>`;
      return a.isOwner ? `<strong class="pub-owner">${name}</strong>` : name;
    })
    .join(', ');
}

// Every title should be clickable. When the .bib carries a real DOI/URL we link straight
// to it; otherwise we fall back to a Google Scholar title search so the paper is still
// findable (honest — it's a search, not a fabricated DOI). Add DOIs to the .bib to upgrade
// any of these to a direct link.
function linkFor(pub) {
  if (pub.url) return pub.url;
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(pub.title)}`;
}

function renderCard(pub) {
  const card = document.createElement('article');
  card.className = 'publication-card';

  const href = linkFor(pub);
  const titleHtml = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pub.title)}</a>`;

  const metaParts = [];
  if (pub.venue) metaParts.push(`<span>${escapeHtml(pub.venue)}</span>`);
  if (pub.year) metaParts.push(`<span>${pub.year}</span>`);

  card.innerHTML = `
    <h3>${titleHtml}</h3>
    <p class="publication-authors">${renderAuthors(pub.authors)}</p>
    <div class="publication-meta">${metaParts.join('')}</div>
  `;
  return card;
}

// Unfinished work: title and status only. A Scholar search for a paper that isn't out yet
// finds nothing, so these link only when the .bib has a real URL (e.g. a preprint).
function renderRow(pub) {
  const row = document.createElement('li');
  row.className = 'pub-row';
  const title = pub.url
    ? `<a href="${escapeHtml(pub.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pub.title)}</a>`
    : escapeHtml(pub.title);
  row.innerHTML = `
    <span class="pub-row-title">${title}</span>
    <span class="pub-row-venue">${escapeHtml(pub.venue || 'In preparation')}</span>
  `;
  return row;
}

// One category per entry, checked in this order. No year means unfinished whatever the type
// (CLAUDE.md: unpublished work is @misc with an empty year), so it never counts as a paper.
function categoryOf(pub) {
  if (pub.year == null) return 'in-progress';
  if (pub.dataset) return 'dataset';
  if (pub.type === 'article') return 'journal';
  if (pub.type === 'inproceedings') return 'conference';
  return 'other';
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'journal', label: 'Journal' },
  { key: 'conference', label: 'Conference' },
  { key: 'dataset', label: 'Dataset' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'other', label: 'Other' },
];

const HASH_PREFIX = '#publications/';

// How many published papers show before the list collapses behind a "Show all" toggle. The
// chips above already give the full shape of the record, so a short first look is enough.
const COLLAPSE_AFTER = 4;

function groupLabel(text, count) {
  const label = document.createElement('p');
  label.className = 'pub-group-label';
  label.textContent = `${text} · `;
  const n = document.createElement('span');
  n.className = 'pub-group-count';
  n.textContent = String(count);
  label.appendChild(n);
  return label;
}

export async function initPublications() {
  const container = document.getElementById('publications-grid');
  if (!container) return;

  try {
    const res = await fetch('data/publications.json');
    if (!res.ok) throw new Error(`publications fetch: ${res.status}`);
    const data = await res.json();
    const entries = (data.publications ?? []).map((pub) => ({ pub, category: categoryOf(pub) }));

    const counts = { all: entries.length };
    for (const { category } of entries) counts[category] = (counts[category] ?? 0) + 1;
    const filters = FILTERS.filter((f) => counts[f.key]);

    // Chips.
    const chips = document.createElement('div');
    chips.className = 'filter-chips';
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Filter publications');
    const chipFor = new Map();
    for (const f of filters) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'filter-chip';
      chip.dataset.filter = f.key;
      chip.innerHTML = `${escapeHtml(f.label)} <span class="filter-chip-count">${counts[f.key]}</span>`;
      chips.appendChild(chip);
      chipFor.set(f.key, chip);
    }

    // In progress: compact rows.
    const progress = entries.filter((e) => e.category === 'in-progress');
    const progressGroup = document.createElement('div');
    progressGroup.className = 'pub-group';
    const progressList = document.createElement('ul');
    progressList.className = 'pub-rows';
    progressList.append(...progress.map((e) => renderRow(e.pub)));
    progressGroup.append(groupLabel('In progress', progress.length), progressList);

    // Published: cards, collapsed after COLLAPSE_AFTER.
    const published = entries.filter((e) => e.category !== 'in-progress').map((e) => ({ ...e, card: renderCard(e.pub) }));
    const publishedGroup = document.createElement('div');
    publishedGroup.className = 'pub-group';
    const publishedLabel = groupLabel('Published', published.length);
    const grid = document.createElement('div');
    grid.className = 'publications-grid';
    grid.append(...published.map((e) => e.card));
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn btn-secondary publications-toggle';
    publishedGroup.append(publishedLabel, grid, toggle);

    container.append(chips, progressGroup, publishedGroup);

    let filter = 'all';
    let expanded = false;

    const apply = () => {
      for (const [key, chip] of chipFor) chip.setAttribute('aria-pressed', String(key === filter));

      const showProgress = filter === 'all' || filter === 'in-progress';
      progressGroup.hidden = !showProgress || !progress.length;

      const matching = published.filter((e) => filter === 'all' || e.category === filter);
      publishedGroup.hidden = !matching.length;
      publishedLabel.lastChild.textContent = String(matching.length);
      const visible = new Set(expanded ? matching : matching.slice(0, COLLAPSE_AFTER));
      for (const e of published) e.card.style.display = visible.has(e) ? '' : 'none';

      toggle.hidden = matching.length <= COLLAPSE_AFTER;
      toggle.textContent = expanded ? 'Show fewer' : `Show all ${matching.length} published`;
    };

    const select = (key, { updateHash = true } = {}) => {
      if (!chipFor.has(key)) return false;
      filter = key;
      expanded = false;
      apply();
      // replaceState, not a new history entry: flicking through chips shouldn't fill Back.
      if (updateHash) history.replaceState(null, '', key === 'all' ? '#publications' : HASH_PREFIX + key);
      return true;
    };

    chips.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (chip) select(chip.dataset.filter);
    });
    toggle.addEventListener('click', () => {
      expanded = !expanded;
      apply();
    });

    // Deep link: #publications/<filter> selects that chip and brings the section into view.
    // The hash names no element, so the browser won't scroll there by itself.
    const fromHash = () => {
      if (!location.hash.startsWith(HASH_PREFIX)) return;
      if (select(location.hash.slice(HASH_PREFIX.length), { updateHash: false })) {
        // Instant, not the page's smooth scroll: arriving from a link should land, not glide.
        document.getElementById('publications')?.scrollIntoView({ behavior: 'instant' });
      }
    };
    window.addEventListener('hashchange', fromHash);
    apply();
    fromHash();
  } catch (err) {
    console.error('Failed to load publications:', err);
    container.innerHTML =
      '<p style="color:var(--color-text-muted);padding:2rem 0">Publications temporarily unavailable.</p>';
  }
}
