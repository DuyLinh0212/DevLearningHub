import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../../support/screenshot';
import { selectFirstRealOption } from '../../../support/select';
import { acceptNextDialog, acceptDialogSequence } from '../../../support/dialogs';
import { loginAsAdmin } from '../../../support/login';
import env from '../../../config/env';

test.describe.serial('Admin > CRUD > Roadmap Management', () => {
  let page: Page;
  const roadmapTitle = `[e2e] Roadmap ${Date.now()}`;
  const roadmapTitleEdited = `${roadmapTitle} (edited)`;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  function cardByTitle(title: string) {
    return `//div[contains(@class,'roadmap-admin-card')][.//h3[contains(@class,'card-title')][contains(text(),"${title}")]]`;
  }

  // Tạo mới một lộ trình (roadmap) qua modal
  test('creates a roadmap', async () => {
    test.setTimeout(90000);

    await page.goto(env.ADMIN_URL + '/admin/roadmap');
    await page.locator('.btn-admin-act.purple').click();

    await page.locator('.modal-box input[type=text]').waitFor();
    await page.locator('.modal-box input[type=text]').fill(roadmapTitle);
    await page.locator('.modal-box textarea').fill('Automated e2e test roadmap description.');

    const selects = page.locator('.modal-box select');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      await selectFirstRealOption(selects.nth(i));
    }

    await takeScreenshot(page, 'admin', 'roadmap-crud', 'create-form-filled');
    acceptNextDialog(page);
    await page.locator('.btn-modal-confirm').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'roadmap-crud', 'after-create');
  });

  // Sửa tiêu đề lộ trình vừa tạo
  test('edits the roadmap', async () => {
    test.setTimeout(90000);

    const card = page.locator(cardByTitle(roadmapTitle));
    await card.waitFor();
    await card.locator('.btn-card-action.btn-edit').click();

    const titleInput = page.locator('.modal-box input[type=text]');
    await titleInput.waitFor();
    await titleInput.fill(roadmapTitleEdited);

    await takeScreenshot(page, 'admin', 'roadmap-crud', 'edit-form-filled');
    acceptNextDialog(page);
    await page.locator('.btn-modal-confirm').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'roadmap-crud', 'after-edit');
  });

  // Xoá lộ trình qua nút xoá trên card
  test('deletes the roadmap', async () => {
    test.setTimeout(90000);

    const card = page.locator(cardByTitle(roadmapTitleEdited));
    await card.waitFor();
    acceptDialogSequence(page, 2);
    await card.locator('.btn-card-action.btn-danger').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'roadmap-crud', 'after-delete');
  });
});
