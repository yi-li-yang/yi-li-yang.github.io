// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/lib/tokens.js
//
// PURE. Resolves an application's citation tokens (`exp:woodwell.b3`, `talk:esri-uc`,
// `derived.menteeCount`, …) to the source text they point at. scripts/verify-application.js
// is the firewall that calls it; the tests call it directly. A token that does not resolve
// returns null, and the firewall turns that into a build failure.
//
// Dotted schemes (`stats.x.y`, `service.x`, `profile.x`, `derived.x`) are written without a
// colon in letter.json; normaliseToken() rewrites them to the `scheme:path` form first.

import {
  indexSkills,
  indexExperienceBullets,
  indexCollaborations,
  resolveStatsPath,
} from './data.js';
import { derivedFacts } from './derive.js';
import { educationView } from './cv-jobs.js';

const DOTTED = ['stats', 'service', 'profile', 'derived'];

export function normaliseToken(token) {
  for (const scheme of DOTTED) {
    if (token.startsWith(`${scheme}.`)) return `${scheme}:${token.slice(scheme.length + 1)}`;
  }
  return token;
}

const value = (kind, path, v) =>
  v === undefined ? null : { text: `${path} = ${typeof v === 'string' ? v : JSON.stringify(v)}`, kind };

export function makeResolver(data, { jobText = null } = {}) {
  const skillById = indexSkills(data.skills);
  const bulletById = indexExperienceBullets(data.experience);
  const collabById = indexCollaborations(data.collaborations);
  const pubByKey = new Map(data.publications.map((p) => [p.key, p]));
  const awardById = new Map((data.awards.awards ?? []).map((a) => [a.id, a]));
  const taglineById = new Map((data.taglines.options ?? []).map((t) => [t.id, t]));
  const degreeById = new Map(
    educationView(data.education).flatMap((inst) => inst.degrees.map((d) => [d.id, { ...d, inst }])),
  );
  const talkById = new Map((data.talks.entries ?? []).map((e) => [e.id, e]));
  const projectById = new Map((data.mentorship.projects ?? []).map((p) => [p.id, p]));
  const initiativeById = new Map((data.initiatives.initiatives ?? []).map((i) => [i.id, i]));
  const derived = derivedFacts(data);

  return function resolveToken(token) {
    if (token === 'none') return { text: '(no factual claim)', kind: 'none' };

    const [scheme, ...rest] = token.split(':');
    const arg = rest.join(':');

    switch (scheme) {
      case 'exp': {
        const b = bulletById.get(arg);
        return b ? { text: b.text, kind: `experience/${b.job}` } : null;
      }
      case 'pub': {
        const p = pubByKey.get(arg);
        return p ? { text: `${p.title} — ${p.venue} (${p.year})`, kind: 'publication' } : null;
      }
      case 'skill': {
        const s = skillById.get(arg);
        return s ? { text: s.label, kind: 'skill' } : null;
      }
      case 'award': {
        const a = awardById.get(arg);
        return a ? { text: `${a.title}: ${a.project} (${a.period})`, kind: 'award' } : null;
      }
      case 'collab': {
        const c = collabById.get(arg);
        return c ? { text: c.partners ?? c.label, kind: 'collaboration' } : null;
      }
      case 'tagline': {
        const t = taglineById.get(arg);
        return t ? { text: t.text, kind: 'tagline' } : null;
      }
      case 'edu': {
        const d = degreeById.get(arg);
        return d ? { text: `${d.long}, ${d.inst.name} (${d.dates})`, kind: 'education' } : null;
      }
      case 'talk': {
        const e = talkById.get(arg);
        if (!e) return null;
        const years = e.occurrences.map((o) => `${o.year} ${o.role}${o.invited ? ', invited' : ''}`);
        return { text: `${e.name}${e.place ? `, ${e.place}` : ''} (${years.join('; ')})`, kind: 'talk' };
      }
      case 'mentor': {
        const p = projectById.get(arg);
        if (!p) return null;
        const people = p.mentees.map((m) => `${m.name} ${m.year}`).join(', ');
        return { text: `${p.title}: ${people}`, kind: 'mentorship' };
      }
      case 'init': {
        const i = initiativeById.get(arg);
        return i ? { text: `${i.title}: ${i.text}`, kind: 'initiative' } : null;
      }
      case 'job': {
        // Naming the company/role you are applying to is not a claim about yourself.
        if (!jobText) return null;
        return { text: `(from job.md: ${arg})`, kind: 'job posting' };
      }
      case 'stats':
        return value('stats', arg, resolveStatsPath(data.stats, arg));
      case 'service':
        // Numbers no list stands behind: reviews and proposals written.
        return value('service', arg, resolveStatsPath(data.service, arg));
      case 'profile':
        return value('profile', arg, resolveStatsPath(data.profile, arg));
      case 'derived':
        // Counted from a list by scripts/lib/derive.js: mentees, talks, funding.
        return value('derived', arg, Object.hasOwn(derived, arg) ? derived[arg] : undefined);
      default:
        return null;
    }
  };
}
