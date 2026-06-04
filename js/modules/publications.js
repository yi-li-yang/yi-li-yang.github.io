// js/modules/publications.js
//
// Renders the publication list from data/publications.json (generated from the .bib SSOT
// by scripts/bib-to-json.js). The owner is bolded from the per-author `isOwner` flag in
// the data — never from markup stored in the JSON. Vanilla, no framework, matching the
// existing dark card design (.publication-card / .publication-meta in components.css).

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderAuthors(authors) {
  return authors
    .map((a) => {
      const name = escapeHtml(a.name);
      if (a.etAl) return `<span class="pub-etal">${name}</span>`;
      return a.isOwner ? `<strong class="pub-owner">${name}</strong>` : name;
    })
    .join(', ');
}

function renderCard(pub) {
  const card = document.createElement('article');
  card.className = 'publication-card';

  const titleHtml = pub.url
    ? `<a href="${escapeHtml(pub.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pub.title)}</a>`
    : escapeHtml(pub.title);

  const metaParts = [];
  if (pub.venue) metaParts.push(`<span>${escapeHtml(pub.venue)}</span>`);
  if (pub.year) metaParts.push(`<span>${pub.year}</span>`);

  card.innerHTML = `
    <h3>${titleHtml}</h3>
    <p class="publication-authors">${renderAuthors(pub.authors)}</p>
    <div class="publication-meta">${metaParts.join('')}</div>
  `;
  return card;
}

export async function initPublications() {
  const container = document.getElementById('publications-grid');
  if (!container) return;

  try {
    const res = await fetch('data/publications.json');
    if (!res.ok) throw new Error(`publications fetch: ${res.status}`);
    const data = await res.json();
    const pubs = data.publications ?? [];

    const frag = document.createDocumentFragment();
    for (const pub of pubs) frag.appendChild(renderCard(pub));
    container.appendChild(frag);
  } catch (err) {
    console.error('Failed to load publications:', err);
    container.innerHTML =
      '<p style="color:var(--color-text-muted);padding:2rem 0">Publications temporarily unavailable.</p>';
  }
}
