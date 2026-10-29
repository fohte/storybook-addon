// @storycap-testrun/browser's own fullPage tiling (packages/browser/src/vitest-plugin/index.ts,
// `captureFullPage`) assumes `scrollTo(0, requestedScrollY)` lands at the
// requested position. Browsers clamp that position near the bottom, so shift
// each clip by the difference between requested and actual scroll positions.
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
