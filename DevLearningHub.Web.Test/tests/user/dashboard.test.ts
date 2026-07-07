import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Dashboard của user tải được và hiển thị đúng header
smokeTest({
  app: 'user',
  describeName: 'User > Dashboard',
  featureSlug: 'dashboard',
  steps: [
    { route: '/dashboard', assertBy: 'header.content-header' },
  ],
});
