# JOB_SEARCH — from job alert to application

The repo already turns a posting into a tailored CV and letter (`/apply`, see
[APPLICATIONS.md](APPLICATIONS.md)). This document covers the step before that: **which postings
deserve `/apply` at all.**

```text
job-alert email ─► drop the noise (title only) ─► read the posting ─► judge it ─► /apply ─► drafting/
```

There is no score. A fixed formula was tried and was too rigid: it cannot tell a strong odd-fit
role from a weak on-paper match. Each posting gets a judgment instead, using the questions below.

## The one rule

**A judgment is a preference, not a fact.** Nothing in it feeds the CV, the letter or the
website. The facts about the candidate stay in `data/**`.

## Drop the noise first

Skip on the title alone, without reading further:

- school teaching or tutoring;
- roles that need an unrelated professional qualification (nursing, law, pharmacy, social work);
- AI-training or annotation gig work;
- junior, graduate or internship roles;
- reporting-only analyst roles (dashboards, business intelligence).

## Then judge what is left

Any sector counts, finance and quant included, when the skill set fits. Ask five questions:

1. **Fit.** Does the work use the core skills: applied machine learning on large, messy,
   real-world data (images, time series, geospatial), end-to-end delivery, Python and PyTorch?
   Domain knowledge is a bonus, not a gate.
2. **Chance.** Would a hiring manager short-list this CV? Look at what the posting treats as
   essential. A missing nice-to-have is fine. A missing essential (for example competition-level
   C++ for a low-latency trading role) usually is not.
3. **Pay.** Is the pay at or above what the industry usually pays for this level? Roles that pay
   well below the market for the level are not worth the switch. When the posting gives no pay,
   judge from the employer and the sector.
4. **Workload.** Is the job sustainable? Roles known for very long hours (for example
   front-office investment banking) need pay that clearly makes up for it, and are flagged.
5. **Employer.** Judge the company as a whole: size, stability, standing in its field, and what
   staff say about it. An established company, such as a large technology firm, usually beats an
   early start-up with the same title. A company with a clearly bad reputation, for example poor
   staff reviews on Glassdoor, is a pass whatever the role.

Then give one of three answers, with the one reason that decides it:

- **Worth applying**: good fit, a real chance, fair pay, sustainable hours, a sound employer.
- **Maybe**: one question is unclear or weak; say which.
- **Not this one**: say why in one line.

## Keep private things out

This repo is public. Pay figures, notice periods, anything about the current employer and
anything personal stay in the owner's private notes, never in this repo.

## Recording outcomes

Every posting that reaches `/apply` gets a folder, so the record stays complete: an application
that was rejected moves to `closed/` with `npm run app:status -- <slug> closed`. The email watch
reads `npm run apps` so it never recommends a role already applied to.
