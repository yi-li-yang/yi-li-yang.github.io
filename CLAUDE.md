# yi-li-yang.github.io

Personal academic portfolio site for Yili Yang.

## Stats Pipeline

`scripts/update-stats.js` fetches metrics from ORCID, GitHub, and Google Scholar, writing to `data/stats.json`. Runs monthly via `.github/workflows/update-stats.yml`.

- **GitHub REST** — repos + stars (user-owned only, fallback when no token)
- **GitHub GraphQL** — repos + stars (including org repos), all-time commits across orgs. Requires `GH_USER_TOKEN`.
- **ORCID** — publications and peer reviews
- **Scholar** — citations, h-index, i10-index via SerpAPI (env `SERPAPI_KEY`) or direct scrape fallback
- **Static metrics** — manually edited in `data/stats.json` under `static` (funding, first-author papers, mentees, invited talks)

Previous values are preserved when any source fails.

## Repo Secrets

- `GH_PAT` — GitHub PAT with `read:user`, `read:org`, `public_repo` scopes (passed as `GH_USER_TOKEN`)
- `SERPAPI_KEY` — SerpAPI key for reliable Scholar fetching in CI
