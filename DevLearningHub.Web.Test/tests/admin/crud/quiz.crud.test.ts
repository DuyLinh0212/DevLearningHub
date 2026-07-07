import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../../support/screenshot';
import { selectFirstRealOption } from '../../../support/select';
import { acceptNextDialog, acceptDialogSequence } from '../../../support/dialogs';
import { loginAsAdmin } from '../../../support/login';
import env from '../../../config/env';

test.describe.serial('Admin > CRUD > Quiz Set Management', () => {
  let page: Page;
  const quizTitle = `[e2e] Quiz Set ${Date.now()}`;
  const quizTitleEdited = `${quizTitle} (edited)`;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  function cardByTitle(title: string) {
    return `//div[contains(@class,'quiz-set-config-card')][.//h3[contains(@class,'card-title')][contains(text(),"${title}")]]`;
  }

  // Tạo mới một bộ quiz set qua modal
  test('creates a quiz set', async () => {
    test.setTimeout(90000);

    await page.goto(env.ADMIN_URL + '/admin/quiz');
    await page.locator('.tab-switch-btn').first().waitFor();
    await page.locator('.tab-switch-btn').nth(1).click();
    await page.waitForTimeout(500);

    await page.locator('.btn-admin-act.purple').click();

    await page.locator('.modal-box input[type=text]').waitFor();
    await page.locator('.modal-box input[type=text]').fill(quizTitle);
    await page.locator('.modal-box textarea').fill('Automated e2e test quiz set description.');

    const selects = page.locator('.modal-box select');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      await selectFirstRealOption(selects.nth(i));
    }

    await takeScreenshot(page, 'admin', 'quiz-set-crud', 'create-form-filled');
    acceptNextDialog(page);
    await page.locator('.btn-modal-confirm').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'quiz-set-crud', 'after-create');
  });

  // Sửa tiêu đề bộ quiz set vừa tạo
  test('edits the quiz set', async () => {
    test.setTimeout(90000);

    const card = page.locator(cardByTitle(quizTitle));
    await card.waitFor();
    await card.locator('.btn-card-action.btn-edit').click();

    const titleInput = page.locator('.modal-box input[type=text]');
    await titleInput.waitFor();
    await titleInput.fill(quizTitleEdited);

    await takeScreenshot(page, 'admin', 'quiz-set-crud', 'edit-form-filled');
    acceptNextDialog(page);
    await page.locator('.btn-modal-confirm').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'quiz-set-crud', 'after-edit');
  });

  // Xoá bộ quiz set qua menu kebab
  test('deletes the quiz set', async () => {
    test.setTimeout(90000);

    const card = page.locator(cardByTitle(quizTitleEdited));
    await card.waitFor();
    await card.locator('.quiz-set-kebab-btn').click();
    await page.locator('.quiz-options-dropdown .dropdown-item.danger').waitFor();
    acceptDialogSequence(page, 2);
    await page.locator('.quiz-options-dropdown .dropdown-item.danger').click();

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'admin', 'quiz-set-crud', 'after-delete');
  });
});
