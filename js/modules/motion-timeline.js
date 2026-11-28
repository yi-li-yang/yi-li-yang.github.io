// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/motion-timeline.js
//
// The arithmetic of a Featured image's motion; js/modules/motion.js draws it. A card has a
// stack of still frames. For a moment in a play, this file says which frames to draw, how
// large and how opaque. It touches no DOM, so `npm test` checks it (test/motion.test.js).
//
// Two kinds of motion:
//   zoom      Each frame shows the same place at twice the scale of the frame before it.
//             The frames under the position scale up, and the next frame fades in on top.
//   dissolve  Every frame has the same scale. One frame fades into the next.
//
// A play starts on the first frame and ends on the last frame, where the image rests. A
// replay starts from that rest: the last frame fades back to the first, then the play runs.
//
// `timings` is { lead, move, hold, back } in milliseconds:
//   lead  the wait on the first frame before anything moves
//   move  zoom: the whole dive. dissolve: one fade from a frame to the next
//   hold  dissolve: the stay on each frame between the first and the last
//   back  replay only: the fade from the last frame back to the first

export const ZOOM_RATIO = 2;

// In a zoom step, the next frame is fully opaque when this share of the step has passed. The
// frame under it is scaled up and blurred, so it should show for a short time only.
const FADE_BY = 0.5;

// A frame under the position stays drawn until the position is this far past it. A frame
// comes in with a soft edge (`soft`, below), and the frame under it shows through that edge
// until the edge has left the image.
const KEEP = 1.5;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const c = clamp01(x); return c * c * (3 - 2 * c); };

// The dive starts gently, is fastest through the wide views, and slows into the last frames,
// where the detail is. Half of the frames pass in the first 37% of the time.
const dive = (x) => smooth(clamp01(x) ** 0.7);

// How long a play runs. A replay is longer by `back`.
export function playLength(kind, count, { lead, move, hold, back }, replay = false) {
  if (count < 2) return 0;
  const body = kind === 'zoom' ? move : (count - 1) * move + (count - 2) * hold;
  return body > 0 ? (replay ? back : 0) + lead + body : 0;
}

// The position in the stack at time t, counted from the start of `lead`: 0 is the first
// frame, count - 1 the last. A position between two whole numbers is part of the way from
// one frame to the next.
export function positionAt(kind, count, { lead, move, hold }, t) {
  const last = count - 1;
  const x = t - lead;
  if (x <= 0) return 0;
  if (kind === 'zoom') return x >= move ? last : last * dive(x / move);
  const step = move + hold;
  const done = Math.floor(x / step);
  if (done >= last) return last;
  return Math.min(last, done + (move > 0 ? clamp01((x - done * step) / move) : 1));
}

// The frames to draw at position u, the lowest first: [{ index, scale, opacity, soft }].
// `soft` is the share of the full soft edge, 0 to 1. In a zoom, a frame comes in small, in the
// middle of the frame under it, and a soft edge hides the line where the two meet. The first
// frame has nothing under it, so its edge is hard. The last frame is where the image rests,
// so its edge hardens as it arrives.
export function layersAt(kind, count, u) {
  const last = count - 1;
  const base = Math.min(Math.floor(u), last);
  const part = u - base;
  const next = part > 0 && base < last;
  if (kind !== 'zoom') {
    const layers = [{ index: base, scale: 1, opacity: 1, soft: 0 }];
    if (next) layers.push({ index: base + 1, scale: 1, opacity: smooth(part), soft: 0 });
    return layers;
  }
  const layers = [];
  for (let i = 0; i <= base; i++) {
    if (u - i < KEEP) layers.push({ index: i, scale: ZOOM_RATIO ** (u - i), opacity: 1, soft: i === 0 || i === last ? 0 : 1 });
  }
  if (next) {
    const index = base + 1;
    layers.push({ index, scale: ZOOM_RATIO ** (part - 1), opacity: smooth(part / FADE_BY), soft: index === last ? 1 - part : 1 });
  }
  return layers;
}

// What to draw at time t of a play: `layers`, as layersAt gives them, and `label`, the frame
// whose caption and credit show. In a replay the last frame first fades away over the first.
export function frameAt(kind, count, timings, t, replay = false) {
  const last = count - 1;
  if (replay && t < timings.back) {
    const gone = smooth(t / timings.back);
    return {
      layers: [{ index: 0, scale: 1, opacity: 1, soft: 0 }, { index: last, scale: 1, opacity: 1 - gone, soft: 0 }],
      label: gone < 0.5 ? last : 0,
    };
  }
  const u = positionAt(kind, count, timings, t - (replay ? timings.back : 0));
  return { layers: layersAt(kind, count, u), label: Math.round(u) };
}
