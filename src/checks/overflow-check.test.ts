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

function mockViewport(size: { scrollWidth: number; innerWidth: number }): void {
  Object.defineProperty(document.documentElement, 'scrollWidth', {
    value: size.scrollWidth,
    configurable: true,
  })
  Object.defineProperty(window, 'innerWidth', {
    value: size.innerWidth,
    configurable: true,
  })
}

afterEach(() => {
  document.body.replaceChildren()
  // jsdom's real defaults (innerWidth=1024, documentElement.scrollWidth=0
  // since jsdom never runs layout), so viewport-overflow tests can't leak
  // into unrelated tests that never call mockViewport().
  mockViewport({ scrollWidth: 0, innerWidth: 1024 })
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

  it('excludes elements matching either globalIgnoreSelectors or the story ignoreSelectors', () => {
    const root = mountStoryRoot()
    const globalMatch = document.createElement('div')
    globalMatch.className = 'checkbox'
    mockSize(globalMatch, { scrollWidth: 150, clientWidth: 100 })
    const storyMatch = document.createElement('div')
    storyMatch.className = 'chip-row'
    mockSize(storyMatch, { scrollWidth: 150, clientWidth: 100 })
    root.append(globalMatch, storyMatch)

    expect(() => {
      overflowCheck.assert(
        {
          overflowCheck: {
            globalIgnoreSelectors: ['.checkbox'],
            ignoreSelectors: ['.chip-row'],
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

  // Under layout: 'centered', canvasElement is a flex item and never
  // self-overflows — only findViewportOverflow can catch this.
  it('fails when the document overflows the viewport, even though canvasElement itself does not self-overflow', () => {
    const root = mountStoryRoot()
    mockViewport({ scrollWidth: 800, innerWidth: 375 })

    expect(
      messageOf(() => {
        overflowCheck.assert(undefined, root)
      }),
    ).toEqual(
      'Story overflows the viewport itself (not just an inner element):\n' +
        "document.documentElement.scrollWidth=800 is 425px wider than window.innerWidth=375. This usually means the story's own wrapper uses a fixed width (e.g. Tailwind's `w-*`) instead of a max-width (`max-w-*`).",
    )
  })

  it('passes when the document does not overflow the viewport', () => {
    const root = mountStoryRoot()
    mockViewport({ scrollWidth: 375, innerWidth: 375 })

    expect(() => {
      overflowCheck.assert(undefined, root)
    }).not.toThrow()
  })

  it('skips the viewport check when parameters.overflowCheck.disable is true', () => {
    const root = mountStoryRoot()
    mockViewport({ scrollWidth: 800, innerWidth: 375 })

    expect(() => {
      overflowCheck.assert({ overflowCheck: { disable: true } }, root)
    }).not.toThrow()
  })
})
