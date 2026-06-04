# Phase C — single-source shared prose (experience + publications)

**Goal:** experience bullets and the publication list live once and feed both the CV (via
Nunjucks templates) and the website (via `data/*.json` the existing JS reads). Logging a new
talk/role/paper becomes a one-place edit.

**Depends on:** Phase B.

---

## Steps

1. **Author the shared data.** Add hand-authored sources (JSON, or YAML via `js-yaml` if you
   prefer editing prose):
   - `data/experience.(json|yaml)` — roles with `bullets[]`, each bullet tagged
     `targets: ["onepage" | "biosketch" | "web"]`.
   - optionally `data/talks.*`, `data/mentorship.*`, `data/funding.*` for the biosketch + site.
   Extract real content from the current `BIOSKETCH.tex` / one-pager and the archived CVs.

2. **`scripts/bib-to-json.js`** — parse `cv/publications.bib` → `data/publications.json` for the
   site: per entry `title`, `authors`, `venue`, `year`, `doi`/`url`, newest-first.
   - **Strip LaTeX markup** — especially `\textbf{Yang, Yili}` around the owner and accents like
     `{\"u}`. Mark the owner with a field (`"owner": true`) so the site bolds it via CSS; never
     store `\textbf` in JSON.

3. **`scripts/render-cv.js`** — Nunjucks with the `\VAR{}`/`\BLOCK{}` tags (see BUILD_AND_RUN).
   Load `data/*` once, render `templates/onepage.tex.njk` and `templates/biosketch.tex.njk` into
   `cv/**/generated/*.tex`, filtering bullets by `target`. The `.tex` shells keep their preamble/
   layout and `\input` the generated bodies + `metrics.tex`.

4. **Wire the site (optional but recommended).** Add a small `js/modules/publications.js` that
   fetches `data/publications.json` and renders a list in a section of `index.html`; register it
   in `js/main.js` alongside the existing modules. Follow `design.md` (Linear dark system) and
   match the existing card styles in `css/components.css` — do not introduce a framework.

5. **Converge web data.** If experience now lives in `data/experience.*`, decide whether
   `pill-tags.json` / `show_repo.json` stay separate (they're fine as-is) or are folded in. Only
   delete a hand file once a generated equivalent matches what the site renders today.

---

## Acceptance criteria

- Editing one experience bullet and rebuilding changes the right PDF(s) and/or the site, with
  the text duplicated nowhere.
- A bullet tagged `["onepage"]` appears only in the one-pager; `["biosketch","web"]` in both
  those and not the one-pager.
- `data/publications.json` contains no LaTeX markup; the owner is flagged by data, not `\textbf`.
- Both PDFs still compile; the site still renders with the existing modules intact.

## Do not

- Do not unify the two CV layouts — only the data is shared; the templates stay distinct.
- Do not store LaTeX markup in any `data/*.json`.
- Do not convert the site to a framework; extend the vanilla modules.
