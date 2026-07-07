import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Diễn đàn (forum) tải được
smokeTest({
  app: 'user',
  describeName: 'User > Forum',
  featureSlug: 'forum',
  steps: [
    { route: '/forum', assertBy: 'header.content-header' },
  ],
});
