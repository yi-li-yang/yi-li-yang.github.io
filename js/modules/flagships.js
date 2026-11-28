// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/flagships.js
//
// Renders the Featured section from data/flagships.json: one card per flagship, all built the
// same way (map image, kicker, title, summary, three numbers, the live link, then text links),
// in a card row (card-row.js). Wide screens show the cards side by side and the row does not
// scroll; narrower ones show one card, with the next fading in at the edge.
//
// A flagship with `motion` has an image that moves: a zoom or a dissolve through a stack of
// still frames (motion.js). It plays once when the image comes into view, rests on the last
// frame, and plays again when the pointer or keyboard focus comes to the card.
//
// "How it was built" opens the long story in one full-width drawer under the row, so opening it
// never makes one card taller than its neighbour. One drawer is open at a time.
//
// Numbers that another project owns are tokens in the data, such as {atlas.cells}, filled from
// data/livability-atlas.json (written by scripts/fetch-atlas.js). A stat or a foot line whose
// number is missing is left out, never printed blank.

import { enhanceCardRow } from './card-row.js';
import { flipIn } from './flip.js';
import { mountMotion, cssTime } from './motion.js';

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
  // A missing image leaves the card's text, not a broken-image box.
  img.onerror = () => img.remove();
  const tags = el('span', 'flagship-tags');
  tags.appendChild(el('span', 'flagship-chip', item.chip));
  media.append(img, tags);
  const credit = item.image.credit ? el('span', 'flagship-credit', item.image.credit) : null;
  if (credit) media.appendChild(credit);
  if (item.motion) mountMotion({ card, media, still: img, tags, credit, motion: item.motion });

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
    external(item.live.href, item.live.label, 'btn btn-secondary'),
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

// A drawer slides open and shut (height, its spacing and opacity together), so the page under
// it moves smoothly instead of jumping by the drawer's full height in one frame. The lengths
// and the curve are the CSS's --settle, --leave and --soft-out (css/variables.css), which are
// 0ms for a reader who asks for reduced motion. cssTime() reads them (motion.js).

// A drawer's figure has no size until it loads, so the drawer could only be measured short and
// would then jump when the picture arrives. Its images start loading when the pointer or focus
// reaches the toggle, and an opening waits a moment (at most FIGURE_WAIT_MS) for them.
const FIGURE_WAIT_MS = 400;

function preloadDrawer(drawer) {
  for (const img of drawer.querySelectorAll('img')) img.loading = 'eager';
}

function figuresReady(drawer) {
  preloadDrawer(drawer);
  const pending = [...drawer.querySelectorAll('img')].filter((img) => !img.complete);
  if (!pending.length) return Promise.resolve();
  return Promise.race([
    Promise.all(pending.map((img) => img.decode().catch(() => {}))),
    new Promise((resolve) => setTimeout(resolve, FIGURE_WAIT_MS)),
  ]);
}

async function slideDrawer(drawer, open) {
  drawer.wanted = open;
  const isOpen = () => !drawer.hidden && !drawer.closing;
  if (open === isOpen()) return;
  if (open) {
    await figuresReady(drawer);
    // Closed again, or already opened by a second click, while its figure loaded.
    if (drawer.wanted !== open || isOpen()) return;
  }
  drawer.motion?.cancel();
  drawer.closing = false;
  const duration = cssTime(open ? '--settle' : '--leave');
  if (!duration) {
    drawer.hidden = !open;
    return;
  }
  drawer.hidden = false;
  const style = getComputedStyle(drawer);
  const shown = {
    height: `${drawer.offsetHeight}px`,
    paddingTop: style.paddingTop,
    paddingBottom: style.paddingBottom,
    marginTop: style.marginTop,
    opacity: 1,
  };
  const folded = { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', opacity: 0 };
  drawer.style.overflow = 'hidden';
  drawer.motion = drawer.animate(open ? [folded, shown] : [shown, folded], {
    duration,
    easing: getComputedStyle(document.documentElement).getPropertyValue('--soft-out').trim() || 'ease-out',
  });
  drawer.closing = !open;
  drawer.motion.onfinish = () => {
    drawer.style.overflow = '';
    if (!open) {
      drawer.hidden = true;
      drawer.closing = false;
    }
  };
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
    flipIn(track.querySelectorAll('.flagship-stat dd'));

    enhanceCardRow(track, { kind: 'flagships', label: 'Featured projects' });

    toggles.forEach((toggle, i) => {
      toggle.addEventListener('pointerenter', () => preloadDrawer(drawers[i]), { once: true });
      toggle.addEventListener('focus', () => preloadDrawer(drawers[i]), { once: true });
    });

    // One drawer at a time: opening one closes the other.
    toggles.forEach((toggle, i) => toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggles.forEach((other, j) => {
        other.setAttribute('aria-expanded', String(open && i === j));
        slideDrawer(drawers[j], open && i === j);
      });
    }));
  } catch (err) {
    console.error('Failed to load flagships:', err);
    host.innerHTML = '<p style="color:var(--muted);padding:2rem 0">Featured projects temporarily unavailable.</p>';
  }
}
