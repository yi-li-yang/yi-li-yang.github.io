// SOURCE — you own this file. Edit freely, by hand or by agent.

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
    const impact = [
      { value: pubCount,           label: 'Publications', source: 'ORCID',  link: orcidLink },
      { value: scholar?.citations, label: 'Citations',    source: 'Scholar', link: scholarLink },
      { value: scholar?.hIndex,    label: 'h-index',      source: 'Scholar' },
      { value: scholar?.i10Index,  label: 'i10-index',    source: 'Scholar' },
    ];

    const service = [
      // Curated total: ORCID tracks fewer, because some reviews aren't ORCID-registered.
      // The true count lives in data/service.json; fall back to ORCID if it didn't load.
      { value: hand?.peerReviews ?? orcid?.reviews, label: 'Peer Reviews', source: 'Curated' },
    ];

    if (hand) {
      if (hand.fundingAwarded) {
        const f = hand.fundingAwarded;
        service.push({ value: f.display ?? f.value, label: f.label ?? 'Funding' });
      }
      if (hand.menteesSupervised != null) {
        service.push({ value: hand.menteesSupervised, label: 'Mentees' });
      }
      if (hand.invitedTalks != null) {
        service.push({ value: hand.invitedTalks, label: 'Invited Talks' });
      }
      if (hand.nsfProposalReviews != null) {
        service.push({ value: hand.nsfProposalReviews, label: 'NSF Proposal Reviews' });
      }
    }

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
        ${item.source ? `<span class="stat-source">${item.source}</span>` : ''}
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
