import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Quản lý chủ đề (topic) tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Topic Management',
  featureSlug: 'topic-management',
  steps: [
    { route: '/admin/topics', assertBy: 'header.content-header' },
  ],
});
