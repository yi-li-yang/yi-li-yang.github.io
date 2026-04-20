
export async function initStats() {
  const container = document.getElementById('stats');
  if (!container) return;

  try {
    const res = await fetch('data/stats.json');
    if (!res.ok) throw new Error(`Stats fetch: ${res.status}`);
    const { profiles, publications, orcid, scholar, static: hand, lastUpdated } =
      await res.json();

    const scholarLink = `https://scholar.google.com/citations?user=${profiles.scholar}`;
    const orcidLink   = `https://orcid.org/${profiles.orcid}`;

    const pubCount = publications?.count ?? orcid?.works ?? null;

    const items = [
      { value: pubCount,           label: 'Publications', source: 'ORCID',  link: orcidLink },
      { value: scholar?.citations, label: 'Citations',    source: 'Scholar', link: scholarLink },
      { value: scholar?.hIndex,    label: 'h-index',      source: 'Scholar' },
      { value: scholar?.i10Index,  label: 'i10-index',    source: 'Scholar' },
      { value: orcid?.reviews,     label: 'Peer Reviews', source: 'ORCID' },
    ];

    if (hand) {
      if (hand.fundingAwarded) {
        const f = hand.fundingAwarded;
        items.push({ value: f.display ?? f.value, label: f.label ?? 'Funding' });
      }
      if (hand.menteesSupervised != null) {
        items.push({ value: hand.menteesSupervised, label: 'Mentees' });
      }
      if (hand.invitedTalks != null) {
        items.push({ value: hand.invitedTalks, label: 'Invited Talks' });
      }
    }

    for (const item of items) {
      if (item.value == null) continue;
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
      container.appendChild(card);
    }

    if (lastUpdated) {
      const date = new Date(lastUpdated);
      const formatted = date.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      });

      const footer = document.createElement('p');
      footer.className = 'stats-updated';
      footer.textContent = `Last updated: ${formatted}`;
      container.appendChild(footer);

      const footerUpdated = document.getElementById('footer-updated');
      if (footerUpdated) footerUpdated.textContent = formatted;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
    const fallback = document.createElement('p');
    fallback.className = 'stats-error';
    fallback.textContent = 'Stats temporarily unavailable.';
    container.appendChild(fallback);
  }
}
