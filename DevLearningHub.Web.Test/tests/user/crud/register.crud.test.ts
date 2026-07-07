import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../../support/screenshot';
import { waitForUrlContains } from '../../../support/wait';
import env from '../../../config/env';
import * as e2eUser from '../../../config/e2eUser';

test.describe.serial('User > CRUD > Register (creates reusable e2e account)', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // Đăng ký tài khoản e2e mới (bootstrap), lưu lại để các test khác tái sử dụng
  test('registers a new account if no e2e user exists yet', async () => {
    test.setTimeout(90000);

    test.skip(e2eUser.hasE2eUser(), 'e2e user already exists');

    const user = e2eUser.generateE2eUser(Date.now());

    await page.goto(env.USER_URL + '/register');
    await page.locator('input[name="fullName"]').waitFor();
    await page.locator('input[name="fullName"]').fill('E2E QA Tester');
    await page.locator('input[name="username"]').fill(user.username);
    await page.locator('input[name="email"]').fill(user.email);
    await page.locator('input[name="password"]').fill(user.password);
    await page.locator('input[name="confirmPassword"]').fill(user.password);
    await takeScreenshot(page, 'user', 'register-crud', 'before-submit');

    const dialogPromise = page.waitForEvent('dialog', { timeout: 10000 });
    await page.locator('button.btn-submit').click();
    const dialog = await dialogPromise;
    await dialog.accept();

    await waitForUrlContains(page, '/login', 15000);
    await takeScreenshot(page, 'user', 'register-crud', 'after-redirect-to-login');

    e2eUser.persistE2eUser(user);
  });
});
