// Shared test helper: runs fn() and returns the message of the throw-based
// assertion failure it produces (vitest's assert.fail(), or a plugin's own
// throw), so a test can assert on the full failure text with a single
// toEqual() instead of catching per test.
export function messageOf(fn: () => void): string {
  // eslint-disable-next-line no-restricted-syntax -- interops with vitest's throw-based assert.fail()
  try {
    fn()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return ''
}
