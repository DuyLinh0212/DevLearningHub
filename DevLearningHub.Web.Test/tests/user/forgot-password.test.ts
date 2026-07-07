import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import env from '../../config/env';

test.describe.serial('User > Forgot Password', () => {
  let page: Page;

  test.afterAll(async () => {
    await page.close();
  });

  // Kiểm tra trang Quên mật khẩu hiển thị đúng tiêu đề, không submit form
  test('renders the forgot-password form', async ({ browser }) => {
    test.setTimeout(90000);
    page = await browser.newPage();
    await page.goto(env.USER_URL + '/forgot-password');
    await expect(page.locator("//h2[contains(text(),'Quên mật khẩu')]")).toBeVisible();
    await takeScreenshot(page, 'user', 'forgot-password', 'loaded');
  });
});
