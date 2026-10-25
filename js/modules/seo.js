// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/seo.js
//
// Adds schema.org Person structured data, so search engines can tie this page to the same
// person's ORCID, Scholar, GitHub and LinkedIn profiles. Nothing here is typed: the profile
// ids come from data/stats.json (their authoritative home, written by the ingest), and the
// name and job title are read off this page's own brand and hero eyebrow. Google, the main
// consumer of Person markup, runs JavaScript, so injecting it at runtime is enough.

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
      jobTitle: document.querySelector('.hero-eyebrow')?.textContent.trim(),
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
