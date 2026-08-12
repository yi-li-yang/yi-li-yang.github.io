---
name: apply
description: Turn a pasted job description into a tailored one-page CV and cover letter, assembled only from facts already in the data layer. Use when the user is applying for a job, shares a job posting, or asks for a tailored CV or cover letter.
---

# Applying for a job

Turn a job posting into `applications/<slug>/` — a tailored one-pager and a cover letter, both
built by **selecting** facts that already exist in this repo.

## The one rule

**You never mint a fact.** Not a skill, not a metric, not a role, not a publication, not an
achievement. Everything you write is a selection or a compression of something already in
`data/` or `cv/publications.bib`. If the posting wants something the data does not contain,
you say so — you do not write around it.

On a CV the dangerous failure is not a typo. It is a clean-sounding fabricated achievement
that reads too well to catch.

## Steps

### 1. Get the posting

Ask the user to paste the job description, and for the posting URL if they have one.
**Do not fetch it yourself** — postings live behind login walls and a half-fetched page silently
produces a CV tailored to the wrong thing.

Derive `<slug>` as `<company>-<role>`, lowercase, hyphenated
(e.g. `goldman-sachs-applied-ai-researcher`).

### 2. Archive it verbatim

Write `applications/<slug>/job.md`: a short front-matter block (company, role, source, capture
date), then the posting **exactly as pasted**, under markdown headings that preserve its own
section structure — `## Required Qualifications`, `## Responsibilities`, and so on.

The headings are not cosmetic: `verify-application.js` only scans requirement-bearing sections
for gaps, so a posting dumped as one undifferentiated blob produces a useless gap report.

Never edit `job.md` later to agree with the CV. It is the evidence of what you aimed at.

### 3. Read the data layer

`data/experience.json` (every bullet has an id), `data/skills.json`, `data/awards.json`,
`data/collaborations.json`, `data/taglines.json`, `data/stats.json`, `cv/publications.bib`.

See `docs/APPLICATIONS.md` for the manifest and letter schemas and the full citation-token list.

### 4. Propose `manifest.json`

Selection by id wherever possible — skills, publications, awards, collaborations and the
tagline are **chosen**, never written, so their wording cannot drift.

Experience bullets are the one place you may rephrase, and every bullet must carry `src`
naming the source bullet(s) it compresses. Rephrasing means *compress and reweight*: drop
detail, reorder for the audience, use the posting's vocabulary where it honestly applies.
It does not mean add a result, a scale, or a metric that the source does not state.

Give the user a one-line rationale per selection when you present it.

### 5. Propose `letter.json`

Every paragraph carries `src`. Use `["none"]` only for connective or motivational prose that
asserts nothing about the applicant — and expect the smell test to inspect it.

**Address the gaps openly.** If a required qualification has no support in the data, say so
plainly in the letter rather than steering around it. A letter that quietly omits a stated
requirement reads as evasive; one that names it and pivots reads as honest. Never imply
experience the data layer does not contain.

### 6. Verify — and do not proceed past red

```bash
npm run verify:app -- <slug>
```

Fix citations and re-run until it exits 0. A dangling `src` means the claim has no source:
find the real source or delete the claim. Never "fix" it by loosening the citation to
something that merely sounds adjacent.

### 7. Render

```bash
npm run tailor -- <slug>
```

Writes the tailored partials, the variant shell `cv/onepage/app-<slug>.tex`, and the cover
letter as both `.tex` and paste-ready `.txt` under `cv/coverletter/generated/`.

### 8. Stop and hand back

Show the user:
- the **provenance report** — each generated claim beside its source,
- the **gap report** — what the posting wants that the data cannot support,
- any **smell-test warnings**.

Then stop. **Never commit.** The user accepts or rejects per item; PDFs are compiled by CI
after they push (`.github/workflows/tailor-cv.yml`).

## Do not

- Do not write to `data/**` or `cv/publications.bib` to make a claim true. If a fact is
  genuinely missing from the record, tell the user it is missing and let them add it.
- Do not auto-apply rephrasings without showing the diff.
- Do not compile or commit on the user's behalf.
- Do not soften the gap report. Its whole value is that it is uncomfortable.
