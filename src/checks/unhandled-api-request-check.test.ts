import { beforeEach, describe, expect, it, vi } from 'vitest'

import { messageOf } from '#checks/test-helpers.js'
import {
  configureUnhandledApiRequestCheck,
  reportUnhandledApiRequest,
  unhandledApiRequestCheck,
  waitForPendingApiRequests,
} from '#checks/unhandled-api-request-check.js'

// The check's fetch tracker patches globalThis.fetch exactly once (state is
// shared via globalThis, so tests can't force it to re-patch). Installing
// this indirection before that first patch means it captures this function
// as "the original fetch" instead of the environment's real one, so each
// test can redirect it without touching globalThis.fetch again.
let fetchImpl: typeof fetch = () =>
  Promise.reject(new Error('unexpected fetch() call in test'))
globalThis.fetch = (input, init) => fetchImpl(input, init)

beforeEach(() => {
  unhandledApiRequestCheck.reset()
  configureUnhandledApiRequestCheck({ pathPrefixes: [] })
  fetchImpl = () => Promise.reject(new Error('unexpected fetch() call in test'))
})

describe('reportUnhandledApiRequest', () => {
  it('records and returns true for a same-origin request matching a configured prefix', () => {
    configureUnhandledApiRequestCheck({ pathPrefixes: ['/api/'] })

    const recorded = reportUnhandledApiRequest(
      `${window.location.origin}/api/tasks`,
    )

    expect(recorded).toBe(true)
    expect(
      messageOf(() => {
        unhandledApiRequestCheck.assert()
      }),
    ).toEqual(
      'Story made unhandled API request(s); add an MSW handler for:\n/api/tasks',
    )
  })

  it('ignores a request whose path does not match any configured prefix', () => {
    configureUnhandledApiRequestCheck({ pathPrefixes: ['/api/'] })

    const recorded = reportUnhandledApiRequest(
      `${window.location.origin}/assets/logo.png`,
    )

    expect(recorded).toBe(false)
    expect(() => {
      unhandledApiRequestCheck.assert()
    }).not.toThrow()
  })

  it('ignores a request to a different origin even when the path matches', () => {
    configureUnhandledApiRequestCheck({ pathPrefixes: ['/api/'] })

    const recorded = reportUnhandledApiRequest(
      'https://other.example.test/api/tasks',
    )

    expect(recorded).toBe(false)
    expect(() => {
      unhandledApiRequestCheck.assert()
    }).not.toThrow()
  })
})

describe('unhandledApiRequestCheck', () => {
  it('clears recorded requests on reset', () => {
    configureUnhandledApiRequestCheck({ pathPrefixes: ['/api/'] })
    reportUnhandledApiRequest(`${window.location.origin}/api/tasks`)

    unhandledApiRequestCheck.reset()

    expect(() => {
      unhandledApiRequestCheck.assert()
    }).not.toThrow()
  })

  it('discards fetches left pending from a previous story on reset, so they do not delay the next story', async () => {
    fetchImpl = () => new Promise(() => {}) // never resolves
    configureUnhandledApiRequestCheck({ pathPrefixes: ['/api/'] })
    void fetch(`${window.location.origin}/api/tasks`)

    unhandledApiRequestCheck.reset()

    let settled = false
    void waitForPendingApiRequests().then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(true)
  })
})

