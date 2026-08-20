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
  // fetch() calls matching pathPrefixes that haven't settled yet — see
  // installFetchTracker() below.
  pendingFetches: Set<Promise<void>>
  fetchTrackerInstalled: boolean
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
    pendingFetches: new Set(),
    fetchTrackerInstalled: false,
  }
  return globalThis.__fohteStorybookAddonUnhandledApiRequestState__
}

export function configureUnhandledApiRequestCheck(options: {
  pathPrefixes: string[]
}): void {
  globalState().pathPrefixes = options.pathPrefixes
}

function isTrackedRequestUrl(url: string): boolean {
  const parsed = new URL(url, window.location.href)
  if (parsed.origin !== window.location.origin) return false
  return globalState().pathPrefixes.some((prefix) =>
    parsed.pathname.startsWith(prefix),
  )
}

// Returns whether the request was recorded, so the caller can decide whether
// to also print MSW's own error for it.
export function reportUnhandledApiRequest(url: string): boolean {
  if (!isTrackedRequestUrl(url)) return false
  globalState().unhandledApiRequestUrls.push(new URL(url).pathname)
  return true
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

// A story's own render (e.g. a mount-time useEffect) can fire a fetch() it
// never awaits. MSW only learns whether that request is unhandled once its
// interception finishes, which — unlike a same-tick function call — takes at
// least one extra tick, so a check running immediately after render can run
// before MSW has had the chance to call reportUnhandledApiRequest() for it.
// Tracking matching fetch() calls lets assert() wait for them to settle
// first instead of racing that interception.
function installFetchTracker(): void {
  const state = globalState()
  if (state.fetchTrackerInstalled) return
  state.fetchTrackerInstalled = true

  const originalFetch = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const response = originalFetch(input, init)
    if (isTrackedRequestUrl(requestUrl(input))) {
      const settled = response.then(
        () => undefined,
        () => undefined,
      )
      state.pendingFetches.add(settled)
      void settled.finally(() => state.pendingFetches.delete(settled))
    }
    return response
  }
}

// ponytail: bounded wait, so a story that deliberately leaves a matching
// fetch pending forever (e.g. to render a "loading" state) doesn't hang the
// suite -- raise this if MSW's interception proves slower in practice.
const PENDING_FETCH_TIMEOUT_MS = 2000

// preview.ts's afterEach awaits this before running any check's assert(),
// so unhandledApiRequestCheck.assert() itself can stay synchronous like
// every other check.
export async function waitForPendingApiRequests(): Promise<void> {
  const { pendingFetches } = globalState()
  if (pendingFetches.size === 0) return
  await Promise.race([
    Promise.all(pendingFetches),
    new Promise((resolve) => setTimeout(resolve, PENDING_FETCH_TIMEOUT_MS)),
  ])
}

export const unhandledApiRequestCheck: StorybookCheck = {
  reset: () => {
    installFetchTracker()
    globalState().unhandledApiRequestUrls.length = 0
  },
  assert: () => {
    throwIfNotEmpty(
      globalState().unhandledApiRequestUrls,
      'Story made unhandled API request(s); add an MSW handler for',
    )
  },
}
