# BUILD_AND_RUN

Everything is Node, and the same render scripts run locally and in CI. LaTeX is the one place the
two differ: CI compiles the canonical PDFs with `latexmk` in a TeX Live container, while a dev
machine uses **Tectonic** — a single binary that fetches only the packages a document needs, so
there is no TeX Live to install. See *Local commands* below.

---

## Pipeline halves

- **Impure (ingest) — already built:** `scripts/update-stats.js` → `data/stats.json`.
  Network; runs in CI (`update-stats.yml`) or locally. Fail-safe; keep as-is.
- **Pure (render) — to build:** Node scripts that read the data layer and write artifacts.
  No network. Run anywhere (CI, local).

```
update-stats.js  ──→ data/stats.json                       (existing, monthly)
bib-to-json.js   : cv/publications.bib ──→ data/publications.json        (site)
emit-metrics-tex : data/stats.json + bib ──→ cv/**/generated/metrics.tex (CV numbers)
render-cv.js     : data/* + templates/*.njk ──→ cv/**/generated/*.tex    (CV bodies)
latexmk (CI only): cv/**/*.tex ──→ assets/cv.pdf, assets/biosketch.pdf
tectonic (local) : cv/**/*.tex ──→ build/preview/*.pdf                  (a preview, never of record)
```

---

## Local commands

```bash
npm install                       # add: nunjucks, @retorquere/bibtex-parser (or citation-js), js-yaml (optional)

node scripts/update-stats.js      # refresh metrics (network) — optional; render uses cached values
node scripts/bib-to-json.js       # publications.bib → data/publications.json
node scripts/emit-metrics-tex.js  # → cv/**/generated/metrics.tex
node scripts/render-cv.js         # → cv/**/generated/*.tex (all prose blocks)

# job applications (Phase D) — see docs/APPLICATIONS.md
npm run verify:app -- <slug>          # firewall: every claim must cite a source
npm run verify:app -- <slug> --strict # warnings become failures (what CI runs)
npm run tailor     -- <slug>          # → tailored one-pager + cover letter (.tex and .txt)

# compile a PREVIEW (needs `tectonic` on PATH — one binary, no TeXLive, no font install)
npm run pdf -- <slug>             # a tailored application, after `npm run tailor -- <slug>`

# the two canonical PDFs. Run from each directory so the class's relative `fonts/` and
# \input{generated/...} paths resolve; -o must already exist, and build/ is gitignored.
mkdir -p build/preview
(cd cv/onepage   && tectonic -o ../../build/preview ONE-PAGE.tex)
(cd cv/biosketch && tectonic -o ../../build/preview BIOSKETCH.tex)   # bibtex runs on its own
```

**Never copy a local build into `assets/`.** Those two PDFs are CI's bytes (invariant 2: no byte
has two authors), and a locally compiled `assets/cv.pdf` is indistinguishable from the real one
while silently disagreeing about its date stamp. Local compiles exist to check layout, nothing
else. Tectonic is XeTeX-based, so the biosketch — which CI builds with pdfLaTeX — logs
missing-character warnings locally that CI never sees. That is engine noise, not a regression.

Preview the site with the existing Live Server config (`.vscode/settings.json`, port 5501) or
any static server — it just fetches `data/*.json`.

---

## The render gotcha — Nunjucks vs LaTeX braces

Jinja's `{{ }}` and Nunjucks' default `{{ }}`/`{% %}` collide with LaTeX.

> **Correction.** This doc used to prescribe `\VAR{}` / `\BLOCK{}`. That recipe is **Jinja2-only
> and does not work in Nunjucks**, which cannot use `}` as a tag terminator — it can't tell a
> tag-closing `}` from a LaTeX one. The implementation uses `<< >>` and `<% %>` instead. Do not
> revert to `\VAR{}`.

The environment lives in `scripts/lib/render.js` (shared by `render-cv.js` and `tailor.js`):

```js
import nunjucks from 'nunjucks';
export const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(join(ROOT, 'templates')),
  { autoescape: false, trimBlocks: true, lstripBlocks: true,
    tags: {
      variableStart: '<<', variableEnd: '>>',
      blockStart:    '<%', blockEnd:    '%>',
      commentStart:  '<#', commentEnd:  '#>',
    }});
```

Templates are the Deedy body with literals swapped (`cv/templates/onepage-experience.tex.njk`):

```latex
<% for job in experience %>
\runsubsection{<< job.role >>}
\descript{<< job.onepage.descript >>}
\begin{tightemize}
<% for b in job.onepage.bullets %>
    \item <% if b.label %>\textbf{<< b.label >>}: <% endif %><< b.text >>
<% endfor %>
\end{tightemize}
<% endfor %>
```

Two filters are registered: `texesc` (escape text arriving from the `.bib`, which is not
LaTeX) and `untex` (unwind LaTeX for the cover letter's plain-text twin). Hand-authored
`data/*.json` prose is **never** passed through `texesc` — it deliberately contains LaTeX.

`emit-metrics-tex.js` writes plain `\newcommand`s — no templating needed:

```latex
\newcommand{\journalpapers}{14}   % count of @article in the bib
\newcommand{\conferences}{9}      % count of @inproceedings
\newcommand{\citations}{268}      % data/stats.json scholar.citations
\newcommand{\pubcount}{20}        % data/stats.json publications.count (ORCID)
```

The `.tex` shells `\input{generated/metrics.tex}` and write `Journal Papers: \journalpapers`,
killing the hardcoded literals.

---

## CI — extend, don't duplicate

You have `update-stats.yml` (monthly, commits `data/stats.json`). Add a **second** workflow
`build-cv.yml` triggered on pushes that touch `cv/**`, `templates/**`, `data/**`, `scripts/**`:

```yaml
name: Build CV
on:
  push: { paths: ['cv/**','templates/**','data/**','scripts/render-cv.js','scripts/emit-metrics-tex.js','scripts/bib-to-json.js'] }
  workflow_dispatch: {}
permissions: { contents: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: node scripts/bib-to-json.js && node scripts/emit-metrics-tex.js && node scripts/render-cv.js
      - uses: xu-cheng/latex-action@v3
        with: { root_file: 'cv/onepage/ONE-PAGE.tex', latexmk_use_xelatex: true, working_directory: '.' }
      - uses: xu-cheng/latex-action@v3
        with: { root_file: 'cv/biosketch/BIOSKETCH.tex', working_directory: '.' }
      - run: |
          mkdir -p assets && cp cv/**/*.pdf assets/ 2>/dev/null || true
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/publications.json cv assets
          git diff --cached --quiet || git commit -m "build: regenerate CV [automated]"
          git push
```

Keep the monthly `update-stats.yml` as the metrics refresh; optionally have it also trigger a
CV rebuild so PDFs pick up new citation counts. GitHub Pages serves the root of `main`.

**The one environment risk:** the Deedy one-pager is XeLaTeX + `fontspec` with Lato/Raleway.
Overleaf has those fonts; confirm the CI TeXLive image resolves `lato`/`raleway`/`fontawesome`,
or pin the TeXLive version. This is the classic "works on Overleaf, fails in CI" break.

---

## Manual-only fallback

The render half is genuinely optional: run the four `node` scripts locally, `git push`, and you
lose only the automatic monthly refresh. The compile half is not. A PDF is a document of record —
the artifact an employer actually received — and letting one machine's Tectonic build stand in for
CI's `latexmk` build gives `assets/` two authors. Render anywhere; compile for keeps in CI.
