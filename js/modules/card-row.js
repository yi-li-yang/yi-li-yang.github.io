// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/card-row.js
//
// A card row: one sideways row of cards. When the cards all fit, it is a plain row and nothing
// moves. When they do not, it rotates, and it says so: the row fades out at the edge that has
// more cards, with an arrow on the fade, and the first time the row comes into view it nudges
// sideways once and back. After that only the reader moves it: a swipe, a sideways scroll
// (trackpad, or Shift with the wheel), an arrow, or Tab to a card. Nothing rotates on a timer,
// and the vertical wheel always scrolls the page.
//
// The row itself is CSS scroll-snap (components.css, "Card rows"), so it still swipes without
// this module. Its sizes are CSS too, per breakpoint on the row's kind (card-row--flagships,
// --tiles, --papers): --row-per-view is how many whole cards show, and --row-peek-size how
// much of the next card shows under the fade. This module reads --row-per-view back to tell
// whether the cards fit.
//
// Used by flagships.js (Featured), thoughts.js (each Projects track) and publications.js.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const NUDGE_MS = 900;
const NUDGE_GAP_MS = 250;
const ANNOUNCE_AFTER_MS = 500;

// Rows that come into view together nudge one after another, not all at once.
let nudges = Promise.resolve();
let rows = 0;

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function arrow(className, label, glyph, controls) {
  const button = el('button', className, glyph);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-controls', controls);
  return button;
}

/**
 * Turns `track` (an element whose children are the cards) into a card row, in place. `kind`
 * picks the sizes in CSS and `label` names the row for screen readers. Call it once the track
 * is in the document. Returns { row, viewport, refresh, reset, scrollToItem }.
 */
export function enhanceCardRow(track, { kind, label } = {}) {
  const id = `card-row-${++rows}`;
  const row = el('div', `card-row card-row--${kind}`);
  row.setAttribute('role', 'region');
  row.setAttribute('aria-roledescription', 'carousel');
  if (label) row.setAttribute('aria-label', label);
  const viewport = el('div', 'card-row-viewport');
  viewport.id = `${id}-viewport`;
  track.classList.add('card-row-track');
  if (track.parentNode) track.replaceWith(row);
  viewport.append(track);

  const prev = arrow('card-row-edge card-row-edge-prev', 'Previous cards', '‹', viewport.id);
  const next = arrow('card-row-edge card-row-edge-next', 'Next cards', '›', viewport.id);
  // What a screen reader hears once the row settles, instead of every step of a scroll.
  const status = el('span', 'card-row-status');
  status.setAttribute('aria-live', 'polite');
  row.append(viewport, prev, next, status);

  const items = () => [...track.children].filter((item) => item.getClientRects().length > 0);
  const perView = () => Math.max(1, Math.floor(parseFloat(getComputedStyle(row).getPropertyValue('--row-per-view')) || 1));
  // Snapped cards sit this far in from the left edge, so the previous card shows a little there.
  const inset = () => parseFloat(getComputedStyle(viewport).scrollPaddingInlineStart) || 0;
  let overflow = false;

  // The cards wholly inside the viewport, as indexes into the visible cards.
  const shown = () => {
    const list = items();
    const left = viewport.scrollLeft;
    const right = left + viewport.clientWidth;
    let first = -1;
    let last = -1;
    list.forEach((item, i) => {
      if (item.offsetLeft >= left - 2 && item.offsetLeft + item.offsetWidth <= right + 2) {
        if (first < 0) first = i;
        last = i;
      }
    });
    // A card wider than the viewport is never wholly inside it; count the one at the left edge.
    if (first < 0) first = last = Math.max(0, list.findIndex((item) => item.offsetLeft + item.offsetWidth > left + 2));
    return { first, last, total: list.length };
  };

  const update = () => {
    if (!overflow) return;
    const max = viewport.scrollWidth - viewport.clientWidth;
    const atStart = viewport.scrollLeft <= 1;
    const atEnd = viewport.scrollLeft >= max - 1;
    prev.disabled = atStart;
    next.disabled = atEnd;
    row.dataset.atStart = String(atStart);
    row.dataset.atEnd = String(atEnd);
  };

  let announceTimer = 0;
  const announce = () => {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      const { first, last, total } = shown();
      status.textContent = first === last ? `Card ${first + 1} of ${total}` : `Cards ${first + 1} to ${last + 1} of ${total}`;
    }, ANNOUNCE_AFTER_MS);
  };

  const leftFor = (item) => Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, item.offsetLeft - inset()));

  // One press moves one view's worth of cards; scroll-snap lands it on a card's edge.
  const page = (direction) => {
    const list = items();
    const target = list[Math.min(list.length - 1, Math.max(0, shown().first + direction * perView()))];
    if (target) viewport.scrollTo({ left: leftFor(target), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  };

  const refresh = () => {
    overflow = items().length > perView();
    row.dataset.overflow = String(overflow);
    if (!overflow) {
      viewport.scrollLeft = 0;
      delete row.dataset.atStart;
      delete row.dataset.atEnd;
    }
    update();
  };

  // A card that takes focus comes wholly into view. Browsers leave a partly visible element
  // where it is, and the card under the fade is partly visible, so Tab onto it would stay hidden.
  track.addEventListener('focusin', (event) => {
    const item = items().find((card) => card.contains(event.target));
    if (!item) return;
    const left = viewport.scrollLeft;
    const width = viewport.clientWidth;
    const start = item.offsetLeft;
    const end = start + item.offsetWidth;
    if (start >= left + inset() - 1 && end <= left + width + 1) return;
    // To the left, its start; to the right, the first card edge that brings its end into view.
    const target = start < left + inset() ? item : (items().find((card) => card.offsetLeft - inset() >= end - width - 1) ?? item);
    viewport.scrollTo({ left: leftFor(target), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  });

  prev.addEventListener('click', () => page(-1));
  next.addEventListener('click', () => page(1));

  let frame = 0;
  viewport.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); });
    announce();
  }, { passive: true });

  new ResizeObserver(refresh).observe(viewport);

  // ── The one nudge ────────────────────────────────────────
  // Once per row per visit, only if the row rotates, never under reduced motion, and never
  // after the reader has already touched, scrolled or tabbed into it.
  let touched = false;
  for (const type of ['pointerdown', 'wheel', 'keydown', 'focusin', 'touchstart']) {
    row.addEventListener(type, () => { touched = true; }, { passive: true });
  }
  viewport.addEventListener('scroll', () => { touched = true; }, { passive: true });

  const nudge = () => new Promise((done) => {
    if (touched || !overflow || reducedMotion.matches) { done(); return; }
    const first = items()[0];
    track.style.setProperty('--nudge', `${-Math.round(Math.min(48, first.offsetWidth * 0.15))}px`);
    row.dataset.nudged = 'true';
    const end = () => { track.classList.remove('is-nudging'); done(); };
    track.addEventListener('animationend', end, { once: true });
    setTimeout(end, NUDGE_MS + 200);
    track.classList.add('is-nudging');
  });

  const seen = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    seen.disconnect();
    nudges = nudges.then(nudge).then(() => wait(NUDGE_GAP_MS));
  }, { threshold: 0.6 });
  seen.observe(row);

  refresh();

  return {
    row,
    viewport,
    refresh,
    // Back to the first card at once, e.g. after a filter changes which cards are shown.
    reset: () => { viewport.scrollLeft = 0; update(); },
    // Brings one card into view at once, e.g. for a deep link to it.
    scrollToItem: (item) => { viewport.scrollLeft = leftFor(item); update(); },
  };
}
