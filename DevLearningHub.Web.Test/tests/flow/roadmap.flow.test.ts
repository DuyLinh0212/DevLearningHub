import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import { selectFirstRealOption } from '../../support/select';
import { acceptNextDialog } from '../../support/dialogs';
import { loginAsAdmin, loginAs } from '../../support/login';
import env from '../../config/env';
import * as e2eUser from '../../config/e2eUser';

test.describe.serial('Flow > Admin creates+publishes a roadmap, moderates it, User views progress', () => {
  let adminPage: Page;
  let userPage: Page;
  const roadmapTitle = `[e2e-flow] Roadmap ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    test.skip(!e2eUser.hasE2eUser(), 'no persisted e2e user');
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

  // Admin tạo mới một lộ trình (roadmap) chờ duyệt
  test('admin creates a roadmap', async () => {
    test.setTimeout(90000);

    await adminPage.goto(env.ADMIN_URL + '/admin/roadmap');
    await adminPage.locator('.btn-admin-act.purple').click();

    await adminPage.locator('.modal-box input[type=text]').waitFor();
    await adminPage.locator('.modal-box input[type=text]').fill(roadmapTitle);
    await adminPage.locator('.modal-box textarea').fill('Automated e2e-flow test roadmap description.');

    const selects = adminPage.locator('.modal-box select');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      await selectFirstRealOption(selects.nth(i));
    }

    await takeScreenshot(adminPage, 'flow', 'roadmap-flow', 'create-form-filled');
    acceptNextDialog(adminPage);
    await adminPage.locator('.btn-modal-confirm').click();

    await adminPage.waitForTimeout(500);
    // Nội dung do Admin tạo được AutoApprovalPolicyService tự động duyệt ngay
    // (bỏ qua hàng đợi kiểm duyệt), khác với content do User tạo — nên không có
    // bước "admin approves" ở đây như các flow test khác (code-problem, quiz...).
    await takeScreenshot(adminPage, 'flow', 'roadmap-flow', 'created-approved');
  });

  // Admin gắn 1 bộ đề (quiz_set) và 1 bài code (problem) vào lộ trình, để lộ trình
  // thực sự có nội dung thay vì chỉ là một khung rỗng.
  test('admin adds a quiz set and a code problem as roadmap items', async () => {
    test.setTimeout(90000);

    const roadmapCard = adminPage.locator(`//div[contains(@class,'roadmap-admin-card')][.//h3[contains(@class,'card-title')][contains(text(),"${roadmapTitle}")]]`);
    await roadmapCard.waitFor();
    await roadmapCard.locator('.btn-card-action.btn-primary').click();

    // Gắn 1 bộ đề (Bộ đề = quiz_set)
    await roadmapCard.locator('.btn-small-primary').click();
    await adminPage.locator('.modal-box select').first().selectOption('quiz_set');
    await selectFirstRealOption(adminPage.locator('.modal-box select').nth(1));
    await takeScreenshot(adminPage, 'flow', 'roadmap-flow', 'add-quiz-item-filled');
    await adminPage.locator('.modal-box .btn-modal-confirm').click();
    await adminPage.waitForTimeout(500);

    // Gắn 1 bài code (Bài code = problem)
    await roadmapCard.locator('.btn-small-primary').click();
    await adminPage.locator('.modal-box select').first().selectOption('problem');
    await selectFirstRealOption(adminPage.locator('.modal-box select').nth(1));
    await takeScreenshot(adminPage, 'flow', 'roadmap-flow', 'add-problem-item-filled');
    await adminPage.locator('.modal-box .btn-modal-confirm').click();
    await adminPage.waitForTimeout(500);

    await expect(roadmapCard.locator('.item-row')).toHaveCount(2);
    await takeScreenshot(adminPage, 'flow', 'roadmap-flow', 'items-added');
  });

  // User mở lộ trình đã duyệt, kiểm tra bước đầu tiên hiển thị đúng trạng thái (không bị khoá)
  // và thấy đủ 2 loại mục (bộ đề + bài code) vừa được admin gắn vào.
  test('user opens the roadmap and sees its steps with correct initial status', async () => {
    test.setTimeout(90000);

    await userPage.goto(env.USER_URL + '/roadmap');
    const roadmapCard = userPage.locator(`//button[contains(@class,'roadmap-selector-card')][contains(.,"${roadmapTitle}")]`);
    await roadmapCard.waitFor();
    await roadmapCard.click();

    await userPage.locator('.tree-timeline-track').waitFor();
    const nodeRows = userPage.locator('.timeline-node-row');
    await takeScreenshot(userPage, 'flow', 'roadmap-flow', 'roadmap-steps');

    const nodeCount = await nodeRows.count();
    expect(nodeCount).toBeGreaterThan(0);

    const firstStatus = await nodeRows.first().locator('.node-status-circle').getAttribute('data-status');
    // First node should be reachable (not locked) on a freshly approved roadmap.
    if (firstStatus === 'locked') {
      throw new Error(`Expected first roadmap node to be unlocked, got status "${firstStatus}"`);
    }

    // Cả bộ đề và bài code vừa gắn đều phải xuất hiện dưới dạng node riêng trong timeline.
    await expect(userPage.locator('.node-type-chip[data-type="quiz_set"]').first()).toBeVisible();
    await expect(userPage.locator('.node-type-chip[data-type="problem"]').first()).toBeVisible();

    // NOTE: the frontend has no "mark complete" UI for roadmap steps — completion
    // is only derived from completing the linked quiz/problem, which this suite
    // does not wire up. This test intentionally stops at verifying moderation
    // integration and initial render, not a completion transition.
  });
});
