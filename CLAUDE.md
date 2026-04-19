# yi-li-yang.github.io

Personal portfolio site for Yili Yang.

## Stats Pipeline

`scripts/update-stats.js` fetches metrics from ORCID, GitHub, and Google Scholar, writing to `data/stats.json`. Runs monthly via `.github/workflows/update-stats.yml`.

- **GitHub REST** — owned non-fork repo count + approximate language distribution by primary-language field (fallback when no token)
- **GitHub GraphQL** — owned repo count, all-repo language bytes aggregated globally into a donut chart, all-time commits. Requires `GH_USER_TOKEN`.
- **ORCID** — publications (works count) and peer reviews (individual review count, not journal group count)
- **Scholar** — citations, h-index, i10-index via SerpAPI (env `SERPAPI_KEY`) or direct scrape fallback
- **Static metrics** — manually edited in `data/stats.json` under `static` (funding, mentees, invited talks)

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

Accessibility & Contrast: Always explicitly define both background and text colors for every container. Do not rely on inherited global text colors. If building a Dark Mode theme, ensure all surfaces use dark backgrounds (bg-gray-900, bg-black) with light text (text-white, text-gray-200). Do not mix light containers into a dark theme unless explicitly requested.

for all logo clouds: apply a monochrome or greyscale filter (grayscale opacity-70 hover:opacity-100 hover:grayscale-0 transition-all in Tailwind， so it blend in the dark background. download latest logo images automatically.

# content components
## navigation bar link to the following sections

## The Hero Section
- *pre-headline*: Geoscientist, Applied Full-stack Geospatial Data Scientist

- *Headline*: impactful career summary, e.g., "Yili Yang | AI & Machine Learning for Complex Global Systems."

- *Sub-headline*: summary keywords Pill Tags, in two columns, data science left, geoscience right, a crossover mark in the middle:

left: Geoscience, PhD in Petrophysics, X-ray synchrotron µCT imaging, Remote Sensing, Geospatial Information Science, Digital Rocks, Scientific Image Processing

right: Machine learning, Deep Learning, Computer Vision, AI for Geoscience, Geospatial Data Science, time-series modelling

Visual: A highly polished abstract geospatial graphic, or simply clean, bold typography if chose a minimalist design system like Linear.

## The "Flagship Showcase" Block (The Interactive "Wow" Factor)
Showcase project grid, leave blank for now， full width under the hero section

------

## Skills (showcase my skills)

*Concepts (Pill Tags)*: Split them logically Use clean "pill" shaped tags.

"AI" (Semantic Segmentation, Transfer Learning, Object Detection, Vision Transformer, CNN, Vision Foundation Models, Geo Foundation Models, Time-series modelling, ),

"Engineering" (Agentic Coding, Harness Engineering, Claude Skills, Prompt/Context Engineering, GitHub Action). 

*Working Platforms (logo clouds)*: Claude code, VSCode, Git, GitHub, Google Colab, JupyterNotebook, Google Cloud Platform, Overleaf, Google Earth Engine, ArcGIS, Qgis， Pytorch, Docker, Linux

- *total coding language pie chart*: access all github repos that I contributed to, calculate the percentage of all languages that i used, make a interactive pie chart to show.

- *github stats* total contributions, repositories i contributed/owned

## Thoughts (showcase my ideas and projects)
Example Cards to showcase: see show_repo.json

Content per Card: github repos,each with a link, a description, and a thumbnail image or gif

## Live stats (academic, no github)
publications(union but deduplicated):
google scholar stats
ORCID stats

## Minimalist Footer
Links to GitHub, LinkedIn, Google Scholar, ORCID, and a mailto: link for your email.

## logo cloud
University of Edinburgh, Faculty.ai, Woodwell. 


## timestamp*
Last updated [Date]