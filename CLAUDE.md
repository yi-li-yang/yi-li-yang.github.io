# CLAUDE.md

Always-loaded context for Claude Code in the `yi-li-yang.github.io` repo.
**This supersedes the previous CLAUDE.md.(deleted)** See "What changed and why" at the bottom.
Reference docs: `docs/`. Executable stages: `tasks/`.

---

## What this project is

A **single-source-of-truth (SSOT)** system for one person's career materials.
One body of facts produces **two PDF CVs** and **this website**.
Owner: **Yili Yang, PhD** — geoscientist / geospatial data scientist.
Purpose: career **records**, **career exploration**, **visualisation**, **demonstration**

Today there are **two separate repos**:
- **this repo** — the website (vanilla static site) + a working stats pipeline,
- a **separate Overleaf-synced LaTeX repo** — `ONE-PAGE.tex`, `BIOSKETCH.tex`, their `.cls`, and `my_publication.bib`.

The goal is to bring the LaTeX into *this* repo (flat, no submodule) so both outputs
derive from one set of facts. The CV's numbers stop being hand-typed; logging happens once.

---

## ⚠️ Ground truth about the ACTUAL stack (read before doing anything)

The real, implemented site is **vanilla**:
- `index.html` at root, `css/variables.css` + `base.css` + `components.css`,
- ES modules: `js/main.js` → `js/modules/{stats,thoughts,skills}.js`,
- data fetched at runtime from `data/*.json`,
- design system in `design.md` (Linear-inspired, dark, Inter Variable).

There is **no** Next.js, React, Tailwind, or map library in this repo, despite what the
old CLAUDE.md's "Project Scaffolding" section claimed. **Do not introduce them.** Treat
that prior section as aspirational fiction; this file replaces it. If a framework is ever
wanted, it's a separate explicit decision — never an incidental scaffolding step.

---

## The one idea

Facts flow one direction: `data → outputs`. Nothing flows back. Every output is derived;
no output contains a hand-typed fact (the CV's "20 journal papers" becomes a value read
from data, not a literal).

---

## Invariants — never violate

1. **One authoritative location per fact.** Nothing is typed in two places.
2. **Disjoint writers.** Script-written files are never hand-edited; human-written files are
   never script-written. No byte has two authors. (Your repo already half-does this:
   `data/stats.json` is script-written — `js`/agents must not hand-edit it.)
3. **Ingest is the only impure (networked) step; rendering is pure/offline.** Rendering must
   still work when a fetch fails.
4. **Outputs are 100% derived.** A hand-typed fact in an output is a bug.
5. **Ingest fails safe.** On fetch error, keep last-known-good; never write a zero/null over a
   good value. (`update-stats.js` already does this — preserve that behavior.)
6. **The LLM never writes to the data layer.** It selects/rephrases verified facts into a
   tailored output, or *proposes* a `.bib` entry for human acceptance. Never mints facts.

---

## Decisions already made — do not re-litigate

- **Node is the engine.** Do not add Python. Reuse/extend `scripts/update-stats.js`. For LaTeX
  templating use **Nunjucks** with LaTeX-safe delimiters. NOTE: the originally-planned
  `\VAR{}`/`\BLOCK{}` recipe is **Jinja2-only and does not work in Nunjucks** (Nunjucks cannot use
  `}` as a tag terminator). The implementation uses `<< >>` for variables and `<% %>` for blocks
  (see `scripts/render-cv.js`) — same intent, working tool. Do not revert to `\VAR{}`.
- **Flat single repo, NO git submodules.** The LaTeX folders become plain directories here.
- **Overleaf is unplugged from git** — an optional, unsynced scratchpad for eyeballing layout,
  not part of the pipeline. Canonical compile is `latexmk` in CI or locally.
- **Keep the `data/` directory and the existing JSON contract.** The site already reads it; do
  not relocate to `web/data/` or rename keys without updating `js/modules/*`.

---

## Current vs. target layout

