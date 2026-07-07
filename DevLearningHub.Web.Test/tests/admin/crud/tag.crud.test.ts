import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../../support/screenshot';
import { acceptNextDialog, acceptDialogSequence } from '../../../support/dialogs';
import { loginAsAdmin } from '../../../support/login';
import env from '../../../config/env';

test.describe.serial('Admin > CRUD > Tag Management', () => {
  let page: Page;
  const tagName = `e2etag${Date.now()}`;
  const tagNameEdited = `${tagName}edit`;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // Tạo mới một tag
  test('creates a tag', async () => {
    test.setTimeout(90000);

    await page.goto(env.ADMIN_URL + '/admin/tags');
    await page.locator('.btn-admin-act.purple').click();

    await page.locator('.modal-box input[type=text]').first().waitFor();
    await page.locator('.modal-box input[type=text]').first().fill(tagName);

    await takeScreenshot(page, 'admin', 'tag-crud', 'create-form-filled');
    acceptNextDialog(page);
    await page.locator('.btn-modal-confirm').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'tag-crud', 'after-create');
  });

  // Tìm kiếm và sửa tên tag vừa tạo
  test('edits the tag', async () => {
    test.setTimeout(90000);

    const searchInput = page.locator('.top-search input');
    await searchInput.fill(tagName);
    await page.waitForTimeout(500);

    await page.locator('.tag-table .btn-tbl-icon-edit').waitFor();
    await page.locator('.tag-table .btn-tbl-icon-edit').click();

    const nameInput = page.locator('.modal-box input[type=text]').first();
    await nameInput.waitFor();
    await nameInput.fill(tagNameEdited);

    await takeScreenshot(page, 'admin', 'tag-crud', 'edit-form-filled');
    acceptNextDialog(page);
    await page.locator('.btn-modal-confirm').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'tag-crud', 'after-edit');
  });

  // Tìm kiếm và xoá tag vừa tạo
  test('deletes the tag', async () => {
    test.setTimeout(90000);

    const searchInput = page.locator('.top-search input');
    await searchInput.fill(tagNameEdited);
    await page.waitForTimeout(500);

    await page.locator('.tag-table .btn-tbl-icon-delete').waitFor();
    acceptDialogSequence(page, 2);
    await page.locator('.tag-table .btn-tbl-icon-delete').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'tag-crud', 'after-delete');
  });
});
