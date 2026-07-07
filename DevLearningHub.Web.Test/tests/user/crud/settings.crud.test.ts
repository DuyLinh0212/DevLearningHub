import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../../support/screenshot';
import { loginAs } from '../../../support/login';
import env from '../../../config/env';
import * as e2eUser from '../../../config/e2eUser';

test.describe.serial('User > CRUD > Settings (edit own profile)', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.skip(!e2eUser.hasE2eUser(), 'no persisted e2e user');
    page = await browser.newPage();
    const user = e2eUser.getE2eUser()!;
    await loginAs(page, env.USER_URL, user.username, user.password);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // Cập nhật họ (lastName), lưu rồi reload trang để kiểm tra giá trị được lưu đúng
  test('updates first/last name and verifies the change persists', async () => {
    test.setTimeout(90000);

    const newLastName = `QA${Date.now() % 100000}`;

    await page.goto(env.USER_URL + '/settings');
    await page.locator('input[name="lastName"]').waitFor();

    const lastNameInput = page.locator('input[name="lastName"]');
    await lastNameInput.fill(newLastName);

    await takeScreenshot(page, 'user', 'settings-crud', 'before-save');
    await page.locator('button.btn-submit-save').click();
    await page.waitForTimeout(1500);

    await page.reload();
    await page.locator('input[name="lastName"]').waitFor();
    const persistedValue = await page.locator('input[name="lastName"]').inputValue();

    if (persistedValue !== newLastName) {
      throw new Error(`Expected lastName to persist as "${newLastName}" but got "${persistedValue}"`);
    }

    await takeScreenshot(page, 'user', 'settings-crud', 'after-reload-persisted');
  });
});
