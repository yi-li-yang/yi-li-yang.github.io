// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/thoughts.js
//
// Renders data/show_repo.json as a project atlas: overview first, details on demand.
// Level 1 is one uniform tile per repo, grouped by track, so the reader sees how many projects
// there are without reading any of them. Each tile sits on the repo's dimmed preview image,
// or on plain surface when the repo has none. Level 2 is one shared popover: it
// floats over the grid while the pointer rests on a tile, and a click (or a tap, on touch)
// pins it. On phones it is a bottom sheet. There is no third level.
//
// Each track is one card row (card-row.js): its tiles sit side by side, and when they do not
// all fit, the row rotates sideways, fading out at the edge that has more, with an arrow there.
//
// A repo entry with `expand` is a placeholder for a derived track: its tiles come from the
// data file it names (data/claude-skills.json, written by scripts/fetch-skills.js).

import { enhanceCardRow } from './card-row.js';
import { loadPreviews } from './previews.js';
import { flipIn } from './flip.js';

const DETAIL_ID = 'atlas-pop';
const HOVER_OPEN_MS = 120;
const HOVER_CLOSE_MS = 200;
// How long the popover takes to fade out (--leave in css/variables.css) before it is hidden.
const LEAVE_MS = 180;
const NARROW = '(max-width: 720px)';
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

// One hue per track, in track order: the colour is wayfinding, so a reader can tell a
// tile's track without reading the label above it.

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
      return data.skills.map((item) => ({ ...item, group: repo.group, kind: 'skill' }));
    } catch (err) {
      console.warn(`Could not load ${repo.group}:`, err.message);
      return [];
    }
  }));
  return { repos: expanded.flat(), installs };
}

// Loads the repo's image into `img`. When it fails, tries the hand-made fallback once, then
// calls onFail, so a broken file never leaves a broken-image box.
function loadImage(img, repo, onFail) {
  let triedFallback = false;
  img.onerror = () => {
    if (!triedFallback && repo.fallbackImage) {
      triedFallback = true;
      img.src = resolveImageUrl(repo.fallbackImage);
      return;
    }
    onFail();
  };
  img.src = resolveImageUrl(repo.image);
}

// ── Art for a project with no picture ─────────────────
// A tile without an image still gets something to look at, and the something says what the
// project is: a skill shows the command that runs it, over a terminal's faint character grid;
// a repo shows contour lines, the earth-science field's own drawing, seeded from its name so
// each one is different and stays the same on every visit. The lines are hairlines in the
// stone neutrals, under the same scrim as a picture, so the text stays readable. ?blank=type
// swaps the contours for the project's name set large (a variant to compare).

const BLANK = new URLSearchParams(location.search).get('blank') === 'type' ? 'type' : 'contour';
const SVG_NS = 'http://www.w3.org/2000/svg';

