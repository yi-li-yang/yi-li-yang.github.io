# One source for every CV and site fact — design

Date: 2026-11-27. Status: approved by the owner on 2026-11-27, with every `.bib` proposal
accepted and the two-count reading confirmed.
Owner: Yili Yang. Author: Claude (Opus 5.5), in a design conversation with the owner.

## Intent

The owner wants to add a fact once and have it appear everywhere: the one-page CV
(`cv/onepage/ONE-PAGE.tex`), the biosketch (`cv/biosketch/BIOSKETCH.tex`), the website and
the job applications. LinkedIn stays manual and is out of scope.

Today that is true for experience, skills, awards, collaborations and publication counts. It
is not true for these:

- **Education** is typed into both `.tex` shells, and the copies disagree (BSc "Geoscience"
  in one, "Geology" in the other).
- **Mentorship, talks, research initiatives, the research-scope paragraph and the funding
  paragraph** are typed only into `BIOSKETCH.tex`.
- **The counts that summarise those lists** are typed separately into `data/service.json`,
  so a list and its count can disagree. They do: `service.json` says 9 mentees, but the
  biosketch names 8 people. It says 17 invited talks, but only 5 talks in the list are
  invited. (17 was the number of event-years in the list when the count was set on
  2026-04-20.)
- **The biosketch publication list** is a hand-kept list of `\nocite` lines. So adding a paper
  takes two edits: one in the `.bib` and one in the `\nocite` list.
- **The site** types the job title, the employer and partner logo walls and the contact links
  into `index.html`, apart from the data files that the CVs read.

## The rule

Each fact is typed once, in one data file. A number is either typed alone, when no list of
the counted things exists anywhere, or counted from a list. A number is never both typed and
listed.

So `peerReviews` (no list exists) stays a typed number, but `menteesSupervised` (a list
exists) becomes a count of that list.

## Goals

1. Every fact that either PDF prints comes from `data/` or `cv/publications.bib`. Neither
   `.tex` shell contains a hand-typed fact.
2. Every count that the site and the CVs both show is derived from the same list, by the same
   code.
3. Adding a paper, a talk, a mentee, a degree, an initiative or a job is one edit.
4. The site's job title, logo walls and stats cards come from the same data as the CVs.
5. The talk counts on the CV and the site stop overstating: "invited" means invited.

## Non-goals

- New site sections (Education, Talks, Mentorship). The data will support them, but they are
  visible design work. The owner's workflow for visible work is a v0 to look at first, so
  they come in a later round.
- The site's "Tools & Environments" logo wall. It overlaps the CV skills but its logos are
  inline SVG artwork with per-logo colours (`js/modules/tools.js`). Moving artwork into data
  is a separate job. This duplication stays and is recorded under "Known remaining
  duplication".
- LinkedIn.
- Changes to the layout or the look of either PDF beyond the label and content changes listed
  here.

## Anti-goals (the work fails if it does these, even if it builds)

- A PDF or the site shows a number that is higher than the list supports.
- A submitted application (`applications/submitted/`) is edited. Those folders are records of
  what was sent.
- A file gets two writers (CLAUDE.md invariant 2): a script edits `index.html`, or a person
  must edit a DERIVED file.
- The LLM adds a fact that the owner did not give or accept (invariant 6). The `.bib` changes
  below are proposals for the owner to accept as part of approving this design.

## Constraints (from CLAUDE.md and the code)

- Node only, no Python. Nunjucks with `<< >>` and `<% %>` delimiters (`scripts/lib/render.js`).
- Hand-authored `data/*.json` prose contains LaTeX on purpose (`\&`, `--`, `$\times$`); the
  `texesc` filter in `scripts/lib/render.js` is for non-LaTeX sources only. This design keeps
  that decision.
- Rendering is offline and pure. Ingest (`scripts/update-stats.js`) is the only networked step.
- CI commits derived bytes only on `main` (`build-cv.yml`, `tailor-cv.yml`).
- Each file opens with a `SOURCE` or `DERIVED` marker.
- Tailored one-pagers (`scripts/tailor.js`) use the same `ONE-PAGE.tex` shell. So every
  partial that the shell `\input`s must also be produced for a tailored build.

## Approaches

