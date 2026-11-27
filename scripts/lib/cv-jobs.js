// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/lib/cv-jobs.js
//
// PURE. The list of partials that make the DEFAULT (untailored) CVs: which template, which
// output file, and which slice of the data each one gets. scripts/render-cv.js renders them;
// test/shells.test.js renders them in memory to check what the PDFs will say. Every
// \input{generated/X} in a .tex shell must have a job here (metrics.tex aside, which
// scripts/emit-metrics-tex.js writes).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

// Degrees grouped under their institution, in file order, with both print forms ready:
// short "BSc Geology" + end year for the one-pager, long "BSc in Geology" + dates for the
// biosketch.
export function educationView(education) {
  return (education.institutions ?? []).map((inst) => ({
    ...inst,
    degrees: (education.degrees ?? [])
      .filter((d) => d.institution === inst.id)
      .map((d) => ({
        ...d,
        short: `${d.level} ${d.subject}`,
        endYear: d.end.slice(0, 4),
        long:
          `${d.level}${d.qualifier ? ` (${d.qualifier})` : ''} in ${d.subject}` +
          `${d.honours ? `, ${d.honours}` : ''}`,
        dates: `${monthYear(d.start)} - ${monthYear(d.end)}`,
      })),
  }));
}

export function canonicalJobs(data) {
  const { experience, skills, awards, collaborations, taglines, profile, education } = data;

  // The default tagline is `null` in data/taglines.json, so the one-pager renders none —
  // matching the CV as it stood before the tagline became a tailoring lever.
  const defaultTagline =
    (taglines.options ?? []).find((t) => t.id === taglines.default) ?? null;

  return [
    {
      template: 'onepage-header.tex.njk',
      out: 'cv/onepage/generated/header.tex',
      src: 'data/profile.json',
      context: { profile },
    },
    {
      template: 'onepage-tagline.tex.njk',
      out: 'cv/onepage/generated/tagline.tex',
      src: 'data/taglines.json',
      context: { tagline: defaultTagline },
    },
    {
      template: 'onepage-skills.tex.njk',
      out: 'cv/onepage/generated/skills.tex',
      src: 'data/skills.json',
      context: { skills },
    },
    {
      template: 'onepage-education.tex.njk',
      out: 'cv/onepage/generated/education.tex',
      src: 'data/education.json',
      context: { institutions: educationView(education) },
    },
    {
      template: 'onepage-links.tex.njk',
      out: 'cv/onepage/generated/links.tex',
      src: 'data/profile.json',
      context: { profile },
    },
    {
      template: 'onepage-experience.tex.njk',
      out: 'cv/onepage/generated/experience.tex',
      src: 'data/experience.json',
      context: { experience },
    },
    {
      // Deliberately empty on the canonical CV: the one-pager reports publication COUNTS
      // (\journalpapers etc.) and has no room for a list too. Tailored variants select a few.
      template: 'onepage-publications.tex.njk',
      out: 'cv/onepage/generated/publications.tex',
      src: 'cv/publications.bib',
      context: { publications: [] },
    },
    {
      template: 'onepage-awards.tex.njk',
      out: 'cv/onepage/generated/awards.tex',
      src: 'data/awards.json',
      context: { awards: awards.awards },
    },
    {
      template: 'onepage-collaborations.tex.njk',
      out: 'cv/onepage/generated/collaborations.tex',
      src: 'data/collaborations.json',
      context: { collaborations },
    },
    {
      template: 'biosketch-experience.tex.njk',
      out: 'cv/biosketch/generated/experience.tex',
      src: 'data/experience.json',
      context: { experience },
    },
  ];
}
