# JOB_SEARCH — from job alert to application

The repo already turns a posting into a tailored CV and letter (`/apply`, see
[APPLICATIONS.md](APPLICATIONS.md)). This document covers the step before that: **which postings
deserve `/apply` at all.**

```text
job-alert email ─► screen (title only) ─► read posting ─► npm run score ─► /apply ─► drafting/
   platforms          cheap, drops noise       full text       data/job-search.json
```

## The one rule

**A score is a preference, not a fact.** `data/job-search.json` says what the owner wants, so it
never feeds the CV, the letter or the website, and nothing the scorer prints may be copied into
`data/**`. The scorer only reads.

## Commands

```bash
npm run score -- <slug>                 # score an application's job.md
npm run score -- path/to/posting.md     # score any saved posting
pbpaste | npm run score -- -            # score text on stdin
npm run score -- <...> --json           # machine-readable, for the email watch
```

Output: a total out of 100, a verdict (`apply` ≥ 65, `consider` ≥ 45, otherwise `skip`), the
points per group with the terms that earned them, any penalty, any deal-breaker, and which of your
own skills (`data/skills.json`) the posting names.

## How the score works

| Group | Weight | Full marks when |
|-------|-------:|-----------------|
| Role title | 25 | one fitting title (applied / research / ML / AI / geospatial scientist, research engineer, quantitative researcher, quant developer, lecturer) |
| Skill set | 35 | five of deep learning, computer vision, time series, forecasting, statistics, foundation models, PyTorch, Python, Google Cloud Platform (GCP), Earth Engine … |
| Domain | 15 | two terms from Earth and climate science or from finance (systematic trading, hedge fund, alternative data …) |
| Seniority | 10 | senior, staff, lead, principal, vice president (VP) or PhD |
| Location or work mode | 10 | London, UK, remote, hybrid or Europe |
| Mission | 5 | a small bonus: net zero, sustainability, conservation, research institute, university … |

The skill set carries the most weight on purpose: any sector counts when the skills fit.

Penalties: junior or internship (−20), AI-training or annotation gig work (−25), reporting or
analyst role (−10).

Deal-breakers (verdict `skip` whatever the score): school teaching or tutoring; roles that need an
unrelated professional qualification (nursing, law, pharmacy, social work).

Edit the weights and lists in `data/job-search.json`. Set `"status": "confirmed"` once the owner
has agreed them; until then the scorer prints `(rules status: proposal)`.

## Keep private things out

This repo is public. Pay floors, notice periods, anything about the current employer and anything
personal stay in the owner's private notes, never in `data/job-search.json`.

## Recording outcomes

Every posting that reaches `/apply` gets a folder, so the record stays complete: an application
that was rejected moves to `closed/` with `npm run app:status -- <slug> closed`. The email watch
reads `npm run apps` so it never recommends a role already applied to.
