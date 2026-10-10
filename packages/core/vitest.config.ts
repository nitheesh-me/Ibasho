import { defineConfig } from 'vitest/config';

// G0-4: line coverage of fixed/, exact/, plugin/ and hash must stay at or above 95%.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary', 'json-summary'],
      thresholds: {
        'src/fixed/**': { lines: 95 },
        'src/exact/**': { lines: 95 },
        'src/plugin/**': { lines: 95 },
        'src/hash.ts': { lines: 95 },
        'src/sha256.ts': { lines: 95 },
      },
    },
  },
});
