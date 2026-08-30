import type { StorybookCheck } from '#checks/check.js'
import { throwIfNotEmpty } from '#checks/check.js'

// A story that loads a non-same-origin http(s) resource (e.g. a remote
// avatar image) races the capture against that request's completion over the
// real network, so the same story can rasterize differently between runs.
// Failing the test surfaces this instead of letting it show up as unstable
// screenshot diffs; fix stories by inlining the resource as a data URI.
const externalResourceUrls: string[] = []

// Entries older than this are from a previous story and must not be
// attributed to the one currently rendering.
let resetAt = 0

function isExternalResourceUrl(url: string): boolean {
  const { protocol, origin } = new URL(url)
  return (
    (protocol === 'http:' || protocol === 'https:') &&
    origin !== window.location.origin
  )
}

function isPerformanceResourceTiming(
  entry: PerformanceEntry,
): entry is PerformanceResourceTiming {
  return entry.entryType === 'resource'
}

new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!isPerformanceResourceTiming(entry)) continue
    // Resource timing entries are queued when the request completes, not
    // when it starts, so a request that outlives its story's render phase
    // must be judged by its completion time (responseEnd, always exposed
    // even cross-origin: https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/responseEnd).
    // Filtering on startTime instead would drop it forever once resetAt
    // advances past its (early) start time.
    if (entry.responseEnd >= resetAt && isExternalResourceUrl(entry.name)) {
      externalResourceUrls.push(entry.name)
    }
  }
}).observe({ type: 'resource', buffered: true })

export const externalResourceCheck: StorybookCheck = {
  reset: () => {
    resetAt = performance.now()
    externalResourceUrls.length = 0
  },
  assert: () => {
    throwIfNotEmpty(
      externalResourceUrls,
      'Story loaded non-same-origin resource(s), which makes VRT captures flaky',
    )
  },
}
