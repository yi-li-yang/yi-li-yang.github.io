# APPLICATIONS — job-tailored CVs and cover letters

Phase D of the SSOT pipeline. A job posting goes in; a tailored one-pager and a cover letter
come out, both assembled **only** from facts already in the data layer.

```text
applications/<status>/<slug>/          status is the DIRECTORY
  job.md         pasted posting, verbatim          (evidence; never edited to match the CV)
  manifest.json  CV tailoring: selection + cited rephrasings
  letter.json    cover letter: paragraphs, each cited
        │
        ├─ npm run verify:app -- <slug>    firewall + provenance + gap report
        └─ npm run tailor     -- <slug>    verifies, THEN renders
                 │
                 build/<slug>/       self-contained compile context
                   cv.tex  ← compile this      letter.tex  letter.txt
                   *.tex partials              .cls + fonts/ (copied in)
                          │
                  push → tailor-cv.yml → PDF + txt artifacts → npm run pdfs
```

## Lifecycle

An application's **status is the folder it sits in** — `drafting`, `submitted`, or `closed`.
The tree is the record; there is no index file that could disagree with it.

```bash
npm run apps                                   # see everything, grouped by status
npm run app:status -- <slug> submitted         # git mv between folders
```

No command ever takes a status. Everything resolves an application by **slug**
(`scripts/lib/applications.js`), so promoting one from drafting to submitted changes nothing
about how you build it. CI skips `closed/` — a closed application never needs rebuilding, which
is what keeps build time flat as the directory grows.

## The PDFs are ephemeral — the manifest is the record

Tailored PDFs are CI artifacts and GitHub deletes them after 90 days. They are deliberately not
committed. **Rebuilding a closed application later produces a similar but not identical
document**, because the citation counts in `data/stats.json` move underneath it.

So: the durable record of what you sent is `manifest.json` + `letter.json` + `job.md`. If you need
the exact bytes an employer received, download the artifact while it exists and keep it yourself.

Nothing here is committed except the three inputs. Tailored `.tex` and PDFs are ephemeral —
the manifest is the source of truth, and it can always regenerate them.

---

## Why the citations exist

Invariant 6: the LLM never mints facts. It **selects and rephrases**; it is not an authority
for any fact. The failure mode this guards against is not a typo — it is a clean-sounding
fabricated achievement that reads too well to catch on a review pass.

So the design removes the opportunity rather than relying on vigilance:

- **Skills, publications, awards, collaborations and taglines are chosen by id.** Their wording
  lives in `data/` and is copied, never retyped. A tailored CV cannot misstate them.
- **Experience bullets and letter paragraphs are the only prose**, and each must carry `src`
  naming what it came from. `scripts/verify-application.js` resolves every token and fails on a
  dangling one.
- **Unsourced sentences get a smell test.** Numbers and unknown proper nouns in a `src: ["none"]`
  sentence are flagged, because that is the shape an invented claim arrives in.

## Citation tokens

| Token | Resolves against |
|-------|------------------|
| `exp:<jobId>.<bulletId>` | `data/experience.json` — e.g. `exp:woodwell.b3` (biosketch), `exp:woodwell.o2` (one-pager) |
| `pub:<bibkey>` | `cv/publications.bib` — e.g. `pub:li2024segment` |
| `skill:<id>` | `data/skills.json` |
| `award:<id>` | `data/awards.json` |
| `collab:<id>` | `data/collaborations.json` |
| `tagline:<id>` | `data/taglines.json` |
| `stats.<dotted.path>` | `data/stats.json` — machine-written ingest figures |
| `service.<key>` | `data/service.json` — funding, mentees, talks, reviews (was `stats.static.*`) |
| `job:<field>` | `job.md` — naming the company or role you are applying to is not a claim about yourself |
| `none` | connective or motivational prose asserting no fact; triggers the smell test |

## `manifest.json`

