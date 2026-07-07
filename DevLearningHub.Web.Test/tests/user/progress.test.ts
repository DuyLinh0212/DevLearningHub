import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Tiến độ học tập tải được
smokeTest({
  app: 'user',
  describeName: 'User > Progress',
  featureSlug: 'progress',
  steps: [
    { route: '/dashboard/progress', assertBy: 'header.content-header' },
  ],
});
