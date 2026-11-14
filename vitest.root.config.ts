import { join } from 'node:path'

import { defineConfig } from 'vitest/config'

// The root-level browser config exercises addon-vitest's root permission path.
// eslint-disable-next-line no-restricted-imports -- use source directly so config works before the build output exists
import { createStorybookProject } from './src/vitest-plugin.ts'

const rootDir = import.meta.dirname
const resolve = {
  alias: [
    {
      find: /^#(.*)\.js$/,
      replacement: join(rootDir, 'src/$1.ts'),
    },
  ],
}

const storybookProject = createStorybookProject({
  name: 'storybook-root-config',
  rootDir,
  viewport: { width: 1280, height: 800 },
  screenshotsSubdir: 'root-config',
  setupFiles: ['./.storybook/vitest.setup.ts'],
})

export default defineConfig({
  ...storybookProject,
  resolve,
})
