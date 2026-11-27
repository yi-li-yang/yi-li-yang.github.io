# One Source for Every CV and Site Fact — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every fact that the two PDFs and the site show is typed once in `data/` (or the `.bib`), and every count is derived from its list.

**Architecture:** New hand-written data files (education, mentorship, talks, initiatives, profile) feed new Nunjucks partials that both `.tex` shells `\input`. One module, `scripts/lib/derive.js`, holds every counting rule; the CV macros, the citation resolver and a new derived `data/site.json` all call it. The site reads `data/site.json` for its stats cards, job title and logo walls.

**Tech Stack:** Node 20 ESM, Nunjucks (`<< >>` / `<% %>`), `node --test`, LaTeX (XeLaTeX one-pager, pdfLaTeX + bibtex biosketch in CI; Tectonic locally), vanilla browser ES modules.

**Spec:** `docs/superpowers/specs/2026-11-27-cv-site-ssot-design.md` (read it first; its appendices hold the data content).

## Global Constraints

- Branch `ssot/one-source-facts`, cut from `site/polish-after-restyle` (not `main`). Never stage `data/claude-skills.json`, `data/previews.json` or `assets/previews/`; they are someone else's uncommitted work. Stage explicit paths only.
- Commit at the end of each task on that branch. Never push. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Node only, no Python, no new npm dependencies.
- Every new file opens with its ownership marker: `SOURCE — you own this file. Edit freely, by hand or by agent.` (JSON: an `_edit` key; JS/TeX: first-line comment) or `DERIVED — …` naming the command that regenerates it.
- Hand-authored `data/*.json` prose may contain LaTeX (`\&`, `--`, `$\times$`). Do not pass it through `texesc`.
- Never edit anything under `applications/submitted/`.
- Exact values the tests pin (from the spec): mentees **8**; invited talks & panels **5**; conferences **15**; invited **7**; talk occurrences **20**; funding total **99749**, display **"~$100K"**; BSc subject **Geology**.
- One-pager labels (exact): `Conference Abstracts: \conferences`, `Invited Talks \& Panels: \invitedtalks`, `Conferences: \conferenceevents`. Site chip label: `Conference abstracts`.
- Contact email everywhere: `yyl.eli@gmail.com`.

## Review Focus

1. A talks entry whose years disagree on `invited`, or an invited entry with mixed roles → `npm run build` stops with a message naming the entry id. (Test: Task 1.)
2. One mentee spelled two ways (case or spacing) → the build stops and names both spellings. (Test: Task 1.)
3. A bare `&`, `%`, `#` or `_` in prose of the new data files → the build stops before LaTeX does, naming the file and key. (Test: Task 1.)
4. `data/site.json` fails to load → the ingest stats cards still render, the logo walls and eyebrow stay empty, and nothing throws. (Check: Task 5, Step 8.)
5. An application whose `letter.json` still has `sender` → `tailor.js` ignores it, prints one warning, and uses `profile.json`. (Test: Task 4.)

---

### Task 0: Branch

- [ ] **Step 1:** `git switch -c ssot/one-source-facts` (from `site/polish-after-restyle`). Run `git status`; expected: the three unrelated paths above still show as modified/untracked.
- [ ] **Step 2:** Commit the spec and this plan:

```bash
git add docs/superpowers/specs/2026-11-27-cv-site-ssot-design.md docs/superpowers/plans/2026-11-27-cv-site-ssot.md
git commit -m "docs: design and plan for one source per CV and site fact"
```

### Task 1: Data files, loader and counting rules

**Files:**
- Create: `data/education.json`, `data/mentorship.json`, `data/talks.json`, `data/initiatives.json`, `data/profile.json`, `scripts/lib/derive.js`, `test/derive.test.js`
- Modify: `data/awards.json`, `data/service.json`, `data/experience.json`, `data/collaborations.json`, `scripts/lib/data.js`, `scripts/bib-to-json.js`, `scripts/update-stats.js:21-26`, `CLAUDE.md` (layout block), `docs/ARCHITECTURE.md`

