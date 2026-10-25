// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/links.js
//
// Tells screen-reader users which links open a new tab. Sighted users get a ↗ from CSS
// (components.css, "External-link marker"); this adds the spoken equivalent by pointing every
// target=_blank link at one hidden "Opens in a new tab" note. A MutationObserver covers links
// that other modules render after load (publications, project details).

const NOTE_ID = 'new-tab-note';
const SELECTOR = 'a[target="_blank"]:not([aria-describedby])';
// The map launcher embeds in place on wide screens, so the note would be wrong there.
const EXCLUDE = '.showcase-map-launch';

function mark(root) {
  const links = root.matches?.(SELECTOR) ? [root] : [];
  links.push(...root.querySelectorAll(SELECTOR));
  for (const a of links) if (!a.matches(EXCLUDE)) a.setAttribute('aria-describedby', NOTE_ID);
}

export function initLinks() {
  const note = document.createElement('span');
  note.id = NOTE_ID;
  note.hidden = true;
  note.textContent = 'Opens in a new tab';
  document.body.appendChild(note);

  mark(document.body);
  new MutationObserver((mutations) => {
    for (const m of mutations) for (const node of m.addedNodes) if (node.nodeType === 1) mark(node);
  }).observe(document.body, { childList: true, subtree: true });
}
