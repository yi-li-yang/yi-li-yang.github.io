# INDEX — how this repo is organised

One body of facts in `data/` and `cv/publications.bib`. Three things derived from it.

| | Concern | Lives in | Produces |
|---|---------|----------|----------|
| ① | **Website** | `index.html`, `css/`, `js/`, `assets/` | the public site, served from the repo root |
| ② | **CV generator** | `cv/` (templates, `.tex` shells, fonts) | `assets/cv.pdf`, `assets/biosketch.pdf` |
| ③ | **Tailored CVs** | `applications/` → `build/` | one CV + cover letter per job applied to |

`data/` is shared: ① fetches it over HTTP at runtime, ② and ③ read it from disk at build time.

## Where to read next

| Document | For |
|----------|-----|
| [../README.md](../README.md) | start here — the commands, and which files you may edit |
| [APPLICATIONS.md](APPLICATIONS.md) | ③ in detail: schemas, citation tokens, the firewall, the gap report |
| [ARCHITECTURE.md](ARCHITECTURE.md) | why the pipeline is shaped this way, and the invariants it protects |
| [BUILD_AND_RUN.md](BUILD_AND_RUN.md) | build stages, and the Nunjucks-vs-LaTeX delimiter gotcha |
| [DESIGN.md](DESIGN.md) | ① the website's design system |

## Rules for any change

1. **Ownership is in the file.** Every file's first line says `SOURCE` (yours) or `DERIVED` (the
   build's). Never edit a `DERIVED` file — by hand or by agent. It names what to run instead.
2. **Node only.** No Python in the pipeline; reuse `scripts/lib/`.
3. **Vanilla site.** No Next.js, React, or Tailwind. See the ground-truth note in `CLAUDE.md`.
4. **Ingest is the only networked step.** Rendering is pure and must work offline; on a fetch
   failure the ingest keeps last-known-good rather than writing a zero.
5. **The data contract is shared with the site.** Change a key in `data/*.json` and update the
   consuming module in `js/modules/` in the same commit.
6. **After any change:** `npm run build`, the site still renders, both PDFs compile, and every
   shown fact traces back to the data layer.
