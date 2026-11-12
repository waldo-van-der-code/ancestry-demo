import { defineConfig, devices } from '@playwright/test';
import { demoBase } from './scripts/demo-base.mjs';
const port = Number(process.env.DEMO_PORT || 4510);
const base = demoBase(process.env.DEMO_BASE);
export default defineConfig({
  testDir: './evals/browser',
  testMatch: 'demo.spec.ts',
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'node scripts/serve-demo.mjs', url: `http://127.0.0.1:${port}${base}/en/`, reuseExistingServer: false },
});
