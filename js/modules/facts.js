// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/facts.js
//
// The site's view of the CV facts: data/site.json, which `npm run build` derives from the same
// data files that both PDFs read (scripts/build-site-json.js). One fetch, shared by every
// module that asks. It resolves to null when the file is missing or broken, so each caller
// can leave its part empty and the rest of the page still renders.

let pending = null;

export function loadSiteFacts() {
  pending ??= fetch('data/site.json')
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
  return pending;
}

function logoLink({ name, url, src, width, height }) {
  const a = document.createElement('a');
  a.className = 'logo-item';
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  // The name under each logo is drawn by CSS from this label (.logo-item::after).
  a.setAttribute('aria-label', name);
  const img = document.createElement('img');
  img.src = src;
  img.alt = name;
  img.className = 'logo-img';
  img.width = width;
  img.height = height;
  img.loading = 'lazy';
  a.append(img);
  return a;
}

// Fills the hero job title and the Experience / Collaborations logo walls.
export async function initFacts() {
  const facts = await loadSiteFacts();
  if (!facts) return;

  const role = document.getElementById('hero-role');
  if (role && facts.role) role.textContent = facts.role;

  for (const [id, logos] of [
    ['logos-experience', facts.logoWalls?.experience],
    ['logos-collaborations', facts.logoWalls?.collaborations],
  ]) {
    const box = document.getElementById(id);
    if (box && logos?.length) box.replaceChildren(...logos.map(logoLink));
  }
}
