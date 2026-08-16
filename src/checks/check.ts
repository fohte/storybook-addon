import { assert } from 'vitest'

// Shared contract for the story checks wired up in preview.ts: each check
// resets its own state before a story runs and asserts on it after. assert()
// receives the story's resolved parameters so a check can support a
// per-story opt-out (e.g. `parameters: { overflowCheck: { disable: true } }`);
// checks that don't need it just ignore the argument.
export type StorybookCheck = {
  reset: () => void
  assert: (storyParameters?: unknown) => void
}

export function throwIfNotEmpty(urls: string[], message: string): void {
  if (urls.length === 0) return
  const list = urls.join('\n')
  urls.length = 0
  assert.fail(`${message}:\n${list}`)
}
