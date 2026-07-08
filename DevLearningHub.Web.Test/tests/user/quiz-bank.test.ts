import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Ngân hàng quiz tải được
smokeTest({
  app: 'user',
  describeName: 'User > Quiz Bank',
  featureSlug: 'quiz-bank',
  steps: [
    { route: '/quiz-bank', assertBy: 'header.qb-hero' },
  ],
});
