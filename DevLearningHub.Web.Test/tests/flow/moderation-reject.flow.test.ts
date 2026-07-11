import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import { selectFirstRealOption } from '../../support/select';
import { acceptNextDialog } from '../../support/dialogs';
import { loginAsAdmin, loginAs } from '../../support/login';
import { openPendingTab, cardByTitle } from '../../support/moderation';
import env from '../../config/env';
import * as e2eUser from '../../config/e2eUser';

test.describe.serial('Flow > Admin rejects a pending item with a reason', () => {
  let adminPage: Page;
  let userPage: Page;
  const problemTitle = `[e2e-flow] Reject Problem ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    test.skip(!e2eUser.hasE2eUser(), 'no persisted e2e user');
    const adminContext = await browser.newContext();
    const userContext = await browser.newContext();
    adminPage = await adminContext.newPage();
    userPage = await userContext.newPage();
    await loginAsAdmin(adminPage);
    await adminPage.addStyleTag({ content: 'vite-error-overlay { display: none !important; }' });
    const user = e2eUser.getE2eUser()!;
    await loginAs(userPage, env.USER_URL, user.username, user.password);
  });

  test.afterAll(async () => {
    await adminPage.close();
    await userPage.close();
  });

  // User tạo bài toán tạm để làm dữ liệu test từ chối
  test('user creates a throwaway coding problem', async () => {
    test.setTimeout(90000);

    await userPage.goto(env.USER_URL + '/code');
    const tabs = userPage.locator('.cp-tab');
    await tabs.nth(1).click();
    await userPage.waitForTimeout(500);

    await userPage.locator('.btn-create-problem').click();

    await userPage.locator('.modal-create input[type="text"]').waitFor();
    await userPage.locator('.modal-create input[type="text"]').fill(problemTitle);

    const selects = userPage.locator('.modal-create select.form-select');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      await selectFirstRealOption(selects.nth(i));
    }

    await userPage.locator('.modal-create .form-textarea-md').fill('Throwaway problem for reject-path testing.');

    // Chọn 1 tag trước khi lưu — xem code-problem.flow.test.ts để biết lý do.
    await userPage.locator('.modal-create .tag-select-dropdown').selectOption({ index: 1 });
    await userPage.locator('.modal-create .btn-add-tag').click();

    await userPage.locator('.modal-create .btn-save').click();
    await userPage.waitForTimeout(1000);
  });

  // Thử từ chối với lý do trống, kiểm tra bị chặn bởi validate; sau đó điền lý do và từ chối thật, kiểm tra item chuyển sang bộ lọc Từ chối
  test('rejecting with an empty reason is blocked, then succeeds with a reason', async () => {
    test.setTimeout(90000);

    await openPendingTab(adminPage, env.ADMIN_URL, 'Bài code');
    const card = adminPage.locator(cardByTitle(problemTitle));
    await card.waitFor();
    await card.locator('button.btn-reject').click();

    await adminPage.locator('.mq-modal-overlay').waitFor();
    await takeScreenshot(adminPage, 'flow', 'moderation-reject-flow', 'reject-modal-empty-reason');

    // Confirm with an empty reason -> blocked by a native validation alert.
    acceptNextDialog(adminPage);
    await adminPage.locator('.mq-modal-actions button.btn-reject').click();

    // Now provide a reason and confirm for real.
    await adminPage.locator('.mq-modal-textarea').fill('Automated e2e-flow rejection reason.');
    await takeScreenshot(adminPage, 'flow', 'moderation-reject-flow', 'reject-modal-with-reason');
    await adminPage.locator('.mq-modal-actions button.btn-reject').click();
    await adminPage.waitForTimeout(500);

    // The card should no longer appear under the pending filter.
    const stillPendingCount = await adminPage.locator(cardByTitle(problemTitle)).count();
    if (stillPendingCount > 0) {
      throw new Error('Rejected item still appears under the pending filter');
    }

    // It should now appear under the "Từ chối" (rejected) status filter.
    await adminPage.locator(`//button[contains(@class,'mq-chip')][contains(text(),"Từ chối")]`).click();
    await expect(adminPage.locator(cardByTitle(problemTitle))).toBeVisible();
    await takeScreenshot(adminPage, 'flow', 'moderation-reject-flow', 'after-reject');
  });
});
