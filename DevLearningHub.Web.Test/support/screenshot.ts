import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const RENDER_SETTLE_MS = 1500;

export async function takeScreenshot(page: Page, appName: string, featureSlug: string, stepName = 'loaded') {
  const dir = path.join(__dirname, '..', 'screenshots', appName, featureSlug);
  fs.mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(RENDER_SETTLE_MS);
  await page.screenshot({ path: path.join(dir, `${stepName}.png`) });
}
