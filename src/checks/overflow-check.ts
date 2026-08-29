import type { StorybookCheck } from '#checks/check.js'
import { throwIfNotEmpty } from '#checks/check.js'

function describeElement(el: Element): string {
  const id = el.id ? `#${el.id}` : ''
  const classAttr = el.getAttribute('class')
  const classes =
    classAttr !== null && classAttr !== ''
      ? `.${classAttr.trim().split(/\s+/).join('.')}`
      : ''
  return `${el.tagName.toLowerCase()}${id}${classes}`
}

// `text-overflow: ellipsis` is excluded because it's a deliberate "this is
// cut off, here's more" affordance (e.g. Tailwind's `truncate`), not a
// silent, undiscoverable clip — exactly the class of intentional truncation
// this check isn't meant to flag.
//
// `overflow-x: visible` elements are NOT excluded, even though such an
// element doesn't clip its own content: in a real app, some clipping
// ancestor above it usually reports the same overflow independently, but a
// story has no such ancestor above its scan root — an `overflow-x: visible`
// element may be the only place a story's overflow is ever caught.
function isIntentionalTruncation(cs: CSSStyleDeclaration): boolean {
  return cs.textOverflow === 'ellipsis'
}

// The standard visually-hidden a11y technique (e.g. Tailwind's `sr-only`)
// shrinks an element to a 1x1px box and clips it on purpose, to keep it
// readable by screen readers while invisible to sighted users. A 1x1px box
// can never show meaningfully clipped content to a sighted user either way,
// so this is a safe, general skip rather than a per-story exclusion.
function isVisuallyHidden(el: Element): boolean {
  return el.clientWidth <= 1 && el.clientHeight <= 1
}

// A single overflowing element is picked up again by every clipping
// ancestor above it, up to the scan root (per
// https://www.w3.org/TR/cssom-view-1/#scrolling-area, unclipped overflow
// keeps bubbling upward), so one bug would otherwise read as N separate
// findings. Group ancestor-descendant reports into the topmost ancestor's
// group instead of dropping any of them — the chain itself is a hint for
// where the fix belongs, since the root cause (e.g. a parent flex layout)
// isn't always the innermost element. `root.querySelectorAll` yields
// elements in document order, so an element's ancestors are always seen
// (and can become its group) before it is.
function groupByAncestor(
  entries: { el: Element; description: string }[],
): string[] {
  const groups: { root: Element; descriptions: string[] }[] = []
  for (const { el, description } of entries) {
    const group = groups.find((g) => g.root.contains(el))
    if (group) {
      group.descriptions.push(description)
    } else {
      groups.push({ root: el, descriptions: [description] })
    }
  }
  return groups.map((g) =>
    g.descriptions.length === 1
      ? g.descriptions.join('')
      : `${String(g.descriptions.length)} chained overflows (same root cause, outermost first):\n  ${g.descriptions.join('\n  ')}`,
  )
}

// el.scrollWidth > el.clientWidth means the element's content doesn't fit
// inside its own padding box (clientWidth) — i.e. some of it is clipped and
// invisible.
//
// This only measures overflow on the inline-end (right, in LTR) side: the
// CSSOM "scrolling area" a scrollable box exposes never extends past its
// inline-start edge, so content overflowing to the *left* is invisible to
// this check (https://www.w3.org/TR/cssom-view-1/#scrolling-area).
// `position: fixed` elements are invisible to it too — they escape the
// containing block chain, so an off-screen fixed element never shows up in
// any ancestor's scrollWidth.
function findOverflows(root: Element, ignoreSelectors: string[]): string[] {
  const entries: { el: Element; description: string }[] = []
  for (const el of root.querySelectorAll('*')) {
    if (el.scrollWidth <= el.clientWidth) continue
    if (isVisuallyHidden(el)) continue
    if (ignoreSelectors.some((selector) => el.matches(selector))) continue
    if (isIntentionalTruncation(getComputedStyle(el))) continue

    const overflowPx = el.scrollWidth - el.clientWidth
    entries.push({
      el,
      description: `${describeElement(el)}: scrollWidth=${String(el.scrollWidth)} > clientWidth=${String(el.clientWidth)} (+${String(overflowPx)}px)`,
    })
  }
  return groupByAncestor(entries)
}

