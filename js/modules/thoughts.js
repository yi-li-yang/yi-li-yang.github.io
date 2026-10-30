// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/thoughts.js
//
// Renders data/show_repo.json as a project atlas: overview first, details on demand.
// Level 1 is one uniform tile per repo, grouped by track, so the reader sees how many projects
// there are without reading any of them. Each tile sits on a dimmed screenshot, or on a
// gradient tinted by its track when the repo has none. Level 2 is one shared popover: it
// floats over the grid while the pointer rests on a tile, and a click (or a tap, on touch)
// pins it. On phones it is a bottom sheet. There is no third level.
//
// A long track shows its first rows, fades the last one out as a hint, and loads the next
// batch as the reader scrolls toward the "Show more" button. The button does the same on
// click, for keyboard users and anyone who prefers to ask.
//
// A repo entry with `expand` is a placeholder for a derived track: its tiles come from the
// data file it names (data/claude-skills.json, written by scripts/fetch-skills.js).

// Tiles a track shows before it needs "Show more" (two rows of four on desktop), and how many
// each further batch adds. A leftover of one tile is never worth a button, so it is shown.
const INITIAL = { wide: 8, narrow: 4 };
const BATCH = 4;
const DETAIL_ID = 'atlas-pop';
const HOVER_OPEN_MS = 110;
const HOVER_CLOSE_MS = 200;
const NARROW = '(max-width: 720px)';

// One hue per track, in track order: the colour is wayfinding, so a reader can tell a
// tile's track without reading the label above it.
const HUES = [168, 255, 32, 205, 330, 95];

function repoNameFromUrl(url) {
  return url.split('/').pop();
}

function repoOwnerFromUrl(url) {
  return url.split('/').slice(-2, -1)[0];
}

const nameOf = (repo) => repo.name ?? repoNameFromUrl(repo.url);
const ownerOf = (repo) => repo.owner ?? repoOwnerFromUrl(repo.url);

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

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// Reads show_repo.json and swaps each `expand` placeholder for the tiles in its data file.
// A track whose file fails to load is dropped; the rest of the atlas still renders.
async function loadRepos() {
  // Wrapped in an object so the file can carry its own `_edit` ownership marker;
  // a bare top-level array has nowhere to put one.
  const { repos } = await fetchJson('data/show_repo.json');
  const installs = new Map(); // track name -> commands that install it
  const expanded = await Promise.all(repos.map(async (repo) => {
    if (!repo.expand) return [repo];
    try {
      const data = await fetchJson(repo.expand);
      if (data.install) installs.set(repo.group, data.install);
      return data.skills.map((item) => ({ ...item, group: repo.group }));
    } catch (err) {
      console.warn(`Could not load ${repo.group}:`, err.message);
      return [];
    }
  }));
  return { repos: expanded.flat(), installs };
}

// Stands in for a missing or broken image: the repo's own name, set large. Honest about
// there being no picture, instead of a faint icon that reads as a failed load.
function makeTitleCard(repo) {
  const card = el('div', 'atlas-titlecard');
  card.append(
    el('span', 'atlas-titlecard-owner', `${ownerOf(repo)} /`),
    el('span', 'atlas-titlecard-name', nameOf(repo)),
  );
  return card;
}

// A deep link to one project: #projects/<repo name>. Pinning and closing keep it current.
const HASH_PREFIX = '#projects/';
const projectUrl = (name) => `${location.origin}${location.pathname}${HASH_PREFIX}${encodeURIComponent(name)}`;

function copyButton(label, getText, className = 'btn btn-secondary') {
  const button = el('button', className, label);
  button.type = 'button';
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getText());
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Copy failed';
    }
    setTimeout(() => { button.textContent = label; }, 1600);
  });
  return button;
}

function fillPopover(pop, repo, onClose) {
  const name = nameOf(repo);

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

  const actions = el('div', 'atlas-actions');
  actions.append(link, copyButton('Copy link', () => projectUrl(name)));

  const body = el('div', 'atlas-body');
  body.append(
    el('span', 'atlas-owner', `${ownerOf(repo)} /`),
    el('h3', 'atlas-name', name),
    el('p', 'atlas-desc', repo.description),
    actions,
  );

  const close = el('button', 'atlas-close', '✕');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close project details');
  close.addEventListener('click', onClose);

  pop.setAttribute('aria-label', `${name} details`);
  pop.replaceChildren(media, body, close);
}

