// SOURCE — you own this file. Edit freely, by hand or by agent.
import { initStats } from './modules/stats.js';
import { initThoughts } from './modules/thoughts.js';
import { initSkills } from './modules/skills.js';
import { initPublications } from './modules/publications.js';
import { initShowcaseMap } from './modules/showcase-map.js';
import { initShowcaseTabs } from './modules/showcase-tabs.js';
import { initNav } from './modules/nav.js';
import { initLinks } from './modules/links.js';
import { initContact } from './modules/contact.js';
import { initSeo } from './modules/seo.js';

document.addEventListener('DOMContentLoaded', () => {
  initLinks();
  initNav();
  initContact();
  initStats();
  initThoughts();
  initSkills();
  initPublications();
  initShowcaseMap();
  initShowcaseTabs();
  initSeo();
});
