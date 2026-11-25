// SOURCE — you own this file. Edit freely, by hand or by agent.
// js/modules/previews.js
//
// Reads data/previews.json, which scripts/fetch-previews.js writes: for each repo URL, the file
// of its preview image and, when it has one, of its animation. Rendering must work without it,
// so any failure gives an empty map, and the site shows the images that show_repo.json names.

let loading = null;

export function loadPreviews() {
  loading ??= fetch('data/previews.json')
    .then((res) => (res.ok ? res.json() : {}))
    .then((data) => data.previews ?? {})
    .catch(() => ({}));
  return loading;
}
