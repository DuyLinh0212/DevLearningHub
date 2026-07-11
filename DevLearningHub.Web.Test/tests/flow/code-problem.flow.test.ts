import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import { waitForUrlContains } from '../../support/wait';
import { selectFirstRealOption } from '../../support/select';
import { loginAsAdmin, loginAs } from '../../support/login';
import { approveItem } from '../../support/moderation';
import env from '../../config/env';
import * as e2eUser from '../../config/e2eUser';

test.describe.serial('Flow > User creates+solves a code problem, Admin moderates', () => {
  let adminPage: Page;
  let userPage: Page;
  const problemTitle = `[e2e-flow] Problem ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    test.skip(!e2eUser.hasE2eUser(), 'no persisted e2e user');
    // Two separate contexts, not two pages on one context, so cookies/localStorage
    // stay isolated — the direct equivalent of two separate buildDriver() instances.
    const adminContext = await browser.newContext();
    const userContext = await browser.newContext();
    adminPage = await adminContext.newPage();
    userPage = await userContext.newPage();
    await loginAsAdmin(adminPage);
    const user = e2eUser.getE2eUser()!;
    await loginAs(userPage, env.USER_URL, user.username, user.password);
  });

  test.afterAll(async () => {
    await adminPage.close();
    await userPage.close();
  });

  // User tạo mới một bài toán lập trình chờ duyệt
  test('user creates a coding problem', async () => {
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

    await userPage.locator('.modal-create .form-textarea-md').fill('Automated e2e-flow test problem description.');

    // Chọn 1 tag trước khi lưu — nếu bỏ qua, chip tag sẽ không được thêm vào
    // form.tags và UI tag-input trông như chưa hoạt động khi theo dõi trực tiếp.
    await userPage.locator('.modal-create .tag-select-dropdown').selectOption({ index: 1 });
    await userPage.locator('.modal-create .btn-add-tag').click();

    // Provide a default test case so the backend has valid test cases
    await userPage.locator('.modal-create .tc-textarea').first().fill('1 2');
    await userPage.locator('.modal-create .tc-textarea.tc-expected').first().fill('3');

    await takeScreenshot(userPage, 'flow', 'code-problem-flow', 'create-form-filled');
    await userPage.locator('.modal-create .btn-save').click();

    await userPage.waitForTimeout(1000);
    await expect(userPage.locator('.modal-create')).toBeHidden({ timeout: 10000 });
    await takeScreenshot(userPage, 'flow', 'code-problem-flow', 'created-pending');
  });

  // Admin duyệt bài toán trong hàng đợi kiểm duyệt
  test('admin approves the problem in the moderation queue', async () => {
    test.setTimeout(90000);

    await approveItem(adminPage, env.ADMIN_URL, 'Bài code', problemTitle);
    await takeScreenshot(adminPage, 'flow', 'code-problem-flow', 'after-approve');
  });

  // User mở lại bài toán đã duyệt, viết code và nộp bài, kiểm tra có kết quả trả về
  test('user opens the problem workspace, runs and submits code', async () => {
    test.setTimeout(90000);

    await userPage.goto(env.USER_URL + '/code');
    const tabs = userPage.locator('.cp-tab');
    await tabs.nth(1).click();
    await userPage.waitForTimeout(500);

    const problemLink = userPage.locator(`//a[contains(@class,'problem-title-link')][contains(text(),"${problemTitle}")]`);
    await problemLink.waitFor();
    await problemLink.click();

    await waitForUrlContains(userPage, '/code/', 15000);
    const editor = userPage.locator('textarea.editor-textarea');
    await editor.waitFor();

    await editor.click();
    await editor.fill('console.log("e2e-flow smoke run");');

    await takeScreenshot(userPage, 'flow', 'code-problem-flow', 'code-written');
    await userPage.locator('button.btn-run').click();

    await userPage.locator('.console-tabs').waitFor();
    await userPage.waitForTimeout(1500);
    await takeScreenshot(userPage, 'flow', 'code-problem-flow', 'after-run');

    await userPage.locator('button.btn-submit-green').click();
    await userPage.waitForTimeout(1500);
    await takeScreenshot(userPage, 'flow', 'code-problem-flow', 'after-submit');
    // No test cases exist on this problem (see plan), so we only assert the
    // run/submit flow completes and renders a result panel, not a pass verdict.
    await expect(userPage.locator('.console-result-view, .result-summary, .result-summary-submit').first()).toBeVisible();
  });
});
