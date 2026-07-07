import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Quản lý tag tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Tag Management',
  featureSlug: 'tag-management',
  steps: [
    { route: '/admin/tags', assertBy: 'header.content-header' },
  ],
});