The site cannot read LaTeX, but the data holds LaTeX on purpose. Three ways to bridge that:

- **A. Convert in the browser.** The site fetches the LaTeX-bearing JSON and a small
  `latexToText` module converts it. The counting code lives in one ES module that both Node
  and the browser import. Cost: LaTeX parsing in the browser, and the counting code must run
  in two runtimes.
- **B. Plain text in data.** Rewrite the data files as plain Unicode and escape at LaTeX
  render time. This is the cleanest data, but it touches every template, `tailor.js`, the
  cover-letter renderers and the tests, and it reverses a deliberate decision.
- **C. A derived site file (chosen).** `npm run build` writes `data/site.json` (DERIVED): a
  plain-text, site-ready view of the facts that the site shows (counts, job title, logo walls,
  contact links). The site reads it like it reads the derived `data/publications.json` today.
  The counting and the LaTeX-to-text conversion run once, in Node.

C is chosen because it follows a pattern the repo already uses (`publications.json`), keeps
the browser code simple, keeps one copy of each counting rule, and leaves the LaTeX-in-data
decision alone. Its cost: a site change in `data/` needs a build before it shows locally, and
CI must commit `data/site.json` on `main`.

The owner handed the "how" to Claude, so this choice is Claude's call.

## Owner decisions (from the conversation)

- **BSc subject is Geology.** "Strictly geology, but geoscience is not wrong." Both PDFs
  print Geology.
- **Mentees: 8.** The biosketch names 8 distinct people. Marly Bartkus appears twice (two
  projects in 2025), which is why `service.json` said 9. The count is distinct people. Claude
  proposed this twice and the owner did not object.
- **Remove pending funding applications.** Bezos and Climate Change AI never funded anything.
  They were applications in progress. Delete the biosketch sentence "Pending/ongoing/submitted
  funding applications with NASA, NSF, Google.org and the Bezos Foundation" and the
  `proposalFunders` key in `service.json`.
- **Talks:** internal meetings with no published abstract stay as the owner wrote them. The
  owner confirmed roles and invited status for each event (Appendix A). ICARP IV 2025 is not
  theirs.
- **How the counts print.** The owner's answer was "invited talks panels, conferences, then
  flag out invited ones". The confirmed reading: the one-pager prints two counts, "Invited
  Talks & Panels" and "Conferences" (one event in one year is one), and the biosketch list
  marks each invited event. The National Academies workshop stays `participant`. A single
  count labelled "Invited Talks, Panels & Conferences" was rejected because a reader would
  take "invited" to cover all three nouns, which repeats the overstatement.

## Data model

New and changed files. All are `SOURCE` unless marked. Field names are proposals; the builder
can adjust them if the shape and the rules stay the same.

### `data/education.json` (new)

```json
{
  "institutions": [
    { "id": "edinburgh", "name": "University of Edinburgh", "country": "UK",
      "url": "https://www.ed.ac.uk", "logo": "assets/logos/edinburgh.png" }
  ],
  "degrees": [
    { "id": "phd", "institution": "edinburgh", "level": "PhD", "subject": "Petrophysics",
      "start": "2016-10", "end": "2021-04" },
    { "id": "msc", "institution": "edinburgh", "level": "MSc", "qualifier": "Research",
      "subject": "Geology", "honours": "Distinction", "start": "2015-08", "end": "2016-08" },
    { "id": "bsc", "institution": "edinburgh", "level": "BSc", "subject": "Geology",
      "start": "2011-09", "end": "2015-05" }
  ]
}
```

