import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import { gotoRoute, clickFirstListItemAndCapture } from '../../support/navigate';
import { loginAsUser } from '../../support/login';
import env from '../../config/env';

test.describe.serial('User > Forum Post Detail', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsUser(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // Mở trang chi tiết bài viết đầu tiên trong diễn đàn
  test('opens the first post from the forum and loads its detail page', async () => {
    test.setTimeout(90000);
    await gotoRoute(page, env.USER_URL, '/forum');
    await expect(page.locator('header.content-header')).toBeVisible();
    await clickFirstListItemAndCapture(page, '.social-post-card');
    await expect(page.locator('header.content-header')).toBeVisible();
    await takeScreenshot(page, 'user', 'forum-post-detail', 'loaded');
  });
});
