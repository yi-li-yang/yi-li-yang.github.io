// SOURCE — you own this file. Edit freely, by hand or by agent.
import { flipIn } from './flip.js';

export async function initStats() {
  const container = document.getElementById('stats');
  if (!container) return;

  try {
    // Two sources: stats.json is machine-written by the ingest, service.json is maintained
    // by hand. They used to be one file with a hand-authored island inside it; splitting
    // them means neither has two writers. service.json is optional — if it fails to load,
    // the ingest-derived cards still render.
    const [res, serviceRes] = await Promise.all([
      fetch('data/stats.json'),
      fetch('data/service.json').catch(() => null),
    ]);
    if (!res.ok) throw new Error(`Stats fetch: ${res.status}`);
    const { profiles, publications, orcid, scholar, lastUpdated } = await res.json();
    const hand = serviceRes?.ok ? await serviceRes.json() : null;

    const scholarLink = `https://scholar.google.com/citations?user=${profiles.scholar}`;
    const orcidLink   = `https://orcid.org/${profiles.orcid}`;

    const pubCount = publications?.count ?? orcid?.works ?? null;

    // Two groups, so the numbers say what kind of evidence they are: what the research has
    // produced (from the ingest), and the service and leadership around it (hand-curated).
    // Each group is four readouts, so the two halves mirror each other at every width (4 side
    // by side, or 2 × 2). Every readout has the same three lines: number, label, and a note
    // (the source, or what the number counts), so every cell has the same height.
    const impact = [
      { value: pubCount,           label: 'Publications', note: 'ORCID',          link: orcidLink },
      { value: scholar?.citations, label: 'Citations',    note: 'Google Scholar', link: scholarLink },
      { value: scholar?.hIndex,    label: 'h-index',      note: 'Google Scholar' },
      { value: scholar?.i10Index,  label: 'i10-index',    note: 'Google Scholar' },
    ];

    // Curated total: ORCID tracks fewer reviews, because some aren't ORCID-registered. The true
    // count lives in data/service.json; fall back to ORCID if it didn't load. The NSF proposal
    // reviews are reviews too, so they are the peer-review readout's note, not a fifth cell.
    const nsf = hand?.nsfProposalReviews;
    const funding = hand?.fundingAwarded;
    const service = [
      {
        value: hand?.peerReviews ?? orcid?.reviews,
        label: 'Peer reviews',
        note: nsf ? `+ ${nsf} NSF proposal review${nsf === 1 ? '' : 's'}` : (hand ? 'Curated' : 'ORCID'),
      },
      { value: funding ? funding.display ?? funding.value : null, label: funding?.label ?? 'Funding', note: 'Awarded' },
      { value: hand?.menteesSupervised, label: 'Mentees', note: 'Supervised' },
      { value: hand?.invitedTalks, label: 'Invited talks', note: 'Career total' },
    ];

    const renderCard = (item) => {
      const card = document.createElement(item.link ? 'a' : 'div');
      card.className = 'stat-card';
      if (item.link) {
        card.href = item.link;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
      }
      card.innerHTML = `
        <span class="stat-value">${item.value}</span>
        <span class="stat-label">${item.label}</span>
        <span class="stat-source">${item.note ?? ''}</span>
      `;
      return card;
    };

    for (const [title, items] of [['Research impact', impact], ['Service & leadership', service]]) {
      const shown = items.filter((item) => item.value != null);
      if (!shown.length) continue;
      const group = document.createElement('div');
      group.className = 'stats-group';
      const label = document.createElement('p');
      label.className = 'stats-group-label';
      label.textContent = title;
      const grid = document.createElement('div');
      grid.className = 'stats-grid';
      grid.append(...shown.map(renderCard));
      group.append(label, grid);
      container.appendChild(group);
    }
    flipIn(container.querySelectorAll('.stat-value'));

    const updated = document.getElementById('stats-updated');
    if (lastUpdated && updated) {
      const formatted = new Date(lastUpdated).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      updated.textContent = `Research figures update monthly from ORCID and Google Scholar · last updated ${formatted}`;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
    const fallback = document.createElement('p');
    fallback.className = 'stats-error';
    fallback.textContent = 'Stats temporarily unavailable.';
    container.appendChild(fallback);
  }
}
