import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Xem lộ trình (roadmap) tải được
smokeTest({
  app: 'user',
  describeName: 'User > Roadmap View',
  featureSlug: 'roadmap-view',
  steps: [
    { route: '/roadmap', assertBy: 'header.content-header' },
  ],
});
