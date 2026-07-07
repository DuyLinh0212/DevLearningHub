import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Dashboard của Moderator tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Moderator Dashboard',
  featureSlug: 'moderator-dashboard',
  steps: [
    { route: '/admin/moderator-dashboard', assertBy: 'header.content-header' },
  ],
});
