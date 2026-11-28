<!-- SOURCE — you own this file. Edit freely, by hand or by agent. -->
# How the website uses the visual system

The website uses Yili's visual system, version 1.0.0, with the **lichen** accent, which is the
home accent for his site, CV and papers. `DESIGN.md` at the repo root is the system's record for
design tools; this file says how the site applies it and which choices were judgement.

## Where the values live

| File | Owner | What it holds |
|---|---|---|
| `css/visual-preference/tokens.css` | the system | colours (both themes), type, space, motion |
| `css/visual-preference/fonts.css` | the system | the Google Fonts link for Albert Sans, IBM Plex Mono, Source Serif 4, Noto Sans SC |
| `assets/favicon.svg` | the system | the lichen square on the stone ground |
| `css/variables.css` | this site | only what the system has no token for: logo ink, image scrims, one `--transition` name |
| `css/base.css`, `css/components.css` | this site | the layout, using the tokens above |

The three system files are copies, and each names its version in its first line. Do not edit
them. To update, copy the new release from `yi-li-yang/skills`
(`plugins/yili-skills/skills/visual-preference/`) over them. They are copied, not linked from
jsDelivr, because the release tag `visual-preference-v1.0.0` was not yet published when the site
moved to the system.

No colour, size or font is typed in the site's own CSS or JS: they use `var(--ink)`,
`var(--lichen)`, `var(--space-4)` and so on. The exceptions are the two `theme-color` meta tags in
`index.html`, which cannot read CSS.

## What the system decided

- Stone ground, dark by default; light follows the reader's system setting.
- Albert Sans for text at 400/500/600, IBM Plex Mono for every number that sits in a column or
  changes (the metrics, the flagship figures, the language percentages).
- Square corners, hairline rules, no shadow except on the project popover, which floats over the
  tiles and uses the one `float` shadow.
- One filled button per view (the hero's **View Resume**); every other action is underlined text.
- The name ends with the lichen square, in the header and in the hero.
- The language chart takes the group colours in order of size: Earth 6 for up to six languages,
  Earth 8 for seven or eight, more folded into a neutral "Other".

## Judgement (not decided by the system)

Confirm these or add them to the system.

1. **The hero.** The name is the page's one display line (49px), and the tagline under it is
   the h1 size (31px). Before, both were one line joined by "|". The words did not change.
2. **Section headings** are the h2 size (25px), because the hero is the page's h1.
3. **Header "Resume"** is underlined text, not a filled button, so the hero's button stays the
   only filled one in the first view. The flagship cards' "Open the live map" and "Try the live
   app" are underlined text for the same reason.
4. **Metrics** are readouts on a hairline rule, left-aligned, the number in mono and in ink. The
   accent no longer colours them: they are data, not a focus. The two groups are mirrored
   halves split by one vertical hairline, four readouts each (2 × 2), and every readout has the
   same three lines: number, label, note. The NSF proposal reviews are the peer-review readout's
   note, not a fifth cell. Experience and Collaborations below split on the same line, three
   logos each in equal cells.
5. **Project tiles** without an image show art that says what the project is, under the same
   scrim as a picture: a skill shows the command that runs it over a faint character grid; a
   repo shows hairline contour lines seeded from its name. The per-track hue gradients stay
   removed: the track is already labelled. `?blank=type` swaps the contours for the name set
   large, to compare. A repo's own preview (`data/previews.json`) wins over `image` in
   `show_repo.json`, which stays as the fallback.
6. **Scrims** under text on a picture are the ground colour at 94/60/20%, so they work in both
   themes.
7. **Labels over groups** (Research impact, In progress, Earth & climate research) are spaced
   capitals in Albert Sans, not mono: mono is for numbers and code.
8. **Hover** on a text link underlines it in ink. The accent is kept for selection and focus:
   the active nav item, a pressed filter chip, a pinned tile, the focus ring.
9. **Logos** are drawn in ink at 60%. The Experience and Collaborations logos show their own
   colours on hover, as before. The Tools & Environments logos are lit by the pointer's
   distance, not only by hover (`js/modules/tools.js`): full colour under the pointer, fading
   to none about two columns away, so the gaps light their neighbours too. The light comes at
   once and fades over about a second, so a pointer that only crosses the grid, or a page
   scrolled under a still pointer, leaves a trail. On a phone, which has no hover, a band
   across the middle of the screen lights each row as it scrolls through. A mark whose own
   colour is black (Claude, VS Code, GitHub, Esri; `data-mono`) lights up in ink, because black
   vanishes on the dark ground.
10. **The card-row nudge** keeps its 900ms length (200ms is too short to notice), with the
    system's ease-out curve.
11. **The CV PDFs are not restyled here.** The manual's CV style (Source Serif 4 headings, light
    lichen rules) is a separate surface and a separate change.
12. **Floating panels settle; they do not snap.** The project popover and the "How it was
    built" drawer take `--settle` (320ms) on a gentler ease-out, `--soft-out`
    (cubic-bezier(0.33, 1, 0.68, 1)), and leave in `--leave` (180ms). The system says 200ms for a
    panel; at 200ms on the system's curve the popover read as abrupt. The popover also fades out
    instead of vanishing, and glides from tile to tile instead of jumping. All of it is 0ms for
    a reader who asks for reduced motion.
13. **Skills** are trees, chosen over a periodic table and drifting rows: each group is a root
    (the square, in ink) with a hairline branch to each skill. The trunk and branches grow in
    once, when the section comes into view, and hovering a skill dims its siblings. Nothing
    ranks or scores a skill, because the data holds no level for one. A reader who asks for
    reduced motion sees the tree whole at once.
14. **Numbers flip in.** Every number on the page (metrics, Featured figures, the GitHub
    counts, language percentages, and the counts beside skill groups, project tracks and
    publication filters) flips into its value the first time it scrolls into view, in under a
    second (`js/modules/flip.js`). Only the digits move: separators, signs and units stay
    still, and each digit keeps the width of the one it lands on, so nothing next to a number
    shifts (the system's "no number shifts as it changes"). Dates and years do not flip. Each
    digit rolls up through 0–9 like an odometer and stops on its value, the left digits first;
    it was chosen over random digits settling (a departure board) and counting up from zero.
    Nothing moves for a reader who asks for reduced motion, and a screen reader reads the final
    value at once.
15. **The Featured images move.** Each image plays one short motion when it comes into view,
    then rests on its last frame; the pointer or keyboard focus on the card plays it again.
    The thaw-slump map dives from the Arctic to one slump: 13 stills, each at twice the scale
    of the one before. The Atlas dissolves through three presets, coloured by rank in London,
    because by score the presets look alike. The page builds the motion from still WebP
    frames (`js/modules/motion.js`). That was chosen over an animated WebP (the page cannot
    start or replay it, and a zoom needs megabytes) and over a video (it needs a step that
    composites the frames, and a frame that holds shows the compression). A play lasts under
    5 seconds and stops by itself, so it needs no Pause control (WCAG 2.2.2); the lengths are
    in `css/variables.css`. The Atlas preset is named on the image in the site's own type,
    because the app's text is too small to read at card size. A reader who asks for reduced
    motion sees the first frame only, and the other frames are never loaded.
    `npm run capture:featured` takes the frames again from the live apps.
