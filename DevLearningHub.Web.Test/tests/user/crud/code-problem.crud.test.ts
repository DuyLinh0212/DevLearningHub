import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../../support/screenshot';
import { selectFirstRealOption } from '../../../support/select';
import { loginAs } from '../../../support/login';
import env from '../../../config/env';
import * as e2eUser from '../../../config/e2eUser';

test.describe.serial('User > CRUD > Code Playground Problem', () => {
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

  // Tạo mới một bài toán lập trình qua modal (chưa có UI xoá nên không test edit/delete)
  test('creates a coding problem (no delete UI exists — leaves it tagged [e2e])', async () => {
    test.setTimeout(90000);

    await page.goto(env.USER_URL + '/code');
    const tabs = page.locator('.cp-tab');
    await tabs.nth(1).click();
    await page.waitForTimeout(500);

    await page.locator('.btn-create-problem').click();

    await page.locator('.modal-create .form-input').waitFor();
    await page.locator('.modal-create .form-input').fill(`[e2e] Problem ${Date.now()}`);

    const selects = page.locator('.modal-create select.form-select');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      await selectFirstRealOption(selects.nth(i));
    }

    await page.locator('.modal-create .form-textarea-md').fill('Automated e2e test problem description.');

    await takeScreenshot(page, 'user', 'code-problem-crud', 'form-filled');
    await page.locator('.modal-create .btn-save').click();

    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'user', 'code-problem-crud', 'after-create');
  });
});
