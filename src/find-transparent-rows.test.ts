import { describe, expect, it } from 'vitest'

import { findTransparentRows } from '#find-transparent-rows.js'

function rgbaData(rows: number[][]): Uint8ClampedArray {
  return new Uint8ClampedArray(rows.flat())
}

describe('findTransparentRows', () => {
  it('returns no rows when every pixel is opaque', () => {
    const data = rgbaData([
      [0, 0, 0, 255, 0, 0, 0, 255],
      [0, 0, 0, 255, 0, 0, 0, 255],
    ])
    expect(findTransparentRows(data, 2, 2)).toEqual([])
  })

  it('returns the index of a fully transparent row', () => {
    const data = rgbaData([
      [0, 0, 0, 255, 0, 0, 0, 255],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ])
    expect(findTransparentRows(data, 2, 2)).toEqual([1])
  })

  it('treats a row with at least one opaque pixel as not transparent', () => {
    const data = rgbaData([[0, 0, 0, 0, 0, 0, 0, 255]])
    expect(findTransparentRows(data, 2, 1)).toEqual([])
  })
})
