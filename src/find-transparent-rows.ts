export function findTransparentRows(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): number[] {
  const transparentRows: number[] = []
  for (let y = 0; y < height; y++) {
    let hasOpaquePixel = false
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] !== 0) {
        hasOpaquePixel = true
        break
      }
    }
    if (!hasOpaquePixel) transparentRows.push(y)
  }
  return transparentRows
}
