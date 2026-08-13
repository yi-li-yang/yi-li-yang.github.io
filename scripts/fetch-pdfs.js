// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/fetch-pdfs.js
//
// Waits for the CI run that a push triggered, then brings its committed PDFs down to the
// working copy. CI compiles the documents and commits them back (see .github/workflows/
// tailor-cv.yml), which means the files exist on the remote minutes after a push but not in
// the local folder until someone remembers to pull. This closes that gap.
//
// IMPURE (network + git), like scripts/update-stats.js — and like it, it fails safe: it only
// ever FAST-FORWARDS, only when the working tree is clean, and it never fabricates a commit.
// If anything is ambiguous it prints what it saw and changes nothing.
//
//   node scripts/fetch-pdfs.js                  wait for HEAD's run, then fast-forward
//   node scripts/fetch-pdfs.js --sha <sha>      wait for a specific commit's run
//   node scripts/fetch-pdfs.js --detach         respawn in the background and return at once
//   node scripts/fetch-pdfs.js --timeout 600    give up waiting after N seconds (default 900)
//
// `--detach` is what .githooks/pre-push uses: git must not be held open while CI compiles.

import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const has = (name) => args.includes(`--${name}`);

const TIMEOUT_S = Number(flag('timeout', 900));
const POLL_S = 15;
// Runs that can commit something back, matched on `workflowName` — the `name:` at the top of
// each workflow file. ("path" would be the obvious key, but `gh run list --json` does not
// offer it; the available fields are fixed and workflowName is the closest stable handle.)
// "Update Stats" is excluded on purpose: it writes data/stats.json on a monthly cron, not in
// response to your push.
const WATCHED = ['Tailor CV', 'Build CV'];
const FIELDS = 'databaseId,workflowName,status,conclusion,headSha';

const watched = (json) => {
  try {
    return JSON.parse(json).filter((x) => WATCHED.includes(x.workflowName));
  } catch {
    return null; // unparseable: let the caller keep its previous snapshot
  }
};

const detached = has('detach');
const logFile = has('log-to') ? flag('log-to') : null;

function say(msg) {
  const line = detached ? msg : msg;
  if (logFile) {
    try {
      appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);
    } catch {
      /* a log we cannot write is not worth failing over */
    }
  }
  console.log(line);
}

// windowsHide stops a console window flashing on screen for every child process. It matters
// here more than usual: the watcher runs detached, so it has no console of its own to lend
// them, and Windows gives each child a brand-new one. At one `gh` poll every 15 seconds for
// the length of a CI run, that is a window blinking on the desktop dozens of times.
const QUIET = { encoding: 'utf8', windowsHide: true };

function git(...a) {
  return execFileSync('git', a, QUIET).trim();
}

// gh exits non-zero for "no runs found" as readily as for "not authenticated", so every call
// goes through here and the caller decides what an empty result means.
function gh(...a) {
  try {
    return { ok: true, out: execFileSync('gh', a, QUIET).trim() };
  } catch (e) {
    return { ok: false, out: String(e.stdout ?? '') + String(e.stderr ?? '') };
  }
}

const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

// ── Re-launch in the background and get out of git's way ──────────────────────
if (detached) {
  const self = fileURLToPath(import.meta.url);
  const rest = args.filter((a) => a !== '--detach');
  const child = spawn(process.execPath, [self, ...rest, '--log-to', '.git/pdf-watch.log'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true, // no console window for the watcher itself
    cwd: process.cwd(),
  });
  child.unref();
  console.log('[pdfs] watching CI in the background; PDFs will appear when it finishes.');
  console.log('[pdfs] progress: .git/pdf-watch.log');
  process.exit(0);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const sha = flag('sha') ?? git('rev-parse', 'HEAD');
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
const short = sha.slice(0, 7);

if (!gh('--version').ok) {
  say('[pdfs] gh CLI not found — cannot watch CI. Install it, or run `git pull` yourself.');
  process.exit(0);
}

say(`[pdfs] watching runs for ${short} on ${branch}`);

// 1. Wait for the run(s) to appear. A push whose paths matched no workflow filter never
//    produces one, so "none after a grace period" is a normal, quiet exit — not an error.
const deadline = Date.now() + TIMEOUT_S * 1000;
let runs = [];
let waitedForAppearance = 0;

while (Date.now() < deadline) {
  const r = gh('run', 'list', '--commit', sha, '--limit', '30', '--json', FIELDS);
  if (r.ok && r.out) runs = watched(r.out) ?? [];
  if (runs.length) break;

  waitedForAppearance += POLL_S;
  if (waitedForAppearance >= 90) {
    say(`[pdfs] no CV workflow ran for ${short} — nothing to wait for.`);
    process.exit(0);
  }
  await sleep(POLL_S);
}

// 2. Wait for them to finish.
while (Date.now() < deadline) {
  const pending = runs.filter((r) => r.status !== 'completed');
  if (!pending.length) break;
  say(`[pdfs] ${pending.map((p) => p.workflowName).join(', ')} still running…`);
  await sleep(POLL_S);
  const r = gh('run', 'list', '--commit', sha, '--limit', '30', '--json', FIELDS);
  if (r.ok && r.out) runs = watched(r.out) ?? runs;
}

for (const r of runs) {
  say(`[pdfs] ${r.workflowName}: ${r.status}${r.conclusion ? ` (${r.conclusion})` : ''}`);
}
if (runs.some((r) => r.status !== 'completed')) {
  say(`[pdfs] gave up waiting after ${TIMEOUT_S}s. Run \`npm run pdfs\` again later.`);
  process.exit(0);
}
// A failed run has nothing to hand back, but the PDFs from a PREVIOUS successful run may
// still be waiting on the remote, so carry on to the fetch rather than bailing here.
if (runs.some((r) => r.conclusion !== 'success')) {
  say('[pdfs] at least one run did not succeed — check `gh run view`.');
}

// 3. Fast-forward, and only that.
git('fetch', 'origin', branch);
const local = git('rev-parse', 'HEAD');
const remote = git('rev-parse', `origin/${branch}`);

if (local === remote) {
  say('[pdfs] already up to date — CI committed nothing new.');
  process.exit(0);
}

// Is our HEAD an ancestor of the remote tip? If not, the branches have diverged and a
// fast-forward would be a lie. Say so and stop.
let canFF = true;
try {
  execFileSync('git', ['merge-base', '--is-ancestor', local, remote], {
    stdio: 'ignore',
    windowsHide: true,
  });
} catch {
  canFF = false;
}
if (!canFF) {
  say(`[pdfs] ${branch} has diverged from origin — not touching it. Reconcile by hand.`);
  process.exit(0);
}

const dirty = git('status', '--porcelain');
if (dirty) {
  say('[pdfs] working tree is dirty — refusing to move it. Commit or stash, then:');
  say(`[pdfs]   git merge --ff-only origin/${branch}`);
  process.exit(0);
}

const incoming = git('diff', '--name-only', local, remote)
  .split('\n')
  .filter((f) => /\.(pdf|txt)$/.test(f) && f.startsWith('applications/'));

git('merge', '--ff-only', `origin/${branch}`);
say(`[pdfs] fast-forwarded ${branch} to ${remote.slice(0, 7)}`);
for (const f of incoming) say(`[pdfs]   ${f}`);
if (!incoming.length) say('[pdfs]   (no application documents in the update)');
