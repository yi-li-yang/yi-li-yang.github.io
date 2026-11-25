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
   accent no longer colours them: they are data, not a focus.
5. **Project tiles** without an image are plain `surface`. The per-track hue gradients were
   removed: the track is already labelled, so the hue carried no meaning.
6. **Scrims** under text on a picture are the ground colour at 94/60/20%, so they work in both
   themes.
7. **Labels over groups** (Research impact, In progress, Earth & climate research) are spaced
   capitals in Albert Sans, not mono: mono is for numbers and code.
8. **Hover** on a text link underlines it in ink. The accent is kept for selection and focus:
   the active nav item, a pressed filter chip, a pinned tile, the focus ring.
9. **Logos** are drawn in ink at 60% and show their own colours on hover, as before.
10. **The card-row nudge** keeps its 900ms length (200ms is too short to notice), with the
    system's ease-out curve.
11. **The CV PDFs are not restyled here.** The manual's CV style (Source Serif 4 headings, light
    lichen rules) is a separate surface and a separate change.
