import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Bảng xếp hạng tải được
smokeTest({
  app: 'user',
  describeName: 'User > Leaderboard',
  featureSlug: 'leaderboard',
  steps: [
    { route: '/leaderboard', assertBy: 'header.content-header' },
  ],
});
