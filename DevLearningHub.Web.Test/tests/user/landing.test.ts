import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import env from '../../config/env';

test.describe.serial('User > Landing', () => {
  let page: Page;

  test.afterAll(async () => {
    await page.close();
  });

  // Kiểm tra trang landing (chưa đăng nhập) hiển thị đúng banner chính
  test('renders the landing page', async ({ browser }) => {
    test.setTimeout(90000);
    page = await browser.newPage();
    await page.goto(env.USER_URL + '/landing');
    await expect(page.locator('.hero-main-title').first()).toBeVisible();
    await takeScreenshot(page, 'user', 'landing', 'loaded');
  });
});
