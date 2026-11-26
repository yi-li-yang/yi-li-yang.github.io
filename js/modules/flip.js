// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/flip.js
//
// Every number on the page flips into its value the first time it scrolls into view, in under
// a second, and then holds still: each digit rolls up through 0-9, like an odometer, and stops
// on its value, the left digits first. Only the digits move: separators, signs and units (",",
// ".", "~$", "K", "%") and the words around a count stay where they are, and each digit keeps
// the width of the digit it lands on, so nothing next to a number shifts. When a number lands,
// its element holds its plain text again.
//
// A screen reader reads the final value at once (a visually hidden copy). Nothing moves for a
// reader who asks for reduced motion, and a printed page shows the values.
//
// Use: flipIn(elements) on numbers the page has just drawn. An element is flipped only if it
// holds plain text with at least one number in it.

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const pending = new Map(); // element -> { final, visual, start, running }
let watcher = null;

function span(className, text) {
  const s = document.createElement('span');
  if (className) s.className = className;
  if (text != null) s.textContent = text;
  return s;
}

function softOut() {
  return getComputedStyle(document.documentElement).getPropertyValue('--soft-out').trim() || 'ease-out';
}

// "19 projects · 3 tracks" -> [19][" projects · "][3][" tracks"]
function split(text) {
  const parts = [];
  let at = 0;
  for (const m of text.matchAll(NUMBER)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index) });
    parts.push({ text: m[0], number: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

// Draws the number at its start (zeros) into `visual`: each digit is a cell that keeps the
// hidden final digit for its width and baseline, with a strip of digits over it, clipped to it.
// Returns start(delay), which rolls the strips and resolves when every digit has landed.
function build(visual, parts) {
  const strips = [];
  for (const part of parts) {
    if (!part.number) { visual.append(part.text); continue; }
    for (const ch of part.text) {
      if (!/\d/.test(ch)) { visual.append(ch); continue; }
      const steps = 10 + Number(ch); // one full turn, then on to the digit
      const strip = span('flip-strip');
      for (let k = 0; k <= steps; k += 1) strip.append(span(null, String(k % 10)));
      const cell = span('flip-cell');
      cell.append(span('flip-hold', ch), strip);
      visual.append(cell);
      strips.push({ strip, steps });
    }
  }
  return (delay) => {
    const easing = softOut();
    return Promise.all(strips.map(({ strip, steps }, i) => strip.animate(
      [{ transform: 'translateY(0)' }, { transform: `translateY(${(-steps / (steps + 1)) * 100}%)` }],
      { duration: 520 + i * 70, delay, easing, fill: 'forwards' },
    ).finished));
  };
}

// The number has landed (or the page is printing): put its plain text back, unless the page
// has already rewritten the element (a filter count, for example).
function land(el) {
  const job = pending.get(el);
  if (!job) return;
  pending.delete(el);
  watcher?.unobserve(el);
  if (el.contains(job.visual)) el.textContent = job.final;
}

function watch() {
  watcher ??= new IntersectionObserver((entries) => {
    // Numbers that come into view together flip one after another, top-left first.
    const shown = entries
      .filter((e) => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top
        || a.boundingClientRect.left - b.boundingClientRect.left);
    shown.forEach((entry, i) => {
      const el = entry.target;
      const job = pending.get(el);
      if (!job || job.running) return;
      job.running = true;
      watcher.unobserve(el);
      job.start(Math.min(i, 6) * 40).then(() => land(el));
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  return watcher;
}

addEventListener('beforeprint', () => {
  for (const el of [...pending.keys()]) land(el);
});

export function flipIn(elements) {
  if (reduced.matches || !('IntersectionObserver' in window) || !Element.prototype.animate) return;
  const list = elements instanceof Element ? [elements] : [...(elements ?? [])];
  for (const el of list) {
    if (!el || pending.has(el) || el.children.length) continue;
    const final = el.textContent;
    const parts = split(final);
    if (!parts.some((p) => p.number)) continue;
    const visual = span('flip-visual');
    visual.setAttribute('aria-hidden', 'true');
    const start = build(visual, parts);
    el.replaceChildren(span('flip-sr', final.trim()), visual);
    pending.set(el, { final, visual, start, running: false });
    watch().observe(el);
  }
}