```jsonc
{
  "meta": { "company": "...", "role": "...", "source": "...", "date": "YYYY-MM-DD", "note": "..." },

  "tagline": "applied-ai-research",          // id from data/taglines.json, or omit

  "skills": [                                 // per group, ordered lines of skill ids
    { "group": "domains",   "lines": [["machine-learning", "time-series-modelling"], ["..."]] },
    { "group": "tech-stack","lines": [["python", "pytorch"]] }
  ],

  "publications": ["li2024segment", "..."],   // bib keys; 3-5 fits the page
  "awards": ["fcs-2025"],
  "collaborations": { "industry": ["google-woodwell"], "academic": ["uconn", "uiuc", "asu"] },

  "experience": [                             // the ONLY place prose is allowed
    {
      "role": "Data Scientist",
      "onepage": {
        "descript": "| Woodwell Climate Research Center",
        "location": ["Jan 2022 - Present | Falmouth, MA, USA"],
        "bullets": [
          { "src": ["exp:woodwell.b1"], "label": "Technical lead", "text": "..." }
        ]
      }
    }
  ]
}
```

Academic collaboration ids are given flat and chunked three per line. Tailored skill lines are
separated with `\\` rather than the canonical CV's mixed break/paragraph styles — more compact,
and fitting one page matters more on a variant.

## `letter.json`

```jsonc
{
  "sender":    { "name": "Yili Yang, PhD", "contact": "email \\textbar{} phone \\textbar{} city" },
  "recipient": { "name": "", "title": "Hiring Team, ...", "company": "...", "address": "" },
  "date": "12 August 2026",
  "letter": {
    "salutation": "Dear Hiring Team,",
    "paragraphs": [
      { "src": ["exp:woodwell.b1", "exp:woodwell.b7"], "text": "..." },
      { "src": ["none"], "text": "closing pleasantries" }
    ],
    "closing": "Yours sincerely,"
  }
}
```

Renders to a LaTeX PDF **and** a plain-text twin. The `.txt` carries no provenance banner
because it gets pasted into application forms verbatim.

## What rephrasing means

Compress and reweight: drop detail, reorder for the audience, adopt the posting's vocabulary
where it honestly applies. It does **not** mean adding a result, a scale, or a metric the
source does not state.

```
source  exp:woodwell.b7  "Collaborated with UIUC in optimising the workflow of the Deep
                          Learning model inference in big geospatial data (Arctic-scale) in GCP."
tailored                 "Optimised deep-learning inference pipelines over very large
                          datasets on Google Cloud Platform"
```

Same claim, fewer words, no new facts. `verify:app` prints exactly this pairing for every
bullet so the comparison is mechanical.

## The gap report

The firewall says what you *may* claim. The gap report says what the posting wants that you
**cannot**. It scans only requirement-bearing sections of `job.md` (`## Required Qualifications`,
`## Responsibilities`, …), skips company boilerplate, and reports a line only when essentially
none of its distinctive terms appear anywhere in the data layer.

Precision is deliberately favoured over recall: a report that flags nine things gets skimmed,
and the one requirement that genuinely cannot be met gets skimmed with it.

Gaps are **never** auto-filled. Address them openly in the letter, or don't apply.

> The gap report earns its keep in both directions. On its first run it reported that *Python*
> appeared nowhere in the data layer — not a gap in the applicant, a gap in the CV. The fix was
> to add it to `data/skills.json`, which is the honest response to a gap report: change the
> record when the record is wrong, never the claim.

## Commands

```bash
npm run apps                            # every application, grouped by status
npm run tailor     -- <slug>            # VERIFIES, then renders into build/<slug>/
npm run app:status -- <slug> submitted  # move between status folders
npm run verify:app -- <slug>            # the report on its own, without rendering
npm run verify:app -- <slug> --strict   # warnings become failures — what CI runs
npm run pdfs       -- <slug>            # fetch the compiled PDFs from the last CI run
```

Verification is folded into `tailor`, so the firewall cannot be skipped by forgetting a step —
only by choosing to (`--skip-verify`, which CI uses because it runs the strict check itself).

`/apply` (`.claude/skills/apply/`) drives the whole sequence interactively and stops for review.

## Rules

- `job.md` is never edited to agree with the CV.
- Never write to `data/**` or `cv/publications.bib` to make a claim true. A missing fact is
  reported to the owner, who decides whether to add it.
- Tailoring never runs unattended: the human accepts per item before a PDF exists.
- The biosketch is never tailored. It is the complete academic record, not a pitch.
