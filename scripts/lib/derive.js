// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/lib/derive.js
//
// PURE, OFFLINE. Every count that summarises a list lives here, once. The CV macros
// (emit-metrics-tex.js), the citation resolver (lib/tokens.js) and the site's derived file
// (build-site-json.js) all read derivedFacts(), so the PDFs, the site and the applications
// cannot disagree about a number.
//
// The rule behind it: a number is either typed alone (data/service.json, when no list of the
// counted things exists) or counted from a list here. Never both.
//
// The validators run inside loadData(), so a malformed list stops every build with a message
// that names the entry, before LaTeX or the browser meets it.

const ROLES = new Set(['talk', 'panel', 'participant']);

// One person, however their name is spaced or capitalised.
const personKey = (name) => String(name).trim().replace(/\s+/g, ' ').toLowerCase();

export function validateMentorship(mentorship) {
  const spelling = new Map();
  for (const project of mentorship.projects ?? []) {
    for (const { name } of project.mentees ?? []) {
      const key = personKey(name);
      const seen = spelling.get(key);
      if (seen !== undefined && seen !== name) {
        throw new Error(
          `data/mentorship.json: one person is spelled two ways: "${seen}" and "${name}" ` +
            `(project ${project.id}). Use one spelling.`,
        );
      }
      spelling.set(key, name);
    }
  }
}

export function menteeCount(mentorship) {
  const people = new Set();
  for (const project of mentorship.projects ?? []) {
    for (const { name } of project.mentees ?? []) people.add(personKey(name));
  }
  return people.size;
}

export function validateTalks(talks) {
  for (const e of talks.entries ?? []) {
    const where = `data/talks.json entry "${e.id}"`;
    const occ = e.occurrences ?? [];
    if (!occ.length) throw new Error(`${where} has no occurrences.`);
    const years = new Set();
    for (const o of occ) {
      if (!Number.isInteger(o.year)) throw new Error(`${where}: year must be an integer.`);
      if (years.has(o.year)) throw new Error(`${where}: ${o.year} appears twice.`);
      years.add(o.year);
      if (!ROLES.has(o.role)) throw new Error(`${where}: unknown role "${o.role}".`);
      if (typeof o.invited !== 'boolean') throw new Error(`${where}: invited must be true or false.`);
    }
    if (new Set(occ.map((o) => o.invited)).size > 1) {
      throw new Error(`${where}: its years disagree on "invited". Split it into two entries.`);
    }
    if (occ[0].invited && new Set(occ.map((o) => o.role)).size > 1) {
      throw new Error(`${where}: an invited entry must keep one role. Split it into two entries.`);
    }
  }
}

export function talkCounts(talks) {
  const all = (talks.entries ?? []).flatMap((e) => e.occurrences ?? []);
  const invitedTalksPanels = all.filter((o) => o.invited && (o.role === 'talk' || o.role === 'panel')).length;
  return {
    occurrences: all.length,
    invited: all.filter((o) => o.invited).length,
    invitedTalksPanels,
    conferences: all.length - invitedTalksPanels,
  };
}

export function fundingTotal(awards) {
  return (awards.awards ?? []).reduce((sum, a) => sum + (a.amount?.value ?? 0), 0);
}

// "~$100K" for 99,749: two significant figures, K below a million, M from a million.
export function fundingDisplay(value) {
  if (!value) return null;
  const rounded = Number(value.toPrecision(2)); // 999,999 rounds to 1,000,000, so pick the unit after
  const [unit, div] = rounded >= 1e6 ? ['M', 1e6] : ['K', 1e3];
  return `~$${Number((rounded / div).toPrecision(2))}${unit}`;
}

export function derivedFacts(data) {
  const talks = talkCounts(data.talks);
  const total = fundingTotal(data.awards);
  return {
    menteeCount: menteeCount(data.mentorship),
    invitedTalksPanels: talks.invitedTalksPanels,
    conferences: talks.conferences,
    invitedCount: talks.invited,
    fundingTotal: total,
    fundingDisplay: fundingDisplay(total),
  };
}

// Prose in the data layer is LaTeX, so a bare &, %, # or _ breaks the PDF build with an error
// that points at a generated file. Catch it here instead, naming the source file and key.
// Keys that hold addresses or file paths are not prose and are skipped.
const NOT_PROSE = new Set(['url', 'src', 'email', 'workEmail', 'website', 'logo', 'profiles']);
const BARE = /(^|[^\\])[&%#_]/;

export function assertNoBareSpecials(value, file, key = '') {
  if (typeof value === 'string') {
    if (BARE.test(value)) {
      throw new Error(`${file}: "${key}" has a bare LaTeX special (& % # _); escape it with \\.`);
    }
  } else if (Array.isArray(value)) {
    for (const v of value) assertNoBareSpecials(v, file, key);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (!NOT_PROSE.has(k) && !k.startsWith('_')) assertNoBareSpecials(v, file, k);
    }
  }
}
