import type { StorybookCheck } from '#checks/check.js'
import { throwIfNotEmpty } from '#checks/check.js'

interface UnhandledApiRequestState {
  // Which paths count as "API requests" is app-specific (tq uses `/api/`, a
  // future app might use a different prefix or none), so it's configured
  // once by the consuming app rather than hardcoded here.
  pathPrefixes: string[]
  // Populated by reportUnhandledApiRequest(), which the consuming app's MSW
  // `onUnhandledRequest` callback calls — a story hitting an API endpoint
  // with no MSW handler gets MSW's error response instead of real data, so
  // the screenshot captures a broken UI state without failing otherwise.
  unhandledApiRequestUrls: string[]
}

// A consuming app's own preview.ts (where reportUnhandledApiRequest() is
// called from) and this addon's afterEach (where unhandledApiRequestCheck
// runs) can end up resolved to two separate instances of this module by a
// bundler — module-level `let`/`const` state wouldn't cross that boundary.
// globalThis is the one thing both instances share regardless.
declare global {
  // `declare global` only merges into globalThis's type when declared `var`.
  var __fohteStorybookAddonUnhandledApiRequestState__:
    UnhandledApiRequestState | undefined
}

function globalState(): UnhandledApiRequestState {
  globalThis.__fohteStorybookAddonUnhandledApiRequestState__ ??= {
    pathPrefixes: [],
    unhandledApiRequestUrls: [],
  }
  return globalThis.__fohteStorybookAddonUnhandledApiRequestState__
}

export function configureUnhandledApiRequestCheck(options: {
  pathPrefixes: string[]
}): void {
  globalState().pathPrefixes = options.pathPrefixes
}

// Returns whether the request was recorded, so the caller can decide whether
// to also print MSW's own error for it.
export function reportUnhandledApiRequest(url: string): boolean {
  const parsed = new URL(url)
  if (parsed.origin !== window.location.origin) return false
  const state = globalState()
  if (
    !state.pathPrefixes.some((prefix) => parsed.pathname.startsWith(prefix))
  ) {
    return false
  }
  state.unhandledApiRequestUrls.push(parsed.pathname)
  return true
}

export const unhandledApiRequestCheck: StorybookCheck = {
  reset: () => {
    globalState().unhandledApiRequestUrls.length = 0
  },
  assert: () => {
    throwIfNotEmpty(
      globalState().unhandledApiRequestUrls,
      'Story made unhandled API request(s); add an MSW handler for',
    )
  },
}
