// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/showcase-tabs.js
//
// On phones, the featured project's three story panels (Science / Engineering / Product)
// become tabs, so the section reads one panel at a time instead of a ~1,000px stack. On wider
// screens the tabs are removed again and the two-column layout in components.css shows all
// three. The ARIA roles exist only while the tabs do, and without JS the panels simply stack.

const PHONE = '(max-width: 720px)';

export function initShowcaseTabs() {
  const wrap = document.querySelector('.showcase-panels');
  const panels = wrap ? [...wrap.querySelectorAll('.showcase-panel')] : [];
  if (panels.length < 2) return;

  const tablist = document.createElement('div');
  tablist.className = 'showcase-tabs';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Project story');

  const tabs = panels.map((panel, i) => {
    panel.id ||= `showcase-panel-${i + 1}`;
    // "01 · Science" -> "Science": the number is the panel's own kicker, not a tab label.
    const kicker = panel.querySelector('.showcase-panel-kicker')?.textContent ?? `Part ${i + 1}`;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'showcase-tab';
    tab.id = `${panel.id}-tab`;
    tab.textContent = kicker.split('·').pop().trim();
    tab.setAttribute('aria-controls', panel.id);
    tablist.appendChild(tab);
    return tab;
  });

  let active = 0;
  const select = (index, focus = false) => {
    active = index;
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
    });
    if (focus) tabs[index].focus();
  };

  tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i)));
  tablist.addEventListener('keydown', (e) => {
    const last = tabs.length - 1;
    const next = { ArrowRight: active === last ? 0 : active + 1, ArrowLeft: active === 0 ? last : active - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(next, true);
  });

  const enable = () => {
    wrap.before(tablist);
    panels.forEach((panel, i) => {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tabs[i].id);
    });
    select(active);
  };

  const disable = () => {
    tablist.remove();
    for (const panel of panels) {
      panel.hidden = false;
      panel.removeAttribute('role');
      panel.removeAttribute('aria-labelledby');
    }
  };

  const phone = window.matchMedia(PHONE);
  const apply = () => (phone.matches ? enable() : disable());
  phone.addEventListener('change', apply);
  apply();
}
