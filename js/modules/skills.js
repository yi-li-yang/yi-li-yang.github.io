// SOURCE — you own this file. Edit freely, by hand or by agent.
import { flipIn } from './flip.js';

// Languages are groups, so they take the visual system's group colours, in order of size:
// Earth 6 for up to six languages, Earth 8 for seven or eight. The values are custom
// properties from css/visual-preference/tokens.css, so the chart follows the theme. More than
// eight named languages are folded into "Other", which stays neutral.
const EARTH_6 = ['sky', 'rust', 'spruce', 'sand', 'dusk', 'ochre'];
const EARTH_8 = ['glacier', 'rust', 'spruce', 'sand', 'dusk', 'rose', 'olive', 'sky'];
const OTHER_COLOR = 'var(--edge)';

function colourLangs(languages) {
  const named = languages.filter(l => l.name !== 'Other');
  const rest = languages.filter(l => l.name === 'Other');
  const kept = named.slice(0, EARTH_8.length);
  const folded = named.slice(EARTH_8.length).concat(rest);
  const palette = kept.length <= EARTH_6.length ? EARTH_6 : EARTH_8;
  const out = kept.map((l, i) => ({ ...l, color: `var(--data-${palette[i]})` }));
  if (folded.length) {
    const bytes = folded.reduce((s, l) => s + l.bytes, 0);
    const percent = folded.reduce((s, l) => s + l.percent, 0);
    out.push({ name: 'Other', bytes, percent, color: OTHER_COLOR });
  }
  return out;
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

function renderPillCluster(container, tags) {
  if (!container || !Array.isArray(tags)) return;
  container.innerHTML = '';
  for (const tag of tags) {
    const pill = document.createElement('span');
    pill.className = 'pill-tag';
    pill.textContent = tag;
    container.appendChild(pill);
  }
}

// ── The Skills section ───────────────────────────────────
// data/pill-tags.json's skill groups, drawn as trees: each group is a root with a branch to
// each skill. The branches grow in, one after another, when the section first scrolls into
// view, and hovering a skill dims its siblings. The tree draws only what the data says: a
// group, its skills, and how many there are. Nothing is ranked or scored, because the data
// holds no level for a skill.

function node(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

function renderPillCategories(container, categories) {
  if (!container || !Array.isArray(categories)) return;
  container.replaceChildren();
  for (const category of categories) {
    const tree = node('div', 'skill-tree');
    const root = node('h3', 'skill-tree-root');
    root.append(node('span', null, category.title), node('span', 'skills-count', String(category.tags.length)));
    const branches = node('ul', 'skill-tree-branches');
    category.tags.forEach((tag, i) => {
      const leaf = node('li', 'skill-tree-leaf');
      leaf.style.setProperty('--i', i);
      leaf.appendChild(node('span', 'skill-tree-label', tag));
      branches.appendChild(leaf);
    });
    tree.append(root, branches);
    container.appendChild(tree);
  }

  flipIn(container.querySelectorAll('.skills-count'));

  const drawn = () => container.classList.add('is-drawn');
  if (!('IntersectionObserver' in window)) { drawn(); return; }
  const watch = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { drawn(); watch.disconnect(); }
  }, { threshold: 0.25 });
  watch.observe(container);
}

async function fetchPillTags() {
  try {
    const res = await fetch('data/pill-tags.json');
    if (!res.ok) throw new Error(`pill tags fetch: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Could not load pill tags:', err.message);
    return null;
  }
}

function renderPillTags(tagData) {
  if (!tagData) return;
  renderPillCluster(document.getElementById('hero-pills-geoscience'), tagData.hero?.geoscience);
  renderPillCluster(document.getElementById('hero-pills-data-science'), tagData.hero?.dataScience);
  renderPillCategories(document.getElementById('capabilities-skills'), tagData.skillSections);
}

function normalizeLangs(languages) {
  if (!languages?.length) return languages;
  const merged = languages.reduce((acc, lang) => {
    const key = lang.name === 'Jupyter Notebook' ? 'Python' : lang.name;
    if (!acc[key]) acc[key] = { name: key, bytes: 0 };
    acc[key].bytes += lang.bytes;
    return acc;
  }, {});
  const total = Object.values(merged).reduce((s, l) => s + l.bytes, 0);
  return Object.values(merged)
    .map(l => ({ ...l, percent: (l.bytes / total) * 100 }))
    .sort((a, b) => b.bytes - a.bytes);
}

function renderInteractiveLangChart(container, languages) {
  if (!languages?.length) return;

  const SIZE = 180, CX = 90, CY = 90, OUTER = 78, INNER = 50, GAP = 0.018;
  let angle = -Math.PI / 2;

  const segments = colourLangs(languages).map(lang => {
    const sweep = (lang.percent / 100) * 2 * Math.PI;
    const a0 = angle + GAP / 2;
    const a1 = angle + sweep - GAP / 2;
    angle += sweep;
    return { ...lang, path: donutPath(CX, CY, OUTER, INNER, a0, a1) };
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'lang-chart';

  const tooltip = document.createElement('div');
  tooltip.className = 'lang-tooltip';
  tooltip.style.display = 'none';
  wrapper.appendChild(tooltip);

  const head = document.createElement('div');
  head.className = 'lang-chart-head';
  const label = document.createElement('p');
  label.className = 'lang-chart-label';
  label.textContent = 'Language breakdown · all repos';
  head.appendChild(label);
  wrapper.appendChild(head);

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'lang-donut');
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute('aria-label', 'Language breakdown donut chart');
  svg.setAttribute('role', 'img');

  const pathEls = segments.map((s, i) => {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', s.path);
    path.style.fill = s.color;
    path.style.cursor = 'pointer';
    path.style.transition = 'opacity var(--transition)';

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
  flipIn(legend.querySelectorAll('.lang-pct'));
}

export async function initSkills() {
  const githubEl = document.getElementById('github-stats');
  const langEl   = document.getElementById('lang-chart-skills');
  const pillEl   = document.getElementById('capabilities-skills');
  if (!githubEl && !langEl && !pillEl) return;

  try {
    const [statsRes, pillData] = await Promise.all([
      fetch('data/stats.json'),
      fetchPillTags()
    ]);

    if (statsRes.ok) {
      const { profiles, github } = await statsRes.json();

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
        flipIn(githubEl.querySelectorAll('.stat-value'));
      }

      if (langEl) {
        renderInteractiveLangChart(langEl, normalizeLangs(github?.languages));
      }

      // As two lone cards the repo and commit counts floated beside empty space; in the
      // chart's header row they caption it. If the chart didn't render, they stay as cards.
      const chartHead = langEl?.querySelector('.lang-chart-head');
      if (chartHead && githubEl?.childElementCount) chartHead.appendChild(githubEl);
    } else {
      console.warn(`Stats fetch failed: ${statsRes.status}`);
    }

    renderPillTags(pillData);
  } catch (err) {
    console.error('Failed to load skills data:', err);
  }
}
