import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Cài đặt (user) tải được
smokeTest({
  app: 'user',
  describeName: 'User > Settings',
  featureSlug: 'settings',
  steps: [
    { route: '/settings', assertBy: 'header.content-header' },
  ],
});
