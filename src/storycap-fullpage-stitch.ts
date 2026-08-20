import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { BrowserCommand, BrowserCommandContext } from 'vitest/node'

type Viewport = { width: number; height: number }
type Page = BrowserCommandContext['page']
type ScreenshotOptions = NonNullable<Parameters<Page['screenshot']>[0]>

interface TakeScreenshotOptions {
  fullPage?: boolean
  omitBackground?: ScreenshotOptions['omitBackground']
  scale?: ScreenshotOptions['scale']
  type?: ScreenshotOptions['type']
}

const IFRAME_SELECTOR = 'iframe[data-vitest]'

// @storycap-testrun/browser's own fullPage tiling (packages/browser/src/vitest-plugin/index.ts,
// `captureFullPage`) always clips each tile starting at the iframe's bounding-box
// top, on the assumption that `scrollTo(0, requestedScrollY)` always lands
// exactly at `requestedScrollY`. The browser clamps the scroll position once
// it exceeds `scrollHeight - viewportHeight`, so whenever the page height
// isn't an exact multiple of the viewport height, the last tile re-captures
// already-seen content instead of the page's true bottom, which is never
// captured. Comparing the requested position against what the browser
// actually applied gives the pixel offset the clip rect needs to shift down
// by to land on unseen content.
export function computeChunkClip(
  requestedScrollY: number,
  actualScrollY: number,
  viewportHeight: number,
  scrollHeight: number,
): { clipYOffset: number; chunkHeight: number } {
  const clipYOffset = requestedScrollY - actualScrollY
  const chunkHeight = Math.min(
    viewportHeight - clipYOffset,
    scrollHeight - requestedScrollY,
  )
  return { clipYOffset, chunkHeight }
}

async function scrollIframeTo(
  ctx: BrowserCommandContext,
  top: number,
): Promise<number> {
  // `{ behavior: 'instant' }` overrides any `scroll-behavior: smooth` set by
  // the story's own CSS. Without it, a smooth-scrolling story would still be
  // mid-animation when the position is read back below, making the reported
  // scroll position (and therefore the capture) non-deterministic.
  return ctx.iframe.locator('body').evaluate((body, scrollTop) => {
    const view = body.ownerDocument.defaultView
    view?.scrollTo({ top: scrollTop, left: 0, behavior: 'instant' })
    return view?.scrollY ?? 0
  }, top)
}

async function getIframeBoundingBox(
  ctx: BrowserCommandContext,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await ctx.page.locator(IFRAME_SELECTOR).boundingBox()
  if (box) return box
  // eslint-disable-next-line no-restricted-syntax -- interop boundary: BrowserCommand contract signals failure by rejecting
  throw new Error('Could not determine iframe position for screenshot')
}

function screenshotOptionsFrom(options: TakeScreenshotOptions) {
  return {
    animations: 'disabled',
    caret: 'hide',
    // Playwright's own default ('device') scales the returned buffer by
    // deviceScaleFactor, but captureFullPage's canvas below is sized in CSS
    // pixels — pin 'css' so a chunk's pixel dimensions always match the
    // canvas region it gets drawn into.
    scale: options.scale ?? 'css',
    ...(options.omitBackground != null && {
      omitBackground: options.omitBackground,
    }),
    ...(options.type != null && { type: options.type }),
  } as const
}

