import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from './screenshot';
import { gotoRoute } from './navigate';
import { loginAsAdmin, loginAsUser } from './login';
import env from '../config/env';

const LOGIN_FNS: Record<string, (page: Page) => Promise<void>> = {
  admin: loginAsAdmin,
  user: loginAsUser,
};
const BASE_URLS: Record<string, string> = { admin: env.ADMIN_URL, user: env.USER_URL };

export type SmokeStep = {
  name?: string;
  route?: string;
  click?: string;
  assertBy: string;
  stepName?: string;
};

export function smokeTest({
  app,
  describeName,
  featureSlug,
  role = app,
  steps,
}: {
  app: string;
  describeName: string;
  featureSlug: string;
  role?: string;
  steps: SmokeStep[];
}) {
  test.describe.serial(describeName, () => {
    let page: Page;

    test.beforeAll(async ({ browser }) => {
      page = await browser.newPage();
      await LOGIN_FNS[role](page);
    });

    test.afterAll(async () => {
      await page.close();
    });

    steps.forEach((step, idx) => {
      test(step.name || `loads (${idx + 1}/${steps.length})`, async () => {
        test.setTimeout(90000);
        if (step.route) {
          await gotoRoute(page, BASE_URLS[app], step.route);
        }
        if (step.click) {
          await page.locator(step.click).click();
          await page.waitForTimeout(500);
        }
        await expect(page.locator(step.assertBy).first()).toBeVisible();
        await takeScreenshot(page, app, featureSlug, step.stepName || 'loaded');
      });
    });
  });
}
