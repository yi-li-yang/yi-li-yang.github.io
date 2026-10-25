// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/nav.js
//
// Scroll-spy: marks the nav link of the section currently in view with aria-current, which
// css/base.css styles. A section counts as "in view" when it crosses a line ~40% down the
// viewport, so exactly one section is active at a time. Sections with no nav link (the hero)
// clear the mark. On phones the nav scrolls sideways, so the active link is kept visible.

export function initNav() {
  const nav = document.getElementById('site-nav');
  if (!nav || !('IntersectionObserver' in window)) return;

  const links = new Map();
  for (const a of nav.querySelectorAll('a[href^="#"]')) links.set(a.getAttribute('href').slice(1), a);

  const setActive = (id) => {
    for (const [key, a] of links) {
      if (key === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    const active = links.get(id);
    if (!active || nav.scrollWidth <= nav.clientWidth) return;
    const navBox = nav.getBoundingClientRect();
    const linkBox = active.getBoundingClientRect();
    if (linkBox.left < navBox.left || linkBox.right > navBox.right) {
      nav.scrollBy({ left: linkBox.left - navBox.left - 16, behavior: 'smooth' });
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
    },
    { rootMargin: '-40% 0px -59% 0px' },
  );
  for (const section of document.querySelectorAll('main > section[id]')) observer.observe(section);
}
