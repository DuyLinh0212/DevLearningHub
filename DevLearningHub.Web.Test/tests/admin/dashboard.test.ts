import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Dashboard chung của admin (/dashboard) tải được
smokeTest({
  app: 'admin',
  describeName: 'Admin > Dashboard',
  featureSlug: 'dashboard',
  steps: [
    { route: '/dashboard', assertBy: 'header.content-header' },
  ],
});