// `findOverflows` never sees canvasElement itself overflowing. Under
// `layout: 'centered'`, canvasElement is a flex item that never shrinks
// below its own content width, so the clip only shows up on
// `document.documentElement`, above canvasElement.
function findViewportOverflow(): string[] {
  const overflowPx = document.documentElement.scrollWidth - window.innerWidth
  if (overflowPx <= 0) return []
  return [
    `document.documentElement.scrollWidth=${String(document.documentElement.scrollWidth)} is ${String(overflowPx)}px wider than window.innerWidth=${String(window.innerWidth)}. This usually means the story's own wrapper uses a fixed width (e.g. Tailwind's \`w-*\`) instead of a max-width (\`max-w-*\`).`,
  ]
}

function overflowCheckParameters(storyParameters: unknown): object | undefined {
  if (typeof storyParameters !== 'object' || storyParameters === null) {
    return undefined
  }
  if (!('overflowCheck' in storyParameters)) return undefined
  const { overflowCheck } = storyParameters
  if (typeof overflowCheck !== 'object' || overflowCheck === null) {
    return undefined
  }
  return overflowCheck
}

function isDisabled(overflowCheck: object | undefined): boolean {
  return (
    overflowCheck !== undefined &&
    'disable' in overflowCheck &&
    overflowCheck.disable === true
  )
}

// Narrower than `overflowCheck.disable`: exempt one intentionally-overflowing
// element (e.g. a chip row using `overflow-x-auto`, or a fixed-scrollbar
// sizing artifact) by CSS selector via the story's own parameters, matching
// only the element itself — not its descendants — so the rest of the story
// (including anything nested inside the matched element) still gets checked.
function ignoreSelectorsOf(overflowCheck: object | undefined): string[] {
  if (overflowCheck === undefined) return []
  if (!('ignoreSelectors' in overflowCheck)) return []
  const { ignoreSelectors } = overflowCheck
  if (!Array.isArray(ignoreSelectors)) return []
  return ignoreSelectors.filter((s): s is string => typeof s === 'string')
}

// A separate key from `ignoreSelectors`, set once by the consuming app in
// its top-level `preview.ts` `parameters` export (not via a module-level
// setter — a story's own `parameters.overflowCheck` and the app's global one
// live in different Storybook parameter scopes, which Storybook deep-merges
// by object key, so a story setting `ignoreSelectors` can't drop this list).
// This also sidesteps bundlers that resolve this addon's module twice for
// one consumer (once from the app's own import, once via Storybook's addon
// loader) — `context.parameters` comes from Storybook itself, not from
// either module instance, so it's unaffected either way.
function globalIgnoreSelectorsOf(overflowCheck: object | undefined): string[] {
  if (overflowCheck === undefined) return []
  if (!('globalIgnoreSelectors' in overflowCheck)) return []
  const { globalIgnoreSelectors } = overflowCheck
  if (!Array.isArray(globalIgnoreSelectors)) return []
  return globalIgnoreSelectors.filter((s): s is string => typeof s === 'string')
}

export const overflowCheck: StorybookCheck = {
  reset: () => {},
  assert: (storyParameters, canvasElement) => {
    const params = overflowCheckParameters(storyParameters)
    if (isDisabled(params)) return
    if (canvasElement == null) {
      // Real Storybook runs always pass canvasElement (it's the story's
      // mount container); this only triggers a caller invoking assert()
      // directly without one. Skip rather than fail, since there is no root
      // to scan.
      console.warn(
        '[overflow-check] no canvasElement in story context; skipping overflow scan',
      )
      return
    }

    throwIfNotEmpty(
      findOverflows(canvasElement, [
        ...globalIgnoreSelectorsOf(params),
        ...ignoreSelectorsOf(params),
      ]),
      'Story has element(s) overflowing their container (clipped and invisible)',
    )

    throwIfNotEmpty(
      findViewportOverflow(),
      'Story overflows the viewport itself (not just an inner element)',
    )
  },
}
