import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang tổng quan quản trị (/admin) tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Admin Dashboard',
  featureSlug: 'admin-dashboard',
  steps: [
    { route: '/admin', assertBy: 'header.content-header' },
  ],
});
