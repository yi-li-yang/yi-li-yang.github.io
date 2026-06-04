# Phase B — derive CV numbers from data (the real drift fix)

**Goal:** the CV stops hard-coding `Journal Papers: 20 / Conferences: 9 / Data Sets: 1` and any
citation/commit figures. Those become `\input`-ed macros generated from `data/stats.json` and
`cv/publications.bib`. Edit the source once; the CV updates on build.

**Depends on:** Phase A.

---

## Background — the numbers are different on purpose

- `data/stats.json.publications.count` = ORCID works (20) — formal registered works.
- `cv/publications.bib` = ~26 entries incl. conference abstracts, preprints, in-prep.

Do **not** force these equal. Derive each figure explicitly:
- journal papers = count of `@article` in the bib,
- conferences = count of `@inproceedings`,
- data sets = count of `@misc` flagged as dataset (or a `keywords = {dataset}` convention),
- citations / h-index / commits = straight from `data/stats.json`.

---

## Steps

1. `scripts/emit-metrics-tex.js`:
   - read `data/stats.json` and parse `cv/publications.bib`
     (`@retorquere/bibtex-parser` or `citation-js`),
   - compute the type counts above,
   - write **both** `cv/onepage/generated/metrics.tex` and `cv/biosketch/generated/metrics.tex`:
     ```latex
     \newcommand{\journalpapers}{14}
     \newcommand{\conferences}{9}
     \newcommand{\datasets}{1}
     \newcommand{\pubcount}{20}
     \newcommand{\citations}{268}
     \newcommand{\hindex}{8}
     \newcommand{\commits}{390}
     ```
2. In `ONE-PAGE.tex` (and `BIOSKETCH.tex` where relevant): add `\input{generated/metrics.tex}`
   in the preamble and replace the hardcoded figures with the macros — e.g. the Stats column
   becomes `Journal Papers: \journalpapers \\ Conferences: \conferences \\ Data Sets: \datasets`.
3. Rebuild PDFs to `assets/cv.pdf` and `assets/biosketch.pdf` (stable names), and update the two
   `index.html` hero links to those paths (completing the rename noted in Phase A).
4. Spot-check: change a number's *source* (e.g. add an `@article` to the bib) → rebuild → the
   PDF figure changes with no manual edit to the `.tex`.

---

## Acceptance criteria

- No publication/citation/commit figure appears as a literal in any `.tex`; all come via macros.
- `emit-metrics-tex.js` is deterministic and offline (reads cached `data/stats.json`; no network).
- Adding an `@article` to the bib and rebuilding increments `\journalpapers` in the PDF.
- `assets/cv.pdf` / `assets/biosketch.pdf` exist and the website buttons resolve to them.

## Do not

- Do not make the website show the bib's 26 as "publications" — that conflates denominators.
  If you add a site publication *count*, label it precisely (e.g. "peer-reviewed articles").
- Do not hand-edit `generated/metrics.tex`.
