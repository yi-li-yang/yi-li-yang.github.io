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
  // "conferenceEvents", never "conferences": \conferences and pubCounts().conferences already
  // name the count of conference ABSTRACTS in the .bib, a different number.
  return {
    occurrences: all.length,
    invited: all.filter((o) => o.invited).length,
    invitedTalksPanels,
    conferenceEvents: all.length - invitedTalksPanels,
  };
}

// Every award's amount is printed with a $ and summed into one total, so a second currency
// would be both mislabelled and added to dollars. Refuse it until currencies are designed.
export function validateAwards(awards) {
  for (const a of awards.awards ?? []) {
    if (!a.amount) continue;
    if (typeof a.amount.value !== 'number') {
      throw new Error(`data/awards.json award "${a.id}": amount.value must be a number.`);
    }
    if (a.amount.currency !== 'USD') {
      throw new Error(
        `data/awards.json award "${a.id}": currency "${a.amount.currency}" is not supported; ` +
          'the CVs and the site print every amount in USD.',
      );
    }
  }
}

// A degree whose institution is unknown would vanish from both CVs, and one with no end date
// would crash the date formatting. Name the degree instead.
const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function validateEducation(education) {
  const institutions = new Set((education.institutions ?? []).map((i) => i.id));
  for (const d of education.degrees ?? []) {
    const where = `data/education.json degree "${d.id}"`;
    if (!institutions.has(d.institution)) {
      throw new Error(`${where}: institution "${d.institution}" is not in "institutions".`);
    }
    for (const field of ['start', 'end']) {
      if (!YEAR_MONTH.test(d[field] ?? '')) {
        throw new Error(`${where}: ${field} must be YYYY-MM (got ${JSON.stringify(d[field])}).`);
      }
    }
  }
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
    conferenceEvents: talks.conferenceEvents,
    invitedCount: talks.invited,
    fundingTotal: total,
    fundingDisplay: fundingDisplay(total),
  };
}

// Prose in the data layer is LaTeX, so a bare &, %, # or _ breaks the PDF build with an error
// that points at a generated file. Catch it here instead, naming the source file and the path
// to the value (e.g. `entries[6].name`). Skipped: keys that are never printed as text (ids,
// URLs, file paths, profile ids) and comment keys. Emails ARE printed as text, so they are
// checked.
const NOT_PROSE = new Set(['id', 'url', 'src', 'website', 'logo', 'profiles']);
const BARE = /(^|[^\\])[&%#_]/;

export function assertNoBareSpecials(value, file, path = '') {
  if (typeof value === 'string') {
    if (BARE.test(value)) {
      throw new Error(`${file}: "${path}" has a bare LaTeX special (& % # _); escape it with \\.`);
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoBareSpecials(v, file, `${path}[${i}]`));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (!NOT_PROSE.has(k) && !k.startsWith('_')) assertNoBareSpecials(v, file, path ? `${path}.${k}` : k);
    }
  }
}
