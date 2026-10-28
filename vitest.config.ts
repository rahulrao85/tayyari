import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'server/**/*.ts'],
      exclude: ['src/main.tsx', 'server/main.ts', 'src/vite-env.d.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: { lines: 99, statements: 98, functions: 98, branches: 92 },
    },
  },
});
