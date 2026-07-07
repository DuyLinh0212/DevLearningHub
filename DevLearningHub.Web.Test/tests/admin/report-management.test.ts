import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Quản lý báo cáo vi phạm tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Report Management',
  featureSlug: 'report-management',
  steps: [
    { route: '/admin/reports', assertBy: 'header.content-header' },
  ],
});
