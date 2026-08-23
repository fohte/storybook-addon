import type { Meta, StoryObj } from '@storybook/html-vite'
import { expect } from 'storybook/test'

const meta = {
  title: 'Fixtures/Viewport',
  render: () => document.createElement('div'),
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

// @storybook/addon-vitest resets the story viewport to its own 1200x900
// default right before mount/play() unless parameters.viewport/globals.viewport
// are set (see vitest-viewport-setup.ts, which sets them). This checks that
// override stays in effect, catching a regression where play() silently runs
// at the wrong viewport again. The expected values match the
// storybook-fixture project's `viewport` option (vitest.config.ts).
export const MatchesConfiguredViewport: Story = {
  play: async () => {
    await expect({
      width: window.innerWidth,
      height: window.innerHeight,
    }).toEqual({
      width: 1280,
      height: 800,
    })
  },
}