describe('waitForPendingApiRequests', () => {
  it('resolves immediately when no fetch is pending', async () => {
    configureUnhandledApiRequestCheck({ pathPrefixes: ['/api/'] })

    await expect(waitForPendingApiRequests()).resolves.toBeUndefined()
  })

  it('waits for an in-flight tracked fetch to settle before resolving', async () => {
    let resolveFetch: (() => void) | undefined
    fetchImpl = () =>
      new Promise((resolve) => {
        resolveFetch = () => {
          resolve(new Response())
        }
      })
    configureUnhandledApiRequestCheck({ pathPrefixes: ['/api/'] })

    void fetch(`${window.location.origin}/api/tasks`)

    let settled = false
    const waiting = waitForPendingApiRequests().then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    resolveFetch?.()
    await waiting
    expect(settled).toBe(true)
  })

  it('waits for a follow-up tracked fetch triggered while an earlier one settles', async () => {
    let resolveFirst: (() => void) | undefined
    let resolveSecond: (() => void) | undefined
    let fetchCalls = 0
    fetchImpl = () => {
      fetchCalls += 1
      if (fetchCalls === 1) {
        return new Promise((resolve) => {
          resolveFirst = () => {
            resolve(new Response())
          }
        })
      }
      return new Promise((resolve) => {
        resolveSecond = () => {
          resolve(new Response())
        }
      })
    }
    configureUnhandledApiRequestCheck({ pathPrefixes: ['/api/'] })

    void fetch(`${window.location.origin}/api/user`).then(() =>
      fetch(`${window.location.origin}/api/user/posts`),
    )

    let settled = false
    const waiting = waitForPendingApiRequests().then(() => {
      settled = true
    })

    resolveFirst?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(resolveSecond).toBeDefined()
    expect(settled).toBe(false)

    resolveSecond?.()
    await waiting
    expect(settled).toBe(true)
  })

  it('ignores a fetch whose URL does not match a configured prefix', async () => {
    // Never resolves: a fetch that's (incorrectly) tracked would still let
    // waitForPendingApiRequests() resolve eventually via the timeout, so
    // resolving alone can't tell "ignored" apart from "tracked but slow".
    fetchImpl = () => new Promise(() => {})
    configureUnhandledApiRequestCheck({ pathPrefixes: ['/api/'] })

    void fetch(`${window.location.origin}/assets/logo.png`)

    let settled = false
    void waitForPendingApiRequests().then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(true)
  })

  it('still gives up on the pending-fetch timeout when vi.setSystemTime() froze Date without vi.useFakeTimers()', async () => {
    // vi.setSystemTime() alone (no vi.useFakeTimers()) only freezes Date, not
    // setTimeout — a consuming app's VRT setup does exactly this to pin
    // screenshots to a fixed date. A deadline computed from Date.now() would
    // never elapse under this combination, hanging until the outer test
    // runner's own timeout kills it.
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    let resolveFetch: (() => void) | undefined
    try {
      fetchImpl = () =>
        new Promise((resolve) => {
          resolveFetch = () => {
            resolve(new Response())
          }
        })
      configureUnhandledApiRequestCheck({ pathPrefixes: ['/api/'] })

      void fetch(`${window.location.origin}/api/tasks`)

      let settled = false
      const waiting = waitForPendingApiRequests().then(() => {
        settled = true
      })

      // No fake timers are installed in this test (that's the scenario under
      // test), so this genuinely waits out the real ~2s deadline instead of
      // fast-forwarding it — stubbing performance.now() here would mock away
      // the exact thing this test exists to prove stays real.
      await waiting
      expect(settled).toBe(true)
    } finally {
      // Left pending, the fetch tracker never removes it from
      // pendingFetches, which would force every later test's fetch wait in
      // this file down the same timeout path.
      resolveFetch?.()
      vi.useRealTimers()
    }
  })

  it('gives up waiting once a pending tracked fetch exceeds the timeout', async () => {
    vi.useFakeTimers()
    let resolveFetch: (() => void) | undefined
    try {
      fetchImpl = () =>
        new Promise((resolve) => {
          resolveFetch = () => {
            resolve(new Response())
          }
        })
      configureUnhandledApiRequestCheck({ pathPrefixes: ['/api/'] })

      void fetch(`${window.location.origin}/api/tasks`)

      let settled = false
      const waiting = waitForPendingApiRequests().then(() => {
        settled = true
      })

      await vi.advanceTimersByTimeAsync(2000)
      await waiting
      expect(settled).toBe(true)
    } finally {
      // Left pending, the fetch tracker never removes it from
      // pendingFetches, which would force every later test's fetch wait in
      // this file down the same timeout path.
      resolveFetch?.()
      vi.useRealTimers()
    }
  })
})
