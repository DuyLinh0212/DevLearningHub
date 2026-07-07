import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../../support/screenshot';
import { acceptNextDialog, acceptDialogSequence } from '../../../support/dialogs';
import { loginAsAdmin } from '../../../support/login';
import env from '../../../config/env';

test.describe.serial('Admin > CRUD > Topic Management', () => {
  let page: Page;
  const topicName = `[e2e] Topic ${Date.now()}`;
  const topicNameEdited = `${topicName} (edited)`;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // Tạo mới một chủ đề (topic)
  test('creates a topic', async () => {
    test.setTimeout(90000);

    await page.goto(env.ADMIN_URL + '/admin/topics');
    await page.locator('.btn-admin-act.purple').click();

    await page.locator('.admin-modal-form-body input[type=text]').waitFor();
    await page.locator('.admin-modal-form-body input[type=text]').fill(topicName);
    await page.locator('.admin-modal-form-body textarea').fill('Automated e2e test topic description.');

    await takeScreenshot(page, 'admin', 'topic-crud', 'create-form-filled');
    acceptNextDialog(page);
    await page.locator('.btn-modal-confirm').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'topic-crud', 'after-create');
  });

  // Tìm kiếm và sửa tên chủ đề vừa tạo
  test('edits the topic', async () => {
    test.setTimeout(90000);

    const searchInput = page.locator('.top-search input');
    await searchInput.fill(topicName);
    await page.waitForTimeout(500);

    await page.locator('.topic-card .btn-tbl-icon-edit').waitFor();
    await page.locator('.topic-card .btn-tbl-icon-edit').click();

    const nameInput = page.locator('.admin-modal-form-body input[type=text]');
    await nameInput.waitFor();
    await nameInput.fill(topicNameEdited);

    await takeScreenshot(page, 'admin', 'topic-crud', 'edit-form-filled');
    acceptNextDialog(page);
    await page.locator('.btn-modal-confirm').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'topic-crud', 'after-edit');
  });

  // Tìm kiếm và xoá chủ đề vừa tạo
  test('deletes the topic', async () => {
    test.setTimeout(90000);

    const searchInput = page.locator('.top-search input');
    await searchInput.fill(topicNameEdited);
    await page.waitForTimeout(500);

    await page.locator('.topic-card .btn-tbl-icon-delete').waitFor();
    acceptDialogSequence(page, 2);
    await page.locator('.topic-card .btn-tbl-icon-delete').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'topic-crud', 'after-delete');
  });
});
