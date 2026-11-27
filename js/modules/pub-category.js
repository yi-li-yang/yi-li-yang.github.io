// SOURCE — you own this file. Edit freely, by hand or by agent.
//
// One category per publication, checked in this order. No year means unfinished whatever the
// type (CLAUDE.md: unpublished work is @misc with an empty year), so it never counts as a
// paper. Pure, so test/site.test.js can check that the chips the site counts with this agree
// with the counts the CV prints (pubCounts() in scripts/lib/data.js).

export function categoryOf(pub) {
  if (pub.year == null) return 'in-progress';
  if (pub.dataset) return 'dataset';
  if (pub.type === 'article') return 'journal';
  if (pub.type === 'inproceedings') return 'conference';
  return 'other';
}
