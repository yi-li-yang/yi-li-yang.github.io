# Phase A — merge the Overleaf LaTeX repo into this repo (flat)

**Goal:** the two PDFs' sources live here, beside the website, as plain folders. One clone gets
everything. No git submodule. Overleaf becomes an optional unsynced scratchpad.

**Pre-req:** you have local copies of the Overleaf LaTeX files: `ONE-PAGE.tex`,
`deedy-resume-openfont.cls`, `BIOSKETCH.tex`, `resume.cls`, `my_publication.bib`.
these files are in the `/latex` folder
---

## Steps

1. Create the structure and copy files in:
   ```
   cv/onepage/    ONE-PAGE.tex  deedy-resume-openfont.cls
   cv/biosketch/  BIOSKETCH.tex  resume.cls
   cv/publications.bib            ← from the LaTeX repo's my_publication.bib
   cv/onepage/generated/  cv/biosketch/generated/   ← empty dirs with a .gitkeep
   ```
2. Fix the biosketch's bibliography path to the new SSOT location. In `BIOSKETCH.tex`,
   `\bibliography{my_publication}` → `\bibliography{../publications}` (or compile with
   `BIBINPUTS=cv:`). Document whichever you choose; do not keep two copies of the bib.
3. Confirm both compile **here**, unchanged otherwise:
   - one-pager: `latexmk -xelatex -outdir=cv/onepage/build cv/onepage/ONE-PAGE.tex`
   - biosketch: `BIBINPUTS=cv: latexmk -pdf -outdir=cv/biosketch/build cv/biosketch/BIOSKETCH.tex`
4. Add build outputs to `.gitignore`: `cv/**/build/`. (The committed PDFs go to `assets/`, not
   the per-template `build/` dirs.)
5. Point the website's buttons at stable PDF names. In `index.html`, the hero links currently
   reference `assets/YYANG_1P_CV%20(3).pdf` and `assets/YYANG_academic_biosketch%20(4).pdf`.
   Plan to replace these with `assets/cv.pdf` and `assets/biosketch.pdf` once Phase B/CI emits
   them under those names. (Do the rename in Phase B when the build produces them.)

---

## Acceptance criteria

- `cv/` contains both templates, both `.cls`, and `cv/publications.bib`.
- Both PDFs compile locally from inside this repo with no reference to the old Overleaf repo.
- `cv/**/build/` is gitignored; no stray PDFs committed outside `assets/`.
- No submodule was created; `git submodule status` is empty.

## Do not

- Do not add a submodule or any Overleaf git sync.
- Do not edit `.tex` content yet beyond the bibliography path — templating is Phase C.
- Do not touch the website's JS or data in this phase.
