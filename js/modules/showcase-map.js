/* Featured showcase — click-to-load Google Earth Engine map.
 *
 * The markup ships a plain anchor that opens the app in a new tab, so the card
 * works with no JS, on mobile, and if this module never loads. On wide screens
 * we upgrade that anchor to an in-place iframe embed, injected only on click so
 * a heavy third-party app never boots on page load.
 *
 * The 701px floor mirrors the 700px breakpoint in css/components.css — keep the
 * two in sync. Below it we leave the plain link alone: the EE app competes with
 * touch scrolling and is unusable in a phone-width frame.
 */

const EMBED_QUERY = '(min-width: 701px)';
const LOAD_TIMEOUT_MS = 20000;

export function initShowcaseMap() {
  const frame = document.getElementById('rts-live-map');
  const link  = frame?.querySelector('.showcase-map-launch');
  if (!frame || !link) return;

  if (!window.matchMedia(EMBED_QUERY).matches) return;

  const title  = link.querySelector('.showcase-map-launch-title');
  const note   = link.querySelector('.showcase-map-launch-note');
  const poster = Array.from(frame.children);

  if (title) title.textContent = 'Launch the interactive map';
  if (note)  note.textContent  = 'Google Earth Engine · loads on click';

  // idle → loading → live, or → failed (after which the anchor just opens a tab)
  let state = 'idle';

  function restore(message) {
    state = 'failed';
    frame.classList.remove('is-loading', 'is-live');
    frame.replaceChildren(...poster);
    if (title) title.textContent = 'Open the interactive map';
    if (note)  note.textContent  = message;
  }

  /* A cross-origin iframe fires `load` even when the navigation fails — the
   * browser's error page counts — so `load` cannot tell us the app is really
   * there. Probe reachability first: a no-cors GET resolves opaquely when the
   * app answers and rejects when the host is down, blocked, or offline. */
  async function reachable(url) {
    try {
      await fetch(url, { mode: 'no-cors', credentials: 'omit' });
      return true;
    } catch {
      return false;
    }
  }

  link.addEventListener('click', async event => {
    if (state !== 'idle') return;
    event.preventDefault();
    state = 'loading';

    const url = link.href;
    frame.classList.add('is-live', 'is-loading');
    frame.replaceChildren();

    if (!await reachable(url)) {
      console.warn('Earth Engine app is unreachable; restoring the link.');
      restore('Earth Engine did not load here — opens in a new tab');
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.className = 'showcase-map-embed';
    iframe.title = 'Interactive map of mapped retrogressive thaw slumps (Google Earth Engine)';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.setAttribute('allowfullscreen', '');
    iframe.src = url;

    // Backstop for a frame that answers but never finishes loading.
    const timer = setTimeout(() => {
      if (state !== 'loading') return;
      console.warn('Earth Engine app did not load in time; restoring the link.');
      restore('Earth Engine did not load here — opens in a new tab');
    }, LOAD_TIMEOUT_MS);

    iframe.addEventListener('load', () => {
      clearTimeout(timer);
      if (state !== 'loading') return;
      state = 'live';
      frame.classList.remove('is-loading');
    }, { once: true });

    frame.replaceChildren(iframe);
  });
}
