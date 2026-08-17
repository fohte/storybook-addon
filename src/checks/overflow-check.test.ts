import { afterEach, describe, expect, it } from 'vitest'

import { overflowCheck } from '#checks/overflow-check.js'
import { messageOf } from '#checks/test-helpers.js'

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

function mountStoryRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('overflowCheck', () => {
  it('does not throw when no canvasElement is provided', () => {
    expect(() => {
      overflowCheck.assert(undefined, undefined)
    }).not.toThrow()
  })

  it('passes when nothing overflows', () => {
    const root = mountStoryRoot()
    const child = document.createElement('div')
    mockSize(child, { scrollWidth: 100, clientWidth: 100 })
    root.append(child)

    expect(() => {
      overflowCheck.assert(undefined, root)
    }).not.toThrow()
  })

  it('fails and describes the overflowing element', () => {
    const root = mountStoryRoot()
    const child = document.createElement('div')
    child.id = 'chip-row'
    mockSize(child, { scrollWidth: 150, clientWidth: 100 })
    root.append(child)

    expect(
      messageOf(() => {
        overflowCheck.assert(undefined, root)
      }),
    ).toEqual(
      'Story has element(s) overflowing their container (clipped and invisible):\n' +
        'div#chip-row: scrollWidth=150 > clientWidth=100 (+50px)',
    )
  })

  it('excludes text-overflow: ellipsis as intentional truncation', () => {
    const root = mountStoryRoot()
    const child = document.createElement('div')
    child.style.textOverflow = 'ellipsis'
    mockSize(child, { scrollWidth: 150, clientWidth: 100 })
    root.append(child)

    expect(() => {
      overflowCheck.assert(undefined, root)
    }).not.toThrow()
  })

  it('excludes visually-hidden elements (<=1x1px)', () => {
    const root = mountStoryRoot()
    const child = document.createElement('div')
    mockSize(child, { scrollWidth: 150, clientWidth: 1, clientHeight: 1 })
    root.append(child)

    expect(() => {
      overflowCheck.assert(undefined, root)
    }).not.toThrow()
  })

  it('skips the check when parameters.overflowCheck.disable is true', () => {
    const root = mountStoryRoot()
    const child = document.createElement('div')
    mockSize(child, { scrollWidth: 150, clientWidth: 100 })
    root.append(child)

    expect(() => {
      overflowCheck.assert({ overflowCheck: { disable: true } }, root)
    }).not.toThrow()
  })

  it('excludes elements matching parameters.overflowCheck.ignoreSelectors', () => {
    const root = mountStoryRoot()
    const child = document.createElement('div')
    child.className = 'chip-row'
    mockSize(child, { scrollWidth: 150, clientWidth: 100 })
    root.append(child)

    expect(() => {
      overflowCheck.assert(
        { overflowCheck: { ignoreSelectors: ['.chip-row'] } },
        root,
      )
    }).not.toThrow()
  })

  it('excludes elements matching parameters.overflowCheck.globalIgnoreSelectors', () => {
    const root = mountStoryRoot()
    const child = document.createElement('div')
    child.className = 'checkbox'
    mockSize(child, { scrollWidth: 150, clientWidth: 100 })
    root.append(child)

    expect(() => {
      overflowCheck.assert(
        { overflowCheck: { globalIgnoreSelectors: ['.checkbox'] } },
        root,
      )
    }).not.toThrow()
  })

  it('keeps globalIgnoreSelectors active when a story sets its own ignoreSelectors', () => {
    const root = mountStoryRoot()
    const child = document.createElement('div')
    child.className = 'checkbox'
    mockSize(child, { scrollWidth: 150, clientWidth: 100 })
    root.append(child)

    expect(() => {
      overflowCheck.assert(
        {
          overflowCheck: {
            globalIgnoreSelectors: ['.checkbox'],
            ignoreSelectors: ['.unrelated'],
          },
        },
        root,
      )
    }).not.toThrow()
  })

  it('groups an overflowing descendant under its overflowing ancestor', () => {
    const root = mountStoryRoot()
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
        overflowCheck.assert(undefined, root)
      }),
    ).toEqual(
      'Story has element(s) overflowing their container (clipped and invisible):\n' +
        '2 chained overflows (same root cause, outermost first):\n' +
        '  div#parent: scrollWidth=200 > clientWidth=100 (+100px)\n' +
        '  span#child: scrollWidth=150 > clientWidth=100 (+50px)',
    )
  })
})
