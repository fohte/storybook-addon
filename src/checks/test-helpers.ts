// Shared test helper: runs fn() and returns the message of the throw-based
// failure it produces (throwIfNotEmpty(), or a plugin's own throw), so a
// test can assert on the full failure text with a single toEqual() instead
// of catching per test.
export function messageOf(fn: () => void): string {
  // eslint-disable-next-line no-restricted-syntax -- interops with throwIfNotEmpty()'s throw-based failure signaling
  try {
    fn()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return ''
}
