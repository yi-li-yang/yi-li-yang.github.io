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

// Every title should be clickable. When the .bib carries a real DOI/URL we link straight
// to it; otherwise we fall back to a Google Scholar title search so the paper is still
// findable (honest — it's a search, not a fabricated DOI). Add DOIs to the .bib to upgrade
// any of these to a direct link.
function linkFor(pub) {
  if (pub.url) return pub.url;
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(pub.title)}`;
}

function renderCard(pub) {
  const card = document.createElement('article');
  card.className = 'publication-card';

  const href = linkFor(pub);
  const titleHtml = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pub.title)}</a>`;

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

// How many publications to show before the list collapses behind a "Show all" toggle.
const COLLAPSE_AFTER = 6;

export async function initPublications() {
  const container = document.getElementById('publications-grid');
  if (!container) return;

  try {
    const res = await fetch('data/publications.json');
    if (!res.ok) throw new Error(`publications fetch: ${res.status}`);
    const data = await res.json();
    const pubs = data.publications ?? [];

    const cards = pubs.map(renderCard);
    const frag = document.createDocumentFragment();
    for (const c of cards) frag.appendChild(c);
    container.appendChild(frag);

    // Collapse long lists so the section doesn't dominate the page: hide the cards beyond
    // COLLAPSE_AFTER until the reader opts in. Pure JS so it stays correct regardless of how
    // many columns the grid wraps into.
    if (pubs.length > COLLAPSE_AFTER) {
      const overflow = cards.slice(COLLAPSE_AFTER);
      let collapsed = true;
      const apply = () => {
        for (const c of overflow) c.style.display = collapsed ? 'none' : '';
      };
      apply();

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'btn btn-secondary publications-toggle';
      const setLabel = () => {
        toggle.textContent = collapsed ? `Show all ${pubs.length} publications` : 'Show fewer';
      };
      setLabel();
      toggle.addEventListener('click', () => {
        collapsed = !collapsed;
        apply();
        setLabel();
      });
      container.insertAdjacentElement('afterend', toggle);
    }
  } catch (err) {
    console.error('Failed to load publications:', err);
    container.innerHTML =
      '<p style="color:var(--color-text-muted);padding:2rem 0">Publications temporarily unavailable.</p>';
  }
}
