import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './DevLearningHub.Web.Test/tests',
  testMatch: '**/*.test.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  globalTimeout: 600000,
  reporter: 'list',
  use: {
    actionTimeout: 60000,
    viewport: { width: 1920, height: 1080 },
    launchOptions: {
      args: ['--start-maximized'],
    },
  },
});
