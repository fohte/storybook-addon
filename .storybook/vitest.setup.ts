import { screenshot } from '@storycap-testrun/browser'
import { afterEach } from 'vitest'
import { page } from 'vitest/browser'

afterEach(async (context) => {
  // @storycap-testrun/browser ships a bundled .d.mts with its own copy of
  // vitest's `TestContext` type, structurally identical to ours but
  // nominally unrelated under `exactOptionalPropertyTypes` — same interop
  // issue vitest-plugin.ts's `asPlugin` works around for the `Plugin` type.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see comment above
  await screenshot(page, context as Parameters<typeof screenshot>[1])
})
