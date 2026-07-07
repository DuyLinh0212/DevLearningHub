import { test, expect, Page } from '@playwright/test';
import { takeScreenshot } from '../../support/screenshot';
import { waitForUrlContains } from '../../support/wait';
import { selectFirstRealOption } from '../../support/select';
import { loginAsAdmin, loginAs } from '../../support/login';
import { approveItem } from '../../support/moderation';
import env from '../../config/env';
import * as e2eUser from '../../config/e2eUser';

test.describe.serial('Flow > User creates+submits quiz, Admin moderates', () => {
  let adminPage: Page;
  let userPage: Page;
  const quizTitle = `[e2e-flow] Quiz ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
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

  // User tạo và xuất bản một bộ quiz chờ duyệt
  test('user creates a quiz set with one question and publishes it', async () => {
    test.setTimeout(90000);

    await userPage.goto(env.USER_URL + '/quiz-create');
    await userPage.locator('.creation-form-card input[type=text]').waitFor();

    await userPage.locator('.creation-form-card input[type=text]').fill(quizTitle);
    const topicSelect = userPage.locator('.input-field-row select').first();
    await selectFirstRealOption(topicSelect);

    // Nút "Tiếp tục biên soạn" chỉ bật khi cả title và topicId đã có giá trị —
    // đợi nó enable để tránh click hụt do ngModel của select chưa kịp cập nhật.
    const nextStepBtn = userPage.locator('.btn-primary-action');
    await expect(nextStepBtn).toBeEnabled({ timeout: 10000 });
    await nextStepBtn.click();

    // Composer đã có sẵn 1 câu hỏi trống (Câu 1, activeQuestionIndex = 0) ngay khi vào
    // bước 2 (xem quiz-create.ts: questions = [createEmptyQuestion()], activeQuestionIndex = 0),
    // nên KHÔNG bấm "Thêm câu hỏi mới" ở đây — bấm thêm sẽ tạo Câu 2 và chuyển active
    // sang index 1, khiến input radio đổi tên thành "correct-opt-1" trong khi bên dưới
    // vẫn tìm "correct-opt-0" -> treo mãi không click được.
    await userPage.locator('.composer-main-form textarea').first().waitFor();
    await userPage.locator('.composer-main-form textarea').first().fill('What is 2 + 2?');

    const optionInputs = userPage.locator('.composer-option-row input[type=text]');
    const answers = ['3', '4', '5', '6'];
    const optionCount = await optionInputs.count();
    for (let i = 0; i < optionCount; i++) {
      await optionInputs.nth(i).fill(answers[i]);
    }
    // Mark option index 0 as the correct answer so the consume step below
    // knows which grid-option-item to click.
    // Cả 4 radio đều dùng chung name="correct-opt-<activeQuestionIndex>" (đúng bản chất
    // radio group — chỉ khác value), nên locator theo [name=...] luôn khớp 4 phần tử ->
    // cần scope theo .composer-option-row đầu tiên để chọn đúng radio của đáp án A.
    // Input radio bị ẩn bằng opacity:0 + position:absolute, còn .radio-custom-dot (span)
    // nằm đè lên trên để hiển thị UI thay thế -> click thẳng vào input bị span chặn
    // pointer events (timeout). Click vào .correct-radio-label bao ngoài thay vì input,
    // giống hành vi người dùng thật (click label sẽ tự kích hoạt input con).
    await userPage.locator('.composer-option-row').first().locator('.correct-radio-label').click();

    await takeScreenshot(userPage, 'flow', 'quiz-flow', 'create-question-filled');
    await userPage.locator('.btn-footer-complete').click();

    await userPage.locator('.btn-modal-confirm').waitFor();
    await userPage.locator('.btn-modal-confirm').click();

    await waitForUrlContains(userPage, '/quiz-bank', 20000);
    await takeScreenshot(userPage, 'flow', 'quiz-flow', 'published-pending');
  });

  // Admin duyệt quiz trong hàng đợi kiểm duyệt
  test('admin approves the quiz set in the moderation queue', async () => {
    test.setTimeout(90000);

    await approveItem(adminPage, env.ADMIN_URL, 'Bộ quiz', quizTitle);
    await takeScreenshot(adminPage, 'flow', 'quiz-flow', 'after-approve');
  });

  // User làm quiz đã duyệt, nộp bài và kiểm tra kết quả
  test('user takes and submits the quiz, then views the result', async () => {
    test.setTimeout(90000);

    await userPage.goto(env.USER_URL + '/quiz-bank');
    const quizLink = userPage.locator(`//a[contains(@class,'problem-link')][contains(text(),"${quizTitle}")]`);
    await quizLink.waitFor();
    await quizLink.click();

    await waitForUrlContains(userPage, '/quiz/', 15000);
    // class "btn-practice" bị dùng lại cho nhiều nút khác nhau trên trang này (Sao chép
    // bộ đề, Chỉnh sửa, Xoá đều mang class "btn-practice" dù không liên quan luyện tập)
    // -> cần scope theo .practice-card (khu vực "Chế độ Luyện tập") để chọn đúng nút.
    await userPage.locator('.practice-card button.btn-practice').waitFor();
    await userPage.locator('.practice-card button.btn-practice').click();

    await waitForUrlContains(userPage, '/quiz-play/', 15000);
    await userPage.locator('.question-display-text').waitFor();

    const options = userPage.locator('label.grid-option-item');
    await options.first().click();

    await takeScreenshot(userPage, 'flow', 'quiz-flow', 'answered-question');
    await userPage.locator('button.btn-final-submit').click();

    await userPage.locator('.modal-box .btn-modal-confirm').waitFor();
    await userPage.locator('.modal-box .btn-modal-confirm').click();

    await waitForUrlContains(userPage, '/quiz-result/', 15000);
    await userPage.locator('.donut-center-mask span').waitFor();
    await takeScreenshot(userPage, 'flow', 'quiz-flow', 'result');

    const reviewCardCount = await userPage.locator('.review-card-item').count();
    if (reviewCardCount > 0) {
      await expect(userPage.locator('.row-status-badge.success').first()).toBeVisible();
    }
  });
});
