import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import { gotoRoute, clickFirstListItemAndCapture } from '../../support/navigate';
import { loginAsAdmin } from '../../support/login';
import env from '../../config/env';

test.describe.serial('Admin > Test Case Management', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // Mở trang quản lý test case của bài toán đầu tiên trong danh sách
  test('opens the first problem and loads its test-case management page', async () => {
    test.setTimeout(90000);
    await gotoRoute(page, env.ADMIN_URL, '/admin/problems');
    await expect(page.locator('header.content-header')).toBeVisible();
    await clickFirstListItemAndCapture(page, '.admin-management-table a.btn-tbl-icon-view');
    await expect(page.locator('header.content-header')).toBeVisible();
    await takeScreenshot(page, 'admin', 'testcase-management', 'loaded');
  });
});
