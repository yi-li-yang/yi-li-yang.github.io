# Phase D — LLM tailoring (optional)

**Goal:** given a job description, produce a tailored one-off CV by *selecting and rephrasing
verified facts from the data layer* — never inventing facts. Revives role-variants on demand
instead of forked `.tex` files.

**Depends on:** Phase C. Runs interactively in Claude Code — no Anthropic API key, no
automation, unless you later choose to productize.

---

## The firewall (invariant 6)

- The model reads `data/*` + `cv/publications.bib` + a pasted job description and outputs a
  **selection manifest + rephrasings only**.
- It **never writes** to `data/*` or any authoritative source. Not an authority for any fact.
- It may **propose** a `.bib` entry (from an ORCID diff) for you to accept — propose, not write.
- Every output is reviewed as a git diff before becoming a PDF. On a CV the dangerous failure
  isn't a typo — it's a clean-sounding fabricated achievement that reads too well to catch.

---

## Steps

1. Define an ad-hoc variant input, e.g. `applications/<company>-<role>.json`: the base target
   (`onepage`), an ordered list of selected item ids, and any approved rephrasings.
2. A tailoring prompt/skill under `scripts/tailor/` (or a Claude Code skill): input = the loaded
   data object (JSON) + the job description; output = a proposed manifest with a one-line
   rationale per selection, rephrasings that only compress/reweight existing text.
3. Render via the existing `render-cv.js` selection path → `assets/cv_<company>_<role>.pdf`.
   No new rendering machinery.
4. *(Optional)* `data/applications.json` log (company, role, date, variant, status) — feeds the
   career-exploration purpose: which framing you keep reaching for.

---

## Acceptance criteria

- Every selected line traces to an existing fact; diffing rephrasings against source shows
  compression/reordering only, no new claims.
- You accept/reject per item before any PDF is produced.
- A tailored PDF renders with a stable, descriptive filename.
- Nothing the model produced was written into the data layer automatically.

## Do not

- Do not let the model add a skill/role/metric/publication not already in the data.
- Do not auto-apply rephrasings without the human diff gate.
- Do not move tailoring into CI; it stays interactive and reviewed.
