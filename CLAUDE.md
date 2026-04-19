# yi-li-yang.github.io

Personal portfolio site for Yili Yang.

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

# Project Scaffolding: Yili Yang Portfolio Site

## 1. Project Overview
This repository contains the personal and professional portfolio for Yili Yang, a Data Scientist specializing in Geospatial AI, Climate Science, and Multimodal Learning. The site highlights academic publications, interactive geospatial datasets (like the ARTS dataset), and machine learning projects. 

**Key Mechanism:** The site utilizes an automated pipeline to fetch live data (e.g., publication lists, citations, or GitHub stats) from online sources, which is then dynamically rendered on the frontend.

## 2. Tech Stack
* **Frontend Framework:** Next.js (React)
* **Styling:** Tailwind CSS
* **Geospatial Visualization:** [Insert Map library here, e.g., `react-map-gl` / Mapbox / `react-leaflet`]
* **Deployment:** GitHub Pages / Vercel
* **Automation:** GitHub Actions (for scheduled data fetching)

## 3. Directory Structure
* `/components`: Reusable UI elements (Buttons, Cards, Image Sliders).
    * `/components/maps`: Specialized interactive map components.
    * `/components/sections`: Larger page blocks (Hero, Publications, Experience).
* `/pages` (or `/app` if using Next.js App Router): Primary page routes (`index.js`, `projects.js`, `publications.js`).
* `/public`: Static assets (images, raw CV pdf, icons).
* `/data`: Auto-generated JSON or Markdown files containing the fetched data. **(Note: Agents should not manually edit these files as they are routinely overwritten by scripts).**
* `/scripts`: Python or Node.js scripts used by GitHub Actions to scrape or fetch external API data (e.g., ORCID, Google Scholar).
* `/styles`: Global CSS files, primarily containing Tailwind directives.

## 4. Automated Data Fetching Pipeline
* **Source:** Scripts in the `/scripts` folder pull data from external APIs.
* **Execution:** A GitHub Action runs on a cron schedule to execute these scripts.
* **Storage:** The output is saved into the `/data` directory as structured formats (JSON/YAML/MD).
* **Rendering:** The frontend uses static site generation (`getStaticProps` or React Server Components) to read the `/data` files at build time and render them into the UI.

## 5. Development Rules for Claude Code
* **Do not modify auto-generated data:** Never manually edit the files inside `/data`. If data formatting needs changing, alter the fetch logic in `/scripts` or the parsing logic in the frontend components.
* **Component Modularity:** Keep React components small and modular. Abstract complex map rendering or slider logic into their own dedicated files.
* **Styling:** Strictly use Tailwind CSS utility classes. Avoid creating custom CSS modules unless absolutely necessary for complex map overlays.
* **Performance:** Optimize image loading using the Next.js `<Image />` component, especially for heavy satellite imagery. Ensure heavy geospatial libraries are loaded dynamically so they do not impact the initial page load speed.
* **Responsive Design:** Ensure all map components, data tables, and grids degrade gracefully on mobile screens. Focus on scannability for hiring managers.

## Design
Use design.md for all front end design.

# content components
1. The Hero Section (The 5-Second Hook)
This needs to instantly communicate your value proposition without making the user scroll.

Headline: Something impactful, e.g., "Yili Yang, PhD | AI & Machine Learning for Complex Global Systems."

Sub-headline: A brief 1-2 sentence summary of your expertise (e.g., "Developing state-of-the-art multimodal deep learning models to process geospatial data and accelerate scientific discovery.")

Call-to-Action (CTA) Buttons: Primary button: "View Resume" (links to your PDF). Secondary button: "Contact Me" or "GitHub."

Visual: A highly polished abstract geospatial graphic, or simply clean, bold typography if you chose a minimalist design system like Linear.

2. The "Flagship Showcase" Block (The Interactive "Wow" Factor)
Instead of a standard project grid, dedicate a full-width block to your absolute best visual work. This proves you are a full-stack data scientist.

Interactive Map / Slider: Use this space for the react-compare-slider or react-map-gl component we discussed. Show the raw satellite imagery of the Retrogressive Thaw Slumps on one side, and your model's segmentation on the other.

Metrics: Overlay brief, punchy stats next to the visual (e.g., "94% Accuracy", "Pan-Arctic Scale", "Processed 5TB+ Data").

3. Selected Projects & Datasets Grid
A clean, 2-or-3-column grid of cards highlighting your other major achievements. Do not list everything; curate the top 3–4.

Example Cards: The ARTS Dataset, the Wildfire Mapping CNN, and the Multi-domain Timeseries Forecasting framework.

Content per Card: Project title, a 2-sentence description, the tech stack used (e.g., "PyTorch, Vision Transformers, Sentinel-2"), and a link to the GitHub repo or publication.

4. Experience & Education Timeline
A sleek, vertical timeline component (very common and beautiful in Vercel/Linear design systems).

Keep the descriptions brief. Focus on impact rather than tasks, just like we discussed for your CV.

Combine Woodwell, Faculty.ai, and your PhD research here.

5. Live Publications & Research Feed
Since you have a script that automatically fetches data and writes to /data/publications.md, this section should just read that file and render it beautifully.

Layout: A minimalist list (not cards) of your journal papers and conferences.

Tags: Add small UI badges for "Journal," "Conference," or "Dataset."

Links: Provide direct DOI or PDF links.

6. Tech Stack & Domains (Logo Cloud or Pill Tags)
A scannable section that hiring managers can use to check off their mental boxes.

Categories: Split them logically into "Machine Learning" (Deep Learning, Vision Transformers), "Geospatial" (QGIS, GEE, Remote Sensing), and "Engineering" (Python, Next.js, Docker). Use clean "pill" shaped tags.

7. Minimalist Footer
Links to GitHub, LinkedIn, Google Scholar, ORCID, and a mailto: link for your email.

"Last updated [Date]" (This shows the site is actively maintained).