const LANG_COLORS = {
  Python:             '#3572A5',
  JavaScript:         '#f1e05a',
  TypeScript:         '#3178c6',
  R:                  '#198CE7',
  Shell:              '#89e051',
  'Jupyter Notebook': '#DA5B0B',
  HTML:               '#e34c26',
  CSS:                '#563d7c',
  'C++':              '#f34b7d',
  Go:                 '#00ADD8',
  Rust:               '#dea584',
  Java:               '#b07219',
  MATLAB:             '#bb92ac',
  Dockerfile:         '#384d54',
  Other:              '#4e5260'
};

function langColor(name) {
  return LANG_COLORS[name] ?? '#4e5260';
}

function donutPath(cx, cy, outerR, innerR, a0, a1) {
  const largeArc = a1 - a0 > Math.PI ? 1 : 0;
  const cos0 = Math.cos(a0), sin0 = Math.sin(a0);
  const cos1 = Math.cos(a1), sin1 = Math.sin(a1);
  return [
    `M ${cx + outerR * cos0} ${cy + outerR * sin0}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${cx + outerR * cos1} ${cy + outerR * sin1}`,
    `L ${cx + innerR * cos1} ${cy + innerR * sin1}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${cx + innerR * cos0} ${cy + innerR * sin0}`,
    'Z'
  ].join(' ');
}

function renderInteractiveLangChart(container, languages) {
  if (!languages?.length) return;

  const SIZE = 180, CX = 90, CY = 90, OUTER = 78, INNER = 50, GAP = 0.018;
  let angle = -Math.PI / 2;

  const segments = languages.map(lang => {
    const sweep = (lang.percent / 100) * 2 * Math.PI;
    const a0 = angle + GAP / 2;
    const a1 = angle + sweep - GAP / 2;
    angle += sweep;
    return { ...lang, path: donutPath(CX, CY, OUTER, INNER, a0, a1), color: langColor(lang.name) };
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'lang-chart';

  const tooltip = document.createElement('div');
  tooltip.className = 'lang-tooltip';
  tooltip.style.display = 'none';
  wrapper.appendChild(tooltip);

  const label = document.createElement('p');
  label.className = 'lang-chart-label';
  label.textContent = 'Language breakdown · all repos';
  wrapper.appendChild(label);

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'lang-donut');
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute('aria-label', 'Language breakdown donut chart');
  svg.setAttribute('role', 'img');

  const pathEls = segments.map((s, i) => {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', s.path);
    path.setAttribute('fill', s.color);
    path.style.cursor = 'pointer';
    path.style.transition = 'opacity 150ms ease';

    path.addEventListener('mouseenter', () => {
      pathEls.forEach((p, j) => { p.style.opacity = j === i ? '1' : '0.2'; });
      tooltip.textContent = `${s.name}: ${s.percent.toFixed(1)}%`;
      tooltip.style.display = 'block';
    });

    path.addEventListener('mousemove', e => {
      const rect = wrapper.getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 14) + 'px';
      tooltip.style.top  = (e.clientY - rect.top  - 30) + 'px';
    });

    path.addEventListener('mouseleave', () => {
      pathEls.forEach(p => { p.style.opacity = '1'; });
      tooltip.style.display = 'none';
    });

    svg.appendChild(path);
    return path;
  });

  const legendItems = segments.map(s => `
    <div class="lang-item">
      <span class="lang-dot" style="background:${s.color}"></span>
      <span class="lang-name">${s.name}</span>
      <span class="lang-pct">${s.percent.toFixed(1)}%</span>
    </div>`).join('');

  const body = document.createElement('div');
  body.className = 'lang-chart-body';
  body.appendChild(svg);

  const legend = document.createElement('div');
  legend.className = 'lang-legend';
  legend.innerHTML = legendItems;
  body.appendChild(legend);

  wrapper.appendChild(body);
  container.appendChild(wrapper);
}

export async function initSkills() {
  const githubEl = document.getElementById('github-stats');
  const langEl   = document.getElementById('lang-chart-skills');
  if (!githubEl && !langEl) return;

  try {
    const res = await fetch('data/stats.json');
    if (!res.ok) throw new Error(`stats fetch: ${res.status}`);
    const { profiles, github } = await res.json();

    if (githubEl && github) {
      const githubLink = `https://github.com/${profiles.github}`;
      const items = [
        { value: github.repos,   label: 'Repositories',    source: 'GitHub' },
        { value: github.commits, label: 'All-time Commits', source: 'GitHub' },
      ];
      for (const item of items) {
        if (item.value == null) continue;
        const card = document.createElement('a');
        card.className = 'stat-card';
        card.href = githubLink;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.innerHTML = `
          <span class="stat-value">${item.value}</span>
          <span class="stat-label">${item.label}</span>
          <span class="stat-source">${item.source}</span>
        `;
        githubEl.appendChild(card);
      }
    }

    if (langEl) {
      renderInteractiveLangChart(langEl, github?.languages);
    }
  } catch (err) {
    console.error('Failed to load skills data:', err);
  }
}
