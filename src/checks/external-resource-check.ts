import type { StorybookCheck } from '#checks/check.js'
import { throwIfNotEmpty } from '#checks/check.js'

// A story that loads a non-same-origin http(s) resource (e.g. a remote
// avatar image) races the capture against that request's completion over the
// real network, so the same story can rasterize differently between runs.
// Failing the test surfaces this instead of letting it show up as unstable
// screenshot diffs; fix stories by inlining the resource as a data URI.
const externalResourceUrls: string[] = []

function isExternalResourceUrl(url: string): boolean {
  const { protocol, origin } = new URL(url)
  return (
    (protocol === 'http:' || protocol === 'https:') &&
    origin !== window.location.origin
  )
}

new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (isExternalResourceUrl(entry.name)) {
      externalResourceUrls.push(entry.name)
    }
  }
}).observe({ type: 'resource', buffered: true })

export const externalResourceCheck: StorybookCheck = {
  reset: () => {
    externalResourceUrls.length = 0
  },
  assert: () => {
    throwIfNotEmpty(
      externalResourceUrls,
      'Story loaded non-same-origin resource(s), which makes VRT captures flaky',
    )
  },
}