// The shell commands that install a track (the skills plugin), copyable in one click.
function makeInstall(lines) {
  const box = el('div', 'atlas-install');
  const commands = el('div', 'atlas-install-lines');
  for (const line of lines) commands.appendChild(el('code', null, line));
  box.append(commands, copyButton('Copy', () => lines.join('\n'), 'atlas-install-copy'));
  return box;
}

export async function initThoughts() {
  const container = document.getElementById('thoughts-grid');
  if (!container) return;

  try {
    const { repos, installs } = await loadRepos();

    // Tracks in order of first appearance; repos keep file order within a track.
    const groups = new Map();
    for (const repo of repos) {
      const key = repo.group ?? 'Projects';
      if (!groups.has(key)) groups.set(key, { name: key, items: [], shown: 0 });
      groups.get(key).items.push(repo);
    }

    const narrow = window.matchMedia(NARROW);
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hoverEnabled = () => canHover.matches && !narrow.matches;

    const pop = el('div', 'atlas-pop');
    pop.id = DETAIL_ID;
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    document.body.appendChild(pop);

    let shownTile = null;
    let pinned = false;
    let openTimer = 0;
    let closeTimer = 0;

    // Reading order, for finding a repo's track and index from a deep link.
    const order = [...groups.values()].flatMap((g) => g.items);
    const tileFor = new Map(); // repo -> tile, for tiles that exist (not behind "Show more")
    const groupOf = new Map(order.map((repo) => [repo, groups.get(repo.group ?? 'Projects')]));

    // replaceState: opening projects one after another shouldn't fill the Back button.
    const setHash = (hash) => history.replaceState(null, '', hash || `${location.pathname}${location.search}`);

    // Floats the popover beside the tile: below it if there is room (or more room than above),
    // centred on the tile and clamped to the viewport. In document coordinates, so it scrolls
    // with the page and stays attached to its tile.
    const place = () => {
      if (!shownTile || narrow.matches) {
        pop.style.left = pop.style.top = '';
        return;
      }
      const r = shownTile.getBoundingClientRect();
      const w = pop.offsetWidth;
      const h = pop.offsetHeight;
      const gap = 6;
      const margin = 12;
      const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, margin), document.documentElement.clientWidth - w - margin);
      const room = { below: window.innerHeight - r.bottom, above: r.top };
      const top = room.below >= h + gap || room.below >= room.above ? r.bottom + gap : r.top - h - gap;
      pop.style.left = `${left + window.scrollX}px`;
      pop.style.top = `${top + window.scrollY}px`;
    };

    const hide = () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      if (!shownTile) return;
      const tile = shownTile;
      // Return focus to the tile only if it was in the popover (the ✕ button is about to be
      // hidden); an Esc pressed elsewhere on the page must not yank the reader back here.
      const focusWasInside = pop.contains(document.activeElement);
      tile.setAttribute('aria-expanded', 'false');
      tile.classList.remove('is-pinned');
      shownTile = null;
      pinned = false;
      pop.hidden = true;
      if (focusWasInside) tile.focus();
      if (location.hash.startsWith(HASH_PREFIX)) setHash('');
    };

    const show = (tile, { pin = false } = {}) => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      if (shownTile && shownTile !== tile) {
        shownTile.setAttribute('aria-expanded', 'false');
        shownTile.classList.remove('is-pinned');
      }
      if (shownTile !== tile) {
        fillPopover(pop, tile.repo, hide);
        pop.style.setProperty('--hue', tile.closest('.atlas-group').style.getPropertyValue('--hue'));
      }
      shownTile = tile;
      pinned = pin;
      tile.setAttribute('aria-expanded', 'true');
      tile.classList.toggle('is-pinned', pin);
      pop.hidden = false;
      place();
      if (pin) setHash(HASH_PREFIX + encodeURIComponent(nameOf(tile.repo)));
      else if (location.hash.startsWith(HASH_PREFIX)) setHash('');
    };

    const scheduleHide = () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      if (!shownTile || pinned) return;
      closeTimer = setTimeout(hide, HOVER_CLOSE_MS);
    };

    // The first popover waits a beat so sweeping the pointer across the grid doesn't flash one
    // per tile; once one is open, moving to the next tile swaps it straight away.
    const hoverShow = (tile) => {
      clearTimeout(closeTimer);
      clearTimeout(openTimer);
      if (shownTile === tile) return;
      if (shownTile) show(tile);
      else openTimer = setTimeout(() => show(tile), HOVER_OPEN_MS);
    };

    pop.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    pop.addEventListener('pointerleave', scheduleHide);
    pop.addEventListener('focusout', (e) => {
      if (!pinned && !pop.contains(e.relatedTarget) && e.relatedTarget !== shownTile) scheduleHide();
    });

    // ── Tiles ──────────────────────────────────────────────

    const makeTile = (repo, index) => {
      const name = nameOf(repo);
      const tile = el('button', 'atlas-tile');
      tile.type = 'button';
      tile.repo = repo;
      // The popover repeats the full description, so screen readers get the name here and the
      // rest from the popover. No title attribute: its native tooltip would sit on top of it.
      tile.setAttribute('aria-label', name);
      tile.setAttribute('aria-expanded', 'false');
      tile.setAttribute('aria-controls', DETAIL_ID);
      // Without a screenshot the tile gets a gradient; this offsets its light so neighbours differ.
      tile.style.setProperty('--ox', `${15 + ((index * 37) % 70)}%`);

      const imgUrl = resolveImageUrl(repo.image);
      if (imgUrl) {
        const bg = el('img', 'atlas-tile-bg');
        bg.src = imgUrl;
        bg.alt = '';
        // Lazy: only the tiles near the viewport pay for their image.
        bg.loading = 'lazy';
        bg.decoding = 'async';
        bg.onerror = () => { bg.remove(); tile.classList.remove('has-image'); };
        tile.classList.add('has-image');
        tile.appendChild(bg);
      }
      tile.append(el('span', 'atlas-tile-name', name), el('span', 'atlas-tile-desc', repo.description));

      tile.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch' && hoverEnabled()) hoverShow(tile); });
      tile.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') scheduleHide(); });
      tile.addEventListener('focus', () => {
        // Keyboard focus previews like hover does; a mouse click focuses too, but its click pins.
        if (tile.matches(':focus-visible') && shownTile !== tile) show(tile);
      });
      tile.addEventListener('blur', (e) => {
        if (!pinned && !pop.contains(e.relatedTarget)) scheduleHide();
      });
      tile.addEventListener('click', (e) => {
        if (shownTile === tile && pinned) { hide(); return; }
        show(tile, { pin: true });
        // From the keyboard the popover's buttons are otherwise a long Tab away.
        if (e.detail === 0) pop.querySelector('a, button')?.focus();
      });

      tileFor.set(repo, tile);
      return tile;
    };

    // ── Tracks and progressive loading ─────────────────────

    const firstBatch = (group) => {
      const n = narrow.matches ? INITIAL.narrow : INITIAL.wide;
      return group.items.length - n < 2 ? group.items.length : n;
    };
    const nextBatch = (group) => {
      const left = group.items.length - group.shown;
      return left - BATCH < 2 ? left : BATCH;
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) reveal(entry.target.group, nextBatch(entry.target.group));
      }
      // Cut off at 15% from the bottom of the viewport, so the button must be scrolled up into
      // the page before it fires, not merely peek in.
    }, { rootMargin: '0px 0px -15% 0px' });

    const reveal = (group, count, { focusFirst = false } = {}) => {
      const fresh = group.items.slice(group.shown, group.shown + count);
      const tiles = fresh.map((repo, i) => makeTile(repo, group.shown + i));
      group.shown += fresh.length;
      group.grid.append(...tiles);
      if (!reducedMotion.matches && group.shown > fresh.length) {
        tiles.forEach((tile) => tile.classList.add('is-new'));
      }

      const left = group.items.length - group.shown;
      group.block.classList.toggle('has-more', left > 0);
      if (left > 0) {
        group.moreCount.textContent = `${group.shown} of ${group.items.length}`;
        group.moreLabel.textContent = `Show ${nextBatch(group)} more`;
        // A tile appended while the button is still on screen would never re-fire the observer,
        // which only reports changes. Observe afresh so loading continues until the viewport fills.
        observer.unobserve(group.more);
        requestAnimationFrame(() => group.more.isConnected && observer.observe(group.more));
      } else {
        observer.unobserve(group.more);
        group.more.remove();
      }
      if (focusFirst) tiles[0]?.focus();
      if (shownTile && !pop.hidden) place();
    };

    const tileOf = (repo) => {
      if (!tileFor.has(repo)) {
        const group = groupOf.get(repo);
        reveal(group, group.items.indexOf(repo) + 1 - group.shown);
      }
      return tileFor.get(repo);
    };

    const frag = document.createDocumentFragment();
    frag.appendChild(el('p', 'section-lede atlas-count', `${plural(repos.length, 'project')} · ${plural(groups.size, 'track')}`));

    let trackIndex = 0;
    for (const group of groups.values()) {
      const block = el('div', 'atlas-group');
      block.style.setProperty('--hue', HUES[trackIndex++ % HUES.length]);
      const label = el('p', 'atlas-group-label', `${group.name} · `);
      label.appendChild(el('span', 'atlas-group-count', String(group.items.length)));
      const grid = el('div', 'atlas-tiles');

      const more = el('div', 'atlas-more');
      const moreButton = el('button', 'atlas-more-btn');
      moreButton.type = 'button';
      const moreLabel = el('span', 'atlas-more-label');
      const moreCount = el('span', 'atlas-more-count');
      moreButton.setAttribute('aria-label', `Show more ${group.name} projects`);
      moreButton.append(moreLabel, moreCount, el('span', 'atlas-more-arrow', '↓'));
      more.appendChild(moreButton);
      more.group = group;
      moreButton.addEventListener('click', () => reveal(group, nextBatch(group), { focusFirst: true }));

      Object.assign(group, { block, grid, more, moreLabel, moreCount });
      block.append(label);
      if (installs.has(group.name)) block.appendChild(makeInstall(installs.get(group.name)));
      block.append(grid, more);
      frag.appendChild(block);
      reveal(group, firstBatch(group));
    }
    container.appendChild(frag);

    // ── Dismissal, deep links, layout changes ──────────────

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && shownTile) hide();
    });
    // A pinned popover stays until the reader clicks elsewhere. Pointer-down, so the tile's own
    // click (which toggles) isn't pre-empted.
    document.addEventListener('pointerdown', (e) => {
      if (shownTile && pinned && !pop.contains(e.target) && !e.target.closest('.atlas-tile')) hide();
    });

    // Deep link: #projects/<name> pins that project. The hash names no element, so the
    // browser won't scroll by itself; bring the section into view first.
    const fromHash = () => {
      if (!location.hash.startsWith(HASH_PREFIX)) return;
      const wanted = decodeURIComponent(location.hash.slice(HASH_PREFIX.length)).toLowerCase();
      const repo = order.find((r) => nameOf(r).toLowerCase() === wanted);
      const tile = repo && tileOf(repo);
      if (!tile) return;
      // Instant: arriving from a link should land on the project, not glide to it.
      document.getElementById('thoughts')?.scrollIntoView({ behavior: 'instant' });
      if (shownTile !== tile || !pinned) show(tile, { pin: true });
    };
    window.addEventListener('hashchange', fromHash);
    fromHash();

    // A width change can change the column count and so where the tile sits. The popover is
    // positioned in document coordinates, so it only needs placing again, not closing —
    // unless the layout flipped between popover and bottom sheet.
    let wasNarrow = narrow.matches;
    window.addEventListener('resize', () => {
      if (narrow.matches !== wasNarrow) { wasNarrow = narrow.matches; hide(); return; }
      if (shownTile) place();
    });
  } catch (err) {
    console.error('Failed to load thoughts:', err);
    container.innerHTML = '<p style="color:var(--color-text-muted);padding:2rem 0">Projects temporarily unavailable.</p>';
  }
}
