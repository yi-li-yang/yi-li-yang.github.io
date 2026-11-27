// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/seo.js
//
// Adds schema.org Person structured data, so search engines can tie this page to the same
// person's ORCID, Scholar, GitHub and LinkedIn profiles. Nothing here is typed: the profile
// ids come from data/stats.json (a copy the ingest writes from data/profile.json), the name
// is read off this page's brand, and the job title comes from data/site.json — the same
// value the hero shows, without waiting for the hero to be filled. Google, the main consumer
// of Person markup, runs JavaScript, so injecting it at runtime is enough.

import { loadSiteFacts } from './facts.js';

export async function initSeo() {
  try {
    const res = await fetch('data/stats.json');
    if (!res.ok) return;
    const { profiles } = await res.json();
    if (!profiles) return;

    const sameAs = [
      profiles.orcid && `https://orcid.org/${profiles.orcid}`,
      profiles.scholar && `https://scholar.google.com/citations?user=${profiles.scholar}`,
      profiles.github && `https://github.com/${profiles.github}`,
      profiles.linkedin && `https://www.linkedin.com/in/${profiles.linkedin}`,
    ].filter(Boolean);

    const person = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: document.querySelector('.brand')?.textContent.trim(),
      jobTitle: (await loadSiteFacts())?.role || undefined,
      url: `${location.origin}/`,
      sameAs,
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(person);
    document.head.appendChild(script);
  } catch (err) {
    console.warn('Structured data skipped:', err.message);
  }
}
