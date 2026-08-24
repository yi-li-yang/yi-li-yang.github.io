# yi-li-yang.github.io

One body of facts. Three outputs.

Every fact about this career is written down exactly once, in `data/` and `cv/publications.bib`.
Everything else is derived from it: the website, two CV PDFs, and a tailored CV and cover letter
for each job applied to. **No output contains a hand-typed fact** — if a number appears on the CV,
it was read from the data layer, not retyped into a `.tex` file.

---

## The three concerns

```text
① WEBSITE          index.html  css/  js/  assets/        served from the repo root
② CV GENERATOR     cv/  ← templates, .tex shells, fonts   two PDFs from the same facts
③ TAILORED CVs     applications/  → build/               one per job, cited and checked

   data/  is shared: ① fetches it over HTTP, ② and ③ read it from disk
```

---

## Commands

```bash
npm run build                                    # the canonical CV → cv/**/generated/
npm run apps                                     # every application, with status
npm run tailor -- goldman-sachs-applied-ai-researcher
npm run app:status -- goldman-sachs-applied-ai-researcher submitted
```

| Command | What it does |
|---------|--------------|
| `npm run build` | Regenerates every derived `.tex` from `data/` + the `.bib`. Run after editing any source file. |
| `npm run apps` | Lists every application, grouped by status, with company, role and date. The directory tree *is* the record — there is no index file to keep in sync. |
| `npm run tailor -- <slug>` | **Verifies, then renders** one application into `build/<slug>/`. A claim that doesn't trace to the data layer aborts the run before anything is written. |
| `npm run app:status -- <slug> <drafting\|submitted\|closed>` | Moves an application between status folders with `git mv`. Nothing else needs updating — every command finds applications by slug, not by path. |

<details>
<summary>Supporting commands</summary>

```bash
npm run verify:app -- <slug>            # the firewall's report, without rendering
npm run verify:app -- <slug> --strict   # warnings become failures (what CI runs)
npm run clean                           # wipe build/
npm run ingest                          # refresh stats from ORCID / GitHub / Scholar (network)
npm run bib | metrics | render          # the individual stages `build` chains together
npm run pdf -- <slug>                   # preview one application's PDFs locally (needs Tectonic)
npm run pdfs                            # wait for CI, then pull the PDFs it committed
npm run hooks                           # make `git push` do that pull for you
```

</details>

---

## Which files do you edit?

**Every file says so in its first line.** Look at the top of whatever you're about to change:

- `SOURCE` — you own it. Edit it freely, by hand or with an agent.
- `DERIVED` — the build owns it. Never edit it, *by hand or by agent*: the next build silently
  reverts you. Derived files name the command that regenerates them, so the marker also tells you
  what to run instead.

```bash
grep -rl "DERIVED" data/ cv/ scripts/    # everything you should not touch
```

There is deliberately no table of source files here. A list in a README answers the question once
and then rots the first time a file moves; a marker inside the file cannot.

---

## How does a PDF get made?

**CI is the only thing that produces a document of record.**

```text
git push  →  GitHub Actions  →  xu-cheng/latex-action (a full TeX Live container)
          →  latexmk  →  PDF uploaded as a run artifact, then committed back
```

You *can* compile locally, and it is worth doing when you are fighting the layout:
`npm run pdf -- <slug>` renders a tailored CV and letter with
[Tectonic](https://tectonic-typesetting.github.io/) — a single binary that fetches only the
packages a document needs, so there is no TeX Live install to maintain. It writes **only** into
the gitignored `build/<slug>/` and deliberately never drops a PDF beside a manifest: a local
build and the document an employer actually received must never be confusable. Tectonic is
optional; skip it and let CI do the compiling.

`build-cv.yml` compiles the two canonical PDFs and commits them to `assets/`.
`tailor-cv.yml` compiles one tailored CV and cover letter per application, asserts the one-pager
is still exactly one page (the Deedy template overflows silently), and **commits the documents
back into the application's own folder**:

```text
applications/drafting/<slug>/
  job.md  manifest.json  letter.json    ← yours
  cv.pdf  letter.pdf  letter.txt        ← CI writes these
```

So the workflow is: `npm run tailor -- <slug>` → review → commit → push → `git pull`, and the PDF
is sitting next to the posting it was written for. One folder holds the whole record of one job.

---

## Applying for a job

`/apply` in Claude Code walks the whole thing: paste the posting, and it archives it, proposes a
tailored CV and cover letter, runs the firewall, and stops for your review. It never commits.

The rule that makes it trustworthy: the model **selects and rephrases facts that already exist**.
Skills, publications, awards and taglines are chosen by id, so their wording cannot drift.
Experience bullets and letter paragraphs are the only generated prose, and each one carries a
citation that `npm run verify:app` resolves against the data layer — a dangling citation fails the
build, in CI as well as locally. It also prints what the posting asks for that your data *cannot*
support, and never fills those gaps in for you.

See **[docs/APPLICATIONS.md](docs/APPLICATIONS.md)** for the citation tokens and file schemas.

---

## Docs

| | |
|---|---|
| [docs/APPLICATIONS.md](docs/APPLICATIONS.md) | job applications: schemas, citation tokens, the firewall, the gap report |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | why the pipeline is shaped this way, and the invariants |
| [docs/BUILD_AND_RUN.md](docs/BUILD_AND_RUN.md) | build stages in detail, and the Nunjucks/LaTeX delimiter gotcha |
| [docs/DESIGN.md](docs/DESIGN.md) | the website's design system |
| [CLAUDE.md](CLAUDE.md) | working agreement for agents in this repo |