**Interfaces:**
- Produces (`scripts/lib/data.js`): `loadData()` now also returns `education`, `mentorship`, `talks`, `initiatives`, `profile`, and runs the three validators below (so a bad file fails every build). `sortPublications(publications) -> publications[]` (moved from `bib-to-json.js`: undated first, then year descending, stable).
- Produces (`scripts/lib/derive.js`):
  - `menteeCount(mentorship) -> number` — distinct people.
  - `talkCounts(talks) -> { occurrences, invited, invitedTalksPanels, conferences }`.
  - `fundingTotal(awards) -> number` — sum of `awards.awards[].amount.value`.
  - `fundingDisplay(value) -> string | null` — `null` for 0; else `~$` + 2 significant figures, `K` below 1,000,000, `M` from 1,000,000.
  - `derivedFacts(data) -> { menteeCount, invitedTalksPanels, conferences, invitedCount, fundingTotal, fundingDisplay }` — the one object every consumer reads.
  - `validateMentorship(m)`, `validateTalks(t)`, `assertNoBareSpecials(obj, file)` — each throws `Error` with the offending id/key in the message.

**Data content** (copy text verbatim from today's `BIOSKETCH.tex` / `ONE-PAGE.tex`; shapes are in the spec's "Data model"):
- `education.json`: the three degrees with `start`/`end` as `YYYY-MM` (PhD 2016-10→2021-04; MSc 2015-08→2016-08, qualifier `Research`, honours `Distinction`; BSc 2011-09→2015-05, subject `Geology`). Institution `edinburgh` carries `logo: { name: "University of Edinburgh", url: "https://www.ed.ac.uk", src: "assets/logos/edinburgh.png", width: 831, height: 199 }`.
- `mentorship.json`: `{ projects: [{ id, title, mentees: [{ name, year }] }] }`, six projects in today's biosketch order (spec table), ids `multi-domain-ts`, `labelling-workflow`, `esri-label-curation`, `sam-digitisation`, `rts-volume-dem`, `vit-rts`.
- `talks.json`: `{ entries: [{ id, name, place, kind, occurrences: [{ year, role, invited, title?, url?, note? }] }] }`. Fifteen entries in this file order (stable sort later relies on it): `tfff-lcaw`, `nas-ai-workshop`, `acfu-workshop`, `esri-uc`, `cyber2a`, `egu`, `geo-for-good`, `tri-polar`, `rtsintrain`, `above-stm8`, `pdg-webinar`, `rmets-webinar`, `faculty-demo-day`, `interpore`, `agu`. Roles, invited flags, years, titles and URLs come from spec Appendix A. `place` is `null` for `pdg-webinar`. `kind` ∈ conference | workshop | summit | webinar | demo-day. EGU's name is "European Geosciences Union General Assembly".
- `initiatives.json`: `{ initiatives: [{ id, title, text }] }` — `pdg`, `permafrost-pathways`, `geoai-challenge`.
- `profile.json`: `name` "Yili Yang", `credentials` "PhD", `phone` "+44 7490334233", `email` "yyl.eli@gmail.com", `workEmail` "yyang@woodwellclimate.org", `location` "London, UK", `website` "https://yi-li-yang.github.io/", `researchScope` (verbatim), `profiles: { orcid, github, scholar, linkedin }` (values from `update-stats.js` PROFILES).
- `awards.json` `fcs-2025`: add `org: "Woodwell Climate Research Center"`, `amount: { value: 99749, currency: "USD" }`, `objectives` (verbatim "This project will attempt…"). Update the `_comment` that says the amount lives in stats.json.
- `service.json`: remove `fundingAwarded`, `menteesSupervised`, `invitedTalks`, `proposalFunders` and `_comment_talks`; rewrite `_comment` to state the rule ("only numbers with no list live here").
- `experience.json`: `logo` objects on `faculty` (`assets/logos/faculty-ai.png`, 2288×405, name "Faculty.ai", url https://faculty.ai) and `woodwell` (`assets/logos/woodwell.png`, 165×33, url https://www.woodwellclimate.org).
- `collaborations.json`: `logo` on `petrobras-edinburgh` (`assets/logos/petrobras.svg`, 216×43, url https://www.petrobras.com.br), `google-woodwell` (`https://cdn.simpleicons.org/google`, 24×24, url https://www.google.com), `esri-woodwell` (`https://cdn.simpleicons.org/esri`, 24×24, url https://www.esri.com). Names: "Petrobras", "Google", "Esri".

- [ ] **Step 1: Write the failing tests** in `test/derive.test.js`:

```js
const data = loadData();
test('real data: counts match the spec', () => {
  const f = derivedFacts(data);
  assert.equal(f.menteeCount, 8);
  assert.equal(f.invitedTalksPanels, 5);
  assert.equal(f.conferences, 15);
  assert.equal(f.invitedCount, 7);
  assert.equal(f.fundingTotal, 99749);
  assert.equal(f.fundingDisplay, '~$100K');
  assert.equal(talkCounts(data.talks).occurrences, 20);
});
test('a person in two projects counts once', () => {
  const m = { projects: [{ id: 'a', mentees: [{ name: 'X Y', year: 2025 }] },
                         { id: 'b', mentees: [{ name: 'X Y', year: 2025 }] }] };
  assert.equal(menteeCount(m), 1);
});
test('one person spelled two ways fails', () => {
  const m = { projects: [{ id: 'a', mentees: [{ name: 'Marly Bartkus', year: 2025 }] },
                         { id: 'b', mentees: [{ name: 'marly  bartkus', year: 2025 }] }] };
  assert.throws(() => validateMentorship(m), /Marly Bartkus.*marly  bartkus/);
});
test('mixed invited flags in one entry fail', () => {
  const t = { entries: [{ id: 'e1', name: 'E', place: 'X', kind: 'conference', occurrences: [
    { year: 2023, role: 'talk', invited: true }, { year: 2024, role: 'talk', invited: false }] }] };
  assert.throws(() => validateTalks(t), /e1/);
});
test('invited entry with mixed roles fails', () => { /* talk + panel, both invited */ assert.throws(/* … */, /e1/); });
test('unknown role and duplicate year fail', () => { /* role 'keynote'; two 2024 occurrences */ });
test('bare specials in prose fail, URLs are exempt', () => {
  assert.throws(() => assertNoBareSpecials({ text: 'A & B' }, 'x.json'), /x\.json.*text/);
  assert.doesNotThrow(() => assertNoBareSpecials({ text: 'A \\& B', url: 'https://a.b/c_d#e' }, 'x.json'));
});
test('fundingDisplay', () => {
  assert.equal(fundingDisplay(0), null);
  assert.equal(fundingDisplay(45000), '~$45K');
  assert.equal(fundingDisplay(1250000), '~$1.3M');
});
test('sortPublications puts undated first, then newest', () => { /* three synthetic entries */ });
```

`assertNoBareSpecials` skips keys named `url`, `src`, `email`, `workEmail`, `website`, `logo`, and `profiles`; it flags `&`, `%`, `#`, `_` not preceded by `\`.

- [ ] **Step 2:** Run `node --test test/derive.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3:** Write the data files listed above, then implement `scripts/lib/derive.js` and the `loadData()` / `sortPublications()` changes. `loadData()` calls `validateMentorship`, `validateTalks`, and `assertNoBareSpecials` on education, mentorship, talks, initiatives and profile. `bib-to-json.js` imports `sortPublications`. `update-stats.js` reads `PROFILES` from `data/profile.json` `profiles` (it still writes `stats.json.profiles`).
- [ ] **Step 4:** Run `npm test`. Expected: all pass, including `fetch-previews.test.js`. Run `npm run build`; expected: it still succeeds (`emit-metrics-tex.js` still reads the removed `service.*` keys and falls back to 0 for now; Task 2 fixes that).
- [ ] **Step 5:** Update the CLAUDE.md layout block and `docs/ARCHITECTURE.md` to list the five new data files and `data/site.json` (Task 5). Commit:

```bash
git add data/education.json data/mentorship.json data/talks.json data/initiatives.json data/profile.json data/awards.json data/service.json data/experience.json data/collaborations.json scripts/lib/derive.js scripts/lib/data.js scripts/bib-to-json.js scripts/update-stats.js test/derive.test.js CLAUDE.md docs/ARCHITECTURE.md
git commit -m "data: lists for education, mentorship, talks, initiatives, profile; counts derived"
```

### Task 2: One-pager from generated partials, and tailored builds

**Files:**
- Create: `scripts/lib/cv-jobs.js`, `cv/templates/onepage-header.tex.njk`, `onepage-education.tex.njk`, `onepage-links.tex.njk`, `test/shells.test.js`
- Modify: `scripts/render-cv.js`, `scripts/emit-metrics-tex.js`, `cv/onepage/ONE-PAGE.tex`, `scripts/tailor.js`, `.github/workflows/tailor-cv.yml:175`

**Interfaces:**
- Consumes: `loadData()`, `derivedFacts()` (Task 1).
- Produces: `canonicalJobs(data) -> Array<{ template, out, src, context }>` in `scripts/lib/cv-jobs.js` (today's `jobs` array from `render-cv.js`, plus the new ones). `render-cv.js` becomes `for (const job of canonicalJobs(loadData())) renderPartial(job)`. Task 3 appends biosketch jobs to the same function.
- Produces macros in `generated/metrics.tex`: `\mentees` = menteeCount, `\invitedtalks` = invitedTalksPanels, `\conferenceevents` = conferences (new), `\funding` = fundingTotal with thousands separators. `\conferences` stays the `@inproceedings` count.

Template output (exact):
- header: `{\huge \textbf{YILI YANG}, PhD}` then the line `\href{mailto:yyl.eli@gmail.com}{yyl.eli@gmail.com} |` / `+44 7490334233 | \faMapMarker London, UK`, built from `profile` (name upper-cased with the `upper` filter).
- education: `\subsection{University of Edinburgh}` then one `\descript{<level> <subject>, <end year>}` per degree: `PhD Petrophysics, 2021`, `MSc Geology, 2016`, `BSc Geology, 2015`.
- links: today's Links block, every URL built from `profile.website` and `profile.profiles`.

- [ ] **Step 1: Write the failing tests** in `test/shells.test.js`:

```js
const strip = (tex) => tex.split('\n').filter((l) => !/^\s*%/.test(l)).join('\n');
for (const shell of ['cv/onepage/ONE-PAGE.tex', 'cv/biosketch/BIOSKETCH.tex']) {
  test(`${shell}: no hand-typed facts outside comments`, () => {
    const body = strip(read(shell));
    assert.doesNotMatch(body, /\b(19|20)\d{2}\b/);   // years
    assert.doesNotMatch(body, /@|\+44/);              // email, phone
    assert.doesNotMatch(body, /\\nocite\{/);          // hand-kept citation list
  });
  test(`${shell}: every \\input{generated/X} has a canonical job`, () => {
    const outs = new Set(canonicalJobs(loadData()).map((j) => j.out));
    for (const [, name] of read(shell).matchAll(/\\input\{generated\/([\w-]+)\.tex\}/g)) {
      if (name === 'metrics') continue;   // written by emit-metrics-tex.js
      assert.ok(outs.has(`${dirname(shell)}/generated/${name}.tex`), name);
    }
  });
}
test('one-pager education renders BSc Geology', () => {
  const job = canonicalJobs(loadData()).find((j) => j.out.endsWith('onepage/generated/education.tex'));
  assert.match(env.render(job.template, job.context), /\\descript\{BSc Geology, 2015\}/);
});
```

The biosketch shell assertions fail until Task 3; mark them `{ todo: true }` here and remove the flag in Task 3.

- [ ] **Step 2:** Run `node --test test/shells.test.js`. Expected: one-pager tests FAIL (years, email, phone present).
- [ ] **Step 3:** Create `cv-jobs.js` and the three templates; switch `render-cv.js` to it. In `emit-metrics-tex.js` take mentees, invited talks, conference events and funding from `derivedFacts(data)`. In `ONE-PAGE.tex` replace the name/contact lines, the Education section body and the Links section body with `\input{generated/header.tex}`, `\input{generated/education.tex}`, `\input{generated/links.tex}`, and set the three Stats labels from Global Constraints.
- [ ] **Step 4:** In `tailor.js`, replace the single `metrics.tex` copy with a list `SHARED = ['metrics', 'header', 'education', 'links']`: copy each from `cv/onepage/generated/` and redirect its `\input`. In `tailor-cv.yml` line 175, run `node scripts/emit-metrics-tex.js && node scripts/render-cv.js` so the shared partials exist in CI.
- [ ] **Step 5:** Run `npm run build && npm test`. Expected: PASS (biosketch todos reported as todo). Compile a preview: `tectonic -o "$SCRATCH" cv/onepage/ONE-PAGE.tex` from `cv/onepage/`; expected: one page, `pdftotext` shows "Invited Talks & Panels: 5", "Conferences: 15", "Mentees: 8", "BSc Geology, 2015".
- [ ] **Step 6:** Commit (`scripts/lib/cv-jobs.js scripts/render-cv.js scripts/emit-metrics-tex.js cv/templates/onepage-*.tex.njk cv/onepage/ONE-PAGE.tex cv/onepage/generated scripts/tailor.js .github/workflows/tailor-cv.yml test/shells.test.js`), message `cv: one-pager reads header, education, links and talk counts from data`.

### Task 3: Biosketch from generated partials

**Files:**
- Create: `cv/templates/biosketch-{header,scope,education,nocite,funding,initiatives,mentorship,services}.tex.njk`
- Modify: `scripts/lib/cv-jobs.js`, `cv/biosketch/BIOSKETCH.tex`, `test/shells.test.js`, `CLAUDE.md` ("Adding a publication is two edits" decision)

**Interfaces:**
- Consumes: `canonicalJobs` (Task 2), `sortPublications`, `derivedFacts` (Task 1).
- Produces: eight more jobs writing `cv/biosketch/generated/<name>.tex`.

Template rules (keep today's markup; copy it from `BIOSKETCH.tex`):
- header: `\name{YILI YANG}` and `\address{+44 7490334233\textbar\textbar yyang@woodwellclimate.org\textbar\textbar ORCID 0000-0002-1791-3899}`. It is `\input` in the preamble, where today's two lines are.
- education: long form `\textbf{<level>[ (<qualifier>)] in <subject>[, <honours>]} \hfill {<Mon YYYY> - <Mon YYYY>}`, months as three-letter English abbreviations. So "BSc in Geology", "Aug 2015 - Aug 2016".
- nocite: one `\nocite{<key>}` per entry of `sortPublications(data.publications)`.
- funding: per award, `<title>: <project>, <org>, \$<amount with thousands separators>`, blank line, `Overall Objectives: <objectives>`. No pending-applications sentence.
- services: `\begin{itemize}`, `\item Manuscripts review: \peerreviews`, `\item NSF Proposal review: \nsfreviews`, then one `\item` per talks entry, sorted by its latest year descending (stable): `<prefix><name>[, <place>] \hfill <years joined by ", ">`. Prefix only for invited entries: role talk → `Invited talk: `, panel → `Invited panel: `, participant → `Invited: `.
- mentorship, initiatives, scope: today's markup, data from Task 1.

- [ ] **Step 1: Write the failing tests** (append to `test/shells.test.js`; remove the `todo` flags from Task 2):

```js
const render = (suffix) => { const j = jobs.find((x) => x.out.endsWith(suffix)); return env.render(j.template, j.context); };
test('services marks invited events and prints every occurrence year', () => {
  const s = render('biosketch/generated/services.tex');
  assert.match(s, /Invited panel: Esri UC Spatial Analytics Summit, US \\hfill 2024/);
  assert.match(s, /Invited: Tropical Forest Forever Facility/);
  assert.match(s, /European Geosciences Union General Assembly, EU \\hfill 2022, 2023, 2024/);
  assert.doesNotMatch(s, /Invited[^\n]*European Geosciences/);
});
test('nocite lists every bib entry in website order', () => {
  const keys = [...render('biosketch/generated/nocite.tex').matchAll(/\\nocite\{([^}]+)\}/g)].map((m) => m[1]);
  assert.deepEqual(keys, sortPublications(data.publications).map((p) => p.key));
});
test('funding has no pending applications', () => assert.doesNotMatch(render('biosketch/generated/funding.tex'), /Pending/));
test('mentorship names 8 distinct people', () => { /* count distinct names in mentorship.tex === 8 */ });
```

- [ ] **Step 2:** Run `node --test test/shells.test.js`. Expected: FAIL.
- [ ] **Step 3:** Write the eight templates, append the jobs, and replace each matching block in `BIOSKETCH.tex` with its `\input`. Rewrite the CLAUDE.md decision "Adding a publication is two edits, not one" to: one edit in `cv/publications.bib`; `generated/nocite.tex` lists every entry.
- [ ] **Step 4:** Run `npm run build && npm test`. Expected: PASS. Compile a preview from `cv/biosketch/` with Tectonic (bibtex runs automatically; XeTeX character warnings are engine noise per CLAUDE.md). Expected: the talks list shows 15 lines with 7 invited markers; Mentorship lists 8 people; no "Pending".
- [ ] **Step 5:** Commit (`cv/templates/biosketch-*.tex.njk scripts/lib/cv-jobs.js cv/biosketch/BIOSKETCH.tex cv/biosketch/generated test/shells.test.js CLAUDE.md`), message `cv: biosketch reads every section from data; nocite list generated`.

### Task 4: Applications — citations and sender

**Files:**
- Create: `scripts/lib/tokens.js`, `test/tokens.test.js`
- Modify: `scripts/verify-application.js:80-140`, `scripts/lib/applications.js`, `scripts/tailor.js:170-176`, `docs/APPLICATIONS.md:171`, `.claude/skills/apply/SKILL.md`

**Interfaces:**
- Produces: `makeResolver(data, { jobText }) -> (token) => { text, kind } | null` and `normaliseToken(token) -> string` in `scripts/lib/tokens.js` (today's `resolveToken` / `normalise`, moved). New schemes: `edu:<degreeId>`, `talk:<entryId>`, `mentor:<projectId>`, `init:<initiativeId>`, `profile.<key>` (dotted), `derived.<key>` (keys of `derivedFacts`).
- Produces: `senderBlock(profile) -> { name, contact }` in `scripts/lib/applications.js`: name `"Yili Yang, PhD"`, contact `"yyl.eli@gmail.com \\textbar{} +44 7490334233 \\textbar{} London, UK"`.

- [ ] **Step 1: Write the failing tests** in `test/tokens.test.js`:

```js
const resolve = makeResolver(loadData(), { jobText: '' });
test('new schemes resolve', () => {
  for (const t of ['edu:bsc', 'talk:esri-uc', 'mentor:multi-domain-ts', 'init:pdg', 'profile:email', 'derived:menteeCount'])
    assert.ok(resolve(t), t);
  assert.match(resolve('derived:menteeCount').text, /8/);
});
test('removed service keys no longer resolve', () => {
  for (const k of ['menteesSupervised', 'invitedTalks', 'fundingAwarded', 'proposalFunders'])
    assert.equal(resolve(normaliseToken(`service.${k}`)), null);
});
test('senderBlock comes from profile', () => {
  assert.deepEqual(senderBlock(loadData().profile), { name: 'Yili Yang, PhD',
    contact: 'yyl.eli@gmail.com \\textbar{} +44 7490334233 \\textbar{} London, UK' });
});
test('tailor ignores a letter.json sender and warns once', () => { /* run tailor's context builder on a letter with `sender`; assert profile sender used and one warning */ });
```

For the last test, export the context builder from `tailor.js` as `letterContext(letterDoc, profile, warn) -> { sender, recipient, date, letter }` (move it to `scripts/lib/applications.js` so the test does not run the script).

- [ ] **Step 2:** Run `node --test test/tokens.test.js`. Expected: FAIL.
- [ ] **Step 3:** Move the resolver into `tokens.js`, add the schemes, and make `verify-application.js` use it (its smell-test word list also gains degree subjects, talk names and initiative titles). Add `senderBlock` and `letterContext`; `tailor.js` calls `letterContext`. Update `docs/APPLICATIONS.md` (new prefixes; `sender` removed from the `letter.json` contract) and the `/apply` skill (it must not write `sender`).
- [ ] **Step 4:** Run `npm test`. Expected: PASS. Run `npm run verify:app -- coreweave-senior-applied-researcher`. Expected: it passes as before (it cites only `award:` and `collab:`).
- [ ] **Step 5:** Commit (`scripts/lib/tokens.js scripts/verify-application.js scripts/lib/applications.js scripts/tailor.js test/tokens.test.js docs/APPLICATIONS.md .claude/skills/apply/SKILL.md`), message `apply: cite the new lists; cover-letter sender from profile.json`.

### Task 5: The site reads `data/site.json`

**Files:**
- Create: `scripts/lib/text.js`, `scripts/build-site-json.js`, `js/modules/facts.js`, `js/modules/pub-category.js`, `test/site.test.js`
- Modify: `scripts/lib/render.js` (the `untex` filter imports from `text.js`), `package.json` (`build` appends `&& node scripts/build-site-json.js`), `js/modules/stats.js`, `js/modules/seo.js`, `js/modules/publications.js:77-93`, `js/main.js`, `index.html:51` and `:198-230`, `.github/workflows/build-cv.yml` (git add list), `.github/workflows/tailor-cv.yml:134` (derived regex)

**Interfaces:**
- Produces: `untex(s) -> string` in `scripts/lib/text.js` — today's filter body, plus `--` → `–` (after `---` → `—`).
- Produces: `buildSiteJson(data) -> object` in `scripts/build-site-json.js`; the CLI writes `data/site.json`:
  `{ _edit, role, service: { peerReviews, nsfProposalReviews, mentees, invitedTalksPanels, conferences, invited, funding: { value, display } }, logoWalls: { experience: [logo], collaborations: [logo] } }` where `logo = { name, url, src, width, height }`. `role` = `untex(data.experience[0].role)`. Experience wall = education institutions with `logo`, then jobs with `logo`, in file order. `_edit` = `"DERIVED — written by scripts/build-site-json.js. Never edit; run \`npm run build\`."`
- Produces: `loadSiteFacts() -> Promise<object | null>` (memoised fetch of `data/site.json`; `null` on any failure) and `initFacts()` in `js/modules/facts.js`. `initFacts` fills `#hero-role` and the containers `#logos-experience`, `#logos-collaborations` with today's markup (`a.logo-item > img.logo-img`, `width`, `height`, `loading="lazy"`, `target="_blank" rel="noopener noreferrer"`, `aria-label` = name).
- Produces: `categoryOf(pub) -> 'in-progress' | 'dataset' | 'journal' | 'conference' | 'other'` in `js/modules/pub-category.js` (moved unchanged from `publications.js`).

- [ ] **Step 1: Before screenshots.** `preview_start` the `site` config; screenshot the Metrics and logo-cloud sections and the Publications chips at desktop and at the mobile preset. Save them in the scratchpad.
- [ ] **Step 2: Write the failing tests** in `test/site.test.js`:

```js
const site = buildSiteJson(loadData());
test('site.json values', () => {
  assert.equal(site.role, 'AI Scientist – Geospatial & Remote Sensing');
  assert.deepEqual(
    { m: site.service.mentees, i: site.service.invitedTalksPanels, c: site.service.conferences, f: site.service.funding.display },
    { m: 8, i: 5, c: 15, f: '~$100K' });
  assert.deepEqual(site.logoWalls.experience.map((l) => l.name), ['University of Edinburgh', 'Faculty.ai', 'Woodwell Climate Research Center']);
  assert.deepEqual(site.logoWalls.collaborations.map((l) => l.name), ['Petrobras', 'Google', 'Esri']);
});
test('untex dashes', () => {
  assert.equal(untex('a -- b --- c'), 'a – b — c');
  assert.equal(untex('\\$99,749'), '$99,749');
});
test('site chip counts equal the CV counts', () => {
  const pubs = JSON.parse(read('data/publications.json')).publications;
  const n = (c) => pubs.filter((p) => categoryOf(p) === c).length;
  const cv = pubCounts(loadData().publications);
  assert.deepEqual([n('journal'), n('conference'), n('dataset')], [cv.journalPapers, cv.conferences, cv.datasets]);
});
test('static index.html facts match the data', () => {
  const html = read('index.html');
  const words = (s) => s.replace(/&amp;/g, '&').match(/[A-Za-z]+/g).join(' ');
  for (const meta of ['name="description"', 'property="og:description"'])
    assert.ok(words(html.match(new RegExp(`<meta ${meta} content="([^"]+)"`))[1]).includes(words(site.role)), meta);
  const p = loadData().profile;
  for (const href of [`mailto:${p.email}`, `linkedin.com/in/${p.profiles.linkedin}`, `github.com/${p.profiles.github}`, p.profiles.scholar, p.profiles.orcid])
    assert.ok(html.includes(href), href);
});
```

- [ ] **Step 3:** Run `node --test test/site.test.js`. Expected: FAIL.
- [ ] **Step 4:** Implement `text.js`, `build-site-json.js`, `pub-category.js`, the `package.json` build step and both workflow edits (`data/site.json` added to `build-cv.yml`'s `git add`; `|^data/site\.json$` added to the derived regex in `tailor-cv.yml`).
- [ ] **Step 5:** Site changes. `index.html`: give the eyebrow `id="hero-role"` with empty content, and replace the six hard-coded logo anchors with empty `#logos-experience` / `#logos-collaborations` containers. `main.js`: call `initFacts()` first. `stats.js`: fetch `stats.json` and use `loadSiteFacts()` for the service group — Peer reviews (note `+ 1 NSF proposal review`), Funding (`site.service.funding.display`, label `USD Funding`, note `Awarded`), Mentees (note `Supervised`), Invited talks & panels (note `+ 15 conferences`, built from the value). `seo.js`: `jobTitle` from `(await loadSiteFacts())?.role`. `publications.js`: import `categoryOf`; rename the chip label to `Conference abstracts`.
- [ ] **Step 6:** Run `npm run build && npm test`. Expected: PASS; `data/site.json` exists and starts with the DERIVED marker.
- [ ] **Step 7: After screenshots** at the same places and widths. Expected differences only: the fourth service card ("Invited talks & panels 5 / + 15 conferences", was "Invited talks 17"), Mentees 8 (was 9), the chip label. Logo walls and eyebrow look identical. `read_console_messages` shows no errors.
- [ ] **Step 8: Failure check.** In the browser, block `data/site.json` (for example `javascript_tool` to override `fetch` for that URL, then reload): the Research impact cards render, the eyebrow and logo walls are empty, no uncaught error.
- [ ] **Step 9:** Commit (`scripts/lib/text.js scripts/lib/render.js scripts/build-site-json.js data/site.json js/modules/facts.js js/modules/pub-category.js js/modules/stats.js js/modules/seo.js js/modules/publications.js js/main.js index.html package.json .github/workflows/build-cv.yml .github/workflows/tailor-cv.yml test/site.test.js`), message `site: read job title, logo walls and service counts from data/site.json`.

### Task 6: `.bib` changes (owner reviews before commit)

**Files:** Modify `cv/publications.bib`.

- [ ] **Step 1:** Fix `rogers2023permafrost` (`number={2330}`, `pages={B33H--2330}`, "Virkkala") and `clelland2025machine` ("Hosking, J. Scott and Potter, Stefano").
- [ ] **Step 2:** Add the InterPore 2019 abstract (key `yang2019fluid`, `@inproceedings`, booktitle "InterPore 2019 Annual Meeting", owner bolded as `\textbf{Yang, Yili}` like other entries) and the eight co-authored abstracts from spec section "`.bib` proposals", each copied from its official page (authors, title, session number). Search the AMS 103rd Annual Meeting site for 8B.4; if it cannot be found, leave it out and note it.
- [ ] **Step 3:** Run `npm run build && npm test`. Expected: PASS; `data/publications.json` has 37 entries (36 if AMS is left out); "Conference Abstracts" = 18 (or 17).
- [ ] **Step 4:** Show the owner `git diff cv/publications.bib`. Commit only after they accept it: `git add cv/publications.bib data/publications.json cv/onepage/generated cv/biosketch/generated data/site.json`, message `bib: fix two entries; add InterPore 2019 and eight co-authored abstracts`.

### Task 7: Whole-branch verification

- [ ] **Step 1:** `npm run build && npm test`. Expected: PASS, no todo left.
- [ ] **Step 2:** Compile both shells with Tectonic into the scratchpad. `pdftotext` them and diff against `pdftotext assets/cv.pdf` / `assets/biosketch.pdf` (the last CI builds). Expected: only the differences listed in the spec's Verification section. `pdfinfo` reports 1 page for the one-pager.
- [ ] **Step 3:** Tailored build check: copy `applications/<status>/coreweave-senior-applied-researcher` to `applications/drafting/zz-ssot-check` (uncommitted), run `npm run tailor -- zz-ssot-check` and `npm run pdf -- zz-ssot-check`. Expected: cv.pdf is 1 page; the letter's sender reads "Yili Yang, PhD" / "yyl.eli@gmail.com | +44 7490334233 | London, UK". Then delete `applications/drafting/zz-ssot-check` and `build/zz-ssot-check`.
- [ ] **Step 4:** `grep -rn "menteesSupervised\|invitedTalks\|fundingAwarded\|proposalFunders" --include=*.js --include=*.njk --include=*.md . | grep -v node_modules | grep -v applications/submitted | grep -v docs/superpowers`. Expected: no hits.
- [ ] **Step 5:** `git status`: only the three unrelated paths remain unstaged. Report to the owner with the before/after screenshots and the PDF text diff.
