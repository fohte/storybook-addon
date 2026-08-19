import { describe, expect, it } from 'vitest'

import { messageOf } from '#checks/test-helpers.js'
import { storycapNetworkIdle } from '#vitest-plugin.js'

const STORYCAP_ID = '/node_modules/@storycap-testrun/browser/dist/index.mjs'

function withPerfObserver(code: string): string {
  return `${code}\n// uses PerformanceObserver for stability checks`
}

describe('storycapNetworkIdle', () => {
  it('leaves non-storycap modules untouched', () => {
    expect(
      storycapNetworkIdle.transform(
        withPerfObserver('const wait = (delay = 500) => new Promise(() => {})'),
        '/node_modules/other-package/index.js',
      ),
    ).toBeNull()
  })

  it('leaves storycap code without the network-idle wait untouched', () => {
    expect(
      storycapNetworkIdle.transform('export const foo = 1', STORYCAP_ID),
    ).toBeNull()
  })

  it('shortens the 500ms network-idle default to 100ms', () => {
    const code = withPerfObserver(
      'const wait = (delay = 500) => new Promise((resolve) => resolve())',
    )

    expect(storycapNetworkIdle.transform(code, STORYCAP_ID)).toEqual(
      withPerfObserver(
        'const wait = (delay = 100) => new Promise((resolve) => resolve())',
      ),
    )
  })

  it('throws when the 500ms default pattern is not found', () => {
    const code = withPerfObserver('const wait = (delay = 500) => notAPromise()')

    expect(
      messageOf(() => {
        storycapNetworkIdle.transform(code, STORYCAP_ID)
      }),
    ).toEqual(
      `storycap-network-idle: no 500ms network-idle default found in ${STORYCAP_ID}. Drop this plugin if @storycap-testrun made the wait configurable, otherwise re-derive the pattern.`,
    )
  })
})
