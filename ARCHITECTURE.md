# ARCHITECTURE

The *why*, mapped onto the files that actually exist in this repo.

---

## The disease: drift between two repos

The CV (Overleaf LaTeX repo) and the website (this repo) each carry their own copy of the
same facts, maintained by hand, drifting apart. Concrete examples today:

- `ONE-PAGE.tex` hardcodes `Journal Papers: 20 / Conferences: 9 / Data Sets: 1`.
- `data/stats.json` carries `publications.count: 20` (from ORCID) — script-written.
- `my_publication.bib` lists ~26 entries (journal + conference abstracts + preprints + in-prep).

These are not all the same number, and that's the subtlety: **they count different things.**
ORCID's 20 = formal registered works. The bib's 26 = everything including abstracts and
in-prep. The goal is not "force them equal" — it's "one curated source, each number *derived*
from it with explicit filtering," so a change is made once and propagates correctly.

---

## Cut 1 — partition by AUTHORITY, mapped to real files

Every fact has an owner (who may write it). Partition storage by owner:

| Authority | Mechanism | Lives in (current → target) | Writer |
|-----------|-----------|------------------------------|--------|
| ORCID / GitHub / Scholar | API + scrape | `data/stats.json` | `scripts/update-stats.js` only |
| You (web cards) | hand | `data/pill-tags.json`, `data/show_repo.json` | you only |
| You (publications) | curated; APIs *propose* | `cv/publications.bib` | you only |
| You (CV prose) | hand | `cv/**/*.tex` shells + new `data/experience.*` | you only |
| Derived | pure render | `cv/**/generated/*`, `data/publications.json`, `assets/*.pdf` | scripts only |

Invariant 2 falls out: a human file is never script-written and vice-versa. Your repo already
honors this for `stats.json` (script-written) — the rule just needs stating and extending.

### Publications are the "both" case → propose/accept
A paper's *existence* is ORCID's; its *presentation* (author order, your name emphasized,
dedupe vs. archived bibs) is yours. So the `.bib` stays human-curated and is the SSOT; an
optional ORCID diff *proposes* missing entries for you to accept. A pull never overwrites it.

---

## Cut 2 — pure vs. impure, mapped to real scripts

- **Impure (ingest):** `scripts/update-stats.js`. Network, flaky, fail-safe. **Already built.**
  Runs in CI (`update-stats.yml`, monthly) or locally. Cannot run inside Overleaf (no network).
- **Pure (render):** new `emit-metrics-tex.js`, `bib-to-json.js`, `render-cv.js`. Deterministic,
  offline, read the data layer, write generated artifacts. Run anywhere.

Why the split is forced, not stylistic: rendering a PDF must succeed even when Scholar is
blocked — so the render reads the last-known-good values `update-stats.js` already cached in
`data/stats.json`, never a live call.

---

## The keystone: a single load step

`render-cv.js` and `bib-to-json.js` should both `load()` the same in-memory object assembled
from `data/*.json` + `cv/publications.bib`, then render from it. One assembly, one shape, so a
malformed field fails loudly at build time rather than as a blank line in a shipped PDF.
(JSON is fine given the Node/JSON repo; use `js-yaml` only if you prefer YAML for hand-authored
prose like `experience` — a taste call, not a requirement.)

---

## Selection: `targets`

The one-pager and biosketch are deliberately shaped differently; do not unify their layouts.
Instead, each shared fact declares where it appears:

```json
{ "text": "Project Lead: pan-Arctic RTS mapping with deep learning",
  "targets": ["biosketch", "web"] }
```

One record, multiple outputs at different lengths. This is what makes "log once" possible
without collapsing the two templates, and it revives the old role-variants
(Halliburton / DataAnalyst / DataScientist) as selection configs rather than rotting forks.

---

## Single-writer rule (operational form of invariant 2)

Generated paths have exactly one writer — the build (CI or local scripts):
`data/stats.json`, `data/publications.json`, `cv/**/generated/*`, `assets/*.pdf`.
You author `data/pill-tags.json`, `data/show_repo.json`, `cv/publications.bib`, the `.tex`
shells, the `.njk` templates, and the site source. **Never hand-edit a generated file** — the
next build silently reverts it.

---

## Inversion — failure modes the design must survive

- *Scholar returns 0 → "0 citations" ships.* → `update-stats.js` already preserves previous
  values; keep that, and surface a stale indicator rather than a zero.
- *Agent scaffolds Next.js because the old CLAUDE.md said so.* → fixed: ground-truth stack
  section in CLAUDE.md; vanilla only.
- *LLM invents a polished publication.* → render is pure over a verified `.bib`; tailoring is
  select-and-rephrase with a human-gated diff.
- *PDF compiles on Overleaf, font-not-found in CI* (Deedy one-pager needs XeLaTeX + Lato/
  Raleway). → use full-TeXLive action; pin it. The compiler is swappable because render is pure.
