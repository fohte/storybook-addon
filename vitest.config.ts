import { join } from 'node:path'

import { configDefaults, defineConfig } from 'vitest/config'

// `#*.js` resolves through package.json's `imports` field to `./lib/*.js`
// (the build output), which doesn't exist before `pnpm build` runs. This
// config file is never published, so import the source directly instead.
// eslint-disable-next-line no-restricted-imports -- see comment above
import { createStorybookProject } from './src/vitest-plugin.ts'

const rootDir = import.meta.dirname

// Inline vitest projects don't inherit the root `resolve.alias` on the
// vitest@4.1.10 pinned here, unlike vitest 5's default — so every project
// that imports a `#*.js` path needs its own copy.
const resolve = {
  alias: [
    {
      find: /^#(.*)\.js$/,
      replacement: join(rootDir, 'src/$1.ts'),
    },
  ],
}

export default defineConfig({
  resolve,
  test: {
    projects: [
      {
        resolve,
        test: {
          name: 'unit',
          environment: 'jsdom',
          // lib/ holds compiled build output (including compiled
          // *.test.js), which duplicates every test run alongside its
          // src/ source when present.
          exclude: [...configDefaults.exclude, 'lib/**'],
        },
      },
      // Dogfoods createStorybookProject against a fixture story taller than
      // the viewport by a non-multiple amount, so a regression in the
      // fullPage tiling/clip path (see storycap-fullpage-stitch.ts) shows up
      // as a failing pixel assertion instead of only being caught by a
      // downstream consumer's own VRT run.
      createStorybookProject({
        name: 'storybook-fixture',
        rootDir,
        viewport: { width: 1280, height: 800 },
        screenshotsSubdir: 'fixture',
        setupFiles: ['./.storybook/vitest.setup.ts'],
      }),
    ],
  },
})
