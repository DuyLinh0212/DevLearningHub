import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang danh sách bài toán Code Playground tải được
smokeTest({
  app: 'user',
  describeName: 'User > Code Playground List',
  featureSlug: 'code-playground-list',
  steps: [
    { route: '/code', assertBy: 'header.content-header, .cp-tab' },
  ],
});
