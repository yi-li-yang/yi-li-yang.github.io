export async function initStats() {
  const container = document.getElementById('stats');
  if (!container) return;

  const res = await fetch('data/stats.json');
  const { profiles, orcid, github, scholar } = await res.json();

  const items = [
    { value: orcid.works, label: 'Publications', source: 'ORCID', link: `https://orcid.org/${profiles.orcid}` },
    { value: scholar.citations, label: 'Citations', source: 'Scholar', link: `https://scholar.google.com/citations?user=${profiles.scholar}` },
    { value: scholar.hIndex, label: 'h-index', source: 'Scholar', link: `https://scholar.google.com/citations?user=${profiles.scholar}` },
    { value: scholar.i10Index, label: 'i10-index', source: 'Scholar', link: `https://scholar.google.com/citations?user=${profiles.scholar}` },
    { value: github.repos, label: 'Repositories', source: 'GitHub', link: `https://github.com/${profiles.github}` },
    { value: github.stars, label: 'Stars', source: 'GitHub', link: `https://github.com/${profiles.github}` },
    { value: orcid.reviews, label: 'Peer Reviews', source: 'ORCID', link: `https://orcid.org/${profiles.orcid}` }
  ];

  for (const item of items) {
    if (item.value == null) continue;
    const card = document.createElement('a');
    card.className = 'stat-card';
    card.href = item.link;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.innerHTML = `
      <span class="stat-value">${item.value}</span>
      <span class="stat-label">${item.label}</span>
      <span class="stat-source">${item.source}</span>
    `;
    container.appendChild(card);
  }
}
