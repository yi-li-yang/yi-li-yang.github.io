import { initStats } from './modules/stats.js';
import { initThoughts } from './modules/thoughts.js';
import { initSkills } from './modules/skills.js';
import { initPublications } from './modules/publications.js';

document.addEventListener('DOMContentLoaded', () => {
  initStats();
  initThoughts();
  initSkills();
  initPublications();
});
