// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/tools.js
//
// The Tools & Environments logos light up near the pointer, not only under it. Each logo takes
// its own colours in proportion to how near the pointer is: full on the logo, fading to none
// about two columns away. So a pointer anywhere over the grid, the gaps included, lights the
// logos around it. The light comes at once and fades slowly, so a pointer that only crosses
// the grid leaves a trail a reader still sees. The whole path counts, not only where the
// pointer is when the screen redraws, and the page scrolling under a still pointer counts as
// the pointer moving.
//
// Without a pointer that hovers (a phone), the light is a band across the middle of the
// screen, and each row of logos lights up as it scrolls through the band.
//
// Each logo is drawn twice: in ink (how it rests) and, over it, in its own colours with
// opacity --lit (0 to 1). A mark whose own colour is black (data-mono in index.html) lights up
// in ink instead, because black would vanish on the dark ground. Without this script, a logo
// takes its colours on hover only, as before (css/components.css).

const RISE_MS = 30;    // how fast a logo brightens toward its target
const FADE_MS = 900;   // how fast it dims: the trail
const REACH = 1.6;     // the light's radius, in columns of the grid
const BAND_REACH = 1.2;
const MIN_REACH = 150; // px, so a narrow grid still lights its neighbours

export function initTools() {
  const cloud = document.querySelector('.platforms-cloud');
  if (!cloud) return;

  const items = [...cloud.querySelectorAll('.platform-item')];
  const marks = items.map((item) => {
    const logo = item.querySelector('.platform-logo');
    const mark = document.createElement('span');
    mark.className = 'platform-mark';
    logo.replaceWith(mark);
    const lit = logo.cloneNode();
    lit.className = 'platform-logo-lit';
    lit.alt = '';
    lit.setAttribute('aria-hidden', 'true');
    mark.append(logo, lit);
    return mark;
  });
  cloud.classList.add('has-light');

  const hovers = matchMedia('(hover: hover)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const level = items.map(() => 0); // how lit each logo is now
  const peak = items.map(() => 0);  // the most each was lit by the path since the last frame
  const shown = items.map(() => '');
  let pointer = null; // the pointer in the viewport, or null when it is not over the page
  let trace = null;   // where the light last was on the page, in page coordinates
  let near = false;   // the grid is on or near the screen
  let geometry = null;
  let frame = 0;
  let then = 0;

  // The logos' centres in the viewport and the light's radius, measured once per frame.
  function measure() {
    if (geometry) return geometry;
    const box = cloud.getBoundingClientRect();
    const columns = getComputedStyle(cloud).gridTemplateColumns.split(' ').length || 1;
    const pitch = box.width / columns;
    const band = !hovers.matches;
    geometry = {
      band,
      reach: Math.max(pitch * (band ? BAND_REACH : REACH), band ? MIN_REACH * 0.8 : MIN_REACH),
      centres: marks.map((mark) => {
        const r = mark.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }),
    };
    return geometry;
  }

  // Where the light is in the viewport: the pointer, or for a phone the middle of the screen.
  function source() {
    if (!hovers.matches) return { x: innerWidth / 2, y: innerHeight / 2 };
    return pointer;
  }

  // How lit each logo is by a light at (x, y) in the viewport.
  function lightAt(x, y) {
    const { band, reach, centres } = measure();
    return centres.map((c) => {
      const d = Math.hypot(band ? 0 : c.x - x, c.y - y) / reach;
      return d >= 1 ? 0 : (1 - d * d) ** 2;
    });
  }

  // The light moved: light every logo along the way, so a fast pass skips none.
  function follow() {
    const at = source();
    if (!at) { trace = null; return; }
    const here = { x: at.x + scrollX, y: at.y + scrollY };
    if (near && !reduced.matches) {
      const from = trace ?? here;
      const steps = Math.max(1, Math.ceil(Math.hypot(here.x - from.x, here.y - from.y) / (measure().reach / 4)));
      for (let k = 1; k <= steps; k += 1) {
        const x = from.x + ((here.x - from.x) * k) / steps - scrollX;
        const y = from.y + ((here.y - from.y) * k) / steps - scrollY;
        lightAt(x, y).forEach((v, i) => { if (v > peak[i]) peak[i] = v; });
      }
    }
    trace = here;
  }

  function tick(now) {
    const dt = then ? Math.min(now - then, 100) : 16;
    then = now;
    geometry = null;
    const at = source();
    const goal = at ? lightAt(at.x, at.y) : items.map(() => 0);
    let settling = false;
    items.forEach((item, i) => {
      const target = Math.max(goal[i], peak[i]);
      peak[i] = 0;
      const tau = target > level[i] ? RISE_MS : FADE_MS;
      let next = reduced.matches ? target : level[i] + (target - level[i]) * (1 - Math.exp(-dt / tau));
      if (Math.abs(target - next) < 0.004) next = target;
      else settling = true;
      level[i] = next;
      const text = next.toFixed(3);
      if (text !== shown[i]) {
        item.style.setProperty('--lit', text);
        shown[i] = text;
      }
    });
    frame = settling ? requestAnimationFrame(tick) : 0;
    if (!frame) then = 0;
  }

  const wake = () => {
    if (near && !frame) frame = requestAnimationFrame(tick);
  };

  // Work only while the grid is on or near the screen.
  new IntersectionObserver((entries) => {
    near = entries.some((e) => e.isIntersecting);
    trace = null;
    wake();
  }, { rootMargin: '50% 0px' }).observe(cloud);

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointer = { x: e.clientX, y: e.clientY };
    follow();
    wake();
  }, { passive: true });

  addEventListener('scroll', () => {
    geometry = null;
    follow();
    wake();
  }, { passive: true });

  const leave = () => { pointer = null; trace = null; wake(); };
  document.documentElement.addEventListener('pointerleave', leave);
  addEventListener('blur', leave);
  addEventListener('resize', () => { geometry = null; trace = null; wake(); }, { passive: true });
}
