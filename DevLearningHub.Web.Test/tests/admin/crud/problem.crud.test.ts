import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../../support/screenshot';
import { selectFirstRealOption } from '../../../support/select';
import { acceptNextDialog, dismissNextDialog, acceptDialogSequence } from '../../../support/dialogs';
import { loginAsAdmin } from '../../../support/login';
import env from '../../../config/env';

test.describe.serial('Admin > CRUD > Problem Management', () => {
  let page: Page;
  const problemTitle = `[e2e] Problem ${Date.now()}`;
  const problemTitleEdited = `${problemTitle} (edited)`;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // Tạo mới một bài toán lập trình, bỏ qua gợi ý vào trang test case
  test('creates a problem', async () => {
    test.setTimeout(90000);

    await page.goto(env.ADMIN_URL + '/admin/problems');
    await page.locator('.btn-admin-act.purple').click();

    await page.locator('.admin-modal-form-body input[type=text]').waitFor();
    await page.locator('.admin-modal-form-body input[type=text]').fill(problemTitle);
    await selectFirstRealOption(page.locator('select.admin-select-field').first());
    await page.locator('.admin-modal-form-body textarea').first().fill('Automated e2e test problem description.');

    await takeScreenshot(page, 'admin', 'problem-crud', 'create-form-filled');
    // Success triggers confirm("go to test-cases?") — dismiss to stay on the problem list.
    dismissNextDialog(page);
    await page.locator('.btn-modal-confirm').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'problem-crud', 'after-create');
  });

  // Tìm kiếm theo tiêu đề chính xác và sửa bài toán vừa tạo
  test('edits the problem', async () => {
    test.setTimeout(90000);

    const searchInput = page.locator('.top-search input');
    await searchInput.fill(problemTitle);

    // Wait for the filtered row itself (not just any edit icon in the table) so we
    // don't race Angular's (input)="filterProblems()" change detection.
    const rowLocator = `//table[contains(@class,'admin-management-table')]//tr[contains(., "${problemTitle}")]`;
    const row = page.locator(rowLocator);
    await row.waitFor({ timeout: 15000 });
    await row.locator('.btn-tbl-icon-edit').click();

    const titleInput = page.locator('.admin-modal-form-body input[type=text]');
    await titleInput.waitFor();
    await titleInput.fill(problemTitleEdited);

    await takeScreenshot(page, 'admin', 'problem-crud', 'edit-form-filled');
    acceptNextDialog(page);
    await page.locator('.btn-modal-confirm').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'problem-crud', 'after-edit');
  });

  // Tìm kiếm và xoá bài toán vừa tạo
  test('deletes the problem', async () => {
    test.setTimeout(90000);

    const searchInput = page.locator('.top-search input');
    await searchInput.fill(problemTitleEdited);

    const rowLocator = `//table[contains(@class,'admin-management-table')]//tr[contains(., "${problemTitleEdited}")]`;
    const row = page.locator(rowLocator);
    await row.waitFor({ timeout: 15000 });
    acceptDialogSequence(page, 2);
    await row.locator('.btn-tbl-icon-delete').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'problem-crud', 'after-delete');
  });
});
