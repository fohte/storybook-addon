import { setProjectAnnotations } from 'storybook/preview-api'
import { getProjectAnnotations } from 'virtual:/@storybook/builder-vite/project-annotations.js'
import { beforeEach, inject } from 'vitest'

declare module 'vitest' {
  interface ProvidedContext {
    fohteStorybookAddonViewport: { width: number; height: number }
  }
}

const VIEWPORT_NAME = '__fohteStorybookAddonViewport'

const { width, height } = inject('fohteStorybookAddonViewport')

// setProjectAnnotations() replaces the project annotations wholesale rather
// than merging into them, so composing in the consumer's own
// getProjectAnnotations() first is required — passing only the viewport
// override below would drop the consumer's own preview.ts
// renderer/decorators/loaders. Both are static per test file (the consumer's
// preview.ts and this project's `viewport` don't change mid-run), so this is
// computed once at setup-file top level rather than inside beforeEach below.
const projectAnnotations = getProjectAnnotations()
const viewportOverride = {
  parameters: {
    viewport: {
      defaultViewport: VIEWPORT_NAME,
      viewports: {
        [VIEWPORT_NAME]: {
          name: 'createStorybookProject viewport',
          styles: {
            width: `${String(width)}px`,
            height: `${String(height)}px`,
          },
        },
      },
    },
  },
  initialGlobals: { viewport: { value: VIEWPORT_NAME } },
}

// @storybook/addon-vitest's own testStory() calls setViewport() right before
// mount/play(), falling back to its built-in 1200x900 default whenever
// parameters.viewport/globals.viewport aren't set — silently overriding the
// `viewport` createStorybookProject() was given for the screenshot capture
// itself. setProjectAnnotations() is the public integration point Storybook
// added for exactly this in 10.3.
//
// The call itself runs in beforeEach, not at setup-file top level:
// @storybook/addon-vitest always injects its own
// internal/setup-file-with-project-annotations alongside consumer
// setupFiles — its "already provisioned" detection only looks inside the
// consumer's `.storybook` dir, which this file isn't in. That file's
// top-level setProjectAnnotations(getProjectAnnotations()) call would run
// after this file's own top level and silently wipe this override.
// beforeEach always runs after every setupFile finishes loading, so calling
// setProjectAnnotations() here instead wins regardless of setupFiles order.
beforeEach(() => {
  setProjectAnnotations([projectAnnotations, viewportOverride])
})
