import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import { gotoRoute, clickFirstListItemAndCapture } from '../../support/navigate';
import { loginAsAdmin } from '../../support/login';
import env from '../../config/env';

test.describe.serial('Admin > Post Detail', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // Mở trang chi tiết bài viết đầu tiên trong danh sách quản lý bài viết
  test('opens the first post from the list and loads its detail page', async () => {
    test.setTimeout(90000);
    await gotoRoute(page, env.ADMIN_URL, '/admin/posts');
    await expect(page.locator('.post-card-title, .post-management').first()).toBeVisible();
    await clickFirstListItemAndCapture(page, '.post-card-title');
    await expect(page.locator('.lc-post-title, header.content-header').first()).toBeVisible();
    await takeScreenshot(page, 'admin', 'post-detail', 'loaded');
  });
});
