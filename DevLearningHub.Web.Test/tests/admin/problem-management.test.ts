import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Quản lý bài toán lập trình tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Problem Management',
  featureSlug: 'problem-management',
  steps: [
    { route: '/admin/problems', assertBy: 'header.content-header' },
  ],
});
