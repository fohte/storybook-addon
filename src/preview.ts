import type {
  AfterEach,
  BeforeEach,
  Parameters,
  WebRenderer,
} from 'storybook/internal/types'

import type { StorybookCheck } from '#checks/check.js'
import { externalResourceCheck } from '#checks/external-resource-check.js'
import { overflowCheck } from '#checks/overflow-check.js'
import {
  unhandledApiRequestCheck,
  waitForPendingApiRequests,
} from '#checks/unhandled-api-request-check.js'

export {
  configureUnhandledApiRequestCheck,
  reportUnhandledApiRequest,
} from '#checks/unhandled-api-request-check.js'

function injectStyle(css: string): void {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
}

// The native text-input caret blinks on an OS timer, so a captured frame of a
// focused input/contenteditable is on or off at random — same content,
// different pixels between runs. Hiding it keeps captures deterministic
// without touching application code.
injectStyle(
  'input, textarea, [contenteditable] { caret-color: transparent !important; }',
)

// CSS animations/transitions (popup open/close fades, zooms, spinners, ...)
// capture at whatever frame happens to be on screen when the screenshot
// fires, so the same story rasterizes differently between runs even though
// nothing about it actually changed. Forcing zero duration collapses every
// animation/transition to its end state instantly, keeping captures
// deterministic without touching application code.
injectStyle(`
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
`)

const checks: StorybookCheck[] = [
  externalResourceCheck,
  unhandledApiRequestCheck,
  overflowCheck,
]

export const parameters: Parameters = {}

export const beforeEach: BeforeEach<WebRenderer> = () => {
  for (const check of checks) check.reset()
}

export const afterEach: AfterEach<WebRenderer> = async (context) => {
  // A story with no play function only has its render awaited before
  // afterEach runs (see storybook/dist/preview/runtime.js's runStory()), so
  // a fire-and-forget fetch() from a mount-time effect can still be in
  // flight here — wait for it before the checks read their state.
  await waitForPendingApiRequests()
  for (const check of checks) {
    check.assert(context.parameters, context.canvasElement)
  }
}
