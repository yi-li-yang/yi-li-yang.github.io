import { initStats } from './modules/stats.js';
import { initThoughts } from './modules/thoughts.js';
import { initSkills } from './modules/skills.js';

document.addEventListener('DOMContentLoaded', () => {
  initStats();
  initThoughts();
  initSkills();

  const navToggle = document.querySelector('.nav-toggle');
  const siteNav = document.getElementById('site-nav');
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      siteNav.classList.toggle('open');
    });
  }
});
