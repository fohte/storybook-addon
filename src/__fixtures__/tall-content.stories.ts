import type { Meta, StoryObj } from '@storybook/html-vite'
import { expect } from 'storybook/test'
import { commands } from 'vitest/browser'

import { findTransparentRows } from '#find-transparent-rows.js'

declare module 'vitest/browser' {
  interface BrowserCommands {
    __storycap_takeScreenshot: (
      filepath: string,
      options: { fullPage?: boolean },
    ) => Promise<string>
    __storycap_prepareViewport: () => Promise<void>
  }
}

// Not a multiple of the 800px viewport height the storybook-fixture project
// (vitest.config.ts) configures, so capturing it always needs more than one
// screenshot tile stitched together, exercising the fullPage tiling/clip path.
const CONTENT_HEIGHT = 1990

function renderTallContent(): HTMLElement {
  const el = document.createElement('div')
  el.style.height = `${String(CONTENT_HEIGHT)}px`
  el.style.background = '#3366cc'
  return el
}

const meta = {
  title: 'Fixtures/TallContent',
  render: renderTallContent,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

async function decodeScreenshot(base64Png: string): Promise<{
  height: number
  transparentRows: number[]
}> {
  const img = new Image()
  img.src = `data:image/png;base64,${base64Png}`
  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      resolve()
    }
    img.onerror = () => {
      reject(new Error('failed to decode captured screenshot'))
    }
  })

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  await expect(ctx).toBeTruthy()
  if (!ctx) return { height: canvas.height, transparentRows: [] }
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)

  return {
    height: canvas.height,
    transparentRows: findTransparentRows(data, canvas.width, canvas.height),
  }
}

export const CapturesFullPageWithoutClipping: Story = {
  play: async () => {
    // storycap's own afterEach hook (see .storybook/vitest.setup.ts) runs
    // __storycap_prepareViewport before capturing; calling
    // __storycap_takeScreenshot directly from play() (before that hook
    // runs) skips it, leaving the iframe at Vitest's default size instead
    // of the story viewport.
    await commands.__storycap_prepareViewport()

    // The rendered page's actual scroll height, not CONTENT_HEIGHT itself —
    // Storybook's own preview chrome adds margin/padding around the story
    // root, so the two aren't the same number. This is the same
    // `Math.max(body, documentElement)` calculation takeScreenshot() uses to
    // decide how many tiles to capture.
    const expectedHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
    )

    const base64 = await commands.__storycap_takeScreenshot(
      '__screenshots__/fixture-verify/taller-than-viewport.png',
      { fullPage: true },
    )

    const { height, transparentRows } = await decodeScreenshot(base64)

    await expect({ height, transparentRows }).toEqual({
      height: expectedHeight,
      transparentRows: [],
    })
  },
}
