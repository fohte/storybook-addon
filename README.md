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
```

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

## Addon `afterEach` ordering

Storybook runs multiple addons' `afterEach` hooks serially, in the **reverse** of the order they're listed in `main.ts`'s `addons` array — the addon listed last runs its `afterEach` first. The consuming app's own `preview.ts`/`preview.tsx` `afterEach` runs before every addon's `afterEach`. If one hook throws, the remaining ones are skipped (fail-fast).

This matters once a screenshot-capturing addon is added: to keep "capture first, then let this package's checks fail the test" working, list that addon **after** `@fohte/storybook-addon` in the `addons` array.

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
