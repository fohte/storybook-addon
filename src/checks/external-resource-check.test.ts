import { describe, expect, it, vi } from 'vitest'

// jsdom doesn't implement PerformanceObserver, and the module under test
// calls `new PerformanceObserver(...)` at module-load time — so the mock
// must be in place, and the module imported dynamically, before this file's
// static imports would otherwise load it.
type PerformanceEntryLike = { name: string }
type ObserverCallback = (list: {
  getEntries: () => PerformanceEntryLike[]
}) => void

let capturedCallback: ObserverCallback | undefined

class MockPerformanceObserver {
  constructor(callback: ObserverCallback) {
    capturedCallback = callback
  }
  observe(): void {}
  disconnect(): void {}
}

vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)

const { externalResourceCheck } =
  await import('#checks/external-resource-check.js')

function emit(entries: PerformanceEntryLike[]): void {
  capturedCallback?.({ getEntries: () => entries })
}

function messageOf(fn: () => void): string {
  try {
    fn()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return ''
}

describe('externalResourceCheck', () => {
  it('ignores same-origin resources', () => {
    externalResourceCheck.reset()
    emit([{ name: `${window.location.origin}/logo.png` }])

    expect(() => {
      externalResourceCheck.assert()
    }).not.toThrow()
  })

  it('records and fails on non-same-origin http(s) resources', () => {
    externalResourceCheck.reset()
    emit([{ name: 'https://cdn.example.test/font.woff2' }])

    expect(
      messageOf(() => {
        externalResourceCheck.assert()
      }),
    ).toEqual(
      'Story loaded non-same-origin resource(s), which makes VRT captures flaky:\n' +
        'https://cdn.example.test/font.woff2',
    )
  })

  it('clears recorded resources on reset', () => {
    externalResourceCheck.reset()
    emit([{ name: 'https://cdn.example.test/font.woff2' }])
    externalResourceCheck.reset()

    expect(() => {
      externalResourceCheck.assert()
    }).not.toThrow()
  })
})
