import { beforeEach, describe, expect, it } from 'vitest'

import { messageOf } from '#checks/test-helpers.js'
import {
  configureUnhandledApiRequestCheck,
  reportUnhandledApiRequest,
  unhandledApiRequestCheck,
} from '#checks/unhandled-api-request-check.js'

beforeEach(() => {
  unhandledApiRequestCheck.reset()
  configureUnhandledApiRequestCheck({ pathPrefixes: [] })
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
