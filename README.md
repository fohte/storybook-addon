# @fohte/storybook-addon

@fohte's personal Storybook addons.

Runs three checks right after each story renders, and fails the story's test when one trips:

- **overflow-check** — flags elements whose content is clipped by their container (scrollWidth > clientWidth), which usually means a silent layout bug.
- **external-resource-check** — flags stories that load a non-same-origin resource (font, image, stylesheet), which makes VRT captures non-deterministic.
- **unhandled-api-request-check** — flags stories that hit an API endpoint with no MSW handler, which would otherwise render with MSW's error response instead of failing.

It also injects CSS that hides the text-input caret and collapses all animations/transitions to their end state, keeping screenshots deterministic.

## Install

```bash
pnpm add -D @fohte/storybook-addon

# Peer dependencies
pnpm add -D storybook vitest

# Peer dependencies for ./vitest-plugin only
pnpm add -D @storybook/addon-vitest @storycap-testrun/browser @vitest/browser-playwright
```

`@vitest/browser-playwright` pins its own `vitest` peer to its exact version (e.g. `4.1.10` requires `vitest@4.1.10` precisely), even though this package's own `peerDependencies` range for both is the looser `^4.0.0`. Keep the two installed at the same version.

## Usage

Add the addon to `.storybook/main.ts`:

```ts
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  addons: ['@fohte/storybook-addon'],
}

export default config
```

This wires up `overflow-check` and `external-resource-check` — no further setup needed.

### overflow-check

To exempt a selector across every story (e.g. a component whose oversized hit target never visibly clips anything), set `parameters.overflowCheck.globalIgnoreSelectors` once in `.storybook/preview.ts`. It's additive with a story's own `parameters.overflowCheck.ignoreSelectors` — both apply, since they're separate keys and Storybook deep-merges parameter objects by key (only arrays at the same key replace wholesale, so a story-level `ignoreSelectors` can't drop the global list):

```ts
import type { Parameters } from 'storybook/internal/types'

export const parameters: Parameters = {
  overflowCheck: { globalIgnoreSelectors: ['[data-slot="checkbox"]'] },
}
```

### unhandled-api-request-check

This check needs to know which paths count as "API requests" (that's app-specific), and needs to be fed unhandled requests from your MSW setup. Configure it once and call `reportUnhandledApiRequest()` from `onUnhandledRequest` in `.storybook/preview.ts`:

```ts
import {
  configureUnhandledApiRequestCheck,
  reportUnhandledApiRequest,
} from '@fohte/storybook-addon/preview'
import { initialize } from 'msw-storybook-addon'

configureUnhandledApiRequestCheck({ pathPrefixes: ['/api/'] })

initialize({
  onUnhandledRequest: ({ url }, print) => {
    if (reportUnhandledApiRequest(url)) {
      print.error()
    }
  },
})
```

## Vitest plugin (`./vitest-plugin`)

Builds a Vitest browser-mode project that runs Storybook stories through [`@storybook/addon-vitest`](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon) and captures a screenshot of each with [`@storycap-testrun/browser`](https://github.com/reg-viz/storycap-testrun), patched to shorten storycap's hardcoded 500ms network-idle wait to 100ms and to fix a tiling bug in its fullPage capture (`clip` staying anchored to the top of the viewport instead of following the browser's clamped scroll position, which duplicated content and cut off the bottom of any story taller than the viewport).

`viewport` applies for the whole test, not just the screenshot: mount and `play()` render at it too. `@storybook/addon-vitest` would otherwise silently mount/run every story at its own fixed 1200x900 default instead.

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createStorybookProject } from '@fohte/storybook-addon/vitest-plugin'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    projects: [
      createStorybookProject({
        name: 'storybook',
        rootDir,
        viewport: { width: 1280, height: 800 },
        screenshotsSubdir: 'desktop',
        setupFiles: ['./.storybook/vitest.setup.ts'],
      }),
    ],
  },
})
```

Screenshots for a project land in `<rootDir>/__screenshots__/<screenshotsSubdir>` — downstream tooling that consumes these images depends on this exact path, so treat it as a stable contract rather than an implementation detail.

`storycapNetworkIdle` and `storycapFullPageStitch` are also exported on their own, for building a project without `createStorybookProject`. `storycapFullPageStitch` must be placed after storycap's own plugin in the `plugins` array — it works by overriding the `__storycap_takeScreenshot` command storycap registers, and Vite resolves conflicting plugin `config()` keys in plugin order, later wins.

Your `setupFiles` entry needs an `afterEach` that calls storycap's own `screenshot()` — see [`@storycap-testrun/browser`'s "Setup Screenshot Capture"](https://github.com/reg-viz/storycap-testrun/tree/main/packages/browser#2-setup-screenshot-capture) for the exact shape. Don't call `setProjectAnnotations()` there, and don't even mention that identifier in a comment: `@storybook/addon-vitest` decides whether to inject this package's checks by a plain substring search over the setup file's source text, so its mere presence silently disables every check in the project, with no error.

### Check failures don't block the screenshot

This package's checks run inside `@storybook/addon-vitest`'s own render phase, as part of the generated test body — before your `setupFiles`' `afterEach` (the one that calls `screenshot()`) ever runs. A failing check throws there, but Vitest still runs every registered `afterEach` after a test regardless of pass or fail, so the screenshot capture always follows, against whatever the DOM looked like when the check failed. Verified against a story with a deliberate overflow: the check failed, and `screenshot()` still produced a non-blank image showing the actual overflowing content.

## Addon `afterEach` ordering

Storybook runs multiple addons' `afterEach` hooks serially, in the **reverse** of the order they're listed in `main.ts`'s `addons` array — the addon listed last runs its `afterEach` first. The consuming app's own `preview.ts`/`preview.tsx` `afterEach` runs before every addon's `afterEach`. If one hook throws, the remaining ones are skipped (fail-fast).

This doesn't apply to `./vitest-plugin`'s screenshot capture: it isn't a Storybook addon, so it never sits in the `addons` array at all — see "Check failures don't block the screenshot" above for how that ordering actually works.

## Development

### Setup

```bash
pnpm install
pnpm test
```

### Scripts

- `pnpm test` - Run type checking and unit tests
- `pnpm test:type` - Type-check without emitting
- `pnpm test:unit` - Run unit tests (vitest)
- `pnpm build` - Compile TypeScript to `lib/`
- `pnpm lint` - Run ESLint

### Release process

This project uses [release-please](https://github.com/googleapis/release-please). Merging a PR whose title follows [Conventional Commits](https://www.conventionalcommits.org/) (`fix:`, `feat:`, `feat!:`/`fix!:` for breaking changes) into `main` updates a Release PR; merging that Release PR tags a GitHub release and publishes to npm.
