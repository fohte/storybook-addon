import { describe, expect, it } from 'vitest'

import { computeChunkClip } from '#storycap-fullpage-stitch.js'

describe('computeChunkClip', () => {
  it('is not offset when the requested scroll position is not clamped', () => {
    expect(computeChunkClip(0, 0, 800, 1158)).toEqual({
      clipYOffset: 0,
      chunkHeight: 800,
    })
  })

  it('is not offset on the last tile when the page height is an exact multiple of the viewport height', () => {
    expect(computeChunkClip(800, 800, 800, 1600)).toEqual({
      clipYOffset: 0,
      chunkHeight: 800,
    })
  })

  it('shifts the clip down to the unseen content when the last tile is clamped', () => {
    // viewport height 800, page height 1158 — the browser clamps the
    // requested scrollTo(0, 800) down to 358 (= 1158 - 800), so the unseen
    // 358px of content sits 442px (= 800 - 358) below the top of the
    // viewport-sized screenshot.
    expect(computeChunkClip(800, 358, 800, 1158)).toEqual({
      clipYOffset: 442,
      chunkHeight: 358,
    })
  })

  it('caps the chunk height to the visible window, not just what the page has left', () => {
    // A bottom-of-page clamp for this scrollHeight would only ever reduce
    // actualScrollY down to 358 (= 1158 - 800). Here actualScrollY (200) is
    // further off than that, so the unseen content spans more of the
    // viewport than the page's remaining 358px would suggest — chunkHeight
    // must be bounded by what's actually visible (viewportHeight -
    // clipYOffset = 200), not by scrollHeight - requestedScrollY.
    expect(computeChunkClip(800, 200, 800, 1158)).toEqual({
      clipYOffset: 600,
      chunkHeight: 200,
    })
  })
})
