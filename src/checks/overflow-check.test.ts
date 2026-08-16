import { afterEach, describe, expect, it } from 'vitest'

import { overflowCheck } from '#checks/overflow-check.js'

function mockSize(
  el: HTMLElement,
  size: { scrollWidth: number; clientWidth: number; clientHeight?: number },
): void {
  Object.defineProperty(el, 'scrollWidth', {
    value: size.scrollWidth,
    configurable: true,
  })
  Object.defineProperty(el, 'clientWidth', {
    value: size.clientWidth,
    configurable: true,
  })
  Object.defineProperty(el, 'clientHeight', {
    value: size.clientHeight ?? 20,
    configurable: true,
  })
}

// overflowCheck.reset() watches document.body for the story's root element
// via MutationObserver, whose callback fires as a microtask — awaiting once
// lets it run before the element is used.
async function mountStoryRoot(): Promise<HTMLElement> {
  overflowCheck.reset()
  const root = document.createElement('div')
  document.body.appendChild(root)
  await Promise.resolve()
  return root
}

afterEach(() => {
  document.body.replaceChildren()
})

function messageOf(fn: () => void): string {
  try {
    fn()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return ''
}

describe('overflowCheck', () => {
  it('passes when nothing overflows', async () => {
    const root = await mountStoryRoot()
    const child = document.createElement('div')
    mockSize(child, { scrollWidth: 100, clientWidth: 100 })
    root.append(child)

    expect(() => {
      overflowCheck.assert(undefined)
    }).not.toThrow()
  })

  it('fails and describes the overflowing element', async () => {
    const root = await mountStoryRoot()
    const child = document.createElement('div')
    child.id = 'chip-row'
    mockSize(child, { scrollWidth: 150, clientWidth: 100 })
    root.append(child)

    expect(
      messageOf(() => {
        overflowCheck.assert(undefined)
      }),
    ).toEqual(
      'Story has element(s) overflowing their container (clipped and invisible):\n' +
        'div#chip-row: scrollWidth=150 > clientWidth=100 (+50px)',
    )
  })

  it('excludes text-overflow: ellipsis as intentional truncation', async () => {
    const root = await mountStoryRoot()
    const child = document.createElement('div')
    child.style.textOverflow = 'ellipsis'
    mockSize(child, { scrollWidth: 150, clientWidth: 100 })
    root.append(child)

    expect(() => {
      overflowCheck.assert(undefined)
    }).not.toThrow()
  })

  it('excludes visually-hidden elements (<=1x1px)', async () => {
    const root = await mountStoryRoot()
    const child = document.createElement('div')
    mockSize(child, { scrollWidth: 150, clientWidth: 1, clientHeight: 1 })
    root.append(child)

    expect(() => {
      overflowCheck.assert(undefined)
    }).not.toThrow()
  })

  it('skips the check when parameters.overflowCheck.disable is true', async () => {
    const root = await mountStoryRoot()
    const child = document.createElement('div')
    mockSize(child, { scrollWidth: 150, clientWidth: 100 })
    root.append(child)

    expect(() => {
      overflowCheck.assert({ overflowCheck: { disable: true } })
    }).not.toThrow()
  })

  it('excludes elements matching parameters.overflowCheck.ignoreSelectors', async () => {
    const root = await mountStoryRoot()
    const child = document.createElement('div')
    child.className = 'chip-row'
    mockSize(child, { scrollWidth: 150, clientWidth: 100 })
    root.append(child)

    expect(() => {
      overflowCheck.assert({
        overflowCheck: { ignoreSelectors: ['.chip-row'] },
      })
    }).not.toThrow()
  })

  it('groups an overflowing descendant under its overflowing ancestor', async () => {
    const root = await mountStoryRoot()
    const parent = document.createElement('div')
    parent.id = 'parent'
    mockSize(parent, { scrollWidth: 200, clientWidth: 100 })
    const child = document.createElement('span')
    child.id = 'child'
    mockSize(child, { scrollWidth: 150, clientWidth: 100 })
    parent.append(child)
    root.append(parent)

    expect(
      messageOf(() => {
        overflowCheck.assert(undefined)
      }),
    ).toEqual(
      'Story has element(s) overflowing their container (clipped and invisible):\n' +
        '2 chained overflows (same root cause, outermost first):\n' +
        '  div#parent: scrollWidth=200 > clientWidth=100 (+100px)\n' +
        '  span#child: scrollWidth=150 > clientWidth=100 (+50px)',
    )
  })
})
