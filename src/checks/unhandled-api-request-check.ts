import type { StorybookCheck } from '#checks/check.js'
import { throwIfNotEmpty } from '#checks/check.js'

// Populated by reportUnhandledApiRequest(), which the consuming app's MSW
// `onUnhandledRequest` callback calls — a story hitting an API endpoint with
// no MSW handler gets MSW's error response instead of real data, so the
// screenshot captures a broken UI state without failing otherwise.
const unhandledApiRequestUrls: string[] = []

// Which paths count as "API requests" is app-specific (tq uses `/api/`, a
// future app might use a different prefix or none), so it's configured once
// by the consuming app rather than hardcoded here.
let pathPrefixes: string[] = []

export function configureUnhandledApiRequestCheck(options: {
  pathPrefixes: string[]
}): void {
  pathPrefixes = options.pathPrefixes
}

// Returns whether the request was recorded, so the caller can decide whether
// to also print MSW's own error for it.
export function reportUnhandledApiRequest(url: string): boolean {
  const parsed = new URL(url)
  if (parsed.origin !== window.location.origin) return false
  if (!pathPrefixes.some((prefix) => parsed.pathname.startsWith(prefix))) {
    return false
  }
  unhandledApiRequestUrls.push(parsed.pathname)
  return true
}

export const unhandledApiRequestCheck: StorybookCheck = {
  reset: () => {
    unhandledApiRequestUrls.length = 0
  },
  assert: () => {
    throwIfNotEmpty(
      unhandledApiRequestUrls,
      'Story made unhandled API request(s); add an MSW handler for',
    )
  },
}