```
yi-li-yang.github.io/                 CURRENT (keep)
├── index.html  css/  js/modules/     vanilla site
├── data/ stats.json pill-tags.json show_repo.json   (stats.json = script-written; other two = hand-written)
├── scripts/update-stats.js           working ingest (ORCID/GitHub/Scholar, fail-safe)
├── .github/workflows/update-stats.yml monthly cron
├── design.md  issues.md  CLAUDE.md
│
│                                     TARGET ADDITIONS
├── cv/                               ← LaTeX moved in from the Overleaf repo (flat)
│   ├── onepage/  ONE-PAGE.tex  deedy-resume-openfont.cls  generated/
│   ├── biosketch/ BIOSKETCH.tex  resume.cls  generated/
│   └── publications.bib              ← SSOT for publications (was Biosketch/my_publication.bib)
├── scripts/
│   ├── update-stats.js               (existing)
│   ├── emit-metrics-tex.js           data/stats.json + bib → cv/**/generated/metrics.tex
│   ├── bib-to-json.js                publications.bib → data/publications.json (for the site)
│   └── render-cv.js                  data + Nunjucks templates → cv/**/generated/*.tex
├── templates/ onepage.tex.njk  biosketch.tex.njk
└── .github/workflows/build-cv.yml    compile PDFs → assets/, deploy
```

---

## Identifiers (already in `data/stats.json.profiles`)

ORCID `0000-0002-1791-3899` · GitHub `yi-li-yang` · Scholar `8I00DowAAAAJ` · LinkedIn `yiliyang`.
CI secrets already in use: `GH_PAT` (as `GH_USER_TOKEN`), `SERPAPI_KEY`.

---

## Build stages (see tasks/)

The ingest arm ("fetch metrics") is **already done** — do not rebuild it.

**STATUS: Phases A, B, C are IMPLEMENTED.** Phase D is not started.

- **Phase A** ✅ — Overleaf LaTeX merged into `cv/` (flat, no submodule). `cv/onepage/`,
  `cv/biosketch/`, shared `cv/publications.bib`; biosketch bib path is `\bibliography{../publications}`.
- **Phase B** ✅ — `scripts/emit-metrics-tex.js` derives counts (by `.bib` entry type) + service/
  funding figures into `cv/**/generated/metrics.tex`; the `.tex` shells `\input` it. No hardcoded
  numbers remain. PDFs publish to `assets/cv.pdf` / `assets/biosketch.pdf` (hero links updated).
- **Phase C** ✅ — `scripts/bib-to-json.js` → `data/publications.json` (LaTeX-free, owner flagged
  per-author); `js/modules/publications.js` renders it on the site. Experience is single-sourced in
  `data/experience.json`, rendered by `scripts/render-cv.js` (Nunjucks, `<< >>`/`<% %>` tags) into
  `cv/**/generated/experience.tex`, which both shells `\input`. Shared keystone loader:
  `scripts/lib/data.js`. Build all: `npm run build`. CI: `.github/workflows/build-cv.yml`.
- **Phase D** *(optional, not started)* — LLM tailoring over the data, select-and-rephrase, human-gated.

Script-written (never hand-edit): `data/stats.json`, `data/publications.json`, `cv/**/generated/*`,
`assets/*.pdf`. Hand-authored (never script-write): `data/pill-tags.json`, `data/show_repo.json`,
`data/experience.json`, `cv/publications.bib`, the `.tex` shells, `templates/*.njk`. The `static`
block inside `data/stats.json` is the one hand-authored island in a script-written file (funding,
mentees, talks, peer/NSF reviews) — `update-stats.js` preserves it across runs.

Verification after any stage: the site still renders, both PDFs compile, and every shown fact
traces back to the data layer.

---

## What changed and why (vs. the previous CLAUDE.md)

- **Removed the Next.js/React/Tailwind "Project Scaffolding" section** — it described an app
  that doesn't exist and would mislead an agent into scaffolding the wrong stack.
- **Kept and elevated the Stats Pipeline docs** — they're accurate; that pipeline is the
  ingest arm of this SSOT design.
- **Added the SSOT architecture, invariants, and the LaTeX-merge plan** — the actual goal of
  unifying the CV and the website around one set of facts.
