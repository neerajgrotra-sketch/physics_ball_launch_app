import { defineConfig } from 'vitest/config';

// Vitest covers the pure TypeScript modules only (physics, tools, game). The Expo app is not tested here.
export default defineConfig({
  test: {
    include: ['physics/**/*.test.ts', 'tools/**/*.test.ts', 'game/**/*.test.ts'],
  },
});
