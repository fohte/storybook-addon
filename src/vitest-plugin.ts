import path from 'node:path'

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import storycap from '@storycap-testrun/browser/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'

// @storycap-testrun/browser ships a bundled .d.ts with its own copy of vite's
// `Plugin` type, so it's structurally identical but nominally unrelated to
// ours — cast to sidestep the resulting "unrelated types" error. Typing this
// as `Plugin` (instead of `any`) reintroduces a cascading "exactOptionalPropertyTypes"
// mismatch between vite's own `Plugin` and rollup's, so this stays `any` and
// the unsafe-assignment at each call site is suppressed individually instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
function asPlugin(plugin: unknown): any {
  return plugin
}

// `playwright()` returns vitest's own `BrowserProviderOption<PlaywrightProviderOptions>`
// (this is the exact usage vitest's own JSDoc on `browser.provider` recommends), but that
// interface is self-referential (providerFactory -> TestProject -> ProjectConfig ->
// browser.provider -> BrowserProviderOption again). Under `exactOptionalPropertyTypes: true`,
// TypeScript's structural comparison of that recursive generic against the target's
// `BrowserProviderOption<object>` bails out with a spurious "two different types with this
// name exist, but they are unrelated" — cast to sidestep it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
function asProvider(provider: unknown): any {
  return provider
}

// @storycap-testrun/browser waits for 500ms of network silence before every
// capture and exposes no option to shorten it, so every story pays that flat
// half second per viewport. Only the floor moves: the window still restarts on
// each resource load, and `document.fonts.ready` plus the metrics-stability
// poll that follow it are untouched.
const NETWORK_IDLE_MS = 100

// The module arrives here either as the shipped `dist/index.mjs` or as an
// esbuild pre-bundle, which reformats the minified source but keeps the literal.
const NETWORK_IDLE_DEFAULT = /=\s*500\s*\)\s*=>\s*new Promise\(/

// A Vite plugin that patches @storycap-testrun/browser's own minified
// source. If a version bump moves the 500ms literal (or removes it), this
// throws at config-load time instead of silently leaving the 500ms wait in
// place — the alternative (staying quiet) would just make every capture
// slower with no visible symptom.
export const storycapNetworkIdle = {
  name: 'storycap-network-idle',
  transform(code: string, id: string) {
    if (
      !id.includes('@storycap-testrun') ||
      !code.includes('PerformanceObserver')
    ) {
      return null
    }

    const patched = code.replace(NETWORK_IDLE_DEFAULT, (match) =>
      match.replace('500', String(NETWORK_IDLE_MS)),
    )
    if (patched === code) {
      // This throw fails config loading itself, before any test runs.
      // eslint-disable-next-line no-restricted-syntax -- Vite plugin transform hook contract: throwing is how a plugin aborts config loading
      throw new Error(
        `storycap-network-idle: no 500ms network-idle default found in ${id}. Drop this plugin if @storycap-testrun made the wait configurable, otherwise re-derive the pattern.`,
      )
    }

    return patched
  },
}

export interface CreateStorybookProjectOptions {
  /** Project name, as shown by `vitest --project <name>`. */
  name: string
  /**
   * Absolute path to the app root that the default `.storybook` config dir
   * and the screenshot output dir are resolved against — typically
   * `path.dirname(fileURLToPath(import.meta.url))` from the consumer's own
   * vitest.config.ts.
   */
  rootDir: string
  viewport: { width: number; height: number }
  /**
   * Screenshots for this project are written to
   * `<rootDir>/__screenshots__/<screenshotsSubdir>`. The shared VRT workflow's
   * reg-suit step reads from this path, so treat it as a cross-repo contract
   * rather than an implementation detail.
   */
  screenshotsSubdir: string
  setupFiles: string[]
  excludeTags?: string[]
  /**
   * `test.maxWorkers`, applied only when `process.env.CI` is set — Vitest
   * reads `maxWorkers` per-project rather than falling back to the root
   * config. Screenshot capture is I/O-bound (network-idle wait, font
   * loading, CDP metric polling), so this can exceed the CI runner's vCPU
   * count, but the right number depends on the runner in use — tune it per
   * consumer rather than trusting this default.
   */
  ciMaxWorkers?: number
}

export function createStorybookProject({
  name,
  rootDir,
  viewport,
  screenshotsSubdir,
  setupFiles,
  excludeTags = [],
  ciMaxWorkers = 8,
}: CreateStorybookProjectOptions) {
  const configDir = path.join(rootDir, '.storybook')
  const screenshotsDir = path.join(
    rootDir,
    '__screenshots__',
    screenshotsSubdir,
  )
  const maxWorkers = process.env['CI'] != null ? ciMaxWorkers : undefined

  return {
    plugins: [
      storycapNetworkIdle,
      storybookTest({
        configDir,
        tags: { exclude: excludeTags },
      }),
      asPlugin(
        storycap({
          viewport,
          output: { dir: screenshotsDir },
        }),
      ),
    ],
    test: {
      name,
      ...(maxWorkers !== undefined && { maxWorkers }),
      browser: {
        enabled: true,
        // Pin the browser's timezone so time-dependent stories (calendar
        // "now" indicators, relative timestamps) render identically
        // regardless of the host machine's local timezone.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- asProvider casts through `any`, see comment above its definition
        provider: asProvider(
          playwright({ contextOptions: { timezoneId: 'Asia/Tokyo' } }),
        ),
        headless: true,
        instances: [{ browser: 'chromium' as const }],
      },
      setupFiles,
    },
  }
}
