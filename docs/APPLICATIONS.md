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
                 build/<slug>/       self-contained compile context (gitignored)
                   cv.tex  letter.tex  letter.txt
                   *.tex partials      .cls + fonts/ (copied in)
                          │
                  push → tailor-cv.yml → compiles, then COMMITS BACK:
                          │
                 applications/<status>/<slug>/cv.pdf  letter.pdf  letter.txt
```

## Lifecycle

An application's **status is the folder it sits in** — `drafting`, `submitted`, or `closed`.
The tree is the record; there is no index file that could disagree with it.

```bash
npm run apps                                   # see everything, grouped by status
npm run app:status -- <slug> submitted         # git mv between folders
```

No **command** ever takes a status. Everything resolves an application by **slug**
(`scripts/lib/applications.js`), so `npm run tailor -- <slug>` behaves identically wherever the
application sits.

**CI is the exception, and deliberately so.** A push rebuilds `drafting/` applications, scoped
to what it actually changed:

| What changed in the push | What CI builds |
|---|---|
| One drafting application's `job.md` / `manifest.json` / `letter.json` | That application, alone |
| A shared **source** input — `data/`, `cv/`, `scripts/` | Every drafting application |
| Derived output — `assets/`, `cv/*/generated/`, `data/publications.json` | Nothing |
| Anything, for an application in `submitted/` or `closed/` | Nothing — those are frozen |

The second row is the single-sourcing working: fix a template and the fix has to reach the
tailored CVs, or they quietly keep rendering the old way forever.

The third row is what stops that becoming a treadmill. CI commits its own output back into the
repo, so counting those files as inputs would make every bot commit trigger another full
rebuild on the next push — one whose only effect is a fresh date stamp on every PDF. Their real
sources (`cv/publications.bib`, the templates) are still watched, so nothing is missed.

The fourth row is the one that matters most: promoting an application **freezes its documents**,
which is the point of promoting it. The committed PDF stops moving the moment it becomes the
record of something you sent.

To rebuild on purpose, run the workflow manually — blank slug rebuilds every draft, an explicit
slug reaches any application in any status.

## The documents live with the application

CI compiles the PDFs and **commits them back into the application's own folder**:

```text
applications/drafting/goldman-sachs-applied-ai-researcher/
  job.md  manifest.json  letter.json     ← SOURCE, yours
  cv.pdf  letter.pdf  letter.txt         ← DERIVED, written by CI
```

So one folder is the complete record of one job: what was asked for, what you selected from your
data in response, and the exact documents that went out.

It also means the documents **move with the application**. `npm run app:status -- <slug> submitted`
is a `git mv` of the whole directory, so the PDFs travel with the posting and the manifest as one
unit. Nothing has to be re-associated afterwards, and nothing can be left behind in the old status.

The CV carries a `Last Updated` stamp in its top-right corner. Because a rebuild picks up whatever
the data layer says at that moment, that stamp is what tells two builds of the same application
apart — CI asserts it is present on every compile.

This matters because a rebuild is **not** reproducible. Regenerate a year-old application and you
get a similar but different document — the citation counts in `data/stats.json` have moved
underneath it. The committed PDF is the only thing that records what an employer actually
received. CI artifacts would have expired after 90 days.

The trade-off accepted here is repo size: roughly 80 KB per application per rebuild, in git
history forever. At a few dozen applications that is negligible; it is worth knowing anyway.

**Do not hand-edit `cv.pdf`, `letter.pdf` or `letter.txt`** — they are derived, and the next CI
run overwrites them. Change the manifest and let it rebuild.

The intermediate LaTeX in `build/` stays out of git — it is a compile context, reproducible from
the manifest at any time. Only the inputs and the finished documents are committed.

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
npm run apps                            # every application, status, and whether it has a PDF
npm run tailor     -- <slug>            # VERIFIES, then renders into build/<slug>/
npm run app:status -- <slug> submitted  # move between status folders
npm run verify:app -- <slug>            # the report on its own, without rendering
npm run verify:app -- <slug> --strict   # warnings become failures — what CI runs
```

To get a PDF: commit and push. CI compiles it and commits it back into the application folder.
LaTeX never runs locally.

You do not have to watch for it. `npm run hooks` (once per clone) installs a `pre-push` hook
that starts a background watcher; when CI finishes, it fast-forwards your branch and the PDFs
appear on their own. It only ever fast-forwards, and only when the working tree is clean.

```bash
npm run pdfs        # foreground: prints each run's status, pulls when they finish
tail -f .git/pdf-watch.log   # what the background watcher from the last push is doing
gh run list --commit "$(git rev-parse HEAD)"   # raw, no waiting
```

`npm run pdfs` is also the answer when the hook was skipped (`git push --no-verify`) or when
you pushed from a client that bypasses hooks.

Verification is folded into `tailor`, so the firewall cannot be skipped by forgetting a step —
only by choosing to (`--skip-verify`, which CI uses because it runs the strict check itself).

`/apply` (`.claude/skills/apply/`) drives the whole sequence interactively and stops for review.

## Rules

- `job.md` is never edited to agree with the CV.
- Never write to `data/**` or `cv/publications.bib` to make a claim true. A missing fact is
  reported to the owner, who decides whether to add it.
- Tailoring never runs unattended: the human accepts per item before a PDF exists.
- The biosketch is never tailored. It is the complete academic record, not a pitch.
