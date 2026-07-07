import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Tạo quiz tải được
smokeTest({
  app: 'user',
  describeName: 'User > Quiz Create',
  featureSlug: 'quiz-create',
  steps: [
    { route: '/quiz-create', assertBy: 'header.content-header' },
  ],
});
