import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import { gotoRoute, clickFirstListItemAndCapture } from '../../support/navigate';
import { loginAsAdmin } from '../../support/login';
import env from '../../config/env';

test.describe.serial('Admin > User Profile', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // Mở trang hồ sơ của người dùng đầu tiên trong danh sách quản lý user
  test('opens a user from the roles/users tab and loads their profile', async () => {
    test.setTimeout(90000);
    await gotoRoute(page, env.ADMIN_URL, '/admin/roles?tab=users');
    await expect(page.locator('header.content-header').first()).toBeVisible();
    const rowLink = 'button.btn-view-profile';
    await clickFirstListItemAndCapture(page, rowLink);
    await expect(page.locator('.profile-name, header.content-header').first()).toBeVisible();
    await takeScreenshot(page, 'admin', 'user-profile', 'loaded');
  });
});
