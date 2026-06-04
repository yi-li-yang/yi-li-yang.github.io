# TASKS — execution map

Run in order. Each phase is independently shippable. The **ingest arm is already built**
(`scripts/update-stats.js`) — do not rebuild it.

| Phase | File | Outcome | New deps |
|-------|------|---------|----------|
| — | *(done)* | ORCID/GitHub/Scholar → `data/stats.json`, fail-safe | — |
| A | `phase-A-merge-latex.md` | Move the Overleaf LaTeX repo into `cv/` (flat, no submodule). | — |
| B | `phase-B-metrics-tex.md` | CV numbers derive from `data/stats.json` + `.bib`. Kills hardcoded `20/9/1`. | bibtex parser |
| C | `phase-C-shared-content.md` | Experience + publications single-sourced; CV via Nunjucks, site reads same data. | nunjucks (+ js-yaml optional) |
| D | `phase-D-tailoring.md` *(optional)* | LLM tailoring over the data; select-and-rephrase, human-gated. | Claude Code |

## Rules for every phase

1. Re-read `CLAUDE.md` invariants and the **ground-truth stack** note first. Vanilla site —
   no Next.js/React/Tailwind.
2. Node only. Reuse `update-stats.js`; don't port to Python.
3. Never hand-edit a script-written file (`data/stats.json`, `data/publications.json`,
   `cv/**/generated/*`, `assets/*.pdf`). Never let a script write a hand-authored file.
4. Keep the `data/*.json` contract the site's `js/modules/*` already depends on; if you change
   a key, update the consuming module in the same change.
5. After each phase: site still renders, both PDFs compile, every shown fact traces to data.
6. If a step needs a decision not specified here, stop and ask the owner.

## Migration notes

- `data/pill-tags.json` and `data/show_repo.json` are **hand-authored web data** — already the
  manual SSOT for the site. Phase C may unify some of their content with the CV's experience
  data, but don't delete them until a generated equivalent demonstrably matches.
- `my_publication.bib` moves from the LaTeX repo to `cv/publications.bib` and becomes the
  publications SSOT for both outputs.
