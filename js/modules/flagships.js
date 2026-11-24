// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/flagships.js
//
// Renders the Featured section from data/flagships.json: one card per flagship, all built the
// same way (map image, kicker, title, summary, three numbers, the live link, then text links),
// in a card row (card-row.js). Wide screens show the cards side by side and nothing moves;
// narrower ones show one card, with the next fading in at the edge.
//
// "How it was built" opens the long story in one full-width drawer under the row, so opening it
// never makes one card taller than its neighbour. One drawer is open at a time.
//
// Numbers that another project owns are tokens in the data, such as {atlas.cells}, filled from
// data/livability-atlas.json (written by scripts/fetch-atlas.js). A stat or a foot line whose
// number is missing is left out, never printed blank.

import { enhanceCardRow } from './card-row.js';

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function external(href, label, className) {
  const a = el('a', className, label);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

// Fills {source.key} tokens from `sources` (e.g. { atlas: {...} }). Returns null when a token
// has no number, so the caller can leave that line out.
function fill(text, sources) {
  let missing = false;
  const out = String(text).replace(/\{(\w+)\.(\w+)\}/g, (_, source, key) => {
    const value = sources[source]?.[key];
    if (typeof value !== 'number') { missing = true; return ''; }
    return value.toLocaleString('en-GB');
  });
  return missing ? null : out;
}

// Body text reads fine without a missing number ("fetches public datasets"), so drop just the token.
const fillLoose = (text, sources) => fill(text, sources) ?? String(text).replace(/\{\w+\.\w+\}\s?/g, '');

function makeCard(item, sources) {
  const card = el('article', 'flagship-card');
  card.id = `flagship-${item.id}`;

  const media = external(item.live.href, null, 'flagship-media');
  media.tabIndex = -1;
  media.setAttribute('aria-hidden', 'true');
  const img = el('img');
  Object.assign(img, { src: item.image.src, alt: '', width: 1200, height: 750, loading: 'lazy', decoding: 'async' });
  media.append(img, el('span', 'flagship-chip', item.chip));
  if (item.image.credit) media.appendChild(el('span', 'flagship-credit', item.image.credit));

  const stats = el('dl', 'flagship-stats');
  for (const stat of item.stats ?? []) {
    const value = fill(stat.value, sources);
    const label = fill(stat.label, sources);
    if (value == null || label == null) continue;
    const row = el('div', 'flagship-stat');
    row.append(el('dt', null, label), el('dd', null, value));
    stats.appendChild(row);
  }

  const actions = el('div', 'flagship-actions');
  actions.append(
    external(item.live.href, item.live.label, 'btn btn-primary'),
    ...(item.links ?? []).map((link) => external(link.href, link.label, 'flagship-link')),
  );

  const more = el('button', 'flagship-more', 'How it was built');
  more.type = 'button';
  more.setAttribute('aria-expanded', 'false');
  more.setAttribute('aria-controls', `flagship-drawer-${item.id}`);

  const foot = el('div', 'flagship-foot');
  foot.append(...(stats.childElementCount ? [stats] : []), actions, more);

  const body = el('div', 'flagship-body');
  body.append(
    el('p', 'flagship-kicker', item.kicker),
    el('h3', 'flagship-title', item.title),
    el('p', 'flagship-summary', fillLoose(item.summary, sources)),
    foot,
  );
  card.append(media, body);
  return { card, more };
}

function makeDrawer(item, sources) {
  const drawer = el('section', 'flagship-drawer');
  drawer.id = `flagship-drawer-${item.id}`;
  drawer.setAttribute('aria-label', `How it was built: ${item.title}`);
  drawer.hidden = true;

  const grid = el('div', 'flagship-story-grid');
  if (item.story.some((part) => part.figure)) grid.classList.add('has-figure');
  for (const part of item.story) {
    const panel = el('section', `flagship-story${part.figure ? ' with-figure' : ''}`);
    panel.append(el('p', 'flagship-story-kicker', part.kicker), el('h4', 'flagship-story-title', part.title));
    if (part.figure) {
      const figure = el('figure', 'flagship-story-figure');
      const img = el('img');
      Object.assign(img, { src: part.figure.src, alt: part.figure.alt, loading: 'lazy', decoding: 'async' });
      figure.append(img, el('figcaption', null, part.figure.caption));
      panel.appendChild(figure);
    }
    panel.appendChild(el('p', 'flagship-story-body', fillLoose(part.body, sources)));
    const foot = part.foot && fill(part.foot, sources);
    if (foot) panel.appendChild(el('p', 'flagship-story-foot', foot));
    if (part.links?.length) {
      const links = el('p', 'flagship-story-links');
      links.append(...part.links.map((link) => external(link.href, link.label)));
      panel.appendChild(links);
    }
    grid.appendChild(panel);
  }
  drawer.append(el('p', 'flagship-drawer-label', `How it was built · ${item.title}`), grid);
  return drawer;
}

export async function initFlagships() {
  const host = document.getElementById('flagships');
  if (!host) return;

  try {
    const [{ flagships }, atlas] = await Promise.all([
      fetchJson('data/flagships.json'),
      // Optional: without it the Atlas card drops the numbers it cannot fill.
      fetchJson('data/livability-atlas.json').catch((err) => { console.warn('Atlas numbers unavailable:', err.message); return null; }),
    ]);
    const sources = { atlas };

    const track = el('div', 'flagship-track');
    const toggles = [];
    const drawers = [];
    for (const item of flagships) {
      const { card, more } = makeCard(item, sources);
      track.appendChild(card);
      toggles.push(more);
      drawers.push(makeDrawer(item, sources));
    }
    host.append(track, ...drawers);

    enhanceCardRow(track, { kind: 'flagships', label: 'Featured projects' });

    // One drawer at a time: opening one closes the other.
    toggles.forEach((toggle, i) => toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggles.forEach((other, j) => {
        other.setAttribute('aria-expanded', String(open && i === j));
        drawers[j].hidden = !(open && i === j);
      });
    }));
  } catch (err) {
    console.error('Failed to load flagships:', err);
    host.innerHTML = '<p style="color:var(--color-text-muted);padding:2rem 0">Featured projects temporarily unavailable.</p>';
  }
}
