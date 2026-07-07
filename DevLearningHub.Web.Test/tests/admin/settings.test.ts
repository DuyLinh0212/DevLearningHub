import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Cài đặt (admin) tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Settings',
  featureSlug: 'settings',
  steps: [
    { route: '/settings', assertBy: 'header.content-header' },
  ],
});
