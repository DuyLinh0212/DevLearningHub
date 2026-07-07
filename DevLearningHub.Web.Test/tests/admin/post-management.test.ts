import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Quản lý bài viết (admin) tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Post Management',
  featureSlug: 'post-management',
  steps: [
    { route: '/admin/posts', assertBy: 'header.content-header' },
  ],
});
