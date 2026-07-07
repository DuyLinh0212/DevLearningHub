import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import { gotoRoute, clickFirstListItemAndCapture } from '../../support/navigate';
import { loginAsUser } from '../../support/login';
import env from '../../config/env';

test.describe.serial('User > Public User Profile', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsUser(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // Mở trang hồ sơ công khai của tác giả bài viết đầu tiên
  test('opens a post author profile from the forum', async () => {
    test.setTimeout(90000);
    await gotoRoute(page, env.USER_URL, '/forum');
    await expect(page.locator('header.content-header')).toBeVisible();
    await clickFirstListItemAndCapture(page, '.author-name');
    await expect(page.locator('header.content-header')).toBeVisible();
    await takeScreenshot(page, 'user', 'user-profile-public', 'loaded');
  });
});
