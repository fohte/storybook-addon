import { join } from 'node:path'

import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^#(.*)\.js$/,
        replacement: join(import.meta.dirname, 'src/$1.ts'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    // lib/ holds compiled build output (including compiled *.test.js), which
    // duplicates every test run alongside its src/ source when present.
    exclude: [...configDefaults.exclude, 'lib/**'],
  },
})
