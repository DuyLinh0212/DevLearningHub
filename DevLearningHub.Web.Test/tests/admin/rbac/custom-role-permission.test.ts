import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../../support/screenshot';
import { waitForUrlContains } from '../../../support/wait';
import { loginAsAdmin, loginAs } from '../../../support/login';
import env from '../../../config/env';
import * as e2eUser from '../../../config/e2eUser';

// Real permission keys used by the app's guards/backend (verified against
// app.routes.ts / permission.guard.ts / admin.guard.ts / CommentsController.cs):
//   admin:access  -> required by adminGuard to enter Web.Admin at all
//   post:hide_any -> required by the /admin/posts route guard (view/moderate posts)
//   comment:delete -> backend-enforced permission to delete any user's comment
// quiz:edit (gates /admin/quiz) is intentionally NOT granted, to prove enforcement.
const ROLE_NAME = `E2E QA Collaborator ${Date.now()}`;

test.describe.serial('Admin > RBAC > Custom role + permission grant', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    test.skip(!e2eUser.hasE2eUser(), 'no persisted e2e user');
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  // Tạo mới một role tuỳ chỉnh
  test('creates a custom role', async () => {
    test.setTimeout(120000);
    await loginAsAdmin(page);
    await page.addStyleTag({ content: 'vite-error-overlay { display: none !important; }' });
    await page.goto(env.ADMIN_URL + '/admin/roles');

    await page.locator('.btn-create').click();

    const inputs = page.locator('.modal-input');
    await inputs.first().waitFor();
    await inputs.nth(0).fill(ROLE_NAME);
    await inputs.nth(1).fill('Automated e2e RBAC test role.');

    await takeScreenshot(page, 'admin', 'rbac', 'create-role-form-filled');
    await page.locator('.modal .btn-save').click();
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'admin', 'rbac', 'after-create-role');
  });

  // Gán các quyền admin:access, post:hide_any, comment:delete cho role (cố tình không gán quiz:edit)
  test('grants admin:access, post:hide_any and comment:delete to the role', async () => {
    test.setTimeout(120000);

    const roleItem = page.locator(`//li[contains(@class,'pq-role-item')][.//span[contains(@class,'pq-role-name')][contains(text(),"${ROLE_NAME}")]]`);
    await roleItem.click();
    await page.waitForTimeout(300);

    await page.locator('input.pq-check').first().waitFor();
    await page.locator('input.pq-check[title="admin:access"]').click({ force: true });
    await page.locator('input.pq-check[title="post:hide_any"]').click({ force: true });
    await page.locator('input.pq-check[title="comment:delete"]').click({ force: true });

    await takeScreenshot(page, 'admin', 'rbac', 'permissions-checked');
    
    const saveResponsePromise = page.waitForResponse(res => res.url().includes('/api/admin/roles') && res.url().includes('/permissions') && res.request().method() === 'PUT', { timeout: 60000 });
    await page.locator('.pq-matrix-head .btn-save').click({ force: true });
    await saveResponsePromise;

    await takeScreenshot(page, 'admin', 'rbac', 'after-save-permissions');
  });

  // Gán role tuỳ chỉnh vừa tạo cho user e2e
  test('assigns the custom role to the e2e user', async () => {
    test.setTimeout(120000);

    const tabs = page.locator('.pq-tab');
    await tabs.nth(1).click();
    await page.waitForTimeout(500);

    const searchInput = page.locator('.top-search input');
    const user = e2eUser.getE2eUser()!;
    await searchInput.fill(user.username);
    await page.waitForTimeout(500);

    await page.locator('.btn-perm').waitFor();
    await page.locator('.btn-perm').click();

    // Wait for THIS role's radio specifically — waiting on any manageRole radio
    // can pass before the newly-created role has finished loading into the list.
    const roleRadioLocator = `//label[contains(@class,'role-radio-item')][.//span[contains(@class,'role-radio-name')][text()="${ROLE_NAME}"]]`;
    const roleRadio = page.locator(roleRadioLocator);
    await roleRadio.waitFor({ state: 'attached', timeout: 15000 });
    
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/admin/roles') && res.request().method() === 'GET', { timeout: 60000 });
    await roleRadio.click({ force: true });
    await responsePromise;

    await takeScreenshot(page, 'admin', 'rbac', 'assign-role-to-user');
    const saveUserResponsePromise = page.waitForResponse(res => res.url().includes('/management') && res.request().method() === 'PUT', { timeout: 60000 });
    await page.locator('.manage-footer .btn-modal-confirm.purple').click();
    await saveUserResponsePromise;
    await page.waitForTimeout(3000); // Đợi thêm 3s để Backend và Token Identity đồng bộ hoàn toàn

    await takeScreenshot(page, 'admin', 'rbac', 'after-assign-role');
  });

  // Đăng nhập bằng user e2e, kiểm tra được cấp quyền truy cập khu vực admin
  test('logs in as the e2e user and verifies admin:access takes effect', async () => {
    test.setTimeout(120000);

    const user = e2eUser.getE2eUser()!;
    await page.goto(env.ADMIN_URL);
    await page.evaluate(() => window.localStorage.clear());
    await loginAs(page, env.ADMIN_URL, user.username, user.password);

    await expect(page.locator('header.content-header')).toBeVisible();
    await takeScreenshot(page, 'admin', 'rbac', 'e2e-user-admin-access-granted');
  });

  // Kiểm tra user e2e truy cập được /admin/posts vì đã được cấp quyền
  test('positive check: e2e user can access /admin/posts (post:hide_any granted)', async () => {
    test.setTimeout(120000);

    await page.goto(env.ADMIN_URL + '/admin/posts');
    await expect(page.locator('header.content-header')).toBeVisible();
    await waitForUrlContains(page, '/admin/posts', 10000);
    await takeScreenshot(page, 'admin', 'rbac', 'e2e-user-can-access-posts');
  });

  // Kiểm tra user e2e bị chặn vào /admin/quiz vì không được cấp quyền quiz:edit.
  // Lưu ý: permissionGuard chỉ redirect về /login khi thiếu/token lỗi; khi token hợp lệ
  // nhưng thiếu quyền, guard chỉ trả về false và Angular Router âm thầm huỷ điều hướng
  // (không có route "**" fallback), nên URL không đổi và trang quiz không được render.
  test('negative check: e2e user is blocked from /admin/quiz (quiz:edit not granted)', async () => {
    test.setTimeout(120000);

    await page.goto(env.ADMIN_URL + '/admin/quiz');
    await page.waitForTimeout(1000);
    await expect(page.locator('app-quiz-management')).toHaveCount(0);
    await takeScreenshot(page, 'admin', 'rbac', 'e2e-user-blocked-from-quiz');
  });

  // Dọn dẹp: gán lại user e2e về role mặc định và xoá role tuỳ chỉnh
  test('cleanup: reassigns the e2e user back to User role and deletes the custom role', async () => {
    test.setTimeout(120000);

    await loginAsAdmin(page);
    await page.goto(env.ADMIN_URL + '/admin/roles?tab=users');
    await page.waitForTimeout(500);

    const tabs = page.locator('.pq-tab');
    await tabs.nth(1).click();
    await page.waitForTimeout(500);

    const searchInput = page.locator('.top-search input');
    const user = e2eUser.getE2eUser()!;
    await searchInput.fill(user.username);
    await page.waitForTimeout(500);

    await page.locator('.btn-perm').waitFor();
    await page.locator('.btn-perm').click();

    const userRoleRadioLocator = `//label[contains(@class,'role-radio-item')][.//span[contains(@class,'role-radio-name')][text()="User"]]`;
    const userRoleRadio = page.locator(userRoleRadioLocator);
    await userRoleRadio.waitFor({ state: 'attached', timeout: 15000 });

    const cleanupResponsePromise = page.waitForResponse(res => res.url().includes('/api/admin/roles') && res.request().method() === 'GET', { timeout: 60000 });
    await userRoleRadio.click({ force: true });
    await cleanupResponsePromise;
    const cleanupSaveUserResponsePromise = page.waitForResponse(res => res.url().includes('/management') && res.request().method() === 'PUT', { timeout: 60000 });
    await page.locator('.manage-footer .btn-modal-confirm.purple').click();
    await cleanupSaveUserResponsePromise;

    await takeScreenshot(page, 'admin', 'rbac', 'cleanup-user-reassigned');

    // switchTab() ở role-management.ts chỉ đổi query param, KHÔNG gọi lại loadRoles(),
    // nên danh sách role trong bộ nhớ vẫn giữ userCount cũ (lúc role còn được gán cho
    // user e2e). Nút xoá role chỉ render khi userCount === 0, nên nếu chỉ click đổi tab
    // (không reload trang) thì nút xoá sẽ không bao giờ xuất hiện -> chờ mãi rồi timeout.
    // Điều hướng lại (goto) để buộc component load lại roles với userCount mới nhất.
    await page.goto(env.ADMIN_URL + '/admin/roles?tab=groups');
    await page.waitForTimeout(500);

    const roleItem = page.locator(`//li[contains(@class,'pq-role-item')][.//span[contains(@class,'pq-role-name')][contains(text(),"${ROLE_NAME}")]]`);
    await roleItem.waitFor();
    await roleItem.locator('.btn-icon.btn-danger').click();

    await page.locator('.modal.modal-sm .btn-delete').waitFor();
    await page.locator('.modal.modal-sm .btn-delete').click();
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'admin', 'rbac', 'cleanup-role-deleted');
  });
});
