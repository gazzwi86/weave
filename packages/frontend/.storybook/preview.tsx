import type { Preview } from '@storybook/nextjs-vite'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // options: show violations in the UI only, fail CI on violations, or skip checks entirely
      test: 'error'
    }
  },
};

export default preview;