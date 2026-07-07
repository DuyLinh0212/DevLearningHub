import { test } from '@playwright/test';
import { Page } from '@playwright/test';
import { waitForUrlDoesNotContain } from '../../support/wait';
import { takeScreenshot } from '../../support/screenshot';
import env from '../../config/env';

test.describe.serial('User > Login', () => {
  let page: Page;

  test.afterAll(async () => {
    await page.close();
  });

  // Đăng nhập user bằng form, kiểm tra chuyển hướng ra khỏi trang /login
  test('logs in and redirects away from /login', async ({ browser }) => {
    test.setTimeout(90000);
    page = await browser.newPage();
    await page.goto(env.USER_URL + '/login');
    await page.locator('input[name="usernameOrEmail"]').fill(env.USER_USERNAME || '');
    await page.locator('input[name="password"]').fill(env.USER_PASSWORD || '');
    await page.locator('button.btn-submit').click();
    await waitForUrlDoesNotContain(page, '/login', 15000);
    await takeScreenshot(page, 'user', 'login', 'loaded');
  });
});
