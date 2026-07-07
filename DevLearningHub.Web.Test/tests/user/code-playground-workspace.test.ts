import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import { gotoRoute, clickFirstListItemAndCapture } from '../../support/navigate';
import { loginAsUser } from '../../support/login';
import env from '../../config/env';

test.describe.serial('User > Code Playground Workspace', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsUser(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // Mở workspace của bài toán đầu tiên trong tab thứ 2
  test('opens the first coding problem and loads the workspace', async () => {
    test.setTimeout(90000);
    await gotoRoute(page, env.USER_URL, '/code');
    const tabs = page.locator('.cp-tab');
    await tabs.nth(1).click();
    await page.waitForTimeout(500);
    await clickFirstListItemAndCapture(page, 'a.problem-title-link');
    await expect(page.locator('.workspace-layout').first()).toBeVisible();
    await takeScreenshot(page, 'user', 'code-playground-workspace', 'loaded');
  });
});
