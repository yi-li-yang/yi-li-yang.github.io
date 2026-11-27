// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// scripts/lib/text.js
//
// PURE. Strip LaTeX back to readable plain text. The data layer's prose is LaTeX on purpose
// (\&, --, $\times$), so every output that is NOT LaTeX goes through here: the cover letter's
// .txt and .md twins (as the `untex` Nunjucks filter, registered in render.js) and the site's
// data/site.json (scripts/build-site-json.js).
//
// Order matters, and one step is subtler than it looks. The final `$`-strip removes leftover
// MATH delimiters ($\mu$ having already been handled, $^2$ and friends have not). But an
// escaped literal dollar — `\$99,749` in a cover letter naming an award — unescapes to a bare
// `$`, which that same strip then ate, silently turning "$99,749" into "99,749". A missing
// currency symbol in a letter about money is not a cosmetic defect.
//
// So escaped dollars are parked on a sentinel that cannot appear in LaTeX source, and restored
// after the math strip has run. NUL is used precisely because no template can produce one.
// `---` becomes an em dash before `--` becomes an en dash, or the em dash would be lost.

const DOLLAR = '\u0000';

export function untex(s) {
  return String(s ?? '')
    .replace(/\\textbar\{\}/g, '|')
    .replace(/\\(?:textbf|textit|emph|text)\{([^}]*)\}/g, '$1')
    .replace(/\$\\mu\$/g, 'µ')
    .replace(/\\times/g, 'x')
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, DOLLAR)
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/\$/g, '')
    .split(DOLLAR)
    .join(String.fromCharCode(36))
    .trim();
}