async function captureTiles(
  ctx: BrowserCommandContext,
  viewport: Viewport,
  scrollHeight: number,
  options: TakeScreenshotOptions,
): Promise<Buffer> {
  // The iframe element's position on the outer page doesn't move when its
  // own inner content scrolls, so this only needs to be read once per
  // capture instead of once per tile.
  const iframeBox = await getIframeBoundingBox(ctx)

  const images: string[] = []
  const heights: number[] = []

  for (
    let requestedScrollY = 0;
    requestedScrollY < scrollHeight;
    requestedScrollY += viewport.height
  ) {
    const actualScrollY = await scrollIframeTo(ctx, requestedScrollY)
    const { clipYOffset, chunkHeight } = computeChunkClip(
      requestedScrollY,
      actualScrollY,
      viewport.height,
      scrollHeight,
    )

    const chunkBuffer = await ctx.page.screenshot({
      clip: {
        x: iframeBox.x,
        y: iframeBox.y + clipYOffset,
        width: iframeBox.width,
        height: chunkHeight,
      },
      ...screenshotOptionsFrom(options),
    })

    images.push(Buffer.from(chunkBuffer).toString('base64'))
    heights.push(chunkHeight)
  }

  const mimeType = options.type === 'jpeg' ? 'image/jpeg' : 'image/png'
  const stitchedBase64 = await ctx.page.evaluate(
    async ({
      images: chunkImages,
      width,
      heights: chunkHeights,
      mimeType: mime,
    }) => {
      const totalHeight = chunkHeights.reduce((sum, h) => sum + h, 0)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = totalHeight
      const canvasContext = canvas.getContext('2d')
      let y = 0
      for (let i = 0; i < chunkImages.length; i++) {
        const img = new Image()
        img.src = `data:${mime};base64,${chunkImages[i] ?? ''}`
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            resolve()
          }
          img.onerror = () => {
            reject(
              new Error(`failed to decode screenshot chunk ${i.toString()}`),
            )
          }
        })
        canvasContext?.drawImage(img, 0, y)
        y += chunkHeights[i] ?? 0
      }
      return canvas.toDataURL(mime).split(',')[1] ?? ''
    },
    { images, width: viewport.width, heights, mimeType },
  )

  return Buffer.from(stitchedBase64, 'base64')
}

// Vitest's browser mode reuses one iframe per test file, so a scroll
// position left behind by a failed capture would bleed into whichever
// story runs next in the same file — reset it whether captureTiles()
// succeeds or rejects.
function captureFullPage(
  ctx: BrowserCommandContext,
  viewport: Viewport,
  scrollHeight: number,
  options: TakeScreenshotOptions,
): Promise<Buffer> {
  return captureTiles(ctx, viewport, scrollHeight, options).finally(() =>
    scrollIframeTo(ctx, 0),
  )
}

function takeScreenshot(
  configuredViewport?: Viewport,
): BrowserCommand<[string, TakeScreenshotOptions], string> {
  return async (ctx, filepath, options) => {
    const viewport = configuredViewport ??
      ctx.page.viewportSize() ?? { width: 1280, height: 720 }

    let buffer: Buffer
    if (options.fullPage === false) {
      await ctx.page.evaluate(() => {
        window.scrollTo(0, 0)
      })
      const iframeBox = await getIframeBoundingBox(ctx)
      buffer = Buffer.from(
        await ctx.page.screenshot({
          clip: iframeBox,
          ...screenshotOptionsFrom(options),
        }),
      )
    } else {
      const scrollHeight = await ctx.iframe
        .locator('body')
        .evaluate((body) =>
          Math.max(
            body.scrollHeight,
            body.ownerDocument.documentElement.scrollHeight,
          ),
        )
      buffer =
        scrollHeight > viewport.height
          ? await captureFullPage(ctx, viewport, scrollHeight, options)
          : await ctx.iframe
              .locator('body')
              .screenshot(screenshotOptionsFrom(options))
    }

    await fs.mkdir(path.dirname(filepath), { recursive: true })
    await fs.writeFile(filepath, buffer)
    return Buffer.from(buffer).toString('base64')
  }
}

// Replaces @storycap-testrun/browser's `__storycap_takeScreenshot` command
// (registered by the `storycap` plugin passed to `createStorybookProject`,
// via the same `config()` → `test.browser.commands` shape used below) with
// a from-scratch reimplementation that fixes the fullPage tiling bug
// described above. Vite merges plugin `config()`
// hooks in plugin order, with later plugins overriding matching keys — so
// this must be placed after the `storycap` plugin in `createStorybookProject`'s
// `plugins` array for the override to take effect. `resolveScreenshotFilepath`,
// `__storycap_prepareViewport` and `__storycap_restoreViewport` are untouched,
// since this only supplies the `__storycap_takeScreenshot` key.
//
// No upstream issue tracks this bug. Drop this plugin (and its wiring in
// vitest-plugin.ts) once @storycap-testrun/browser's own `captureFullPage`
// (packages/browser/src/vitest-plugin/index.ts) accounts for `scrollTo`
// clamping the requested position instead of assuming it always lands
// exactly where requested.
export function storycapFullPageStitch(options: { viewport?: Viewport } = {}) {
  return {
    name: 'storycap-fullpage-stitch-fix',
    config() {
      return {
        test: {
          browser: {
            commands: {
              __storycap_takeScreenshot: takeScreenshot(options.viewport),
            },
          },
        },
      }
    },
  }
}
