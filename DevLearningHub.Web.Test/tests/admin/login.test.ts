import { test } from '@playwright/test';
import { Page } from '@playwright/test';
import { waitForUrlDoesNotContain } from '../../support/wait';
import { takeScreenshot } from '../../support/screenshot';
import env from '../../config/env';

test.describe.serial('Admin > Login', () => {
  let page: Page;

  test.afterAll(async () => {
    await page.close();
  });

  // Đăng nhập admin bằng form, kiểm tra chuyển hướng ra khỏi trang /login
  test('logs in and redirects away from /login', async ({ browser }) => {
    test.setTimeout(90000);
    page = await browser.newPage();
    await page.goto(env.ADMIN_URL + '/login');
    await page.locator('input[name="usernameOrEmail"]').fill(env.ADMIN_USERNAME || '');
    await page.locator('input[name="password"]').fill(env.ADMIN_PASSWORD || '');
    await page.locator('button.btn-submit').click();
    await waitForUrlDoesNotContain(page, '/login', 15000);
    await takeScreenshot(page, 'admin', 'login', 'loaded');
  });
});
