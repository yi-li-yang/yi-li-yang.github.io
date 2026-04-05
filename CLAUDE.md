# Stats Pipeline Todos

## Execution order matters — do them in this sequence.

---

## 1. Previous-value preservation (foundation — do first)

**File:** `scripts/update-stats.js`

Every other todo depends on graceful degradation. Without this, any
source failure silently wipes good data.

- Add `readFileSync`, `existsSync` to the `node:fs` imports
- Before `Promise.all`, read existing `data/stats.json` into a
  `previous` object (handle the first-run case where the file doesn't
  exist yet)
- Change the fallback chain:
  `orcid ?? previous.orcid ?? { works: null, reviews: null }`
  (same pattern for `github`, `scholar`)
- Behavior: fetch succeeds → new value; fetch fails → old value;
  no old value → nulls

---

## 2. Scholar scraper — replace with SerpAPI

**File:** `scripts/update-stats.js`

Current approach scrapes `scholar.google.com` with a fake User-Agent.
Works locally, fails from GitHub Actions datacenter IPs. SerpAPI's
free tier (100 searches/month) is plenty — monthly cron uses ~12/year.

- Read `SERPAPI_KEY` from env var
- If set: call `https://serpapi.com/search?engine=google_scholar_author&author_id=8I00DowAAAAJ&api_key=...`
- Parse `cited_by.table` from the JSON response for citations,
  h-index, i10-index (all-time column)
- If `SERPAPI_KEY` not set: fall back to the existing direct scraper
  (still works locally for manual runs)
- Sign up at serpapi.com, add key as `SERPAPI_KEY` repo secret

---

## 3. GitHub contributions across orgs — GraphQL

**File:** `scripts/update-stats.js`

REST `/users/yi-li-yang/repos` only returns personal repos. Your
Woodwell (WHRC) work is invisible. GraphQL `contributionsCollection`
captures commits, PRs, issues, and reviews across every org.

- New function `fetchGitHubGraphQL()` using
  `https://api.github.com/graphql`
- `contributionsCollection` only spans one year at a time, so:
  1. First query `contributionsCollection { contributionYears }` →
     returns e.g. `[2026, 2025, ..., 2016]`
  2. Loop each year, query totals, sum across all years
- Read PAT from `GH_USER_TOKEN` env var (NOT `GITHUB_TOKEN` — that's
  a reserved name in Actions and overriding it causes subtle auth
  bugs in other steps)
- If no token: skip GraphQL, keep only REST repo/star counts
- Merge into github object:
  `{ repos, stars, commits, pullRequests, issues, reviews }`

**Before adding frontend cards for all four contribution metrics:**
run the query once manually and check the numbers. Only surface
metrics with meaningful values. If your all-time `issues` count is 8,
that card is noise — drop it. Ship only the cards that tell a story.

---

## 4. Static high-signal metrics

**File:** `data/stats.json`

The highest-value stats for your profile aren't fetchable — they're
things like funding awarded, first-author paper count, mentees, and
invited talks. These are slow-changing; update them 1-2x per year
by hand. But they need to exist in the pipeline so the frontend
renders them alongside the automated metrics.

- Add a `static` section to `stats.json`:
```json
  "static": {
    "fundingAwarded": { "value": 99749, "label": "USD Funding", "display": "~$100K" },
    "firstAuthorPapers": 8,
    "menteesSupervised": 7,
    "invitedTalks": 10
  }
```
- `scripts/update-stats.js` should preserve the `static` section
  when writing (merge, don't overwrite the whole file)
- Document in a comment: "Edit these manually when they change."

---

## 5. Frontend error handling

**Files:** `js/modules/stats.js`, `css/components.css`

Currently, a missing or malformed `stats.json` throws silently and
the section renders empty.

- Wrap `initStats()` body in try-catch
- Add `if (!res.ok) throw new Error(\`Stats fetch: ${res.status}\`)`
  after the fetch (404s don't throw by themselves)
- Catch block: `console.error(err)` and append
  `<p class="stats-error">Stats temporarily unavailable.</p>`
- Add `.stats-error` style (muted color, small text)

---

## 6. Last updated display

**Files:** `js/modules/stats.js`, `css/components.css`

Visitors have no way to know if the numbers are current or stale.

- Destructure `lastUpdated` from the parsed JSON
- After the card loop, append
  `<p class="stats-updated">Last updated: ${formatted date}</p>`
- Format as "4 April 2026" (UK locale, matches your site)
- Add `.stats-updated` style (muted, right-aligned, small)

---

## 7. JSON validation before commit

**File:** `.github/workflows/update-stats.yml`

If the script writes malformed JSON for any reason, the workflow
will happily commit broken data and break the live site.

- After running the script, add a validation step:
```yaml
  - name: Validate stats JSON
    run: |
      node -e "
        const s = require('./data/stats.json');
        if (!s.profiles || !s.lastUpdated) process.exit(1);
      "
```
- Fails the workflow before the commit step if JSON is broken

---

## 8. GitHub Action — scheduled automation

**New file:** `.github/workflows/update-stats.yml`
```yaml
name: Update Stats
on:
  schedule:
    - cron: '0 0 1 * *'  # 1st of every month, midnight UTC
  workflow_dispatch:      # allow manual trigger
permissions:
  contents: write
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node scripts/update-stats.js
        env:
          GH_USER_TOKEN: ${{ secrets.GH_PAT }}
          SERPAPI_KEY: ${{ secrets.SERPAPI_KEY }}
      - name: Validate stats JSON
        run: node -e "const s=require('./data/stats.json');if(!s.profiles||!s.lastUpdated)process.exit(1)"
      - name: Commit and push if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/stats.json
          git diff --cached --quiet || git commit -m "chore: update stats [automated]"
          git push
```

**Required repo secrets:**
- `GH_PAT` — classic PAT with `read:user` and `public_repo` scopes
- `SERPAPI_KEY` — free tier from serpapi.com

**Why monthly, not twice a year:** Scholar citations change monthly,
GitHub contributions change weekly. A six-month cadence means stale
data and no early warning if the pipeline breaks. Monthly uses ~12
SerpAPI calls/year — well within the 100/month free tier.

---

## Verification checklist

Before declaring done, verify each:

- [ ] Run `node scripts/update-stats.js` locally with no env vars →
      uses direct Scholar scrape, preserves old values if anything fails
- [ ] Run with `GH_USER_TOKEN=<pat>` → contribution stats populate
      from GraphQL
- [ ] Run with `SERPAPI_KEY=<key>` → Scholar stats come from SerpAPI
      JSON, not the scraper
- [ ] Temporarily break Scholar fetch (bad URL) → confirm previous
      values are preserved in the output JSON
- [ ] Rename `data/stats.json` → reload site → confirm
      "Stats temporarily unavailable" message appears
- [ ] Normal page load → confirm "Last updated" renders below cards
- [ ] Push to main → trigger workflow manually from Actions tab →
      confirm successful run, validation passes, commit appears
- [ ] Wait one month → confirm cron fires automatically