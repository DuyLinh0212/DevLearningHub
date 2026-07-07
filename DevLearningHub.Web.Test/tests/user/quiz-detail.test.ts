import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import { gotoRoute, clickFirstListItemAndCapture } from '../../support/navigate';
import { loginAsUser } from '../../support/login';
import env from '../../config/env';

test.describe.serial('User > Quiz Detail', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsUser(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // Mở trang chi tiết của quiz đầu tiên trong ngân hàng quiz
  test('opens a published quiz from the quiz bank and loads its detail page', async () => {
    test.setTimeout(90000);
    await gotoRoute(page, env.USER_URL, '/quiz-bank');
    await expect(page.locator('header.content-header')).toBeVisible();
    await clickFirstListItemAndCapture(page, 'a.btn-solve-primary');
    await expect(page.locator('header.content-header')).toBeVisible();
    await takeScreenshot(page, 'user', 'quiz-detail', 'loaded');
  });
});
