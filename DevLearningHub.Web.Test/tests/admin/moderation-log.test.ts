import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Lịch sử kiểm duyệt tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Moderation Log',
  featureSlug: 'moderation-log',
  steps: [
    { route: '/admin/moderation-log', assertBy: 'header.content-header' },
  ],
});
