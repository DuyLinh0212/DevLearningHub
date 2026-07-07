import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Nhật ký kiểm tra (Audit Logs) tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Audit Logs',
  featureSlug: 'audit-logs',
  steps: [
    { route: '/admin/audit-logs', assertBy: 'header.content-header' },
  ],
});
