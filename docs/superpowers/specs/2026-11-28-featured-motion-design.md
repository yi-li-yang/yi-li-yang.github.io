<!-- SOURCE — you own this file. Edit freely, by hand or by agent. -->
# Motion for the Featured images — design

Date: 2026-11-28. Status: approved by the owner on 2026-11-28. The owner tried a v0 with
three triggers the same day and made the choices under "Decided at the trial".
Owner: Yili Yang. Author: Claude (Fable 5.2), in a design conversation with the owner.

## Intent

Each Featured card showed one still screenshot. The owner wants the two images to move, and
asked for the best look and the clearest message, not the least work. Each card's motion
says one thing:

- **RTS:** the orange speckle across the Arctic is thousands of landforms, each a few hundred
  metres wide. The image dives from the hemisphere to one thaw slump and its outline.
- **Atlas:** the same city gives a different answer when the priorities change. The map
  changes colour as the preset changes.

## Goals, non-goals, anti-goals

- Goal: smooth, sharp motion that the page controls (start, replay).
- Goal: a change that a visitor sees without looking closely.
- Non-goal: a video player, sound, or a control to scrub.
- Anti-goal: motion that plays for longer than 5 seconds with no way to stop it (WCAG 2.2.2).
- Anti-goal: motion for a reader who asks for reduced motion. That reader sees the first frame.

## What the research found

- The Atlas app has no transition. A new weight recolours the map on the next frame
  (`Livability-Atlas/web/src/features/map/HexMap.tsx`), so its own animated preview has four
  frames with hard cuts. A smooth change must be made after the capture.
- The RTS map is an Earth Engine app with a deep link: `#lon=…;lat=…;z=…`
  (`RTSmapping_v2/post-inference/ee_south_app.js`). It draws a density surface below zoom 8,
  points from zoom 8, and outlines from zoom 12.
- A screen recording of the RTS map would show tiles as they load. A clean zoom needs one
  still for each zoom level, each taken after its tiles loaded.
- PlanetScope imagery cannot be published again, so the frames use the app's Google
  satellite basemap, as the still did.
- By score, the Atlas presets look alike: the map differs by 4 to 5 between two presets, on
  a scale of 0 to 255 for the mean difference of a pixel. By rank in London it differs by 14
  to 17, because rank spreads the colours over the whole city.

## Approaches

1. **A stack of still WebP frames that the browser composites (chosen).** For the zoom, each
   frame shows the same place at twice the scale of the frame before. The page scales the
   outer frame up while the inner frame fades in. For the Atlas, the page dissolves from one
   still to the next. A dissolve is a true picture of a recolour, because the hexagons do
   not move. The frames are sharp when they hold, the page has full control, and the
   pipeline keeps one image format. The cost is one small player module.
2. **Animated WebP in `<picture>`,** as the project popover does. The page cannot start or
   replay it. In a zoom every pixel changes in every frame, so the file is several
   megabytes, or the zoom moves in steps.
3. **MP4 video.** The page can control it, but a clean zoom must still be composited from
   stills first, and that step needs ffmpeg. Held frames show compression, and iOS Low Power
   Mode stops autoplay.

The owner picked approach 1.

## The design

**Frames.**

| Card | Frames | Motion |
|---|---|---|
| RTS | 13 stills, zoom 3 to zoom 15, all centred on `rts_id 9480` (67.58 N, 134.77 E) | `zoom` |
| Atlas | 3 stills of the app as it is now, coloured by rank in London: presets Student, Retired, Family with children | `dissolve` |

The Atlas frames carry a caption that the site draws ("Priorities: Student"), because the
app's own text is about 7 px tall at card size. The caption changes with the dissolve. The
credit on the image changes with the frame too: each frame names the providers that the map
itself named.

**One play.** A play starts on the first frame and ends on the last frame, where the image
rests. It lasts under 5 seconds and stops by itself.

- `zoom`: a lead, then the dive.
- `dissolve`: a lead, then a dissolve to each next frame, with a hold on the frame between
  the first and the last.
- A replay starts from the rest: the last frame fades back to the first, then the play runs.

The lengths are CSS variables in `css/variables.css`. They are 0 for reduced motion.

**Trigger.** One play when 60% of the image is in view. The pointer on the card, or keyboard
focus in it, plays it again.

**Loading.** The frames after the first load only when the card is within one screen of the
view. The motion starts only after every frame has decoded. If a frame fails, the card
keeps the still. Reduced motion and Save-Data never load the frames.

**Data.** `data/flagships.json` has `motion: { kind, frames: [{ src, caption?, credit? }] }`
for a flagship. `image.src` is the first frame.

**Capture.** `scripts/capture-featured.js` (`npm run capture:featured`) takes the frames
from the two live apps and writes `assets/showcase/featured-record.json`. It is run by hand
and borrows Playwright and sharp from `auto-generate-preview-image`.
`npm run featured:status` says when the Atlas frames are older than the app's own preview.

## Decided at the trial

- The trigger: one play in view, and the pointer plays it again. The trial also had a loop
  with a Pause button and a play on hover only; both are removed.
- The rest: the last frame, not the first.
- The Atlas must change more clearly. So the frames are coloured by rank in London, and the
  presets are in the order that changes the map most at each step.
- The Atlas framing: the app's own preview framing (a 1200 by 750 window). A smaller window
  hid the weights behind the legend.
- The RTS target: `rts_id 9480`.

## Not done here

- `auto-generate-preview-image` could learn to write several stills in one run. Then the
  Atlas repo could own its frames, and `scripts/fetch-previews.js` could copy them every
  day, as it copies the previews. Today the capture is a script in this repo, run by hand.
