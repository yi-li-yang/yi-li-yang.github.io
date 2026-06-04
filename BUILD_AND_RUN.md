# BUILD_AND_RUN

Everything is Node. The LaTeX compiler is `latexmk`. The same scripts run locally and in CI.

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
latexmk          : cv/**/*.tex ──→ assets/cv.pdf, assets/biosketch.pdf
```

---

## Local commands

```bash
npm install                       # add: nunjucks, @retorquere/bibtex-parser (or citation-js), js-yaml (optional)

node scripts/update-stats.js      # refresh metrics (network) — optional; render uses cached values
node scripts/bib-to-json.js       # publications.bib → data/publications.json
node scripts/emit-metrics-tex.js  # → cv/**/generated/metrics.tex
node scripts/render-cv.js         # → cv/**/generated/*.tex

# compile (needs local TeXLive w/ XeLaTeX + Lato/Raleway fonts; MacTeX or texlive-full)
latexmk -xelatex -interaction=nonstopmode -outdir=cv/onepage/build  cv/onepage/ONE-PAGE.tex
BIBINPUTS=cv: latexmk -pdf -interaction=nonstopmode -outdir=cv/biosketch/build cv/biosketch/BIOSKETCH.tex
cp cv/onepage/build/*.pdf cv/biosketch/build/*.pdf assets/
```

Preview the site with the existing Live Server config (`.vscode/settings.json`, port 5501) or
any static server — it just fetches `data/*.json`.

---

## The render gotcha — Nunjucks vs LaTeX braces

Jinja's `{{ }}` and Nunjucks' default `{{ }}`/`{% %}` collide with LaTeX. Reconfigure tags in
`render-cv.js` so templates use `\VAR{}` / `\BLOCK{}`:

```js
const nunjucks = require('nunjucks');
const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader('templates'),
  { autoescape: false,
    tags: {
      variableStart: '\\VAR{', variableEnd: '}',
      blockStart: '\\BLOCK{',  blockEnd: '}',
      commentStart: '\\#{',    commentEnd: '}',
    }});
```

Template (`templates/onepage.tex.njk`) is your existing Deedy body with literals swapped:

```latex
\BLOCK{ for j in experience }
\runsubsection{\VAR{ j.role }} \descript{| \VAR{ j.org }}
\begin{tightemize}
\BLOCK{ for b in j.bullets if 'onepage' in b.targets }
    \item \VAR{ b.text }
\BLOCK{ endfor }
\end{tightemize}
\BLOCK{ endfor }
```

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

CI is optional. Run the four `node` scripts + `latexmk` locally and `git push` the results.
You lose only the automatic monthly refresh; everything else is identical.
