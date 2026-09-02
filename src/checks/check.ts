// Shared contract for the story checks wired up in preview.ts: each check
// resets its own state before a story runs and asserts on it after. assert()
// receives the story's resolved parameters (so a check can support a
// per-story opt-out, e.g. `parameters: { overflowCheck: { disable: true } }`)
// and the story's canvasElement; checks that don't need one or both just
// ignore the corresponding argument.
//
// A check's own module and the consuming app's preview.ts can end up
// resolved to two separate instances of this module by the app's bundler
// (Storybook loads this addon's preview entry via an absolute path, while
// the app's own preview.ts imports it as a bare specifier that gets
// pre-bundled separately) — so a check that exposes a function for the
// consumer to call directly (as opposed to only reading `storyParameters`)
// can't rely on module-level `let`/`const` state to carry data from that
// call into reset()/assert(): the two live in different module instances.
// Route state that crosses that boundary through `context.parameters`
// (works when the value is known statically, at preview.ts load time) or
// through a namespaced `globalThis` property (needed when a check has to
// record something imperatively during a story's run, e.g. from a
// third-party callback) instead. This can't be caught by a unit test, since
// the duplication only happens under an app's real bundler.
export type StorybookCheck = {
  reset: () => void
  assert: (storyParameters?: unknown, canvasElement?: Element) => void
}

export function throwIfNotEmpty(urls: string[], message: string): void {
  if (urls.length === 0) return
  const list = urls.join('\n')
  urls.length = 0
  // eslint-disable-next-line no-restricted-syntax -- interop boundary: Storybook's afterEach (preview.ts) only reports a check as a story failure when assert() throws
  throw new Error(`${message}:\n${list}`)
}
