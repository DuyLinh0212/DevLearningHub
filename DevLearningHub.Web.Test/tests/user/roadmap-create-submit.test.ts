import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import { selectFirstRealOption } from '../../support/select';
import { loginAs } from '../../support/login';
import env from '../../config/env';
import * as e2eUser from '../../config/e2eUser';

// Kịch bản: người dùng tạo một lộ trình mới (mặc định là "Bản nháp"), thêm một mục học,
// rồi bấm "Gửi kiểm duyệt". Mục tiêu là xác nhận luồng mới: tạo xong KHÔNG tự động đưa đi
// kiểm duyệt — chỉ khi người dùng chủ động bấm gửi thì lộ trình mới rời trạng thái bản nháp.
test.describe.serial('User > CRUD > Roadmap Create & Submit', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.skip(!e2eUser.hasE2eUser(), 'no persisted e2e user');
    page = await browser.newPage();
    // Tự động chấp nhận mọi hộp thoại confirm() (nút "Gửi kiểm duyệt" có xác nhận).
    page.on('dialog', (dialog) => dialog.accept());
    const user = e2eUser.getE2eUser()!;
    await loginAs(page, env.USER_URL, user.username, user.password);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('creates a draft roadmap, adds an item, and submits it for review', async () => {
    test.setTimeout(90000);

    const title = `[e2e] Roadmap ${Date.now()}`;

    await page.goto(env.USER_URL + '/roadmap');
    await page.locator('header.content-header').waitFor();

    // 1) Mở modal tạo lộ trình và điền tiêu đề (giữ mặc định "riêng tư" để việc gửi kiểm duyệt
    //    cho kết quả xác định là tự động duyệt).
    await page.locator('button:has-text("Tạo lộ trình")').first().click();
    const roadmapModal = page.locator('section.roadmap-modal-sheet');
    await roadmapModal.waitFor();
    await roadmapModal.locator('input[type="text"]').fill(title);

    await takeScreenshot(page, 'user', 'roadmap-submit', 'step1-create-modal');
    await roadmapModal.locator('.modal-actions button.blue-solid').click();

    // 2) Lộ trình vừa tạo trở thành lộ trình đang xem; tiêu đề hiển thị ở phần nội dung chính.
    await expect(page.locator('.roadmap-tree-main h2')).toHaveText(title, { timeout: 20000 });
    // Trạng thái ban đầu phải là "Bản nháp" và phải có nút "Gửi kiểm duyệt".
    await expect(page.locator('.roadmap-tree-main .status-chip.is-draft')).toBeVisible();
    await expect(page.locator('button:has-text("Gửi kiểm duyệt")')).toBeVisible();

    // 3) Thêm một mục học kiểu "Chủ đề" (topic là dữ liệu dùng chung nên luôn có sẵn lựa chọn).
    await page.locator('.intro-actions button:has-text("Thêm mục học")').click();
    const itemModal = page.locator('section.roadmap-modal-sheet');
    await itemModal.waitFor();
    // Chờ select "Nội dung" (select thứ 2) render xong danh sách rồi chọn phương án thật đầu tiên.
    const contentSelect = itemModal.locator('.modal-body select').nth(1);
    await contentSelect.waitFor({ timeout: 15000 });
    // Chờ tới khi có ít nhất một phương án thật (option thứ 2) ngoài placeholder.
    await contentSelect.locator('option').nth(1).waitFor({ state: 'attached', timeout: 15000 });
    await selectFirstRealOption(contentSelect);

    await takeScreenshot(page, 'user', 'roadmap-submit', 'step2-add-item');
    await itemModal.locator('.modal-actions button:has-text("Thêm mục học")').click();

    // Mục học mới xuất hiện trong dòng thời gian của lộ trình.
    await expect(page.locator('.tree-timeline-track .timeline-node-row').first()).toBeVisible({ timeout: 20000 });

    // 4) Gửi kiểm duyệt. Sau khi gửi, lộ trình rời trạng thái bản nháp nên nút "Gửi kiểm duyệt"
    //    biến mất (chỉ hiển thị lại với bản nháp/bị từ chối).
    await page.locator('button:has-text("Gửi kiểm duyệt")').click();
    await expect(page.locator('button:has-text("Gửi kiểm duyệt")')).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator('.roadmap-tree-main .status-chip.is-draft')).toHaveCount(0);

    await takeScreenshot(page, 'user', 'roadmap-submit', 'step3-submitted');
  });
});
