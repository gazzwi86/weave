import type { Preview } from '@storybook/nextjs-vite'

// Design tokens + Tailwind pipeline — without this every story renders unstyled.
import '../app/globals.css'

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