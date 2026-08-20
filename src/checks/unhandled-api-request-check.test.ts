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

  it('ignores a fetch whose URL does not match a configured prefix', async () => {
    fetchImpl = () => new Promise(() => {})
    configureUnhandledApiRequestCheck({ pathPrefixes: ['/api/'] })

    void fetch(`${window.location.origin}/assets/logo.png`)

    await expect(waitForPendingApiRequests()).resolves.toBeUndefined()
  })

  it('gives up waiting once a pending tracked fetch exceeds the timeout', async () => {
    vi.useFakeTimers()
    try {
      fetchImpl = () => new Promise(() => {})
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
      vi.useRealTimers()
    }
  })
})
