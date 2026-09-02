import { fromThrowable } from 'neverthrow'

// Shared test helper: runs fn() and returns the message of the throw-based
// failure it produces (throwIfNotEmpty(), or a plugin's own throw), so a
// test can assert on the full failure text with a single toEqual() instead
// of catching per test.
export function messageOf(fn: () => void): string {
  return fromThrowable(fn, (error) =>
    error instanceof Error ? error.message : String(error),
  )().match(
    () => '',
    (message) => message,
  )
}
