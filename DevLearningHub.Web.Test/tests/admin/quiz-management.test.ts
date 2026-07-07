import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Quản lý Quiz (admin) tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Quiz Management',
  featureSlug: 'quiz-management',
  steps: [
    { route: '/admin/quiz', assertBy: 'header.content-header' },
  ],
});
