import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import env from '../../config/env';

test.describe.serial('User > Register', () => {
  let page: Page;

  test.afterAll(async () => {
    await page.close();
  });

  // Kiểm tra trang Đăng ký hiển thị đúng tiêu đề, cố tình không submit để tránh tạo tài khoản rác
  test('renders the registration form (not submitted, to avoid creating junk accounts)', async ({ browser }) => {
    test.setTimeout(90000);
    page = await browser.newPage();
    await page.goto(env.USER_URL + '/register');
    await expect(page.locator("//h2[contains(text(),'Tạo tài khoản')]")).toBeVisible();
    await takeScreenshot(page, 'user', 'register', 'loaded');
  });
});
