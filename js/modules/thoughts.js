// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/thoughts.js
//
// Renders data/show_repo.json as a project atlas: overview first, details on demand.
// Level 1 is one uniform tile per repo (name + a one-line summary), grouped by track, so the
// reader sees how many projects there are without reading any of them. Level 2 is a single
// shared detail panel that opens under the clicked tile's grid row. On phones the grid is one
// column, so the same placement rule reads as an accordion. There is no third level.

// Tracks longer than this collapse their tail behind a "+N more" tile, which keeps the overview
// at two rows per track however many repos are added. Same idea as COLLAPSE_AFTER in
// publications.js.
const TILES_PER_GROUP = 8;
const DETAIL_ID = 'atlas-detail';

function repoNameFromUrl(url) {
  return url.split('/').pop();
}

function repoOwnerFromUrl(url) {
  return url.split('/').slice(-2, -1)[0];
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null;
  // Convert github.com blob URLs to raw.githubusercontent.com for direct image rendering
  return imageUrl
    .replace('https://github.com/', 'https://raw.githubusercontent.com/')
    .replace('/blob/', '/');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Stands in for a missing or broken image: the repo's own name, set large. Honest about
// there being no picture, instead of a faint icon that reads as a failed load.
function makeTitleCard(repo) {
  const card = el('div', 'atlas-titlecard');
  card.append(
    el('span', 'atlas-titlecard-owner', `${repoOwnerFromUrl(repo.url)} /`),
    el('span', 'atlas-titlecard-name', repoNameFromUrl(repo.url)),
  );
  return card;
}

// A deep link to one project: #projects/<repo name>. Opening and closing keep it current.
const HASH_PREFIX = '#projects/';
const projectUrl = (name) => `${location.origin}${location.pathname}${HASH_PREFIX}${encodeURIComponent(name)}`;

function navButton(label, target, onNav) {
  const button = el('button', 'atlas-nav', label);
  button.type = 'button';
  if (target) {
    const name = repoNameFromUrl(target.url);
    button.title = name;
    button.setAttribute('aria-label', `${label.replace(/[←→]/g, '').trim()} project: ${name}`);
    button.addEventListener('click', () => onNav(target));
  } else {
    button.disabled = true;
  }
  return button;
}

function fillDetail(detail, repo, { onClose, prev, next, onNav }) {
  const name = repoNameFromUrl(repo.url);

  const media = el('div', 'atlas-media');
  const imgUrl = resolveImageUrl(repo.image);
  if (imgUrl) {
    const img = el('img');
    img.src = imgUrl;
    img.alt = name;
    img.decoding = 'async';
    img.onerror = () => img.replaceWith(makeTitleCard(repo));
    media.appendChild(img);
  } else {
    media.appendChild(makeTitleCard(repo));
  }

  const link = el('a', 'btn btn-secondary', 'View on GitHub');
  link.href = repo.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  const copy = el('button', 'btn btn-secondary atlas-copy', 'Copy link');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(projectUrl(name));
      copy.textContent = 'Link copied';
    } catch {
      copy.textContent = 'Copy failed';
    }
    setTimeout(() => { copy.textContent = 'Copy link'; }, 1600);
  });

  const actions = el('div', 'atlas-actions');
  actions.append(link, copy);

  // Browse without closing: the reader digging in can walk every project from here.
  const nav = el('div', 'atlas-navs');
  nav.append(navButton('← Previous', prev, onNav), navButton('Next →', next, onNav));

  const body = el('div', 'atlas-body');
  body.append(
    el('span', 'atlas-owner', `${repoOwnerFromUrl(repo.url)} /`),
    el('h3', 'atlas-name', name),
    el('p', 'atlas-desc', repo.description),
    actions,
    nav,
  );

  const close = el('button', 'atlas-close', '✕');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close project details');
  close.addEventListener('click', onClose);

  detail.replaceChildren(media, body, close);
}

// The detail spans the full grid width, so it must sit after the LAST tile in the clicked
// tile's row, not after the tile itself. Detach it first: while it is in the grid it pushes
// later tiles down and their offsetTop no longer describes the row they would be in.
function placeDetail(detail, tile) {
  detail.remove();
  const rowEnd = [...tile.parentElement.children]
    .filter((t) => t.offsetTop === tile.offsetTop)
    .at(-1);
  rowEnd.after(detail);
}

