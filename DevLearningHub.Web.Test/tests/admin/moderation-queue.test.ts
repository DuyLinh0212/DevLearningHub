import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Hàng đợi kiểm duyệt tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Moderation Queue',
  featureSlug: 'moderation-queue',
  steps: [
    { route: '/admin/moderation', assertBy: 'header.content-header' },
  ],
});
