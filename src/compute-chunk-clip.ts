// @storycap-testrun/browser's own fullPage tiling (packages/browser/src/vitest-plugin/index.ts,
// `captureFullPage`) always clips each tile starting at the iframe's bounding-box
// top, on the assumption that `scrollTo(0, requestedScrollY)` always lands
// exactly at `requestedScrollY`. The browser clamps the scroll position once
// it exceeds `scrollHeight - viewportHeight`, so whenever the page height
// isn't an exact multiple of the viewport height, the last tile re-captures
// already-seen content instead of the page's true bottom, which is never
// captured. Comparing the requested position against what the browser
// actually applied gives the pixel offset the clip rect needs to shift down
// by to land on unseen content.
export function computeChunkClip(
  requestedScrollY: number,
  actualScrollY: number,
  viewportHeight: number,
  scrollHeight: number,
): { clipYOffset: number; chunkHeight: number } {
  const clipYOffset = requestedScrollY - actualScrollY
  const chunkHeight = Math.min(
    viewportHeight - clipYOffset,
    scrollHeight - requestedScrollY,
  )
  return { clipYOffset, chunkHeight }
}
