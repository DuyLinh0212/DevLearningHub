import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Quản lý Moderator tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Moderator Management',
  featureSlug: 'moderator-management',
  steps: [
    { route: '/admin/moderators', assertBy: 'header.content-header' },
  ],
});
