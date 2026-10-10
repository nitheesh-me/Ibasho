import { defineConfig } from 'vitest/config';

// Node by default; component tests opt into happy-dom with a `@vitest-environment` docblock.
export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
