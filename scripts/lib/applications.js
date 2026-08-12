// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/lib/applications.js
//
// An application's STATUS is its directory: applications/{drafting,submitted,closed}/<slug>/.
// The directory tree is the record — there is no index file to drift out of sync with it.
//
// That layout has exactly one hazard: an application's path changes when its status does. If
// commands took paths, every status change would break muscle memory and half the docs. So no
// command ever takes a status — they take a slug, and this module finds it. Promoting an
// application from drafting to submitted changes nothing about how you build it.

import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './data.js';

export const STATUSES = ['drafting', 'submitted', 'closed'];

// `closed` is skipped by CI: a closed application never needs rebuilding, and skipping it is
// what keeps build time flat as the directory grows.
export const BUILDABLE = ['drafting', 'submitted'];

const APPS = join(ROOT, 'applications');

const slugsIn = (status) => {
  const dir = join(APPS, status);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(
    (name) =>
      statSync(join(dir, name)).isDirectory() && existsSync(join(dir, name, 'manifest.json')),
  );
};

/**
 * Resolve a slug to wherever it currently lives.
 * Returns { slug, status, dir, rel } or null when there is no such application.
 *
 * Throws when the same slug exists under two statuses — the one way this layout can genuinely
 * go wrong, and silently building the wrong one would be worse than stopping.
 */
export function findApplication(slug) {
  const hits = STATUSES.filter((s) => slugsIn(s).includes(slug));

  if (hits.length > 1) {
    throw new Error(
      `"${slug}" exists under ${hits.length} statuses (${hits.join(', ')}). ` +
        `An application has one status. Delete the stale copy before continuing.`,
    );
  }
  if (!hits.length) return null;

  const status = hits[0];
  const rel = `applications/${status}/${slug}`;
  return { slug, status, rel, dir: join(ROOT, rel) };
}

/** Every application, newest-status-first, with its manifest.meta for display. */
export function listApplications() {
  const out = [];
  for (const status of STATUSES) {
    for (const slug of slugsIn(status).sort()) {
      const rel = `applications/${status}/${slug}`;
      let meta = {};
      try {
        meta = JSON.parse(readFileSync(join(ROOT, rel, 'manifest.json'), 'utf8')).meta ?? {};
      } catch {
        // A manifest that won't parse is still an application worth listing — `npm run apps`
        // should show it as broken rather than pretend it isn't there.
        meta = { note: '(manifest.json could not be parsed)' };
      }
      out.push({
        slug,
        status,
        rel,
        dir: join(ROOT, rel),
        meta,
        hasLetter: existsSync(join(ROOT, rel, 'letter.json')),
        // CI compiles these and commits them back here, so their presence answers "has this
        // actually been built, or is it still just a manifest?" — the question you have when
        // you are about to send something.
        hasPdf: existsSync(join(ROOT, rel, 'cv.pdf')),
      });
    }
  }
  return out;
}

/** Resolve or exit with a message naming what to run to see the valid slugs. */
export function requireApplication(slug, command) {
  const app = findApplication(slug);
  if (!app) {
    console.error(`no application "${slug}".  Run \`npm run apps\` to list them.`);
    if (command) console.error(`usage: ${command}`);
    process.exit(2);
  }
  return app;
}
