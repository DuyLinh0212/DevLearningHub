import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../../support/screenshot';
import { waitForUrlContains } from '../../../support/wait';
import { acceptDialogSequence } from '../../../support/dialogs';
import { loginAs } from '../../../support/login';
import env from '../../../config/env';
import * as e2eUser from '../../../config/e2eUser';

test.describe.serial('User > CRUD > Forum Post', () => {
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

  // Tạo bài viết diễn đàn, kiểm tra chi tiết, rồi xoá bài viết.
  // GetPost (PostsController) miễn trừ tác giả khỏi chặn 403 khi bài đang pending,
  // nên chủ bài viết vẫn xem được bài của mình qua URL chi tiết dù chưa được duyệt.
  test('creates a forum post, verifies it, then deletes it', async () => {
    test.setTimeout(90000);

    await page.goto(env.USER_URL + '/forum/create');
    await page.locator('input[name="title"]').waitFor();

    await page.locator('input[name="title"]').fill(`[e2e] Test post ${Date.now()}`);
    await page.locator('textarea[name="bodyMarkdown"]').fill('This is an automated e2e test post body.');

    await page.locator('.tag-combobox-wrapper').click();
    await page.locator('.tag-dropdown-item').first().waitFor();
    await page.locator('.tag-dropdown-item').first().click();

    await takeScreenshot(page, 'user', 'forum-post-crud', 'form-filled');
    await page.locator('input[name="title"]').click();
    await page.locator('button.btn-submit').click();

    await waitForUrlContains(page, '/forum/post/', 15000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.btn-action-danger').first()).toBeVisible({ timeout: 15000 });
    await takeScreenshot(page, 'user', 'forum-post-crud', 'created-post-detail');

    acceptDialogSequence(page, 2); // confirm() then success alert()
    await page.locator('.btn-action-danger').first().click();
    await waitForUrlContains(page, '/forum', 15000);
    await takeScreenshot(page, 'user', 'forum-post-crud', 'after-delete');
  });
});