export async function initThoughts() {
  const container = document.getElementById('thoughts-grid');
  if (!container) return;

  try {
    const res = await fetch('data/show_repo.json');
    if (!res.ok) throw new Error(`show_repo fetch: ${res.status}`);
    // Wrapped in an object so the file can carry its own `_edit` ownership marker;
    // a bare top-level array has nowhere to put one.
    const { repos } = await res.json();

    // Tracks in order of first appearance; repos keep file order within a track.
    const groups = new Map();
    for (const repo of repos) {
      const key = repo.group ?? 'Projects';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(repo);
    }

    const detail = el('div', 'atlas-detail');
    detail.id = DETAIL_ID;
    detail.hidden = true;
    detail.setAttribute('role', 'region');
    detail.setAttribute('aria-label', 'Project details');
    detail.setAttribute('aria-live', 'polite');

    let openTile = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Reading order for Previous/Next: tracks in order, repos in file order within each.
    const order = [...groups.values()].flat();
    const tileFor = new Map(); // repo -> tile, for tiles that exist (not behind "+N more")
    const expanders = new Map(); // track name -> reveals that track's hidden tiles

    // replaceState: opening projects one after another shouldn't fill the Back button.
    const setHash = (hash) => history.replaceState(null, '', hash || `${location.pathname}${location.search}`);

    const close = () => {
      if (!openTile) return;
      const tile = openTile;
      // Return focus to the tile only if it was in the atlas (the ✕ button is about to be
      // removed); an Esc pressed elsewhere on the page must not yank the reader back here.
      const focusWasHere = container.contains(document.activeElement);
      tile.setAttribute('aria-expanded', 'false');
      openTile = null;
      detail.hidden = true;
      detail.remove();
      if (focusWasHere) tile.focus();
      if (location.hash.startsWith(HASH_PREFIX)) setHash('');
    };

    const tileOf = (repo) => {
      if (!tileFor.has(repo)) expanders.get(repo.group ?? 'Projects')?.();
      return tileFor.get(repo);
    };

    const open = (tile, { instant = false } = {}) => {
      if (openTile) openTile.setAttribute('aria-expanded', 'false');
      openTile = tile;
      tile.setAttribute('aria-expanded', 'true');
      const i = order.indexOf(tile.repo);
      fillDetail(detail, tile.repo, {
        onClose: close,
        prev: order[i - 1],
        next: order[i + 1],
        onNav: (repo) => {
          const target = tileOf(repo);
          if (!target) return;
          const [same, other] = repo === order[i - 1] ? [0, 1] : [1, 0];
          open(target);
          // The old buttons were replaced, so focus must be placed again: on the same
          // direction if it still applies, else the other way (at either end of the list).
          const navs = detail.querySelectorAll('.atlas-nav');
          (navs[same].disabled ? navs[other] : navs[same]).focus();
        },
      });
      detail.hidden = false;
      placeDetail(detail, tile);
      detail.scrollIntoView({ block: 'nearest', behavior: instant || reducedMotion.matches ? 'instant' : 'smooth' });
      setHash(HASH_PREFIX + encodeURIComponent(repoNameFromUrl(tile.repo.url)));
    };

    const makeTile = (repo) => {
      const name = repoNameFromUrl(repo.url);
      const tile = el('button', 'atlas-tile');
      tile.type = 'button';
      tile.repo = repo;
      tile.title = name;
      // The summary is a visual cue; screen readers get the full description from the detail.
      tile.setAttribute('aria-label', name);
      tile.setAttribute('aria-expanded', 'false');
      tile.setAttribute('aria-controls', DETAIL_ID);
      tile.append(el('span', 'atlas-tile-name', name), el('span', 'atlas-tile-desc', repo.description));
      tile.addEventListener('click', () => (openTile === tile ? close() : open(tile)));
      tileFor.set(repo, tile);
      return tile;
    };

    const frag = document.createDocumentFragment();
    frag.appendChild(el('p', 'section-lede atlas-count', `${plural(repos.length, 'project')} · ${plural(groups.size, 'track')}`));

    for (const [name, items] of groups) {
      const block = el('div', 'atlas-group');
      const label = el('p', 'atlas-group-label', `${name} · `);
      label.appendChild(el('span', 'atlas-group-count', String(items.length)));
      const grid = el('div', 'atlas-tiles');

      const overflow = items.length > TILES_PER_GROUP;
      const shown = overflow ? items.slice(0, TILES_PER_GROUP - 1) : items;
      for (const repo of shown) grid.appendChild(makeTile(repo));

      if (overflow) {
        const rest = items.slice(TILES_PER_GROUP - 1);
        const more = el('button', 'atlas-tile atlas-tile-more', `+${rest.length} more`);
        more.type = 'button';
        more.setAttribute('aria-label', `Show ${rest.length} more ${name} projects`);
        const expand = () => {
          if (!more.isConnected) return;
          more.replaceWith(...rest.map(makeTile));
          if (openTile) placeDetail(detail, openTile);
        };
        expanders.set(name, expand);
        more.addEventListener('click', () => {
          expand();
          tileFor.get(rest[0])?.focus();
        });
        grid.appendChild(more);
      }

      block.append(label, grid);
      frag.appendChild(block);
    }
    container.appendChild(frag);

    document.addEventListener('keydown', (e) => {
      if (!openTile) return;
      if (e.key === 'Escape') close();
      // ←/→ browse projects while the reader is working in the atlas.
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && container.contains(document.activeElement)) {
        const target = order[order.indexOf(openTile.repo) + (e.key === 'ArrowLeft' ? -1 : 1)];
        if (!target) return;
        e.preventDefault();
        const tile = tileOf(target);
        if (tile) { open(tile); tile.focus({ preventScroll: true }); }
      }
    });

    // Deep link: #projects/<name> opens that project. The hash names no element, so the
    // browser won't scroll by itself; bring the section into view first.
    const fromHash = () => {
      if (!location.hash.startsWith(HASH_PREFIX)) return;
      const wanted = decodeURIComponent(location.hash.slice(HASH_PREFIX.length)).toLowerCase();
      const repo = order.find((r) => repoNameFromUrl(r.url).toLowerCase() === wanted);
      const tile = repo && tileOf(repo);
      if (!tile) return;
      // Instant: arriving from a link should land on the project, not glide to it.
      document.getElementById('thoughts')?.scrollIntoView({ behavior: 'instant' });
      if (openTile !== tile) open(tile, { instant: true });
    };
    window.addEventListener('hashchange', fromHash);
    fromHash();

    // A width change can change the column count and so the row an open tile sits in. Height
    // changes are ignored: opening the detail changes the height and must not re-trigger this.
    let lastWidth = 0;
    new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width === lastWidth) return;
      lastWidth = width;
      if (openTile) placeDetail(detail, openTile);
    }).observe(container);
  } catch (err) {
    console.error('Failed to load thoughts:', err);
    container.innerHTML = '<p style="color:var(--color-text-muted);padding:2rem 0">Projects temporarily unavailable.</p>';
  }
}
