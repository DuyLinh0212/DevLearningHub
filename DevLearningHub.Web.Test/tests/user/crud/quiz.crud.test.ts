import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../../support/screenshot';
import { waitForUrlContains } from '../../../support/wait';
import { selectFirstRealOption } from '../../../support/select';
import { loginAs } from '../../../support/login';
import env from '../../../config/env';
import * as e2eUser from '../../../config/e2eUser';

test.describe.serial('User > CRUD > Quiz Create', () => {
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

  // Tạo và xuất bản một bộ quiz gồm 1 câu hỏi, kiểm tra chuyển hướng về trang ngân hàng quiz
  test('creates a quiz set with one question and publishes it', async () => {
    test.setTimeout(90000);

    await page.goto(env.USER_URL + '/quiz-create');
    await page.locator('.creation-form-card input[type=text]').waitFor();

    const titleInput = page.locator('.creation-form-card input[type=text]');
    await titleInput.fill(`[e2e] Quiz Test ${Date.now()}`);

    const topicSelect = page.locator('.input-field-row select').first();
    await selectFirstRealOption(topicSelect);

    await takeScreenshot(page, 'user', 'quiz-crud', 'step1-filled');
    // Nút "Tiếp tục biên soạn" chỉ bật khi cả title và topicId đã có giá trị —
    // đợi nó enable để tránh click hụt do ngModel của select chưa kịp cập nhật.
    const nextStepBtn = page.locator('.btn-primary-action');
    await expect(nextStepBtn).toBeEnabled({ timeout: 10000 });
    await nextStepBtn.click();

    // Composer đã có sẵn 1 câu hỏi trống (Câu 1, activeQuestionIndex = 0) ngay khi vào
    // bước 2, nên KHÔNG bấm "Thêm câu hỏi mới" — bấm thêm sẽ tạo Câu 2 và chuyển active
    // sang index 1, khiến input radio đổi tên thành "correct-opt-1" trong khi bên dưới
    // vẫn tìm "correct-opt-0" -> treo mãi không click được.
    // .composer-main-form có 2 textarea (nội dung câu hỏi + giải thích đáp án) -> cần .first()
    await page.locator('.composer-main-form textarea').first().waitFor();
    await page.locator('.composer-main-form textarea').first().fill('What is 2 + 2?');

    const optionInputs = page.locator('.composer-option-row input[type=text]');
    const answers = ['3', '4', '5', '6'];
    const optionCount = await optionInputs.count();
    for (let i = 0; i < optionCount; i++) {
      await optionInputs.nth(i).fill(answers[i]);
    }
    // Cả 4 radio đều dùng chung name="correct-opt-<activeQuestionIndex>" (chỉ khác value),
    // nên locator theo [name=...] luôn khớp 4 phần tử -> cần scope theo .composer-option-row
    // đầu tiên để chọn đúng radio của đáp án A.
    // Input radio bị ẩn bằng opacity:0 + position:absolute, còn .radio-custom-dot (span)
    // nằm đè lên trên để hiển thị UI thay thế -> click thẳng vào input bị span chặn pointer
    // events (timeout). Click vào .correct-radio-label bao ngoài thay vì input.
    await page.locator('.composer-option-row').first().locator('.correct-radio-label').click();

    await takeScreenshot(page, 'user', 'quiz-crud', 'step2-question-filled');
    await page.locator('.btn-footer-complete').click();

    await page.locator('.btn-modal-confirm').waitFor();
    await page.locator('.btn-modal-confirm').click();

    await waitForUrlContains(page, '/quiz-bank', 20000);
    await takeScreenshot(page, 'user', 'quiz-crud', 'published-redirect-to-quiz-bank');
  });
});
