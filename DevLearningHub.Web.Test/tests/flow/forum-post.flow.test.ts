import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import { waitForUrlContains } from '../../support/wait';
import { loginAsAdmin, loginAs } from '../../support/login';
import { approveItem } from '../../support/moderation';
import env from '../../config/env';
import * as e2eUser from '../../config/e2eUser';

test.describe.serial('Flow > User creates a forum post, Admin moderates it', () => {
  let adminPage: Page;
  let userPage: Page;
  const postTitle = `[e2e-flow] Post ${Date.now()}`;
  let postUrl: string;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(90000);
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

  // User tạo mới một bài viết diễn đàn chờ duyệt
  test('user creates a forum post', async () => {
    test.setTimeout(90000);

    await userPage.goto(env.USER_URL + '/forum/create');
    await userPage.locator('input[name="title"]').waitFor();

    await userPage.locator('input[name="title"]').fill(postTitle);
    await userPage.locator('textarea[name="bodyMarkdown"]').fill('Automated e2e-flow test post body.');

    await userPage.locator('.tag-combobox-wrapper').click();
    await userPage.locator('.tag-dropdown-item').first().waitFor();
    await userPage.locator('.tag-dropdown-item').first().click();

    await takeScreenshot(userPage, 'flow', 'forum-post-flow', 'create-form-filled');
    await userPage.locator('input[name="title"]').click();
    await userPage.locator('button.btn-submit').click();

    await waitForUrlContains(userPage, '/forum/post/', 15000);
    postUrl = userPage.url();
    await takeScreenshot(userPage, 'flow', 'forum-post-flow', 'created-pending');
  });

  // Admin duyệt bài viết trong hàng đợi kiểm duyệt
  test('admin approves the post in the moderation queue', async () => {
    test.setTimeout(90000);

    await approveItem(adminPage, env.ADMIN_URL, 'Bài viết', postTitle);
    await takeScreenshot(adminPage, 'flow', 'forum-post-flow', 'after-approve');
  });

  // Kiểm tra bài viết đã duyệt vẫn hiển thị đúng tại URL chi tiết
  test('the approved post still renders at its detail URL', async () => {
    test.setTimeout(90000);

    await userPage.goto(postUrl);
    await expect(userPage.locator(`//*[contains(text(),"${postTitle}")]`).first()).toBeVisible();
    await takeScreenshot(userPage, 'flow', 'forum-post-flow', 'approved-post-detail');
  });
});
