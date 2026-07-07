import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Ma trận vai trò & quyền hạn tải được và hiển thị đúng header
smokeTest({
  app: 'admin',
  describeName: 'Admin > Roles & Permission Matrix',
  featureSlug: 'roles-permission-matrix',
  steps: [
    { route: '/admin/roles', assertBy: 'header.content-header' },
  ],
});