- One-pager prints the short form: `PhD Petrophysics, 2021` (end year).
- Biosketch prints the long form: `MSc (Research) in Geology, Distinction` with
  `Aug 2015 - Aug 2016`. Months print as three-letter abbreviations in every row (today one
  row says "August"; Claude's call).

### `data/mentorship.json` (new)

Projects, each with mentees and a year. Text is copied from today's biosketch.

| Project | Mentees |
|---|---|
| Multi-domain Timeseries Forecasting | Sandeep Poudel 2026, Dogukan Teber 2025 |
| Satellite Image Labelling Workflow and Training Image Generation | Robb Young 2025, Marly Bartkus 2025 |
| Deep Learning label data curation for ESRI-Woodwell Collaboration | Marly Bartkus 2025 |
| Automatic Improvement of Geospatial Digitisation using Segment Anything Model | Arav Agarwal 2025, Milagros Becerra 2025 |
| Estimation of the Volumetric Loss of Retrogressive Thaw Slumps using DEM | Margo Moceyunas 2024 |
| Using Vision-Transformer to segment Retrogressive Thaw Slumps on Remote Sensing Imagery | Ridhima Singh 2023 |

Mentee count = number of distinct people = 8. The builder chooses how a person is identified
(a person id or the exact name), and a test must fail if one person is spelled two ways.

### `data/talks.json` (new)

One entry per event series. Each entry has `occurrences`, one per year, because the role can
change from year to year (EGU 2022 participant, EGU 2023 and 2024 talks).

```json
{ "id": "egu", "name": "European Geosciences Union General Assembly", "place": "EU",
  "kind": "conference",
  "occurrences": [
    { "year": 2022, "role": "participant", "invited": false },
    { "year": 2023, "role": "talk", "invited": false, "note": "online" },
    { "year": 2024, "role": "talk", "invited": false }
  ] }
```

- `role` is one of `talk`, `panel`, `participant`. `participant` makes no claim either way
  about a talk; it is used where the owner's list does not say.
- `invited` is true only where the owner said so.
- Optional fields: `title`, `url` (source or recording), `note`.

Derived counts:

- **Invited talks & panels** = occurrences with `invited` and `role` in {talk, panel}. Today: 5.
- **Conferences** = all other occurrences. Today: 15 (20 − 5). The unit is one event in one
  year (EGU 2022, 2023 and 2024 count as 3), the same unit the old count of 17 used. These 15
  come from 10 distinct events. Claude recommends the event-year unit; the owner confirms it.
- **Invited (any)** = occurrences with `invited`. Today: 7. The site may show it as a note.

The full list is Appendix A.

### `data/initiatives.json` (new)

Three entries, text copied from today's biosketch: Permafrost Discovery Gateway, Permafrost
Pathways, GeoAI Challenge. Fields: `id`, `title`, `text`.

### `data/profile.json` (new)

Name, `credentials` ("PhD"), phone, personal email, work email, location, the research-scope
paragraph (verbatim from the biosketch) and the profile identifiers (ORCID, GitHub, Scholar,
LinkedIn, website URL).

- The one-pager prints `yyleli@gmail.com`; the site prints `yyl.eli@gmail.com`. Gmail
  ignores dots, so both reach the same inbox. One value goes into `profile.json`:
  `yyl.eli@gmail.com`, the form the site uses (Claude's call).
- `scripts/update-stats.js` reads the identifiers from `profile.json` instead of its own
  `PROFILES` constant. It still writes `stats.json.profiles`, which is a derived copy.

### `data/awards.json` (changed)

Each award gets `amount` (`{ "value": 99749, "currency": "USD" }`) and `objectives` (the
biosketch's "Overall Objectives" sentence, verbatim). The funding total is the sum of the
award amounts. Its display form ("~$100K" for 99749) is derived by a rounding rule the builder
writes; the rule must give "~$100K" for 99749.

### `data/service.json` (changed)

Keeps only numbers that have no list: `peerReviews`, `nsfProposalReviews`, `proposalsLed`,
`proposalsCollaborated`. Removes `fundingAwarded`, `menteesSupervised`, `invitedTalks`
(now derived) and `proposalFunders` (owner decision). Its comments are updated to say so.

### `data/experience.json` and `data/collaborations.json` (changed)

Add `url` and `logo` where the site shows a logo today: Faculty and Woodwell in experience;
Petrobras, Google and Esri in collaborations. An entry without `logo` is not shown on a logo
wall. That keeps today's walls: ICCR and Microsoft have no logo.

### `data/site.json` (new, DERIVED)

Written by `npm run build`. Plain text, no LaTeX. Holds what the site shows: the stats-card
values (mentees, invited talks & panels, conferences, invited count, funding display), the
current job title, and the two logo walls in
display order. The Experience wall is the education institutions with a `logo` (Edinburgh)
followed by the jobs with a `logo` (Faculty, Woodwell). The Collaborations wall is the
industry entries with a `logo`. Contact links are not in this file; they stay in
`index.html` (see Website). The builder decides the exact shape.

## What each output reads

### One-page CV (`ONE-PAGE.tex`)

The shell keeps only layout and `\input`s. New generated partials:

- `generated/header.tex`: name, credentials, email, phone, location (`profile.json`).
- `generated/education.tex`: short form (`education.json`).
- `generated/links.tex`: the Links section (`profile.json`).

Stats column:

- Under Publications, rename "Conferences" to **"Conference Abstracts"**. It counts
  `@inproceedings` entries, and the new talk count under Academic Services would otherwise
  share its label (Claude's call).
- Under Academic Services: "Invited Talks \& Panels: `\invitedtalks`" (5),
  "Conferences: `\conferenceevents`" (15), "Peer-reviews", "Mentees" (8). Macro names are
  proposals; TeX names must be letters only.

### Biosketch (`BIOSKETCH.tex`)

The shell keeps only layout and `\input`s. New generated partials:

- `generated/header.tex` (`\name`, `\address`: phone, work email, ORCID).
- `generated/scope.tex` (research-scope paragraph).
- `generated/education.tex` (long form).
- `generated/nocite.tex`: one `\nocite` per `.bib` entry, in the order the website uses
  (undated work first, then newest year first, same tie-break as `data/publications.json`).
  All 28 entries are `\nocite`d today, so this changes the order but not the content. The
  hand-kept list goes away.
- `generated/funding.tex` (from `awards.json`; the pending-applications sentence is gone).
- `generated/initiatives.tex`, `generated/mentorship.tex`.
- `generated/services.tex`: manuscript reviews and NSF proposal reviews (`service.json`),
  then the talks list from `talks.json`. Each event prints on one line with its years, like
  today. Each invited occurrence is marked, for example "Invited talk:", "Invited panel:" or
  "(invited)" after the year. The builder chooses the marker; it must be visible in print.

### Website

- `js/modules/stats.js` reads the service cards from `data/site.json`:
  "Invited talks & panels: 5" with the note "+ 15 conferences", "Mentees: 8", "Funding:
  ~$100K", "Peer reviews" (unchanged). Wording is Claude's call.
- The hero job title (`.hero-eyebrow`) and both logo walls are rendered from
  `data/site.json` at runtime. `seo.js` already reads the eyebrow.
- The publication filter chips (`js/modules/publications.js`) count Journal and Conference
  with their own rule (no year means unfinished, whatever the type). Each chip keeps counting
  the cards it filters, so a chip's number always equals what it shows. A test pins those
  counts to `pubCounts()` in `scripts/lib/data.js` for the real data, so the site and the CV
  cannot drift apart unnoticed. The "Conference" chip is renamed "Conference abstracts" to
  match the CV label (Claude's call; changed during planning from "write the counts into
  `data/site.json`", because a chip number that differs from its cards would confuse).
- Facts that must stay in static HTML for crawlers and link previews: the job title in
  `<meta name="description">` and `og:description`, and the hero contact links. These stay
  hand-written in `index.html`. A new test fails when they differ from `profile.json` and the
  current role in `experience.json`. This keeps one writer per file; the cost is a second edit
  when the job title changes, which the test then forces.

### Applications

- New citation prefixes in `scripts/verify-application.js`: `edu:<id>`, `talk:<id>`,
  `mentor:<project-id>`, `init:<id>`, `profile.<key>`, plus a way to cite the derived counts
  (for example `derived.menteeCount`). The builder chooses the syntax.
- `service.menteesSupervised`, `service.invitedTalks`, `service.fundingAwarded` and
  `service.proposalFunders` stop resolving. Only `applications/submitted/woodwell-research-
  scientist-ii` cites them. It is a frozen record, CI does not re-verify `submitted/`, and it
  is not edited. If any drafting application cites them, the builder updates its citations.
- `scripts/tailor.js` must produce every partial the shell now `\input`s (header, education,
  links), or tailored builds break.
- The cover-letter sender block (name, email, phone, city) is typed into each `letter.json`
  today, which is a second copy of `profile.json`. It moves to `profile.json`: `tailor.js`
  fills the sender from it, `sender` leaves the `letter.json` contract, and the three
  cover-letter templates, `docs/APPLICATIONS.md` and the `/apply` skill are updated.
  Submitted letters are not touched (Claude's call; it follows the rule above).

## `.bib` proposals (the owner accepts these by approving this design)

The owner may strike any line.

1. Fix `rogers2023permafrost`: the abstract number is B33H-2330, not B33H-233; "Virkalla" is
   "Virkkala".
2. Fix `clelland2025machine`: "Hosking, J.Scottand Potter, Stefano" makes a false author.
   It becomes "Hosking, J. Scott and Potter, Stefano".
3. Add the InterPore 2019 abstract that Yili presented ("Fluid displacement and trapping
   during two-phase steady-state flow in complex carbonate imaged by synchrotron x-ray
   microtomography", Yang, Butler, Fusseis, van Dijke, Geiger, Xiao;
   https://events.interpore.org/event/12/contributions/1177/).
4. Add eight co-authored abstracts that someone else presented. The builder copies each
   entry (full author list, title, number) from the linked official page and shows the owner
   the `.bib` diff before it is committed; CLAUDE.md allows the LLM to propose a `.bib` entry
   for human acceptance. The AMS abstract has no link yet: the builder looks for it on the
   AMS 103rd Annual Meeting site, and if it cannot be found, that entry is dropped and
   reported.
   - AGU 2022 B52J-0995, Potter et al., "Mapping Alaskan and Canadian Wildfires using
     Convolutional Neural Networks" (a different abstract from `potter2023mapping`).
     https://agu.confex.com/agu/fm22/meetingapp.cgi/Paper/1159514
   - AMS 103rd Annual Meeting 2023, 8B.4, Mullen et al., "The Outsized Influence of Ponds on
     Surface Water Variability and the Carbon Cycle in Alaska's Boreal and Tundra Regions".
   - NASA ABoVE ASTM 9 2023, poster 14, Rogers et al., "Permafrost Pathways: Connecting
     Science, People, and Policy for Arctic Justice and Global Climate".
     https://cce-datasharing.gsfc.nasa.gov/conferences/absbyid/37/37/h/1
   - AGU 2024 B13I-1652, Clelland et al., "Machine Learning Projections of Fire Occurrence in
     the Arctic-Boreal Zone for 2025-2100 under Different SSP Scenarios".
     https://agu.confex.com/agu/agu24/meetingapp.cgi/Paper/1525166
   - AGU 2024 B33H-1627, Dean et al., "ARTS: a scalable data set for Arctic Retrogressive
     Thaw Slumps". https://agu.confex.com/agu/agu24/meetingapp.cgi/Paper/1592281
   - AGU 2025 EP23A-04, Rodenhizer et al., "A Circumpolar Map of Retrogressive Thaw Slump
     Susceptibility". https://agu.confex.com/agu/agu25/meetingapp.cgi/Paper/1916917
   - AGU 2025 H14D-06, Agarwal et al., "Enhancing Geospatial Label Accuracy with Prompt-Based
     Zero-Shot Segment Anything Model: A Retrogressive Thaw Slump Case Study".
     https://agu.confex.com/agu/agu25/meetingapp.cgi/Paper/1925339
   - AGU 2025 B13G-1631, Potter et al., "Burned area mapping across the Arctic-boreal zone
     with Landsat and Sentinel-2 imagery".
     https://agu.confex.com/agu/agu25/meetingapp.cgi/Paper/1953514

Effect: "Conference Abstracts" goes from 9 to 18, and the biosketch list grows from 28 to 37
entries. Because `nocite.tex` is generated, no second edit is needed.

One text fix outside the `.bib`: the biosketch says "European Geophysical Union". EGU is the
European Geosciences Union. `talks.json` uses the correct name.

## Documentation changes

- CLAUDE.md, "Adding a publication is two edits, not one": replace it with the new rule (one
  edit; `nocite.tex` is generated).
- CLAUDE.md layout and `docs/ARCHITECTURE.md`: list the new data files and `data/site.json`.
- `docs/APPLICATIONS.md`: list the new citation prefixes.

## Verification

- `npm run build` and `npm test` pass. New tests check at least: the derived counts (mentees
  8, invited talks & panels 5, conferences 15, invited 7, funding "~$100K"); every `\input` in
  both shells has a generator; neither shell contains a hand-typed year or count outside
  comments; the static `index.html` facts match the data.
- Both PDFs compile in CI. Locally, `npm run pdf` gives a Tectonic preview only (CLAUDE.md).
- Compare the PDF text before and after. The only differences are the ones this design
  lists: labels, the counts (17 becomes 5 and 15; 9 mentees becomes 8), BSc Geology, the
  removed pending-funding sentence, the talks list (InterPore 2019, Faculty Demo Day 2021,
  invited markers, EGU name), the biosketch publication order, and the accepted `.bib`
  changes.
- The site looks the same except for the stats cards and the publication chip counts and
  label: compare screenshots at desktop and phone widths (the owner's design workflow).
- One tailored build still compiles to one page. No drafting application exists, and
  tailoring a submitted slug rewrites its `letter.md`, so the builder copies one application
  folder to a temporary, uncommitted drafting slug, tailors it, checks the page count, and
  deletes the copy.

## Left to the builder

- Exact field names, the shape of `data/site.json`, and the person-identity method in
  `mentorship.json`.
- Template names, macro names and the invited marker in print.
- The funding rounding rule (within the "~$100K" constraint).
- Work on a new branch cut from `site/polish-after-restyle`, not from `main`: that branch
  holds an unmerged commit that changes `index.html`, `stats.js` and `publications.js`, the
  same files this work changes. Its uncommitted files (`data/claude-skills.json`,
  `data/previews.json`, `assets/previews/`) are not part of this work and are not staged.
- Add `data/site.json` to the `git add` list in `build-cv.yml`, and check whether
  `tailor-cv.yml` needs the new partials.

## Known remaining duplication (accepted)

- The "Tools & Environments" logo wall in `index.html` restates some CV skills
  (`data/skills.json`). See Non-goals.
- The job title in the static meta tags, guarded by a test (see Website).

## Appendix A: talks list (20 occurrences)

Sources: the owner's biosketch list and their answers on 2026-11-27, the owner's personal
email, and public pages where linked.

| Event | Year | Place | Role | Invited | Source or note |
|---|---|---|---|---|---|
| AGU Fall Meeting | 2018 | US | talk | no | oral H41E-08, 13 Dec 2018 |
| InterPore 2019 | 2019 | Valencia, Spain | talk | no | events.interpore.org/event/12/contributions/1177 |
| Faculty Fellowship Demo Day XXI | 2021 | UK | talk | no | youtube.com/watch?v=-rtQqj4A-Eg ("Demo Day XXI - Woodwell - Yili") |
| EGU General Assembly | 2022 | EU | participant | no | no public abstract; kept as the owner wrote it |
| EGU General Assembly | 2023 | online | talk | no | session EGU23/45866, presented online |
| EGU General Assembly | 2024 | EU | talk | no | ARTS abstract; owner confirmed they presented |
| Google Geo for Good Summit | 2022, 2023, 2025 | US/Singapore | participant | no | |
| Tri-Polar Remote Sensing Conference | 2023, 2024 | China | participant | no | |
| RTSInTrain Workshop | 2023 | EU | participant | no | |
| NASA ABoVE 8th Science Team Meeting | 2022 | US | talk | no | pre-recorded research highlight, "Using Deep Neural Networks to Map Retrogressive Thaw Slumps in the Northern Siberia" |
| Permafrost Discovery Gateway Webinar | 2022 | online | talk | yes | 7 Jul 2022 |
| Royal Meteorological Society webinar, "Machine Learning for Atmospheric Sciences: Values and Controversies" | 2022 | UK | talk | yes | |
| Arctic Carbon Flux Upscaling Workshop | 2024 | Sweden | talk | yes | |
| Esri UC Spatial Analytics Summit | 2024 | US | panel | yes | |
| Cyber2A Workshop | 2024 | US | talk | yes | |
| National Academies workshop, "Accelerating Climate Progress with AI: From Science to Action" | 2024 | US | participant | yes | owner: invited; role not stated |
| TFFF: Pathways to Impact, London Climate Action Week | 2026 | UK | participant | yes | owner: invited, no talk |

Counts from this table: 20 occurrences; 5 invited talks & panels; 15 conferences; 7 invited.
If the owner spoke at the National Academies workshop, its role becomes `talk`, and the counts
become 6 and 14.