// A small seeded random number generator (mulberry32), so a repo's drawing never changes.
function seeded(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Nested closed contours around one summit: each ring is a circle bent by three harmonics,
// and the bend grows outwards, as it does on a real hillside.
function contourSvg(name) {
  const rand = seeded(name);
  const W = 320;
  const H = 180;
  const cx = W * (0.5 + rand() * 0.3);
  const cy = H * (0.2 + rand() * 0.3);
  const waves = [2, 3, 5].map((k) => ({ k, a: 0.05 + rand() * 0.11, p: rand() * Math.PI * 2, drift: (rand() - 0.5) * 0.5 }));
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('aria-hidden', 'true');
  for (let ring = 0; ring < 14; ring++) {
    const r = 10 + ring * 15;
    const points = [];
    for (let i = 0; i < 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      const bend = waves.reduce((s, w) => s + w.a * Math.min(1, 0.35 + ring * 0.12) * Math.sin(w.k * t + w.p + w.drift * ring), 0);
      points.push(`${(cx + Math.cos(t) * r * (1 + bend)).toFixed(1)},${(cy + Math.sin(t) * r * (1 + bend) * 0.8).toFixed(1)}`);
    }
    const path = document.createElementNS(SVG_NS, 'polygon');
    path.setAttribute('points', points.join(' '));
    // Every fifth line is an index contour, drawn a step stronger, as on a survey map.
    if (ring % 5 === 4) path.setAttribute('class', 'is-index');
    svg.appendChild(path);
  }
  return svg;
}

const commandOf = (repo) => `/${ownerOf(repo)}:${nameOf(repo)}`;

// The command line a skill runs from, with a cursor that blinks while the tile is hovered.
function makePrompt(repo) {
  const line = el('span', 'atlas-prompt');
  line.setAttribute('aria-hidden', 'true');
  line.append(el('span', 'atlas-prompt-mark', '>'), el('span', 'atlas-prompt-cmd', commandOf(repo)), el('span', 'atlas-prompt-caret'));
  return line;
}

// The art behind a tile, or behind the popover's title card, for a project with no image.
function makeArt(repo) {
  const art = el('span', `atlas-art atlas-art--${repo.kind === 'skill' ? 'skill' : BLANK}`);
  art.setAttribute('aria-hidden', 'true');
  if (repo.kind === 'skill') {
    // The dot grid is the element's own background (css/components.css).
  } else if (BLANK === 'type') {
    art.appendChild(el('span', 'atlas-art-word', nameOf(repo)));
  } else {
    art.appendChild(contourSvg(nameOf(repo)));
  }
  return art;
}

// Stands in for a missing or broken image: the repo's own name, set large, over its art.
function makeTitleCard(repo) {
  const card = el('div', 'atlas-titlecard');
  card.appendChild(makeArt(repo));
  if (repo.kind === 'skill') card.appendChild(makePrompt(repo));
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
  if (repo.image) {
    const img = el('img');
    img.alt = name;
    img.decoding = 'async';
    // The repo's animation, when it has one, plays here only, and only for a visitor who has not
    // asked for reduced motion; everyone else sees the still image. The tile stays still.
    let shown = img;
    if (repo.anim) {
      const source = el('source');
      source.media = '(prefers-reduced-motion: no-preference)';
      source.srcset = repo.anim;
      shown = el('picture');
      shown.append(source, img);
    }
    loadImage(img, repo, () => shown.replaceWith(makeTitleCard(repo)));
    media.appendChild(shown);
  } else {
    media.appendChild(makeTitleCard(repo));
  }

  // A private repo would answer visitors with a 404, so it gets a plain label, not a link.
  let source;
  if (repo.private) {
    source = el('span', 'btn btn-secondary atlas-private', 'Private repository');
  } else {
    source = el('a', 'btn btn-secondary', 'View on GitHub');
    source.href = repo.url;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
  }

  const actions = el('div', 'atlas-actions');
  actions.append(source, copyButton('Copy link', () => projectUrl(name)));

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
    const [{ repos, installs }, previews] = await Promise.all([loadRepos(), loadPreviews()]);
    // A repo's own preview (data/previews.json) wins over the file show_repo.json names, which
    // stays as the fallback: the site shows a new preview the day the ingest copies it.
    for (const repo of repos) {
      const preview = previews[repo.url];
      if (preview?.image) {
        if (repo.image && repo.image !== preview.image) repo.fallbackImage = repo.image;
        repo.image = preview.image;
      }
      if (preview?.anim) repo.anim = preview.anim;
    }

    // Tracks in order of first appearance; repos keep file order within a track.
    const groups = new Map();
    for (const repo of repos) {
      const key = repo.group ?? 'Projects';
      if (!groups.has(key)) groups.set(key, { name: key, items: [] });
      groups.get(key).items.push(repo);
    }

    const narrow = window.matchMedia(NARROW);
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
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
    const tileFor = new Map(); // repo -> tile
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
      const below = room.below >= h + gap || room.below >= room.above;
      const top = below ? r.bottom + gap : r.top - h - gap;
      // It grows out of its tile: from just above when it sits below the tile, and the reverse.
      pop.classList.toggle('is-above', !below);
      pop.style.left = `${left + window.scrollX}px`;
      pop.style.top = `${top + window.scrollY}px`;
    };

    // Motion. The popover fades and settles in from its tile, glides from tile to tile while
    // it stays open, and fades out before it is hidden; the CSS owns the curves and lengths.
    // A first opening is placed before it is shown, so it never glides in from the last tile.
    let leaveTimer = 0;
    const openPop = () => {
      clearTimeout(leaveTimer);
      if (pop.hidden) {
        pop.hidden = false;
        pop.classList.add('no-glide');
        place();
        void pop.offsetWidth; // apply the start state, so the entrance runs from its first frame
        pop.classList.remove('no-glide');
      } else {
        place();
      }
      pop.classList.add('is-open');
    };
    const closePop = () => {
      pop.classList.remove('is-open');
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        if (!pop.classList.contains('is-open')) pop.hidden = true;
      }, REDUCED_MOTION.matches ? 0 : LEAVE_MS);
    };
    // New content fades in where the old content was, instead of replacing it in one frame.
    const swapContent = (repo) => {
      pop.classList.add('is-swapping');
      fillPopover(pop, repo, hide);
      void pop.offsetWidth;
      pop.classList.remove('is-swapping');
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
      closePop();
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
        if (pop.classList.contains('is-open')) swapContent(tile.repo);
        else fillPopover(pop, tile.repo, hide);
      }
      shownTile = tile;
      pinned = pin;
      tile.setAttribute('aria-expanded', 'true');
      tile.classList.toggle('is-pinned', pin);
      openPop();
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

    // A tile that slides under a still pointer, because its row moved, must not open its
    // popover; only the pointer moving onto a tile does. So each row scroll notes where the
    // pointer stood, and a hover from that same spot waits for the pointer's next move.
    let pointerX = NaN;
    let pointerY = NaN;
    let stillX = NaN;
    let stillY = NaN;
    document.addEventListener('pointermove', (e) => { pointerX = e.clientX; pointerY = e.clientY; }, { passive: true });
    const cameToPointer = (e) => Math.abs(e.clientX - stillX) < 3 && Math.abs(e.clientY - stillY) < 3;
    const hoverFrom = (tile, e) => {
      if (e.pointerType === 'touch' || !hoverEnabled()) return;
      tile.waitsForMove = cameToPointer(e);
      if (!tile.waitsForMove) hoverShow(tile);
    };

    pop.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    pop.addEventListener('pointerleave', scheduleHide);
    pop.addEventListener('focusout', (e) => {
      if (!pinned && !pop.contains(e.relatedTarget) && e.relatedTarget !== shownTile) scheduleHide();
    });

    // ── Tiles ──────────────────────────────────────────────

    const makeTile = (repo) => {
      const name = nameOf(repo);
      const tile = el('button', 'atlas-tile');
      tile.type = 'button';
      tile.repo = repo;
      // The popover repeats the full description, so screen readers get the name here and the
      // rest from the popover. No title attribute: its native tooltip would sit on top of it.
      tile.setAttribute('aria-label', name);
      tile.setAttribute('aria-expanded', 'false');
      tile.setAttribute('aria-controls', DETAIL_ID);

      const addArt = () => {
        tile.classList.add('has-art');
        tile.prepend(makeArt(repo));
        if (repo.kind === 'skill') {
          tile.classList.add('has-prompt');
          tile.prepend(makePrompt(repo));
        }
      };
      if (repo.image) {
        const bg = el('img', 'atlas-tile-bg');
        bg.alt = '';
        // Lazy: only the tiles near the viewport pay for their image.
        bg.loading = 'lazy';
        bg.decoding = 'async';
        loadImage(bg, repo, () => { bg.remove(); tile.classList.remove('has-image'); addArt(); });
        tile.classList.add('has-image');
        tile.appendChild(bg);
      } else {
        addArt();
      }
      tile.append(el('span', 'atlas-tile-name', name), el('span', 'atlas-tile-desc', repo.description));

      tile.addEventListener('pointerenter', (e) => hoverFrom(tile, e));
      tile.addEventListener('pointermove', (e) => { if (tile.waitsForMove) hoverFrom(tile, e); });
      tile.addEventListener('pointerleave', (e) => {
        tile.waitsForMove = false;
        if (e.pointerType !== 'touch') scheduleHide();
      });
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

    // ── Tracks ─────────────────────────────────────────────

    const frag = document.createDocumentFragment();
    frag.appendChild(el('p', 'section-lede atlas-count', `${plural(repos.length, 'project')} · ${plural(groups.size, 'track')}`));

    for (const group of groups.values()) {
      const block = el('div', 'atlas-group');
      const label = el('p', 'atlas-group-label', `${group.name} · `);
      label.appendChild(el('span', 'atlas-group-count', String(group.items.length)));
      const grid = el('div', 'atlas-tiles');
      grid.append(...group.items.map(repo => makeTile(repo)));

      group.grid = grid;
      block.append(label);
      if (installs.has(group.name)) block.appendChild(makeInstall(installs.get(group.name)));
      block.append(grid);
      frag.appendChild(block);
    }
    container.appendChild(frag);
    flipIn(container.querySelectorAll('.atlas-count, .atlas-group-count'));

    // The rows are made once the tracks are in the page, so they can measure themselves. A
    // popover belongs beside its tile: a hover one closes when its row moves; a pinned one
    // follows its tile, and closes once the tile has left the row's view.
    for (const group of groups.values()) {
      group.row = enhanceCardRow(group.grid, { kind: 'tiles', label: `${group.name} projects` });
      group.row.viewport.addEventListener('scroll', () => {
        stillX = pointerX;
        stillY = pointerY;
        if (!shownTile || groupOf.get(shownTile.repo) !== group) return;
        if (!pinned) { hide(); return; }
        const tile = shownTile.getBoundingClientRect();
        const view = group.row.viewport.getBoundingClientRect();
        if (tile.right < view.left + 8 || tile.left > view.right - 8) hide();
        else place();
      }, { passive: true });
    }

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
      const tile = repo && tileFor.get(repo);
      if (!tile) return;
      // Instant: arriving from a link should land on the project, not glide to it.
      document.getElementById('thoughts')?.scrollIntoView({ behavior: 'instant' });
      groupOf.get(repo).row?.scrollToItem(tile);
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
    container.innerHTML = '<p style="color:var(--muted);padding:2rem 0">Projects temporarily unavailable.</p>';
  }
}
