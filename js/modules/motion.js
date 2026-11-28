// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/motion.js
//
// Plays the motion of a Featured image (data/flagships.json, `motion`). The image stays as it
// is; a stack of still frames sits on top of it, and this file scales and fades the frames as
// js/modules/motion-timeline.js says.
//
// The motion plays once, when 60% of the image is in view, and ends on the last frame, where
// the image rests. The pointer on the card, or keyboard focus in it, plays it again: the last
// frame fades back to the first, then the motion runs. One play lasts under 5 seconds and
// stops by itself, so it needs no Pause control (WCAG 2.2.2).
//
// The frames after the first load only when the card is within one screen of the view, and
// the motion starts only when every frame has decoded. If a frame fails, the card keeps its
// image. A reader who asks for reduced motion, or for less data, gets the image only: the
// lengths in css/variables.css are 0 for reduced motion, and no frame is requested.

import { playLength, frameAt } from './motion-timeline.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const IN_VIEW = 0.6;

// A step of the screen that takes longer than this counts as this long. So a play that the
// browser paused (a hidden tab) carries on from where it was and does not jump to its end.
const LONGEST_STEP = 50;

// A CSS time (`320ms`, `0.3s`) as a number of milliseconds.
export function cssTime(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000 || 0;
}

function timingsOf(kind) {
  const zoom = kind === 'zoom';
  return {
    lead: cssTime('--motion-lead'),
    move: cssTime(zoom ? '--motion-dive' : '--motion-dissolve'),
    hold: zoom ? 0 : cssTime('--motion-dissolve-hold'),
    back: cssTime('--motion-back'),
  };
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// `card` is the whole card, `media` the image link, `still` the image in it, `tags` the stack
// of labels on the image, and `credit` the node that holds the image's credit, if it has one.
// A frame may carry its own `caption` and `credit`; they show while that frame is in view.
export function mountMotion({ card, media, still, tags, credit, motion }) {
  const frames = motion?.frames ?? [];
  if (frames.length < 2) return;
  const kind = motion.kind === 'zoom' ? 'zoom' : 'dissolve';
  const last = frames.length - 1;

  // The caption of the first frame belongs to the still image, so it shows with no motion too.
  const caption = frames.some((frame) => frame.caption) ? make('span', 'flagship-caption', frames[0].caption ?? '') : null;
  if (caption) tags.prepend(caption);

  if (reducedMotion.matches || navigator.connection?.saveData) return;
  const timings = timingsOf(kind);
  if (!playLength(kind, frames.length, timings)) return;

  // One node for each credit. A change of credit swaps the nodes, each in its own place, so
  // nothing on the page moves (a longer text in one node would move its left edge).
  const restCredit = credit?.textContent ?? '';
  const credits = new Map();
  if (credit) {
    credits.set(restCredit, credit);
    for (const frame of frames) {
      if (!frame.credit || credits.has(frame.credit)) continue;
      const node = make('span', credit.className, frame.credit);
      node.hidden = true;
      credit.after(node);
      credits.set(frame.credit, node);
    }
  }

  let stack = null;
  let layers = [];
  let loading = null;
  let ready = false;
  let playing = false;
  let played = false;
  let replay = false;
  let total = 0;
  let elapsed = 0;
  let previous = 0;
  let shown = new Set();
  let label = 0;
  let inView = false;

  function load() {
    loading ??= (async () => {
      stack = make('div', `flagship-frames is-${kind}`);
      layers = frames.map((frame) => {
        const img = document.createElement('img');
        Object.assign(img, { alt: '', decoding: 'async', src: frame.src });
        return img;
      });
      stack.append(...layers);
      still.after(stack);
      try {
        await Promise.all(layers.map((img) => img.decode()));
        ready = true;
      } catch {
        // A frame is missing or broken: the card keeps its still image.
        stack.remove();
      }
      return ready;
    })();
    return loading;
  }

  // Shows the caption and the credit of one frame.
  function setLabel(index) {
    if (index === label) return;
    label = index;
    if (caption) caption.textContent = frames[index].caption ?? '';
    const text = frames[index].credit ?? restCredit;
    for (const [value, node] of credits) node.hidden = value !== text;
  }

  function show(drawn) {
    for (const index of shown) if (!drawn.has(index)) layers[index].classList.remove('is-on');
    shown = drawn;
  }

  function draw(now) {
    elapsed += Math.min(Math.max(now - previous, 0), LONGEST_STEP);
    previous = now;
    if (elapsed >= total) {
      // The play is over: the image rests on the last frame, alone and whole.
      const img = layers[last];
      img.style.transform = '';
      img.style.opacity = '';
      img.classList.remove('is-soft');
      img.classList.add('is-on');
      show(new Set([last]));
      setLabel(last);
      stack.classList.remove('is-moving');
      playing = false;
      return;
    }
    const frame = frameAt(kind, frames.length, timings, elapsed, replay);
    const drawn = new Set();
    for (const layer of frame.layers) {
      const img = layers[layer.index];
      img.style.transform = `scale(${layer.scale})`;
      img.style.opacity = layer.opacity;
      img.style.setProperty('--soft', layer.soft);
      img.classList.toggle('is-soft', layer.soft > 0);
      img.classList.add('is-on');
      drawn.add(layer.index);
    }
    show(drawn);
    setLabel(frame.label);
    requestAnimationFrame(draw);
  }

  function play() {
    if (!ready || playing) return;
    playing = true;
    replay = played;
    played = true;
    total = playLength(kind, frames.length, timings, replay);
    elapsed = 0;
    previous = performance.now();
    stack.classList.add('is-moving');
    // The browser may have dropped the decoded frames since they loaded; ask again, do not wait.
    for (const img of layers) img.decode().catch(() => {});
    requestAnimationFrame(draw);
  }

  // Load the frames when the card comes within one screen of the view.
  const near = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    near.disconnect();
    load();
  }, { rootMargin: '100% 0px' });
  near.observe(media);

  // The first play: when most of the image is in view.
  const first = new IntersectionObserver(async ([entry]) => {
    inView = entry.intersectionRatio >= IN_VIEW;
    if (!inView || played) return;
    if (await load() && inView && !played) play();
    if (played) first.disconnect();
  }, { threshold: [0, IN_VIEW] });
  first.observe(media);

  // Again: the pointer on the card, or keyboard focus in it.
  const again = async () => { if (await load()) play(); };
  card.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') again(); });
  card.addEventListener('focusin', again);
}
