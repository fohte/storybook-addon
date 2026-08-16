import { describe, expect, it } from 'vitest'

import { throwIfNotEmpty } from '#checks/check.js'
import { messageOf } from '#checks/test-helpers.js'

describe('throwIfNotEmpty', () => {
  it('does nothing when the list is empty', () => {
    expect(() => {
      throwIfNotEmpty([], 'should not fail')
    }).not.toThrow()
  })

  it('fails with the message and the list contents when non-empty', () => {
    expect(
      messageOf(() => {
        throwIfNotEmpty(['/foo', '/bar'], 'unexpected item(s)')
      }),
    ).toEqual('unexpected item(s):\n/foo\n/bar')
  })

  it('clears the list after failing', () => {
    const urls = ['/foo']

    expect(() => {
      throwIfNotEmpty(urls, 'unexpected item(s)')
    }).toThrow()

    expect(urls).toEqual([])
  })
})
