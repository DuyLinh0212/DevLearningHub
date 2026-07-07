import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Quản lý lộ trình (roadmap) tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Roadmap Management',
  featureSlug: 'roadmap-management',
  steps: [
    { route: '/admin/roadmap', assertBy: 'header.content-header' },
  ],
});
