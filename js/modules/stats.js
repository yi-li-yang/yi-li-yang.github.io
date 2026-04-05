export async function initStats() {
  const container = document.getElementById('stats');
  if (!container) return;

  try {
    const res = await fetch('data/stats.json');
    if (!res.ok) throw new Error(`Stats fetch: ${res.status}`);
    const { profiles, orcid, github, scholar, static: manual, lastUpdated } = await res.json();

    const scholarLink = `https://scholar.google.com/citations?user=${profiles.scholar}`;
    const githubLink = `https://github.com/${profiles.github}`;
    const orcidLink = `https://orcid.org/${profiles.orcid}`;

    const items = [
      { value: orcid.works, label: 'Publications', source: 'ORCID', link: orcidLink },
      { value: scholar.citations, label: 'Citations', source: 'Scholar', link: scholarLink },
      { value: scholar.hIndex, label: 'h-index', source: 'Scholar', link: scholarLink },
      { value: scholar.i10Index, label: 'i10-index', source: 'Scholar', link: scholarLink },
      { value: github.repos, label: 'Repositories', source: 'GitHub', link: githubLink },
      { value: github.stars, label: 'Stars', source: 'GitHub', link: githubLink },
      { value: github.commits, label: 'Commits', source: 'GitHub', link: githubLink },
      { value: orcid.reviews, label: 'Peer Reviews', source: 'ORCID', link: orcidLink },
    ];

    // Static hand-maintained metrics
    if (manual) {
      if (manual.fundingAwarded) {
        const f = manual.fundingAwarded;
        items.push({ value: f.display ?? f.value, label: f.label ?? 'Funding', source: 'Manual' });
      }
      if (manual.firstAuthorPapers != null) {
        items.push({ value: manual.firstAuthorPapers, label: 'First-Author Papers', source: 'Manual' });
      }
      if (manual.menteesSupervised != null) {
        items.push({ value: manual.menteesSupervised, label: 'Mentees', source: 'Manual' });
      }
      if (manual.invitedTalks != null) {
        items.push({ value: manual.invitedTalks, label: 'Invited Talks', source: 'Manual' });
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
        <span class="stat-source">${item.source}</span>
      `;
      container.appendChild(card);
    }

    if (lastUpdated) {
      const footer = document.createElement('p');
      footer.className = 'stats-updated';
      const date = new Date(lastUpdated);
      footer.textContent = `Last updated: ${date.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      })}`;
      container.appendChild(footer);
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
    const fallback = document.createElement('p');
    fallback.className = 'stats-error';
    fallback.textContent = 'Stats temporarily unavailable.';
    container.appendChild(fallback);
  }
}
