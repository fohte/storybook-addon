import { assert } from 'vitest'

// Shared contract for the story checks wired up in preview.ts: each check
// resets its own state before a story runs and asserts on it after. assert()
// receives the story's resolved parameters (so a check can support a
// per-story opt-out, e.g. `parameters: { overflowCheck: { disable: true } }`)
// and the story's canvasElement; checks that don't need one or both just
// ignore the corresponding argument.
export type StorybookCheck = {
  reset: () => void
  assert: (storyParameters?: unknown, canvasElement?: Element) => void
}

export function throwIfNotEmpty(urls: string[], message: string): void {
  if (urls.length === 0) return
  const list = urls.join('\n')
  urls.length = 0
  assert.fail(`${message}:\n${list}`)
}
